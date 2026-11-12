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

use crate::whisperx::python::get_portable_python_path;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri::Manager;

pub(crate) fn get_hf_cache_dir() -> Result<PathBuf, String> {
    let cache_dir = dirs::home_dir()
        .ok_or_else(|| "Could not find home directory".to_string())?
        .join(".cache")
        .join("huggingface")
        .join("hub");
    Ok(cache_dir)
}

pub(crate) fn get_env_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    path.push("whisperx_env");
    Ok(path)
}

pub(crate) fn get_binary_path(env_path: &Path) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        env_path.join("Scripts").join("whisperx.exe")
    }
    #[cfg(not(target_os = "windows"))]
    {
        env_path.join("bin").join("whisperx")
    }
}

pub(crate) fn get_python_path(env_path: &Path) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        env_path.join("Scripts").join("python.exe")
    }
    #[cfg(not(target_os = "windows"))]
    {
        env_path.join("bin").join("python3")
    }
}

pub(crate) fn resolve_system_python() -> Option<String> {
    let python_cmd = if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    };
    let mut cmd = std::process::Command::new(python_cmd);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    if cmd
        .arg("--version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
    {
        Some(python_cmd.to_string())
    } else if cfg!(target_os = "windows") {
        let mut cmd = std::process::Command::new("python3");
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }
        if cmd
            .arg("--version")
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
        {
            Some("python3".to_string())
        } else {
            None
        }
    } else {
        None
    }
}

/// Oldest Python minor version (3.x) supported by the pinned WhisperX/PyTorch set.
pub(crate) const MIN_SUPPORTED_PYTHON_MINOR: u32 = 10;
/// Newest Python minor version (3.x) supported by the pinned WhisperX/PyTorch set.
/// WhisperX 3.8.6 declares `<3.14` and torch 2.8.0 ships no wheels for 3.14.
pub(crate) const MAX_SUPPORTED_PYTHON_MINOR: u32 = 13;

/// Returns whether a Python `major.minor` version can run the pinned WhisperX install.
pub(crate) fn is_supported_python_version(major: u32, minor: u32) -> bool {
    major == 3 && (MIN_SUPPORTED_PYTHON_MINOR..=MAX_SUPPORTED_PYTHON_MINOR).contains(&minor)
}

/// Checks whether the given Python interpreter has a version supported by the pinned
/// WhisperX install (see [`is_supported_python_version`]).
///
/// # Arguments
/// * `python_cmd` - The interpreter command or path to query.
///
/// # Returns
/// * `bool` - `true` if the interpreter runs and reports a supported version.
///
/// # Side Effects
/// * Spawns the interpreter once to print its version.
pub(crate) fn python_version_is_supported(python_cmd: &str) -> bool {
    let mut cmd = std::process::Command::new(python_cmd);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    let output = cmd
        .args(["-c", "import sys; print('%d.%d' % sys.version_info[:2])"])
        .stderr(std::process::Stdio::null())
        .output();
    match output {
        Ok(out) if out.status.success() => {
            let text = String::from_utf8_lossy(&out.stdout);
            let mut parts = text.trim().split('.');
            match (
                parts.next().and_then(|p| p.parse::<u32>().ok()),
                parts.next().and_then(|p| p.parse::<u32>().ok()),
            ) {
                (Some(major), Some(minor)) => is_supported_python_version(major, minor),
                _ => false,
            }
        }
        _ => false,
    }
}

pub(crate) fn get_active_python_path(app_handle: &AppHandle) -> Result<String, String> {
    if let Ok(portable) = get_portable_python_path(app_handle) {
        if portable.exists() {
            return Ok(portable.to_string_lossy().to_string());
        }
    }

    resolve_system_python().ok_or_else(|| "No python/python3 found on system".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_get_hf_cache_dir() {
        let dir = get_hf_cache_dir();
        assert!(dir.is_ok());
        assert!(dir.unwrap().to_string_lossy().contains("huggingface"));
    }

    #[test]
    fn test_binary_paths() {
        let env_path = Path::new("/mock/env");
        let py = get_python_path(env_path);
        assert!(py.to_string_lossy().contains("python"));

        let bin = get_binary_path(env_path);
        assert!(bin.to_string_lossy().contains("whisperx"));
    }

    #[test]
    fn test_is_supported_python_version() {
        assert!(!is_supported_python_version(3, 9));
        assert!(is_supported_python_version(3, 10));
        assert!(is_supported_python_version(3, 11));
        assert!(is_supported_python_version(3, 13));
        assert!(!is_supported_python_version(3, 14));
        assert!(!is_supported_python_version(2, 11));
        assert!(!is_supported_python_version(4, 11));
    }

    #[test]
    fn test_python_version_is_supported_missing_interpreter() {
        assert!(!python_version_is_supported(
            "/nonexistent/python-for-epi-test"
        ));
    }
}
