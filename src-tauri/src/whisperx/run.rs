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

use tauri::{AppHandle, Manager};
use std::process::Command;
use crate::utils::{validate_model_name, validate_path_in_library};
use crate::whisperx::env::{get_env_path, get_binary_path};

/// Output result payload returned from running the WhisperX tool on a file.
#[derive(serde::Serialize)]
pub struct WhisperXOutput {
    /// Indicates if the process exited with a success code.
    pub success: bool,
    /// The captured standard output text stream.
    pub stdout: String,
    /// The captured standard error text stream.
    pub stderr: String,
    /// The optional process exit code.
    pub code: Option<i32>,
}

/// Executes WhisperX in the virtual environment to transcribe an audio file.
///
/// # Arguments
/// * `app_handle` - The Tauri application handle.
/// * `audio_path` - Path to the input WAV audio file.
/// * `output_dir` - Directory path where transcription outputs are written.
/// * `model` - Whisper model type (e.g. "base", "small").
/// * `language` - Target ISO-639-1 language code or "auto".
/// * `initial_prompt` - Prompt to guide spelling/formatting.
/// * `temperature` - Temperature parameter for transcription generation.
/// * `device` - Device to run on (e.g., "cpu", "cuda").
/// * `compute_type` - CTranslate2 compute quantization type (e.g., "int8").
/// * `batch_size` - Size of process batches.
/// * `diarize` - Enable speaker diarization.
/// * `hf_token` - Hugging Face access token for pyannote.
/// * `min_speakers` - Minimum number of speaker categories.
/// * `max_speakers` - Maximum number of speaker categories.
/// * `no_align` - Disable phoneme-level word alignment.
///
/// # Returns
/// * `Result<WhisperXOutput, String>` - An object representing execution results.
///
/// # Side Effects
/// * Spawns a python process to run whisperx.
/// * Writes JSON output files to the `output_dir` directory.
#[allow(clippy::too_many_arguments)]
pub fn build_whisperx_run_command(
    bin_path: &std::path::Path,
    app_bin_dir: Option<std::path::PathBuf>,
    audio_path: &str,
    output_dir: &str,
    model: &str,
    language: &str,
    initial_prompt: &str,
    temperature: f32,
    device: &str,
    compute_type: &str,
    batch_size: i32,
    diarize: bool,
    hf_token: &str,
    min_speakers: i32,
    max_speakers: i32,
    no_align: bool,
) -> Command {
    let mut cmd = Command::new(bin_path);

    if let Some(app_bin_dir) = app_bin_dir {
        if let Some(path) = std::env::var_os("PATH") {
            let mut paths = std::env::split_paths(&path).collect::<Vec<_>>();
            paths.insert(0, app_bin_dir);
            if let Ok(new_path) = std::env::join_paths(paths) {
                cmd.env("PATH", new_path);
            }
        } else {
            cmd.env("PATH", app_bin_dir);
        }
    }
    
    cmd.arg(audio_path);
    cmd.arg("--model").arg(model);
    
    if language != "auto" {
        cmd.arg("--language").arg(language);
    }
    
    if !initial_prompt.is_empty() {
        cmd.arg("--initial_prompt").arg(initial_prompt);
    }
    
    if temperature > 0.0 {
        cmd.arg("--temperature").arg(temperature.to_string());
    }

    if !device.is_empty() {
        cmd.arg("--device").arg(device);
    }

    if !compute_type.is_empty() {
        cmd.arg("--compute_type").arg(compute_type);
    }

    cmd.arg("--batch_size").arg(batch_size.to_string());

    if diarize {
        cmd.arg("--diarize");
        if !hf_token.is_empty() {
            cmd.arg("--hf_token").arg(hf_token);
        }
        cmd.arg("--min_speakers").arg(min_speakers.to_string());
        cmd.arg("--max_speakers").arg(max_speakers.to_string());
    }

    if no_align {
        cmd.arg("--no_align");
    }

    cmd.arg("--output_format").arg("json");
    cmd.arg("--output_dir").arg(output_dir);
    
    cmd
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn run_whisperx(
    app_handle: AppHandle, 
    audio_path: String, 
    output_dir: String,
    model: String,
    language: String,
    initial_prompt: String,
    temperature: f32,
    device: String,
    compute_type: String,
    batch_size: i32,
    diarize: bool,
    hf_token: String,
    min_speakers: i32,
    max_speakers: i32,
    no_align: bool,
    log_path: Option<String>
) -> Result<WhisperXOutput, String> {
    validate_model_name(&model)?;
    let audio_path = validate_path_in_library(&audio_path)?.to_string_lossy().to_string();
    let output_dir = validate_path_in_library(&output_dir)?.to_string_lossy().to_string();

    let env_path = get_env_path(&app_handle)?;
    let bin_path = get_binary_path(&env_path);

    if !bin_path.exists() {
        return Err("WhisperX is not installed locally.".into());
    }

    let mut app_bin_dir_opt = None;
    if let Ok(mut app_bin_dir) = app_handle.path().app_data_dir() {
        app_bin_dir.push("bin");
        app_bin_dir_opt = Some(app_bin_dir);
    }

    let cmd = build_whisperx_run_command(
        &bin_path,
        app_bin_dir_opt,
        &audio_path,
        &output_dir,
        &model,
        &language,
        &initial_prompt,
        temperature,
        &device,
        &compute_type,
        batch_size,
        diarize,
        &hf_token,
        min_speakers,
        max_speakers,
        no_align,
    );

    let app_handle_clone = app_handle.clone();
    let output = tokio::task::spawn_blocking(move || {
        let registry = app_handle_clone.state::<crate::process_manager::ProcessRegistry>();
        crate::process_manager::run_registered(&registry, cmd)
    })
    .await
    .map_err(|e| format!("Spawn blocking failed: {}", e))??;

    if let Some(path) = log_path {
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
            use std::io::Write;
            let _ = writeln!(f, "--- WHISPERX STDOUT ---");
            let _ = f.write_all(&output.stdout);
            let _ = writeln!(f, "--- WHISPERX STDERR ---");
            let _ = f.write_all(&output.stderr);
        }
    }

    Ok(WhisperXOutput {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        code: output.status.code(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_whisperx_run_command_basic() {
        let bin_path = std::path::Path::new("/bin/whisperx");
        let cmd = build_whisperx_run_command(
            bin_path,
            None,
            "audio.wav",
            "/out",
            "base",
            "en",
            "",
            0.0,
            "cpu",
            "int8",
            16,
            false,
            "",
            0,
            0,
            true,
        );

        let args: Vec<String> = cmd.get_args().map(|s| s.to_string_lossy().to_string()).collect();
        assert!(args.contains(&"audio.wav".to_string()));
        assert!(args.contains(&"--model".to_string()));
        assert!(args.contains(&"base".to_string()));
        assert!(args.contains(&"--language".to_string()));
        assert!(args.contains(&"en".to_string()));
        assert!(args.contains(&"--no_align".to_string()));
        assert!(args.contains(&"--output_dir".to_string()));
        assert!(args.contains(&"/out".to_string()));
    }

    #[test]
    fn test_build_whisperx_run_command_diarize() {
        let bin_path = std::path::Path::new("/bin/whisperx");
        let cmd = build_whisperx_run_command(
            bin_path,
            None,
            "audio.wav",
            "/out",
            "base",
            "auto", // auto language should not emit --language flag
            "",
            0.5,
            "",
            "",
            8,
            true,
            "hf_token_123",
            2,
            5,
            false,
        );

        let args: Vec<String> = cmd.get_args().map(|s| s.to_string_lossy().to_string()).collect();
        assert!(!args.contains(&"--language".to_string()));
        assert!(args.contains(&"--temperature".to_string()));
        assert!(args.contains(&"0.5".to_string()));
        assert!(args.contains(&"--diarize".to_string()));
        assert!(args.contains(&"--hf_token".to_string()));
        assert!(args.contains(&"hf_token_123".to_string()));
        assert!(args.contains(&"--min_speakers".to_string()));
        assert!(args.contains(&"2".to_string()));
        assert!(args.contains(&"--max_speakers".to_string()));
        assert!(args.contains(&"5".to_string()));
        assert!(!args.contains(&"--no_align".to_string()));
    }
}
