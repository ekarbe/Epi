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

use std::path::{Path, PathBuf};

/// Validates that a path is strictly inside the user's `~/Documents/Epi Library` directory
/// to prevent directory traversal and unauthorized filesystem access.
///
/// # Arguments
/// * `path` - The target path reference to validate.
///
/// # Returns
/// * `Result<PathBuf, String>` - The absolute, normalized path within the library on success,
///   or an error description if traversal or escape is detected.
///
/// # Errors
/// * Returns an error if the user's document directory is not found, or if path traversal
///   or out-of-bounds library folder access is attempted.
pub fn validate_path_in_library<P: AsRef<Path>>(path: P) -> Result<PathBuf, String> {
    #[cfg(not(test))]
    let docs_dir = dirs::document_dir()
        .ok_or_else(|| "Could not find documents directory".to_string())?;

    #[cfg(test)]
    let docs_dir = dirs::document_dir().unwrap_or_else(|| std::env::temp_dir());

    let library_dir = docs_dir.join("Epi Library");
    validate_path_in_dir(path, &library_dir)
}

/// Validates that a path is strictly inside the given library directory.
///
/// This is the directory-agnostic core of [`validate_path_in_library`]; it allows the
/// library file operations to be exercised against a temporary directory in tests.
///
/// # Arguments
/// * `path` - The target path reference to validate. Relative paths are resolved against `library_dir`.
/// * `library_dir` - The absolute path of the library root the target must stay within.
///
/// # Returns
/// * `Result<PathBuf, String>` - The absolute, normalized path within the library on success,
///   or an error description if traversal or escape is detected.
pub fn validate_path_in_dir<P: AsRef<Path>>(path: P, library_dir: &Path) -> Result<PathBuf, String> {
    let path = path.as_ref();

    // Resolve target path absolute representation
    let absolute_path = if path.is_absolute() {
        path.to_path_buf()
    } else {
        library_dir.join(path)
    };

    // Normalize path components to resolve '..' and '.'
    let mut normalized = PathBuf::new();
    for component in absolute_path.components() {
        match component {
            std::path::Component::ParentDir => {
                if !normalized.pop() {
                    return Err("Path traversal attempt detected".to_string());
                }
            }
            std::path::Component::Normal(c) => {
                normalized.push(c);
            }
            std::path::Component::RootDir => {
                normalized.push(std::path::Component::RootDir.as_os_str());
            }
            std::path::Component::Prefix(p) => {
                normalized.push(p.as_os_str());
            }
            _ => {}
        }
    }

    if !normalized.starts_with(library_dir) {
        return Err("Access denied: path must be inside Epi Library".to_string());
    }

    Ok(normalized)
}

/// Validates model names to prevent shell injection or execution of arbitrary code.
///
/// # Arguments
/// * `model` - The model name string slice to validate.
///
/// # Returns
/// * `Result<(), String>` - Ok(()) if the model name is safe, or an error message.
///
/// # Errors
/// * Returns an error if the model name is empty, exceeds 100 characters, contains path traversals,
///   or has non-alphanumeric/unsupported characters.
pub fn validate_model_name(model: &str) -> Result<(), String> {
    if model.is_empty() || model.len() > 100 {
        return Err("Model name must be between 1 and 100 characters.".to_string());
    }
    // Only allow alphanumeric characters, hyphens, underscores, dots, and single slashes (for HF repo formats)
    for c in model.chars() {
        if !c.is_ascii_alphanumeric() && c != '-' && c != '_' && c != '.' && c != '/' {
            return Err("Model name contains invalid characters. Only alphanumeric, '-', '_', '.', and '/' are allowed.".to_string());
        }
    }
    // Prevent path traversal sequences
    if model.contains("..") || model.starts_with('/') || model.ends_with('/') {
        return Err("Model name cannot contain path traversal sequences or start/end with a slash.".to_string());
    }
    Ok(())
}

/// The sidecar files that share a recording's file stem, as `(subdirectory, suffix)` pairs.
pub const RECORDING_SIDECAR_FILES: &[(&str, &str)] = &[
    ("Transcriptions", ".json"),
    ("Transcriptions", "_transcript.txt"),
    ("Summaries", "_summary.md"),
    ("Logs", "_ffmpeg.log"),
];

/// Removes a file, treating an already missing file as success.
///
/// # Returns
/// * `Result<(), String>` - Ok(()) if the file was removed or did not exist, or an error
///   description naming the file for any other failure (e.g. permission denied, file locked).
fn remove_file_if_exists(path: &Path) -> Result<(), String> {
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("Failed to delete {}: {}", path.display(), e)),
    }
}

