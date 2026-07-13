// Epi - Local-first Meeting Intelligence
// Copyright (C) 2026  Eike Christian Karbe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

use tauri::{AppHandle, Window, Manager, Emitter};
use std::process::Command;
use std::io::{BufRead, BufReader};
use std::thread;
use crate::whisperx::env::{get_env_path, get_binary_path, get_python_path};

pub fn build_python_patch_script() -> &'static str {
    r#"
import os
import whisperx

asr_file = os.path.join(os.path.dirname(whisperx.__file__), 'asr.py')
with open(asr_file, 'r', encoding='utf-8') as f:
    content = f.read()

target = "total_segments = len(vad_segments)"
replacement = """total_segments = len(vad_segments)
        if total_segments == 0:
            return {"segments": [], "language": language}"""

if target in content and "return {\"segments\": []" not in content:
    content = content.replace(target, replacement)
    with open(asr_file, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully patched whisperx/asr.py")
else:
    print("Patch already applied or target not found.")
"#
}

/// Represents the local installation status and configuration of the WhisperX engine.
#[derive(serde::Serialize, Clone)]
pub struct WhisperXStatus {
    /// Indicates whether WhisperX virtual environment and dependencies are present and functional.
    pub installed: bool,
    /// The absolute system path to the WhisperX executable, or None if not installed.
    pub binary_path: Option<String>,
}

#[tauri::command]
/// Verifies the WhisperX engine status by checking the binary path and testing a virtual environment import of whisperx.
///
/// # Returns
/// * `Result<WhisperXStatus, String>` - An object representing the installation state and binary location.
///
/// # Side Effects
/// * Spawns a lightweight Python sub-process to test the library import capability.
pub async fn check_whisperx_status(app_handle: AppHandle) -> Result<WhisperXStatus, String> {
    let env_path = get_env_path(&app_handle)?;
    let bin_path = get_binary_path(&env_path);
    let python_bin = get_python_path(&env_path);
    
    let is_functional = if bin_path.exists() && python_bin.exists() {
        let mut cmd = tokio::process::Command::new(&python_bin);
        #[cfg(target_os = "windows")]
        {
            cmd.creation_flags(0x08000000);
        }
        cmd.args(["-c", "import whisperx"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null());
        
        match cmd.spawn() {
            Ok(mut child) => {
                let status = tokio::time::timeout(
                    std::time::Duration::from_secs(5),
                    child.wait()
                ).await;
                match status {
                    Ok(Ok(s)) => s.success(),
                    _ => {
                        let _ = child.kill().await;
                        false
                    }
                }
            }
            Err(_) => false,
        }
    } else {
        false
    };
    
    if is_functional {
        Ok(WhisperXStatus {
            installed: true,
            binary_path: Some(bin_path.to_string_lossy().to_string()),
        })
    } else {
        Ok(WhisperXStatus {
            installed: false,
            binary_path: None,
        })
    }
}

#[tauri::command]
pub async fn uninstall_whisperx(app_handle: AppHandle) -> Result<(), String> {
    if let Ok(env_path) = get_env_path(&app_handle) {
        if env_path.exists() {
            std::fs::remove_dir_all(&env_path).map_err(|e| e.to_string())?;
        }
    }
    
    if let Ok(portable_path) = crate::whisperx::python::get_python_standalone_dir(&app_handle) {
        if portable_path.exists() {
            std::fs::remove_dir_all(&portable_path).map_err(|e| e.to_string())?;
        }
    }
    
    Ok(())
}

#[tauri::command]
pub async fn check_cuda_support() -> Result<bool, String> {
    // Silently execute nvidia-smi. If it succeeds, an NVIDIA GPU is present.
    let mut cmd = tokio::process::Command::new("nvidia-smi");
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000);
    }
    let output = cmd
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .output()
        .await;
        
    match output {
        Ok(out) => Ok(out.status.success()),
        Err(_) => Ok(false),
    }
}

