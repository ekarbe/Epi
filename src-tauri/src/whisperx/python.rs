// Epi - Local-first Meeting Intelligence

use std::path::PathBuf;
use tauri::{AppHandle, Manager, Window, Emitter};
use flate2::read::GzDecoder;
use tar::Archive;

#[cfg(target_family = "unix")]
use std::os::unix::fs::PermissionsExt;

/// Resolves the URL for the appropriate python-build-standalone release based on OS and architecture.
fn get_python_download_url() -> Result<&'static str, String> {
    if cfg!(target_os = "windows") {
        if cfg!(target_arch = "x86_64") {
            Ok("https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.11.8%2B20240224-x86_64-pc-windows-msvc-shared-install_only.tar.gz")
        } else {
            Err("Unsupported Windows architecture for portable Python".to_string())
        }
    } else if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            Ok("https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.11.8%2B20240224-aarch64-apple-darwin-install_only.tar.gz")
        } else if cfg!(target_arch = "x86_64") {
            Ok("https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.11.8%2B20240224-x86_64-apple-darwin-install_only.tar.gz")
        } else {
            Err("Unsupported macOS architecture for portable Python".to_string())
        }
    } else if cfg!(target_os = "linux") {
        if cfg!(target_arch = "x86_64") {
            Ok("https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.11.8%2B20240224-x86_64-unknown-linux-gnu-install_only.tar.gz")
        } else {
            Err("Unsupported Linux architecture for portable Python".to_string())
        }
    } else {
        Err("Unsupported operating system for portable Python".to_string())
    }
}

pub fn get_python_standalone_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    path.push("python_standalone");
    Ok(path)
}

pub fn get_portable_python_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let base = get_python_standalone_dir(app_handle)?;
    // The tar.gz extracts to a root folder usually named 'python'
    let python_dir = base.join("python");
    
    #[cfg(target_os = "windows")]
    let exe = python_dir.join("python.exe");
    
    #[cfg(not(target_os = "windows"))]
    let exe = python_dir.join("bin").join("python3");
    
    Ok(exe)
}

pub async fn install_portable_python(app_handle: &AppHandle, window: &Window) -> Result<(), String> {
    let emit_log = |msg: &str| {
        let _ = window.emit("whisperx-install-log", msg.to_string());
    };

    let target_dir = get_python_standalone_dir(app_handle)?;
    if target_dir.exists() {
        let _ = std::fs::remove_dir_all(&target_dir);
    }
    std::fs::create_dir_all(&target_dir).map_err(|e| format!("Failed to create python_standalone dir: {}", e))?;

    let url = get_python_download_url()?;
    emit_log(&format!("Downloading standalone Python from {}...", url));

    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("Failed to fetch Python release: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }

    emit_log("Download complete. Extracting Python (this may take a minute)...");

    let bytes = response.bytes()
        .await
        .map_err(|e| format!("Failed to read downloaded bytes: {}", e))?;

    let cursor = std::io::Cursor::new(bytes);
    let tar = GzDecoder::new(cursor);
    let mut archive = Archive::new(tar);

    // Extracting might take a few seconds
    archive.unpack(&target_dir).map_err(|e| format!("Failed to unpack Python tar.gz: {}", e))?;

    let py_path = get_portable_python_path(app_handle)?;
    if !py_path.exists() {
        return Err(format!("Python executable not found at expected path {:?}", py_path));
    }

    #[cfg(target_family = "unix")]
    {
        // Ensure python3 binary has execution permissions
        let mut perms = std::fs::metadata(&py_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        let _ = std::fs::set_permissions(&py_path, perms);
    }

    emit_log("Standalone Python installed successfully!");

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_python_download_url_returns_something() {
        let result = get_python_download_url();
        // Since this depends on the host OS/arch running the test, it should either be Ok with a URL or Err with an unsupported message.
        // We know GitHub Actions (where this might run) usually are x86_64 linux/macos/windows, or aarch64 macos.
        if let Ok(url) = result {
            assert!(url.contains("indygreg/python-build-standalone"));
            assert!(url.contains("install_only.tar.gz"));
        } else {
            assert!(result.unwrap_err().contains("Unsupported"));
        }
    }
}
