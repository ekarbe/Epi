// Epi - Local-first Meeting Intelligence
// Copyright (C) 2026  Eike Christian Karbe

use std::path::PathBuf;
use tauri::{AppHandle, Manager, Emitter};
use std::io::Write;
use crate::checksum::{verify_sha256, PinnedDownload};

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

/// Pinned Windows FFmpeg build: Gyan's FFmpeg 6.1.1 "full_build-shared" release
/// (immutable GitHub release asset, same FFmpeg version as the macOS/Linux builds).
/// The SHA-256 was computed from the published asset.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
const FFMPEG_WINDOWS_DOWNLOAD: PinnedDownload = PinnedDownload {
    url: "https://github.com/GyanD/codexffmpeg/releases/download/6.1.1/ffmpeg-6.1.1-full_build-shared.zip",
    sha256: "50032b867c3ce74d682d2e9321e9d2a4b8bed37a09cba41b3980015658ffd498",
};

/// Verifies a downloaded FFmpeg asset against its pinned SHA-256, logging the outcome.
fn verify_ffmpeg_download(app: &AppHandle, bytes: &[u8], download: &PinnedDownload) -> Result<(), String> {
    verify_sha256(bytes, download.sha256, "FFmpeg download").map_err(|e| {
        log::error!("{}", e);
        let _ = app.emit("ffmpeg-install-log", &format!("ERR: {}", e));
        e
    })?;
    log::info!("FFmpeg download SHA-256 verified ({})", download.sha256);
    let _ = app.emit("ffmpeg-install-log", format!("SHA-256 checksum verified ({}).", download.sha256));
    Ok(())
}

/// Extracts the `.exe` and `.dll` files found in a `bin/` directory of an FFmpeg
/// zip archive flat into `out_dir`.
///
/// Entry names are sanitized with `enclosed_name()` (zip-slip protection) and only
/// the final file name component is used for the output path, so no entry can be
/// written outside `out_dir`. Returns the names of the extracted files.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn extract_ffmpeg_bin_files<R: std::io::Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    out_dir: &std::path::Path,
    mut on_extract: impl FnMut(&str),
) -> Result<Vec<String>, String> {
    let mut extracted = Vec::new();
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry {}: {}", i, e))?;
        if file.is_dir() {
            continue;
        }
        let Some(enclosed) = file.enclosed_name() else {
            return Err(format!("Refusing to extract unsafe zip entry path: {}", file.name()));
        };

        let in_bin_dir = enclosed
            .parent()
            .and_then(|p| p.file_name())
            .map(|n| n == "bin")
            .unwrap_or(false);
        let Some(file_name) = enclosed.file_name().map(|n| n.to_string_lossy().to_string()) else {
            continue;
        };
        let lower = file_name.to_ascii_lowercase();
        if !in_bin_dir || !(lower.ends_with(".exe") || lower.ends_with(".dll")) {
            continue;
        }

        on_extract(&file_name);
        let out_file_path = out_dir.join(&file_name);
        let mut out_file = std::fs::File::create(&out_file_path)
            .map_err(|e| format!("Failed to create {}: {}", file_name, e))?;
        std::io::copy(&mut file, &mut out_file)
            .map_err(|e| format!("Failed to write {}: {}", file_name, e))?;
        extracted.push(file_name);
    }
    Ok(extracted)
}

#[cfg(target_os = "windows")]
async fn install_ffmpeg_windows(app: &AppHandle, dest_path: &PathBuf) -> Result<(), String> {
    let download = FFMPEG_WINDOWS_DOWNLOAD;
    let url = download.url;
    
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
    verify_ffmpeg_download(app, &bytes, &download)?;
        
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
    let out_dir = dest_path
        .parent()
        .ok_or_else(|| "Invalid ffmpeg destination path".to_string())?;
    let extracted = extract_ffmpeg_bin_files(&mut archive, out_dir, |name| {
        let _ = app.emit("ffmpeg-install-log", format!("Extracting {}...", name));
    })
    .map_err(|e| {
        let _ = app.emit("ffmpeg-install-log", &format!("ERR: {}", e));
        e
    })?;
    
    if !extracted.iter().any(|n| n.eq_ignore_ascii_case("ffmpeg.exe")) {
        let msg = "Could not find bin/ffmpeg.exe in the downloaded zip archive.";
        let _ = app.emit("ffmpeg-install-log", &format!("ERR: {}", msg));
        return Err(msg.into());
    }
    
    Ok(())
}

