// Epi - Local-first Meeting Intelligence

use crate::checksum::{verify_sha256, PinnedDownload};
use flate2::read::GzDecoder;
use std::path::{Path, PathBuf};
use tar::Archive;
use tauri::{AppHandle, Emitter, Manager, Window};

#[cfg(target_family = "unix")]
use std::os::unix::fs::PermissionsExt;

#[cfg(test)]
const PBS_BASE: &str =
    "https://github.com/indygreg/python-build-standalone/releases/download/20240224/";

/// Pinned python-build-standalone 20240224 assets per `(os, arch)`, as reported by
/// `std::env::consts`. Digests are taken from the release's published `SHA256SUMS`.
const PYTHON_DOWNLOADS: &[(&str, &str, PinnedDownload)] = &[
    ("windows", "x86_64", PinnedDownload {
        url: "https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.11.8%2B20240224-x86_64-pc-windows-msvc-shared-install_only.tar.gz",
        sha256: "b618f1f047349770ee1ef11d1b05899840abd53884b820fd25c7dfe2ec1664d4",
    }),
    ("macos", "aarch64", PinnedDownload {
        url: "https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.11.8%2B20240224-aarch64-apple-darwin-install_only.tar.gz",
        sha256: "389a51139f5abe071a0d70091ca5df3e7a3dfcfcbe3e0ba6ad85fb4c5638421e",
    }),
    ("macos", "x86_64", PinnedDownload {
        url: "https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.11.8%2B20240224-x86_64-apple-darwin-install_only.tar.gz",
        sha256: "097f467b0c36706bfec13f199a2eaf924e668f70c6e2bd1f1366806962f7e86e",
    }),
    ("linux", "x86_64", PinnedDownload {
        url: "https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.11.8%2B20240224-x86_64-unknown-linux-gnu-install_only.tar.gz",
        sha256: "94e13d0e5ad417035b80580f3e893a72e094b0900d5d64e7e34ab08e95439987",
    }),
];

/// Resolves the pinned python-build-standalone release (URL + SHA-256) for the given OS and architecture.
fn python_download_for(os: &str, arch: &str) -> Result<PinnedDownload, String> {
    if let Some((_, _, dl)) = PYTHON_DOWNLOADS
        .iter()
        .find(|(o, a, _)| *o == os && *a == arch)
    {
        return Ok(*dl);
    }
    match os {
        "windows" => Err("Unsupported Windows architecture for portable Python".to_string()),
        "macos" => Err("Unsupported macOS architecture for portable Python".to_string()),
        "linux" => Err("Unsupported Linux architecture for portable Python".to_string()),
        _ => Err("Unsupported operating system for portable Python".to_string()),
    }
}

/// Resolves the pinned python-build-standalone release for the current OS and architecture.
fn get_python_download() -> Result<PinnedDownload, String> {
    python_download_for(std::env::consts::OS, std::env::consts::ARCH)
}

/// Unpacks a gzip-compressed tarball into `target_dir`.
///
/// Every entry is unpacked with `unpack_in`, which rejects absolute paths, `..`
/// components and writes through symlinks that would land outside `target_dir`.
/// Any such entry aborts the extraction with an error.
fn unpack_tar_gz_safely(bytes: &[u8], target_dir: &Path) -> Result<(), String> {
    let mut archive = Archive::new(GzDecoder::new(std::io::Cursor::new(bytes)));
    let entries = archive
        .entries()
        .map_err(|e| format!("Failed to read Python tar.gz: {}", e))?;
    for entry in entries {
        let mut entry = entry.map_err(|e| format!("Failed to read Python tar.gz entry: {}", e))?;
        let entry_path = entry
            .path()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|_| "<invalid path>".to_string());
        let unpacked = entry
            .unpack_in(target_dir)
            .map_err(|e| format!("Failed to unpack {}: {}", entry_path, e))?;
        if !unpacked {
            return Err(format!(
                "Refusing to unpack archive entry outside the target directory: {}",
                entry_path
            ));
        }
    }
    Ok(())
}

pub fn get_python_standalone_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
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

