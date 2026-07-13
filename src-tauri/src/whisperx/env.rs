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

use tauri::Manager;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use crate::whisperx::python::get_portable_python_path;

pub(crate) fn get_hf_cache_dir() -> Result<PathBuf, String> {
    let cache_dir = dirs::home_dir()
        .ok_or_else(|| "Could not find home directory".to_string())?
        .join(".cache")
        .join("huggingface")
        .join("hub");
    Ok(cache_dir)
}

pub(crate) fn get_env_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
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
    let python_cmd = if cfg!(target_os = "windows") { "python" } else { "python3" };
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
        let py = get_python_path(&env_path);
        assert!(py.to_string_lossy().contains("python"));

        let bin = get_binary_path(&env_path);
        assert!(bin.to_string_lossy().contains("whisperx"));
    }
}