/// Sets up and installs WhisperX locally by creating an isolated virtual environment,
/// upgrading pip, installing PyTorch and WhisperX dependencies, applying a compatibility patch,
/// and pre-downloading the base models.
///
/// # Arguments
/// * `app_handle` - The Tauri application handle.
/// * `window` - The Tauri window handle used to emit logs to the frontend.
///
/// # Returns
/// * `Result<(), String>` - Ok(()) on success, or an error description.
///
/// # Side Effects
/// * Spawns multiple python and pip sub-processes.
/// * Creates folders in the app data directory (`whisperx_env`).
/// * Downloads ~2GB of packages and models.
/// * Emits `whisperx-install-log` events to the frontend.
#[tauri::command]
pub async fn install_whisperx(app_handle: AppHandle, window: Window, cpu_only: bool) -> Result<(), String> {
    if crate::whisperx::env::resolve_system_python().is_none() {
        let portable_path = crate::whisperx::python::get_portable_python_path(&app_handle).unwrap_or_default();
        if !portable_path.exists() {
            let _ = window.emit("whisperx-install-log", "System Python not found. Installing portable Python...");
            crate::whisperx::python::install_portable_python(&app_handle, &window).await?;
        }
    }

    tokio::task::spawn_blocking(move || {
        let env_path = get_env_path(&app_handle)?;
        
        // Ensure app data dir exists
        if let Some(parent) = env_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let emit_log = |msg: &str| {
            let _ = window.emit("whisperx-install-log", msg.to_string());
        };

        let result = (|| -> Result<(), String> {
            emit_log("Starting local WhisperX installation...");
            emit_log("Creating isolated Python virtual environment...");

            let registry = app_handle.state::<crate::process_manager::ProcessRegistry>();

            // 1. Create venv
            let python_cmd = crate::whisperx::env::get_active_python_path(&app_handle)?;
            let mut venv_cmd = Command::new(&python_cmd);
            venv_cmd.arg("-m").arg("venv").arg(&env_path);
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                venv_cmd.creation_flags(0x08000000);
            }
            
            let venv_output = crate::process_manager::run_registered(&registry, venv_cmd)?;
            if !venv_output.status.success() {
                return Err("Failed to create virtual environment. Ensure python/python3 is installed and in your PATH.".to_string());
            }

            emit_log("Virtual environment created successfully.");
            // Helper to run pip and stream output
            let run_pip = |args: Vec<&str>, window: &Window, registry: &crate::process_manager::ProcessRegistry| -> Result<(), String> {
                let python_path = crate::whisperx::env::get_python_path(&env_path);
                let mut cmd = Command::new(&python_path);
                cmd.arg("-m").arg("pip");
                cmd.args(&args);
                cmd.stdout(std::process::Stdio::piped());
                cmd.stderr(std::process::Stdio::piped());
                #[cfg(target_os = "windows")]
                {
                    use std::os::windows::process::CommandExt;
                    cmd.creation_flags(0x08000000);
                }

                let mut child = cmd.spawn().map_err(|e| e.to_string())?;
                let pid = child.id();

                let stdout = child.stdout.take().ok_or_else(|| "Failed to capture pip stdout".to_string())?;
                let stderr = child.stderr.take().ok_or_else(|| "Failed to capture pip stderr".to_string())?;

                {
                    let mut lock = registry.processes.lock().unwrap_or_else(|e| e.into_inner());
                    lock.insert(pid, child);
                }

                let w1 = window.clone();
                let stdout_handle = thread::spawn(move || {
                    let reader = BufReader::new(stdout);
                    for l in reader.lines().map_while(Result::ok) {
                        let _ = w1.emit("whisperx-install-log", l);
                    }
                });

                let w2 = window.clone();
                let stderr_handle = thread::spawn(move || {
                    let reader = BufReader::new(stderr);
                    for l in reader.lines().map_while(Result::ok) {
                        let _ = w2.emit("whisperx-install-log", format!("ERR: {}", l));
                    }
                });

                let _ = stdout_handle.join();
                let _ = stderr_handle.join();

                let child = {
                    let mut lock = registry.processes.lock().unwrap_or_else(|e| e.into_inner());
                    lock.remove(&pid)
                };

                if let Some(mut c) = child {
                    let status = c.wait().map_err(|e| e.to_string())?;
                    if !status.success() {
                        return Err(format!("pip command failed: {:?}", args));
                    }
                    Ok(())
                } else {
                    Err("Process was terminated during exit cleanup".into())
                }
            };

            emit_log("Upgrading pip...");
            run_pip(vec!["install", "--upgrade", "pip"], &window, &registry)?;

            // 2. Install PyTorch
            if cpu_only {
                emit_log("Installing lightweight CPU-only PyTorch...");
                #[cfg(not(target_os = "macos"))]
                run_pip(vec!["install", "torch", "torchvision", "torchaudio", "--index-url", "https://download.pytorch.org/whl/cpu"], &window, &registry)?;
                
                #[cfg(target_os = "macos")]
                run_pip(vec!["install", "torch", "torchvision", "torchaudio"], &window, &registry)?;
            } else {
                emit_log("Installing PyTorch with CUDA support (this will require ~5.6GB of disk space)...");
                run_pip(vec!["install", "torch", "torchvision", "torchaudio"], &window, &registry)?;
            }

            // 3. Install WhisperX dependencies explicitly (to avoid whisperX's strict torch~=2.8.0 pin which fails on Python 3.14)
            emit_log("Installing WhisperX dependencies...");
            run_pip(vec![
                "install",
                "ctranslate2", "faster-whisper", "nltk", "omegaconf", "pandas", "pyannote-audio", "huggingface-hub", "transformers", "sounddevice"
            ], &window, &registry)?;

            // 4. Install WhisperX without strict dependency checking
            emit_log("Installing WhisperX from github repository...");
            run_pip(vec![
                "install", "--no-deps", "--ignore-requires-python",
                "git+https://github.com/m-bain/whisperx.git"
            ], &window, &registry)?;

            // 5. Patch whisperx/asr.py to handle empty vad_segments
            emit_log("Patching whisperx to fix transformers compatibility...");
            let python_patch_script = build_python_patch_script();
            let python_bin = get_python_path(&env_path);
            let mut patch_cmd = Command::new(&python_bin);
            patch_cmd.arg("-c").arg(python_patch_script);
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                patch_cmd.creation_flags(0x08000000);
            }
            let patch_output = crate::process_manager::run_registered(&registry, patch_cmd)?;
            
            if !patch_output.status.success() {
                return Err("Failed to patch whisperx".into());
            }

            // 6. Pre-download default models
            emit_log("Pre-downloading tiny model (this may take a moment)...");
            let predownload_script = "import whisperx; whisperx.load_model('tiny', device='cpu', compute_type='int8')";
            let mut download_cmd = Command::new(&python_bin);
            download_cmd.arg("-c").arg(predownload_script);
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                download_cmd.creation_flags(0x08000000);
            }
            let download_output = crate::process_manager::run_registered(&registry, download_cmd)?;

            if !download_output.status.success() {
                emit_log("Warning: Pre-downloading models failed, they will be downloaded on first use.");
            }

            emit_log("WhisperX installation completed successfully!");
            Ok(())
        })();

        if let Err(e) = &result {
            emit_log(&format!("Installation failed: {}", e));
            emit_log("Cleaning up incomplete environment...");
            let _ = std::fs::remove_dir_all(&env_path);
        }

        result
    })
    .await
    .map_err(|e| format!("Spawn blocking failed: {}", e))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_python_patch_script() {
        let script = build_python_patch_script();
        assert!(script.contains("import whisperx"));
        assert!(script.contains("total_segments = len(vad_segments)"));
        assert!(script.contains("return {\"segments\": [], \"language\": language}"));
    }
}