/// Joins collected error messages into a single error, or returns Ok(()) if there are none.
fn aggregate_errors(errors: Vec<String>) -> Result<(), String> {
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

/// Extracts the file stem of a recording filename (e.g. `meeting` for `meeting.ogg`).
fn recording_stem(filename: &str) -> Result<&str, String> {
    Path::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| format!("Invalid filename: {}", filename))
}

/// Deletes a specific subfile under a subdirectory of the Epi Library directory,
/// after validating that the path is safe (no traversal).
///
/// # Arguments
/// * `library_dir` - The path to the Epi Library directory.
/// * `base_name` - The base filename without extension.
/// * `subdir` - The subfolder name (e.g. "Recordings").
/// * `suffix` - The filename suffix/extension (e.g. ".ogg").
///
/// # Returns
/// * `Result<(), String>` - Ok(()) if the file was deleted or did not exist, or an error
///   description if validation or the deletion itself failed.
///
/// # Side Effects
/// * Deletes the specified file from the filesystem if validation succeeds and the file exists.
pub fn delete_library_subfile(library_dir: &Path, base_name: &str, subdir: &str, suffix: &str) -> Result<(), String> {
    let path = library_dir.join(subdir).join(format!("{}{}", base_name, suffix));
    let p = validate_path_in_dir(path, library_dir)?;
    remove_file_if_exists(&p)
}

/// Deletes the transcription, summary, and ffmpeg log sidecar files of a recording.
///
/// Every file is attempted even if an earlier one fails; missing files are ignored.
///
/// # Returns
/// * `Result<(), String>` - Ok(()) on success, or the aggregated error messages of all failed deletions.
pub fn delete_sidecar_files_in(library_dir: &Path, filename: &str) -> Result<(), String> {
    let base = recording_stem(filename)?;
    let errors = RECORDING_SIDECAR_FILES
        .iter()
        .filter_map(|(subdir, suffix)| delete_library_subfile(library_dir, base, subdir, suffix).err())
        .collect();
    aggregate_errors(errors)
}

/// Deletes the OGG audio file of a recording from the `Recordings` directory.
/// A missing file is not an error.
pub fn delete_audio_file_in(library_dir: &Path, filename: &str) -> Result<(), String> {
    let audio_file = validate_path_in_dir(library_dir.join("Recordings").join(filename), library_dir)?;
    remove_file_if_exists(&audio_file)
}

/// Deletes the audio file and all sidecar files of a recording.
///
/// Every file is attempted even if an earlier one fails; missing files are ignored.
///
/// # Returns
/// * `Result<(), String>` - Ok(()) on success, or the aggregated error messages of all failed deletions.
pub fn delete_recording_files_in(library_dir: &Path, filename: &str) -> Result<(), String> {
    let mut errors = Vec::new();
    if let Err(e) = delete_audio_file_in(library_dir, filename) {
        errors.push(e);
    }
    if let Err(e) = delete_sidecar_files_in(library_dir, filename) {
        errors.push(e);
    }
    aggregate_errors(errors)
}

/// Renames a recording's audio file and all of its existing sidecar files.
///
/// The operation is all-or-nothing on a best-effort basis (it is not truly atomic):
/// 1. All `(old, new)` path pairs are planned and validated up front; files that do not
///    exist (e.g. a recording without a transcript) are skipped.
/// 2. If any target already exists, nothing is renamed.
/// 3. Renames are performed in order. If one fails, the files already renamed are moved
///    back in reverse order and an error describing the failure (and any rollback failure)
///    is returned.
///
/// # Arguments
/// * `library_dir` - The path to the Epi Library directory.
/// * `old_filename` - The current name of the recording OGG file.
/// * `new_filename` - The target name of the recording OGG file.
pub fn rename_recording_files_in(library_dir: &Path, old_filename: &str, new_filename: &str) -> Result<(), String> {
    rename_recording_files_with(library_dir, old_filename, new_filename, |from, to| std::fs::rename(from, to))
}

