// Epi - Local-first Meeting Intelligence
// Copyright (C) 2026  Eike Christian Karbe

use std::path::PathBuf;
use tauri::{AppHandle, Manager, Emitter};
use std::io::Write;

#[cfg(target_family = "unix")]
use std::os::unix::fs::PermissionsExt;

/// Returns the absolute path to the local ffmpeg binary managed by Epi, if it exists.
pub fn get_local_ffmpeg_path(app: &AppHandle) -> Option<PathBuf> {
    let mut bin_dir = app.path().app_data_dir().ok()?;
    bin_dir.push("bin");
    
    let ffmpeg_name = if cfg!(target_os = "windows") {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    };
    
    let ffmpeg_path = bin_dir.join(ffmpeg_name);
    if ffmpeg_path.exists() {
        Some(ffmpeg_path)
    } else {
        None
    }
}

#[tauri::command]
pub async fn check_ffmpeg_installation(app: AppHandle) -> Result<String, String> {
    // Check if we have our own local binary first
    if get_local_ffmpeg_path(&app).is_some() {
        return Ok("local".to_string());
    }
    
    // Check if system ffmpeg exists
    let mut cmd = tokio::process::Command::new("ffmpeg");
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000);
    }
    let output = cmd
        .arg("-version")
        .output()
        .await;
        
    if output.is_ok() {
        return Ok("global".to_string());
    }
    Ok("missing".to_string())
}

#[tauri::command]
pub async fn uninstall_ffmpeg(app: AppHandle) -> Result<(), String> {
    if let Ok(mut bin_dir) = app.path().app_data_dir() {
        bin_dir.push("bin");
        if bin_dir.exists() {
            std::fs::remove_dir_all(&bin_dir).map_err(|e| format!("Failed to remove bin directory: {}", e))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn install_ffmpeg(app: AppHandle) -> Result<(), String> {
    let _ = app.emit("ffmpeg-install-log", "Starting FFmpeg installation...");
    
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| {
            let msg = format!("Could not determine app data directory: {}", e);
            let _ = app.emit("ffmpeg-install-log", &format!("ERR: {}", msg));
            msg
        })?;
    
    let bin_dir = app_data_dir.join("bin");
    if !bin_dir.exists() {
        std::fs::create_dir_all(&bin_dir)
            .map_err(|e| {
                let msg = format!("Failed to create bin directory: {}", e);
                let _ = app.emit("ffmpeg-install-log", &format!("ERR: {}", msg));
                msg
            })?;
    }
    
    let ffmpeg_name = if cfg!(target_os = "windows") { "ffmpeg.exe" } else { "ffmpeg" };
    let dest_path = bin_dir.join(ffmpeg_name);

    #[cfg(target_os = "windows")]
    install_ffmpeg_windows(&app, &dest_path).await?;
    
    #[cfg(not(target_os = "windows"))]
    install_ffmpeg_unix(&app, &dest_path).await?;
    
    let _ = app.emit("ffmpeg-install-log", "FFmpeg installation completed successfully.");
    Ok(())
}

async fn download_with_progress(app: &AppHandle, mut response: reqwest::Response) -> Result<Vec<u8>, String> {
    let total_size = response.content_length();
    let mut downloaded: u64 = 0;
    let mut buffer = Vec::new();

    if let Some(total) = total_size {
        buffer.reserve(total as usize);
        let _ = app.emit("ffmpeg-install-log", format!("Starting download: {} bytes", total));
    } else {
        let _ = app.emit("ffmpeg-install-log", "Starting download (unknown size)...");
    }

    let mut last_reported_mb = 0;

    while let Some(chunk) = response.chunk().await.map_err(|e| format!("Download error: {}", e))? {
        buffer.write_all(&chunk).map_err(|e| format!("Failed to write to buffer: {}", e))?;
        downloaded += chunk.len() as u64;
        
        let current_mb = downloaded / (1024 * 1024);
        if current_mb > last_reported_mb {
            last_reported_mb = current_mb;
            if let Some(total) = total_size {
                let percentage = (downloaded as f64 / total as f64) * 100.0;
                let _ = app.emit("ffmpeg-install-log", format!("Downloaded {} MB / {} MB ({:.1}%)", current_mb, total / (1024 * 1024), percentage));
            } else {
                let _ = app.emit("ffmpeg-install-log", format!("Downloaded {} MB", current_mb));
            }
        }
    }
    
    let _ = app.emit("ffmpeg-install-log", "Download complete.");
    Ok(buffer)
}

#[cfg(target_os = "windows")]
async fn install_ffmpeg_windows(app: &AppHandle, dest_path: &PathBuf) -> Result<(), String> {
    let url = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl-shared.zip";
    
    let _ = app.emit("ffmpeg-install-log", format!("Fetching from: {}", url));
    
    // Download the ZIP file
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(url)
        .send()
        .await
        .map_err(|e| {
            let msg = format!("Failed to download ffmpeg zip: {}", e);
            let _ = app.emit("ffmpeg-install-log", &format!("ERR: {}", msg));
            msg
        })?;
        
    if !response.status().is_success() {
        let msg = format!("Download failed with status: {}", response.status());
        let _ = app.emit("ffmpeg-install-log", &format!("ERR: {}", msg));
        return Err(msg);
    }
    
    let bytes = download_with_progress(app, response).await?;
        
    let _ = app.emit("ffmpeg-install-log", "Extracting zip archive...");
    
    // Read ZIP file in memory
    let reader = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(reader)
        .map_err(|e| {
            let msg = format!("Failed to open zip archive: {}", e);
            let _ = app.emit("ffmpeg-install-log", &format!("ERR: {}", msg));
            msg
        })?;
        
    // Find ffmpeg.exe and DLLs inside the zip
    let mut found = false;
    let out_dir = dest_path.parent().unwrap();
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).unwrap();
        let name = file.name().to_string();
        
        if name.contains("/bin/") && !name.ends_with('/') {
            if name.ends_with(".exe") || name.ends_with(".dll") {
                let file_name = std::path::Path::new(&name).file_name().unwrap();
                let out_file_path = out_dir.join(file_name);
                
                let _ = app.emit("ffmpeg-install-log", format!("Extracting {}...", file_name.to_string_lossy()));
                let mut out_file = std::fs::File::create(&out_file_path)
                    .map_err(|e| format!("Failed to create {}: {}", file_name.to_string_lossy(), e))?;
                std::io::copy(&mut file, &mut out_file)
                    .map_err(|e| format!("Failed to write {}: {}", file_name.to_string_lossy(), e))?;
                
                if name.ends_with("ffmpeg.exe") {
                    found = true;
                }
            }
        }
    }
    
    if !found {
        let msg = "Could not find bin/ffmpeg.exe in the downloaded zip archive.";
        let _ = app.emit("ffmpeg-install-log", &format!("ERR: {}", msg));
        return Err(msg.into());
    }
    
    Ok(())
}

