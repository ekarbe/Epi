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

use tauri::Emitter;
use tauri::{AppHandle, Window, Manager};
use std::process::Command;
use crate::utils::validate_model_name;
use crate::whisperx::env::{get_hf_cache_dir, get_env_path, get_python_path};

pub fn extract_model_from_dir_name(dir_name: &str) -> Option<String> {
    if dir_name.starts_with("models--Systran--faster-whisper-") {
        Some(dir_name.replace("models--Systran--faster-whisper-", ""))
    } else {
        None
    }
}

pub fn build_download_script(model: &str) -> String {
    format!(
        "import whisperx; whisperx.load_model('{}', device='cpu', compute_type='int8')",
        model
    )
}

/// Scans the HuggingFace cache directory for downloaded faster-whisper models.
///
/// # Returns
/// * `Result<Vec<String>, String>` - A list of model names found cached locally.
#[tauri::command]
pub fn get_downloaded_models() -> Result<Vec<String>, String> {
    let cache_dir = get_hf_cache_dir()?;

    if !cache_dir.exists() {
        return Ok(vec![]);
    }

    let mut models = Vec::new();
    if let Ok(entries) = std::fs::read_dir(cache_dir) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if let Some(model_name) = extract_model_from_dir_name(&name) {
                        models.push(model_name);
                    }
                }
            }
        }
    }
    
    Ok(models)
}

/// Downloads and caches a specific faster-whisper model.
///
/// # Arguments
/// * `app_handle` - The Tauri application handle.
/// * `window` - The Tauri window handle used to emit logs.
/// * `model` - The model name string to download.
///
/// # Returns
/// * `Result<(), String>` - Ok(()) on success, or an error description.
///
/// # Side Effects
/// * Spawns a python script that loads the model, causing it to download.
/// * Emits `whisperx-model-log` events to the frontend.
#[tauri::command]
pub async fn download_model(app_handle: AppHandle, window: Window, model: String) -> Result<(), String> {
    validate_model_name(&model)?;
    let env_path = get_env_path(&app_handle)?;
    
    let python_bin = get_python_path(&env_path);
    if !python_bin.exists() {
        return Err("WhisperX environment not found. Please install the engine first.".into());
    }

    let emit_log = |msg: &str| {
        let _ = window.emit("whisperx-model-log", msg.to_string());
    };

    emit_log(&format!("Downloading model '{}' (this may take a few minutes)...", model));
    
    let download_script = build_download_script(&model);

    let mut cmd = Command::new(&python_bin);
    cmd.arg("-c").arg(&download_script);
    
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    
    let app_handle_clone = app_handle.clone();
    let output = tokio::task::spawn_blocking(move || {
        let registry = app_handle_clone.state::<crate::process_manager::ProcessRegistry>();
        crate::process_manager::run_registered(&registry, cmd)
    })
    .await
    .map_err(|e| format!("Spawn blocking failed: {}", e))??;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        emit_log(&format!("Error: {}", err));
        return Err(format!("Failed to download model '{}'", model));
    }

    emit_log(&format!("Successfully downloaded and cached model '{}'", model));
    Ok(())
}

/// Deletes a cached faster-whisper model from the HuggingFace local hub cache.
///
/// # Arguments
/// * `model` - The model name string to delete.
///
/// # Returns
/// * `Result<(), String>` - Ok(()) on success, or an error description.
///
/// # Side Effects
/// * Removes directories in `~/.cache/huggingface/hub/`.
#[tauri::command]
pub fn delete_model(model: String) -> Result<(), String> {
    validate_model_name(&model)?;
    let cache_dir = get_hf_cache_dir()?.join(format!("models--Systran--faster-whisper-{}", model));

    if cache_dir.exists() {
        std::fs::remove_dir_all(cache_dir).map_err(|e| format!("Failed to delete model cache: {}", e))?;
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_model_from_dir_name() {
        assert_eq!(extract_model_from_dir_name("models--Systran--faster-whisper-base.en").unwrap(), "base.en");
        assert_eq!(extract_model_from_dir_name("models--Systran--faster-whisper-large-v3").unwrap(), "large-v3");
        assert!(extract_model_from_dir_name("some-other-dir").is_none());
        assert!(extract_model_from_dir_name("models--SomethingElse").is_none());
    }

    #[test]
    fn test_build_download_script() {
        let script = build_download_script("base");
        assert!(script.contains("'base'"));
        assert!(script.contains("whisperx.load_model"));
    }
}