pub async fn install_portable_python(
    app_handle: &AppHandle,
    window: &Window,
) -> Result<(), String> {
    let emit_log = |msg: &str| {
        let _ = window.emit("whisperx-install-log", msg.to_string());
    };

    let target_dir = get_python_standalone_dir(app_handle)?;
    if target_dir.exists() {
        let _ = std::fs::remove_dir_all(&target_dir);
    }
    std::fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create python_standalone dir: {}", e))?;

    let download = get_python_download()?;
    let url = download.url;
    emit_log(&format!("Downloading standalone Python from {}...", url));

    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("Failed to fetch Python release: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download failed with status: {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read downloaded bytes: {}", e))?;

    // Verify integrity before touching the archive contents.
    verify_sha256(&bytes, download.sha256, "standalone Python archive").map_err(|e| {
        log::error!("{}", e);
        emit_log(&format!("ERR: {}", e));
        e
    })?;
    log::info!(
        "Standalone Python archive SHA-256 verified ({})",
        download.sha256
    );
    emit_log(&format!("SHA-256 checksum verified ({}).", download.sha256));

    emit_log("Download complete. Extracting Python (this may take a minute)...");

    // Extracting might take a few seconds
    unpack_tar_gz_safely(&bytes, &target_dir)?;

    let py_path = get_portable_python_path(app_handle)?;
    if !py_path.exists() {
        return Err(format!(
            "Python executable not found at expected path {:?}",
            py_path
        ));
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
    use crate::checksum::is_sha256_hex;

    #[test]
    fn test_get_python_download_returns_something() {
        let result = get_python_download();
        // Depends on the host OS/arch running the test: either a pinned download or an "Unsupported" error.
        if let Ok(dl) = result {
            assert!(dl.url.contains("indygreg/python-build-standalone"));
            assert!(dl.url.contains("install_only.tar.gz"));
            assert!(is_sha256_hex(dl.sha256));
        } else {
            assert!(result.unwrap_err().contains("Unsupported"));
        }
    }

    #[test]
    fn test_every_python_download_is_pinned() {
        assert_eq!(PYTHON_DOWNLOADS.len(), 4);
        for (os, arch, dl) in PYTHON_DOWNLOADS {
            assert!(
                dl.url.starts_with(PBS_BASE),
                "{}/{}: unexpected URL {}",
                os,
                arch,
                dl.url
            );
            assert!(dl.url.ends_with("-install_only.tar.gz"));
            assert!(
                is_sha256_hex(dl.sha256),
                "{}/{}: invalid SHA-256 {}",
                os,
                arch,
                dl.sha256
            );
            assert_eq!(python_download_for(os, arch).unwrap(), *dl);
        }
    }

    #[test]
    fn test_python_download_unsupported_platforms() {
        assert!(python_download_for("linux", "aarch64")
            .unwrap_err()
            .contains("Linux"));
        assert!(python_download_for("freebsd", "x86_64")
            .unwrap_err()
            .contains("operating system"));
    }

    fn tar_gz_with_entry(path: &str, data: &[u8]) -> Vec<u8> {
        let mut header = tar::Header::new_gnu();
        // Write the raw name so that unsafe paths (which `set_path` rejects) end up in the archive.
        let name = path.as_bytes();
        header.as_old_mut().name[..name.len()].copy_from_slice(name);
        header.set_size(data.len() as u64);
        header.set_mode(0o644);
        header.set_entry_type(tar::EntryType::Regular);
        header.set_cksum();
        let mut builder = tar::Builder::new(flate2::write::GzEncoder::new(
            Vec::new(),
            flate2::Compression::fast(),
        ));
        builder.append(&header, data).unwrap();
        builder.into_inner().unwrap().finish().unwrap()
    }

    #[test]
    fn test_unpack_tar_gz_safely_extracts_regular_entries() {
        let dir = tempfile::tempdir().unwrap();
        let bytes = tar_gz_with_entry("python/bin/python3", b"#!fake");
        unpack_tar_gz_safely(&bytes, dir.path()).unwrap();
        assert_eq!(
            std::fs::read(dir.path().join("python/bin/python3")).unwrap(),
            b"#!fake"
        );
    }

    #[test]
    fn test_unpack_tar_gz_safely_rejects_path_traversal() {
        let outer = tempfile::tempdir().unwrap();
        let target = outer.path().join("target");
        std::fs::create_dir_all(&target).unwrap();
        let bytes = tar_gz_with_entry("../escaped.txt", b"evil");
        assert!(unpack_tar_gz_safely(&bytes, &target).is_err());
        assert!(!outer.path().join("escaped.txt").exists());
    }
}
