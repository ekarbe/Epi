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
    let path = path.as_ref();
    
    #[cfg(not(test))]
    let docs_dir = dirs::document_dir()
        .ok_or_else(|| "Could not find documents directory".to_string())?;
        
    #[cfg(test)]
    let docs_dir = dirs::document_dir().unwrap_or_else(|| std::env::temp_dir());

    let library_dir = docs_dir.join("Epi Library");

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

    if !normalized.starts_with(&library_dir) {
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

/// Deletes a specific subfile under a subdirectory of the Epi Library directory,
/// after validating that the path is safe (no traversal).
///
/// # Arguments
/// * `library_dir` - The path to the Epi Library directory.
/// * `base_name` - The base filename without extension.
/// * `subdir` - The subfolder name (e.g. "Recordings").
/// * `suffix` - The filename suffix/extension (e.g. ".ogg").
///
/// # Side Effects
/// * Deletes the specified file from the filesystem if validation succeeds and the file exists.
pub fn delete_library_subfile(library_dir: &Path, base_name: &str, subdir: &str, suffix: &str) {
    let path = library_dir.join(subdir).join(format!("{}{}", base_name, suffix));
    if let Ok(p) = validate_path_in_library(path) {
        if p.exists() {
            let _ = std::fs::remove_file(p);
        }
    }
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
}