/// Pinned static FFmpeg 6.1.1 binaries (eugeneware/ffmpeg-static release `b6.1.1`)
/// per `(os, arch)` as reported by `std::env::consts`. The project publishes no
/// checksum file, so the SHA-256 digests were computed from the release assets.
const FFMPEG_UNIX_DOWNLOADS: &[(&str, &str, PinnedDownload)] = &[
    ("macos", "x86_64", PinnedDownload {
        url: "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-darwin-x64",
        sha256: "ebdddc936f61e14049a2d4b549a412b8a40deeff6540e58a9f2a2da9e6b18894",
    }),
    ("macos", "aarch64", PinnedDownload {
        url: "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-darwin-arm64",
        sha256: "a90e3db6a3fd35f6074b013f948b1aa45b31c6375489d39e572bea3f18336584",
    }),
    ("linux", "x86_64", PinnedDownload {
        url: "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-linux-x64",
        sha256: "e7e7fb30477f717e6f55f9180a70386c62677ef8a4d4d1a5d948f4098aa3eb99",
    }),
    ("linux", "x86", PinnedDownload {
        url: "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-linux-ia32",
        sha256: "c6472eb993612db72ca50893a34137ba11173e60a1a4c028d4660a3f755d2490",
    }),
    ("linux", "arm", PinnedDownload {
        url: "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-linux-arm",
        sha256: "0afba4a11110e6e402053e0fc14c33a7eb207d7a588688ae87dba471a0f06c71",
    }),
    ("linux", "aarch64", PinnedDownload {
        url: "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-linux-arm64",
        sha256: "6bb182d0d75d23028db82e9e4f723ca69b853d055698486e6984ddb2c06fb8ce",
    }),
];

/// Resolves the pinned static FFmpeg download (URL + SHA-256) for the given OS and architecture.
pub fn ffmpeg_unix_download(os: &str, arch: &str) -> Result<PinnedDownload, String> {
    let url = build_ffmpeg_unix_url(os, arch)?;
    FFMPEG_UNIX_DOWNLOADS
        .iter()
        .find(|(_, _, dl)| dl.url == url)
        .map(|(_, _, dl)| *dl)
        .ok_or_else(|| format!("No pinned FFmpeg build available for {} {}", os, arch))
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
    let download = ffmpeg_unix_download(std::env::consts::OS, std::env::consts::ARCH)?;
    let url = download.url;
    
    let _ = app.emit("ffmpeg-install-log", format!("Fetching from: {}", url));
    
    // Follow redirects for github releases
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| e.to_string())?;
        
    let response = client.get(url)
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
    verify_ffmpeg_download(app, &bytes, &download)?;
        
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

    #[test]
    fn test_every_ffmpeg_download_is_pinned() {
        use crate::checksum::is_sha256_hex;
        assert!(is_sha256_hex(FFMPEG_WINDOWS_DOWNLOAD.sha256));
        assert!(!FFMPEG_WINDOWS_DOWNLOAD.url.contains("latest"));
        for (os, arch, dl) in FFMPEG_UNIX_DOWNLOADS {
            assert!(is_sha256_hex(dl.sha256), "{}/{}: invalid SHA-256 {}", os, arch, dl.sha256);
            assert_eq!(build_ffmpeg_unix_url(os, arch).unwrap(), dl.url);
            assert_eq!(ffmpeg_unix_download(os, arch).unwrap(), *dl);
        }
    }

    #[test]
    fn test_ffmpeg_unix_download_without_pinned_build() {
        // URL can be built, but no such release asset exists (and thus no hash is pinned).
        assert!(ffmpeg_unix_download("macos", "x86").is_err());
        assert!(ffmpeg_unix_download("linux", "mips").is_err());
    }

    fn zip_with_entries(entries: &[(&str, &[u8])]) -> zip::ZipArchive<std::io::Cursor<Vec<u8>>> {
        let mut writer = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
        for (name, data) in entries {
            writer.start_file(*name, zip::write::SimpleFileOptions::default()).unwrap();
            writer.write_all(data).unwrap();
        }
        let cursor = writer.finish().unwrap();
        zip::ZipArchive::new(std::io::Cursor::new(cursor.into_inner())).unwrap()
    }

    #[test]
    fn test_extract_ffmpeg_bin_files_extracts_only_bin_executables() {
        let dir = tempfile::tempdir().unwrap();
        let mut archive = zip_with_entries(&[
            ("ffmpeg-6.1.1/bin/ffmpeg.exe", b"exe"),
            ("ffmpeg-6.1.1/bin/avcodec-60.dll", b"dll"),
            ("ffmpeg-6.1.1/doc/readme.txt", b"txt"),
            ("ffmpeg-6.1.1/presets/bin.exe", b"no"),
        ]);
        let mut seen = Vec::new();
        let extracted = extract_ffmpeg_bin_files(&mut archive, dir.path(), |n| seen.push(n.to_string())).unwrap();
        assert_eq!(extracted, vec!["ffmpeg.exe", "avcodec-60.dll"]);
        assert_eq!(seen, extracted);
        assert_eq!(std::fs::read(dir.path().join("ffmpeg.exe")).unwrap(), b"exe");
        assert!(!dir.path().join("readme.txt").exists());
        assert!(!dir.path().join("bin.exe").exists());
    }

    #[test]
    fn test_extract_ffmpeg_bin_files_rejects_zip_slip() {
        let outer = tempfile::tempdir().unwrap();
        let target = outer.path().join("target");
        std::fs::create_dir_all(&target).unwrap();
        let mut archive = zip_with_entries(&[("../bin/evil.dll", b"evil")]);
        let err = extract_ffmpeg_bin_files(&mut archive, &target, |_| {}).unwrap_err();
        assert!(err.contains("unsafe zip entry"));
        assert!(!outer.path().join("bin/evil.dll").exists());
        assert!(!target.join("evil.dll").exists());
    }
}
