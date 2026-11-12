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

//! Epi Core Application Library
//!
//! Handles Tauri plugin initialization, native command dispatch, state management,
//! and clean-up of resources (such as active recorder and transcription sub-processes)
//! upon application exit.

mod audio;
mod whisperx;
mod cloud_transcription;
mod cloud_llm;
mod local_llm;
pub mod process_manager;
mod utils;
pub mod ffmpeg;

/// Calculates the total disk space (in bytes) occupied by files within the "Epi Library" directory.
///
/// This function runs asynchronously on a blocking thread pool to avoid blocking the main event thread.
///
/// # Returns
/// * `Result<u64, String>` - The total size in bytes on success, or an error description.
///
/// # Side Effects
/// * Recursively walks the "Epi Library" directory in the user's document folder.
#[tauri::command]
async fn get_library_size() -> Result<u64, String> {
    tokio::task::spawn_blocking(|| {
        let mut total_size = 0;
        if let Some(docs) = dirs::document_dir() {
            let lib_dir = docs.join("Epi Library");
            if lib_dir.exists() {
                let walker = walkdir::WalkDir::new(lib_dir).into_iter();
                for entry in walker.filter_map(|e| e.ok()) {
                    if let Ok(metadata) = entry.metadata() {
                        if metadata.is_file() {
                            total_size += metadata.len();
                        }
                    }
                }
            }
        }
        Ok(total_size)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(serde::Serialize)]
pub struct StorageBreakdown {
    pub recordings: u64,
    pub transcriptions: u64,
    pub summaries: u64,
    pub logs: u64,
    pub total: u64,
}

#[tauri::command]
async fn get_storage_breakdown() -> Result<StorageBreakdown, String> {
    tokio::task::spawn_blocking(|| {
        let mut breakdown = StorageBreakdown { recordings: 0, transcriptions: 0, summaries: 0, logs: 0, total: 0 };
        if let Some(docs) = dirs::document_dir() {
            let lib_dir = docs.join("Epi Library");
            if lib_dir.exists() {
                let get_dir_size = |subdir: &str| -> u64 {
                    let mut size = 0;
                    if let Ok(entries) = std::fs::read_dir(lib_dir.join(subdir)) {
                        for entry in entries.flatten() {
                            if let Ok(metadata) = entry.metadata() {
                                if metadata.is_file() {
                                    size += metadata.len();
                                }
                            }
                        }
                    }
                    size
                };
                breakdown.recordings = get_dir_size("Recordings");
                breakdown.transcriptions = get_dir_size("Transcriptions");
                breakdown.summaries = get_dir_size("Summaries");
                breakdown.logs = get_dir_size("Logs");
                breakdown.total = breakdown.recordings + breakdown.transcriptions + breakdown.summaries + breakdown.logs;
            }
        }
        Ok(breakdown)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Retrieves the available disk space in bytes on the drive containing the Epi Library.
/// Returns a fallback of the maximum available space across all drives if the specific drive cannot be resolved.
#[tauri::command]
async fn get_available_disk_space() -> Result<u64, String> {
    tokio::task::spawn_blocking(|| {
        let disks = sysinfo::Disks::new_with_refreshed_list();
        
        if let Some(docs) = dirs::document_dir() {
            let mut best_disk: Option<&sysinfo::Disk> = None;
            let mut longest_prefix = 0;
            
            for disk in disks.list() {
                if docs.starts_with(disk.mount_point()) {
                    let len = disk.mount_point().as_os_str().len();
                    if len > longest_prefix {
                        longest_prefix = len;
                        best_disk = Some(disk);
                    }
                }
            }
            
            if let Some(disk) = best_disk {
                return Ok(disk.available_space());
            }
        }
        
        let max_space = disks.list().iter().map(|d| d.available_space()).max().unwrap_or(0);
        Ok(max_space)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Resolves the absolute path of the `~/Documents/Epi Library` directory.
fn library_dir() -> Result<std::path::PathBuf, String> {
    let docs = dirs::document_dir()
        .ok_or_else(|| "Could not find documents directory".to_string())?;
    Ok(docs.join("Epi Library"))
}

/// Renames a recording OGG file and all its associated transcription, summary, and ffmpeg log files on disk.
///
/// The rename is all-or-nothing on a best-effort basis, not truly atomic: all target paths are
/// checked before anything is moved, and if an individual rename fails the files already
/// renamed are moved back in reverse order. See [`utils::rename_recording_files_in`].
///
/// # Arguments
/// * `old_filename` - The current name of the recording OGG file.
/// * `new_filename` - The target name of the recording OGG file.
///
/// # Returns
/// * `Result<(), String>` - Ok(()) on success, or an error description of what failed
///   (including any files that could not be restored during rollback).
#[tauri::command]
async fn rename_recording_files(old_filename: String, new_filename: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        crate::utils::rename_recording_files_in(&library_dir()?, &old_filename, &new_filename)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Deletes all physical files associated with a recording on disk.
///
/// Missing files are ignored; every file is attempted even if one fails.
///
/// # Arguments
/// * `filename` - The name of the audio recording OGG file.
///
/// # Returns
/// * `Result<(), String>` - Returns Ok(()) on success, or the aggregated error descriptions of
///   all files that could not be deleted.
///
/// # Side Effects
/// * Deletes .ogg from `Recordings`, .json/.txt from `Transcriptions`, .md from `Summaries`, and .log from `Logs`.
#[tauri::command]
async fn delete_recording_files(filename: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        crate::utils::delete_recording_files_in(&library_dir()?, &filename)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Deletes only the physical OGG audio file of a recording from disk.
/// This is used to reclaim disk storage space while preserving transcript/summary text data.
///
/// # Arguments
/// * `filename` - The filename string of the target recording.
///
/// # Returns
/// * `Result<(), String>` - Ok(()) on success or if the file did not exist, or an error description.
///
/// # Side Effects
/// * Removes the OGG file from the `Recordings` directory.
#[tauri::command]
async fn delete_audio_file(filename: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        crate::utils::delete_audio_file_in(&library_dir()?, &filename)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn delete_all_logs() -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let docs = dirs::document_dir()
            .ok_or_else(|| "Could not find documents directory".to_string())?;
        let logs_dir = docs.join("Epi Library").join("Logs");
        if logs_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(logs_dir) {
                for entry in entries.flatten() {
                    if let Ok(metadata) = entry.metadata() {
                        if metadata.is_file() {
                            let _ = std::fs::remove_file(entry.path());
                        }
                    }
                }
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Appends a generic application log entry to the global app.log file.
/// Used by the frontend to persist important UI/JS events.
///
/// # Arguments
/// * `log` - The log string to append
#[tauri::command]
async fn append_app_log(log: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let docs = dirs::document_dir().ok_or_else(|| "Could not find documents directory".to_string())?;
        let log_dir = docs.join("Epi Library").join("Logs");
        std::fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;
        let log_file = log_dir.join("app.log");
        
        use std::io::Write;
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_file)
            .map_err(|e| e.to_string())?;
            
        writeln!(file, "{}", log).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Deletes physical transcription, summary, and ffmpeg log files of a recording from disk.
/// Leaves the physical OGG audio recording intact.
///
/// # Arguments
/// * `filename` - The base audio filename (which shares stem names with transcripts/logs).
///
/// # Returns
/// * `Result<(), String>` - Ok(()) on success, or the aggregated error descriptions of all
///   files that could not be deleted (missing files are ignored).
///
/// # Side Effects
/// * Removes JSON/TXT files from `Transcriptions`, Markdown from `Summaries`, and log files from `Logs`.
#[tauri::command]
async fn delete_transcript_files(filename: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        crate::utils::delete_sidecar_files_in(&library_dir()?, &filename)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// The main entry point for the Tauri application.
/// Sets up plugins, managed states, commands, and exit hooks.
///
/// # Side Effects
/// * Initializes default Tauri plugins (OS, Dialog, FS, SQL, Store, Stronghold).
/// * Establishes app state management for audio and background child processes.
/// * Registers Tauri IPC command handlers.
/// * Spawns the main window and hooks into the `Exit` run event to clean up and terminate child processes (ffmpeg, Python venv).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let log_file_path = dirs::document_dir()
        .map(|d| d.join("Epi Library").join("Logs").join("app.log"))
        .unwrap_or_else(|| std::path::PathBuf::from("app.log"));
        
    if let Some(parent) = log_file_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    
    if let Ok(file) = std::fs::OpenOptions::new().create(true).append(true).open(&log_file_path) {
        let _ = simplelog::WriteLogger::init(
            simplelog::LevelFilter::Info,
            simplelog::Config::default(),
            file
        );
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_stronghold::Builder::new(|password| {
            let hash = blake2b_simd::blake2b(password.as_bytes());
            hash.as_bytes()[..32].to_vec()
        }).build())
        .manage(audio::AudioState::default())
        .manage(whisperx::LiveTranscriptionState(std::sync::Mutex::new(None)))
        .manage(process_manager::ProcessRegistry::new())
        .invoke_handler(tauri::generate_handler![
            audio::get_audio_devices,
            audio::start_recording,
            audio::stop_recording,
            audio::get_wav_metadata,
            whisperx::check_whisperx_status,
            whisperx::check_cuda_support,
            whisperx::install_whisperx,
            whisperx::uninstall_whisperx,
            whisperx::run_whisperx,
            whisperx::get_downloaded_models,
            whisperx::download_model,
            whisperx::delete_model,
            whisperx::start_live_transcription,
            whisperx::stop_live_transcription,
            cloud_transcription::transcribe_cloud,
            cloud_llm::generate_cloud_summary,
            local_llm::get_local_models,
            local_llm::generate_local_summary,
            local_llm::pull_ollama_model,
            local_llm::delete_ollama_model,
            get_library_size,
            get_storage_breakdown,
            get_available_disk_space,
            rename_recording_files,
            delete_recording_files,
            delete_audio_file,
            delete_transcript_files,
            delete_all_logs,
            append_app_log,
            ffmpeg::install_ffmpeg,
            ffmpeg::uninstall_ffmpeg,
            ffmpeg::check_ffmpeg_installation
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                use tauri::Manager;
                
                // Kill live transcription process
                let live_state = app_handle.state::<whisperx::LiveTranscriptionState>();
                let mut guard = live_state.0.lock().unwrap_or_else(|e| e.into_inner());
                if let Some(mut child) = guard.take() {
                    let _ = child.kill();
                    let _ = child.wait();
                }

                // Kill audio recording process
                let audio_state = app_handle.state::<audio::AudioState>();
                let mut session_guard = audio_state.session.lock().unwrap_or_else(|e| e.into_inner());
                if let Some(session) = session_guard.take() {
                    let mut child = session.process;
                    #[cfg(unix)]
                    unsafe {
                        libc::kill(child.id() as libc::pid_t, libc::SIGTERM);
                        let _ = child.wait();
                    }
                    #[cfg(not(unix))]
                    {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }

                // Kill all other registered background child processes
                let process_registry = app_handle.state::<process_manager::ProcessRegistry>();
                process_registry.kill_all();
            }
        });
}

#[cfg(test)]
mod tests {


    #[test]
    fn test_library_compiles() {
        // Boilerplate test to ensure the test framework is hooked up correctly.
        assert_eq!(2 + 2, 4);
    }
}
