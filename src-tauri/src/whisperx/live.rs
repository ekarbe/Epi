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
use std::io::{BufRead, BufReader};
use std::thread;
use crate::utils::validate_model_name;
use crate::whisperx::env::{get_env_path, get_python_path};

/// A thread-safe wrapper containing the active live transcription subprocess child.
/// Spun up to handle real-time audio feeds from the microphone.
pub struct LiveTranscriptionState(pub std::sync::Mutex<Option<std::process::Child>>);

#[derive(Debug, PartialEq)]
pub enum LiveTranscriptionEvent {
    Update(String),
    Status(String),
}

pub fn parse_stdout_line(line: &str) -> LiveTranscriptionEvent {
    if line.starts_with("[TEXT] ") {
        let text = line.trim_start_matches("[TEXT] ").trim();
        LiveTranscriptionEvent::Update(text.to_string())
    } else {
        LiveTranscriptionEvent::Status(line.to_string())
    }
}

/// Spawns the live transcription python sub-process to start recording and transcribing system audio in real-time.
///
/// # Arguments
/// * `app_handle` - The Tauri application handle.
/// * `window` - The Tauri window handle to emit transcription updates to.
/// * `model` - The model to use.
/// * `language` - Target language.
/// * `device_name` - Optional specific input device name to record from.
///
/// # Returns
/// * `Result<(), String>` - Ok(()) on success, or an error description.
///
/// # Side Effects
/// * Kills any active live transcription sub-process before spawning a new one.
/// * Spawns `live_transcribe.py` in the venv and registers it in `LiveTranscriptionState`.
/// * Spawns reader threads for stdout and stderr to emit `live-transcription-update` and `live-transcription-status` events.
pub fn build_whisperx_command(
    python_bin: &std::path::Path,
    script_path: &std::path::Path,
    model: &str,
    language: &str,
) -> Command {
    let mut cmd = Command::new(python_bin);
    cmd.arg("-u"); // Unbuffered stdout/stderr
    cmd.arg(script_path);
    cmd.arg("--model").arg(model);
    cmd.arg("--language").arg(language);
    
    cmd.stdin(std::process::Stdio::piped());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    cmd
}

#[tauri::command]
pub fn start_live_transcription(
    app_handle: AppHandle,
    window: Window,
    model: String,
    language: String,
) -> Result<(), String> {
    validate_model_name(&model)?;
    let state = app_handle.state::<LiveTranscriptionState>();
    let mut guard = state.0.lock().unwrap_or_else(|e| e.into_inner());
    
    if let Some(mut old_child) = guard.take() {
        let _ = old_child.kill();
        let _ = old_child.wait();
    }

    let env_path = get_env_path(&app_handle)?;
    let python_bin = get_python_path(&env_path);
    
    if !python_bin.exists() {
        return Err("WhisperX is not installed locally.".into());
    }

    let resource_dir = app_handle.path().resource_dir().map_err(|e| e.to_string())?;
    let script_path = resource_dir.join("src").join("live_transcribe.py");

    let mut cmd = build_whisperx_command(&python_bin, &script_path, &model, &language);

    let mut child = cmd.spawn().map_err(|e| format!("Failed to start live transcription: {}", e))?;

    let mut stdin = child.stdin.take().ok_or("Failed to capture stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let audio_state = app_handle.state::<crate::audio::recording::AudioState>();
    let mut rx = audio_state.audio_tx.subscribe();

    // Spawn a tokio task to pump audio from broadcast channel to python stdin
    tokio::spawn(async move {
        use std::io::Write;
        while let Ok(chunk) = rx.recv().await {
            if stdin.write_all(&chunk).is_err() {
                break;
            }
        }
    });

    let w1 = window.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().map_while(Result::ok) {
            match parse_stdout_line(&line) {
                LiveTranscriptionEvent::Update(text) => {
                    let _ = w1.emit("live-transcription-update", text);
                }
                LiveTranscriptionEvent::Status(status) => {
                    let _ = w1.emit("live-transcription-status", status);
                }
            }
        }
        // Emit termination event when stdout stream hits EOF (process ends or crashes)
        let _ = w1.emit("live-transcription-terminated", "Process ended or connection closed");
    });

    let w2 = window.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().map_while(Result::ok) {
            println!("[Live Transcribe Error/Log] {}", line);
            let _ = w2.emit("live-transcription-status", line);
        }
    });

    *guard = Some(child);

    Ok(())
}

/// Stops the running live transcription sub-process.
///
/// # Arguments
/// * `app_handle` - The Tauri application handle.
///
/// # Returns
/// * `Result<(), String>` - Ok(()) on success.
///
/// # Side Effects
/// * Kills the process and takes it out of the active state.
#[tauri::command]
pub fn stop_live_transcription(app_handle: AppHandle) -> Result<(), String> {
    let state = app_handle.state::<LiveTranscriptionState>();
    let mut guard = state.0.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_stdout_line_text() {
        let line = "[TEXT] Hello world!";
        let event = parse_stdout_line(line);
        assert_eq!(event, LiveTranscriptionEvent::Update("Hello world!".to_string()));
    }

    #[test]
    fn test_parse_stdout_line_text_with_spaces() {
        let line = "[TEXT]    Trailing and leading spaces   ";
        let event = parse_stdout_line(line);
        assert_eq!(event, LiveTranscriptionEvent::Update("Trailing and leading spaces".to_string()));
    }

    #[test]
    fn test_parse_stdout_line_status() {
        let line = "Loading model...";
        let event = parse_stdout_line(line);
        assert_eq!(event, LiveTranscriptionEvent::Status("Loading model...".to_string()));
    }

    #[test]
    fn test_parse_stdout_line_status_brackets() {
        let line = "[INFO] Loading model...";
        let event = parse_stdout_line(line);
        assert_eq!(event, LiveTranscriptionEvent::Status("[INFO] Loading model...".to_string()));
    }
    
    #[test]
    fn test_parse_stdout_line_empty() {
        let line = "";
        let event = parse_stdout_line(line);
        assert_eq!(event, LiveTranscriptionEvent::Status("".to_string()));
    }

    #[test]
    fn test_parse_stdout_line_almost_text() {
        // Missing space after [TEXT]
        let line = "[TEXT]Hello world!";
        let event = parse_stdout_line(line);
        assert_eq!(event, LiveTranscriptionEvent::Status("[TEXT]Hello world!".to_string()));
    }

    #[test]
    fn test_build_whisperx_command() {
        let python_bin = std::path::Path::new("/fake/python");
        let script_path = std::path::Path::new("/fake/script.py");
        let cmd = build_whisperx_command(python_bin, script_path, "base.en", "en");
        
        let program = cmd.get_program().to_string_lossy();
        assert_eq!(program, "/fake/python");
        
        let args: Vec<String> = cmd.get_args().map(|s| s.to_string_lossy().to_string()).collect();
        assert_eq!(args[0], "-u");
        assert_eq!(args[1], "/fake/script.py");
        assert_eq!(args[2], "--model");
        assert_eq!(args[3], "base.en");
        assert_eq!(args[4], "--language");
        assert_eq!(args[5], "en");
    }
}