pub fn build_ffmpeg_unix_url(os: &str, arch: &str) -> Result<String, String> {
    let os_str = match os {
        "macos" => "darwin",
        "linux" => "linux",
        _ => return Err(format!("Unsupported OS for auto-download: {}", os)),
    };
    
    let arch_str = match arch {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        "arm" => "arm",
        "x86" => "ia32",
        _ => return Err(format!("Unsupported architecture: {}", arch)),
    };
    
    Ok(format!(
        "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-{}-{}",
        os_str, arch_str
    ))
}

#[cfg(target_family = "unix")]
async fn install_ffmpeg_unix(app: &AppHandle, dest_path: &PathBuf) -> Result<(), String> {
    let url = build_ffmpeg_unix_url(std::env::consts::OS, std::env::consts::ARCH)?;
    
    let _ = app.emit("ffmpeg-install-log", format!("Fetching from: {}", url));
    
    // Follow redirects for github releases
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| e.to_string())?;
        
    let response = client.get(&url)
        .send()
        .await
        .map_err(|e| {
            let msg = format!("Failed to download ffmpeg binary: {}", e);
            let _ = app.emit("ffmpeg-install-log", &format!("ERR: {}", msg));
            msg
        })?;
        
    if !response.status().is_success() {
        let msg = format!("Download failed with status: {}", response.status());
        let _ = app.emit("ffmpeg-install-log", &format!("ERR: {}", msg));
        return Err(msg);
    }
    
    let bytes = download_with_progress(app, response).await?;
        
    let _ = app.emit("ffmpeg-install-log", "Writing binary to disk...");
    let mut file = std::fs::File::create(dest_path)
        .map_err(|e| format!("Failed to create ffmpeg file: {}", e))?;
        
    file.write_all(&bytes)
        .map_err(|e| format!("Failed to write ffmpeg file: {}", e))?;
        
    let _ = app.emit("ffmpeg-install-log", "Setting executable permissions...");
    // Make it executable
    let mut perms = std::fs::metadata(dest_path)
        .map_err(|e| format!("Failed to read metadata: {}", e))?
        .permissions();
    perms.set_mode(0o755);
    std::fs::set_permissions(dest_path, perms)
        .map_err(|e| format!("Failed to set permissions: {}", e))?;
        
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_ffmpeg_unix_url_macos() {
        let url = build_ffmpeg_unix_url("macos", "aarch64").unwrap();
        assert_eq!(url, "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-darwin-arm64");
        
        let url_x64 = build_ffmpeg_unix_url("macos", "x86_64").unwrap();
        assert_eq!(url_x64, "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-darwin-x64");
    }

    #[test]
    fn test_build_ffmpeg_unix_url_linux() {
        let url = build_ffmpeg_unix_url("linux", "x86_64").unwrap();
        assert_eq!(url, "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-linux-x64");
        
        let url_ia32 = build_ffmpeg_unix_url("linux", "x86").unwrap();
        assert_eq!(url_ia32, "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-linux-ia32");
    }

    #[test]
    fn test_build_ffmpeg_unix_url_invalid() {
        let err = build_ffmpeg_unix_url("windows", "x86_64");
        assert!(err.is_err());
        
        let err_arch = build_ffmpeg_unix_url("linux", "mips");
        assert!(err_arch.is_err());
    }
}