/// Implementation of [`rename_recording_files_in`] with an injectable rename function,
/// so that rename failures and the rollback path can be exercised in tests.
fn rename_recording_files_with<F>(library_dir: &Path, old_filename: &str, new_filename: &str, mut rename: F) -> Result<(), String>
where
    F: FnMut(&Path, &Path) -> std::io::Result<()>,
{
    if old_filename == new_filename {
        return Ok(());
    }
    let old_base = recording_stem(old_filename)?;
    let new_base = recording_stem(new_filename)?;

    let mut candidates = vec![(
        library_dir.join("Recordings").join(old_filename),
        library_dir.join("Recordings").join(new_filename),
    )];
    for (subdir, suffix) in RECORDING_SIDECAR_FILES {
        candidates.push((
            library_dir.join(subdir).join(format!("{}{}", old_base, suffix)),
            library_dir.join(subdir).join(format!("{}{}", new_base, suffix)),
        ));
    }

    // Plan: validate every path and refuse to overwrite anything before touching the
    // filesystem. Only files that actually exist are renamed.
    let mut plan = Vec::new();
    for (old, new) in candidates {
        let old = validate_path_in_dir(old, library_dir)?;
        let new = validate_path_in_dir(new, library_dir)?;
        if new.exists() {
            return Err(format!(
                "A recording with this filename already exists ({}).",
                new.display()
            ));
        }
        if old.exists() {
            plan.push((old, new));
        }
    }

    for (index, (old, new)) in plan.iter().enumerate() {
        if let Err(e) = rename(old, new) {
            let mut message = format!("Failed to rename {} to {}: {}", old.display(), new.display(), e);
            let rollback_errors: Vec<String> = plan[..index]
                .iter()
                .rev()
                .filter_map(|(done_old, done_new)| {
                    rename(done_new, done_old).err().map(|re| {
                        format!("could not restore {}: {}", done_old.display(), re)
                    })
                })
                .collect();
            if !rollback_errors.is_empty() {
                message.push_str(&format!(". Rollback incomplete: {}", rollback_errors.join("; ")));
            }
            return Err(message);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_model_name_valid() {
        assert!(validate_model_name("valid-name_123.bin").is_ok());
        assert!(validate_model_name("org/repo.model").is_ok());
    }

    #[test]
    fn test_validate_model_name_invalid() {
        assert!(validate_model_name("").is_err());
        assert!(validate_model_name(&"a".repeat(101)).is_err());
        assert!(validate_model_name("../model").is_err());
        assert!(validate_model_name("/model").is_err());
        assert!(validate_model_name("model/").is_err());
        assert!(validate_model_name("model$name").is_err());
        assert!(validate_model_name("model;rm -rf /").is_err());
    }

    #[test]
    fn test_validate_path_traversal() {
        let docs = dirs::document_dir();
        if docs.is_some() {
            let res = validate_path_in_library("../../../etc/passwd");
            assert!(res.is_err(), "Should reject path traversal");
            
            let res2 = validate_path_in_library("/tmp/outside");
            assert!(res2.is_err(), "Should reject absolute path outside library");
        }
    }

    /// Creates a temporary library with the standard subdirectories.
    fn temp_library() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        for sub in ["Recordings", "Transcriptions", "Summaries", "Logs"] {
            std::fs::create_dir_all(dir.path().join(sub)).unwrap();
        }
        dir
    }

    /// Writes all files belonging to a recording stem and returns their relative paths.
    fn write_recording(lib: &Path, stem: &str) -> Vec<PathBuf> {
        let mut files = vec![PathBuf::from("Recordings").join(format!("{}.ogg", stem))];
        for (subdir, suffix) in RECORDING_SIDECAR_FILES {
            files.push(PathBuf::from(subdir).join(format!("{}{}", stem, suffix)));
        }
        for f in &files {
            std::fs::write(lib.join(f), stem).unwrap();
        }
        files
    }

    #[test]
    fn test_validate_path_in_dir() {
        let lib = temp_library();
        assert!(validate_path_in_dir("Recordings/a.ogg", lib.path()).is_ok());
        assert!(validate_path_in_dir(lib.path().join("Recordings/../../escape"), lib.path()).is_err());
        assert!(validate_path_in_dir("/etc/passwd", lib.path()).is_err());
    }

    #[test]
    fn test_rename_moves_all_files() {
        let lib = temp_library();
        let old_files = write_recording(lib.path(), "old");

        rename_recording_files_in(lib.path(), "old.ogg", "new.ogg").unwrap();

        for f in old_files {
            assert!(!lib.path().join(&f).exists(), "{} should be gone", f.display());
            let renamed = f.to_string_lossy().replace("old", "new");
            assert!(lib.path().join(renamed).exists());
        }
    }

    #[test]
    fn test_rename_skips_missing_sidecars() {
        let lib = temp_library();
        std::fs::write(lib.path().join("Recordings/old.ogg"), "a").unwrap();

        rename_recording_files_in(lib.path(), "old.ogg", "new.ogg").unwrap();

        assert!(lib.path().join("Recordings/new.ogg").exists());
        assert!(!lib.path().join("Recordings/old.ogg").exists());
    }

    #[test]
    fn test_rename_refuses_existing_target_without_changes() {
        let lib = temp_library();
        let old_files = write_recording(lib.path(), "old");
        // Only a sidecar of the target exists; this must still block the rename.
        std::fs::write(lib.path().join("Summaries/new_summary.md"), "other").unwrap();

        let err = rename_recording_files_in(lib.path(), "old.ogg", "new.ogg").unwrap_err();

        assert!(err.contains("already exists"), "{}", err);
        for f in old_files {
            assert!(lib.path().join(f).exists(), "nothing should have been renamed");
        }
        assert!(!lib.path().join("Recordings/new.ogg").exists());
    }

    #[test]
    fn test_rename_rolls_back_on_failure() {
        let lib = temp_library();
        let old_files = write_recording(lib.path(), "old");

        // Fail when the summary is renamed, after the audio and transcripts were moved.
        let err = rename_recording_files_with(lib.path(), "old.ogg", "new.ogg", |from, to| {
            if from.ends_with("old_summary.md") {
                Err(std::io::Error::new(std::io::ErrorKind::PermissionDenied, "locked"))
            } else {
                std::fs::rename(from, to)
            }
        })
        .unwrap_err();

        assert!(err.contains("old_summary.md") && err.contains("locked"), "{}", err);
        assert!(!err.contains("Rollback incomplete"), "{}", err);
        for f in old_files {
            assert!(lib.path().join(&f).exists(), "{} should be restored", f.display());
            let renamed = f.to_string_lossy().replace("old", "new");
            assert!(!lib.path().join(renamed).exists());
        }
    }

    #[test]
    fn test_rename_reports_incomplete_rollback() {
        let lib = temp_library();
        write_recording(lib.path(), "old");

        let err = rename_recording_files_with(lib.path(), "old.ogg", "new.ogg", |from, to| {
            // The forward rename of the summary fails, and so does restoring the audio file.
            if from.ends_with("old_summary.md") || from.ends_with("new.ogg") {
                Err(std::io::Error::new(std::io::ErrorKind::PermissionDenied, "locked"))
            } else {
                std::fs::rename(from, to)
            }
        })
        .unwrap_err();

        assert!(err.contains("Rollback incomplete"), "{}", err);
        assert!(err.contains("old.ogg"), "{}", err);
        // Transcripts were still restored.
        assert!(lib.path().join("Transcriptions/old.json").exists());
    }

    #[test]
    fn test_rename_rejects_traversal() {
        let lib = temp_library();
        std::fs::write(lib.path().join("Recordings/old.ogg"), "a").unwrap();
        assert!(rename_recording_files_in(lib.path(), "old.ogg", "../../escape.ogg").is_err());
        assert!(lib.path().join("Recordings/old.ogg").exists());
    }

    #[test]
    fn test_delete_recording_files_removes_everything_and_ignores_missing() {
        let lib = temp_library();
        let files = write_recording(lib.path(), "rec");
        std::fs::remove_file(lib.path().join("Logs/rec_ffmpeg.log")).unwrap();

        delete_recording_files_in(lib.path(), "rec.ogg").unwrap();

        for f in files {
            assert!(!lib.path().join(f).exists());
        }
        // Deleting again is a no-op, not an error.
        delete_recording_files_in(lib.path(), "rec.ogg").unwrap();
    }

    #[test]
    fn test_delete_reports_and_aggregates_failures() {
        let lib = temp_library();
        write_recording(lib.path(), "rec");
        // Directories cannot be removed with remove_file, even as root.
        std::fs::remove_file(lib.path().join("Recordings/rec.ogg")).unwrap();
        std::fs::create_dir(lib.path().join("Recordings/rec.ogg")).unwrap();
        std::fs::remove_file(lib.path().join("Summaries/rec_summary.md")).unwrap();
        std::fs::create_dir(lib.path().join("Summaries/rec_summary.md")).unwrap();

        let err = delete_recording_files_in(lib.path(), "rec.ogg").unwrap_err();

        assert!(err.contains("rec.ogg") && err.contains("rec_summary.md"), "{}", err);
        // The remaining files were still deleted.
        assert!(!lib.path().join("Transcriptions/rec.json").exists());
        assert!(!lib.path().join("Logs/rec_ffmpeg.log").exists());
    }

    #[test]
    fn test_delete_audio_and_sidecars_separately() {
        let lib = temp_library();
        write_recording(lib.path(), "rec");

        delete_audio_file_in(lib.path(), "rec.ogg").unwrap();
        assert!(!lib.path().join("Recordings/rec.ogg").exists());
        assert!(lib.path().join("Transcriptions/rec.json").exists());

        delete_sidecar_files_in(lib.path(), "rec.ogg").unwrap();
        for (subdir, suffix) in RECORDING_SIDECAR_FILES {
            assert!(!lib.path().join(subdir).join(format!("rec{}", suffix)).exists());
        }
    }
}
