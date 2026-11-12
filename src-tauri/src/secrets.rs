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

//! Secret storage backed by the operating system's keyring.
//!
//! Cloud API keys and the Hugging Face token are stored in the macOS Keychain,
//! the Windows Credential Manager or the Linux Secret Service (GNOME Keyring,
//! KWallet, ...). Secrets never touch Epi's own settings files. If no keyring
//! backend is reachable, every operation fails with a descriptive error; there
//! is deliberately no plaintext fallback.

use keyring::{Entry, Error as KeyringError};

/// Service name under which all of Epi's secrets are stored in the keyring.
pub const SERVICE: &str = "com.ekarbe.epi";

/// Names of the secrets the frontend is allowed to read and write.
///
/// The cloud provider ids match the keys used by the Engine tab
/// (`apiKeys[provider]`); `hf_token` is the Hugging Face token used for
/// WhisperX speaker diarization.
pub const ALLOWED_SECRETS: &[&str] = &["openai", "anthropic", "google", "assembly", "hf_token"];

/// Rejects any secret name that is not in [`ALLOWED_SECRETS`].
fn validate_name(name: &str) -> Result<(), String> {
    if ALLOWED_SECRETS.contains(&name) {
        Ok(())
    } else {
        Err(format!("Unknown secret name: {}", name))
    }
}

/// Converts a keyring error into a user-facing message.
fn describe_error(err: KeyringError) -> String {
    match err {
        KeyringError::NoStorageAccess(e) | KeyringError::PlatformFailure(e) => format!(
            "The system keyring is not available ({}). Epi stores API keys only in the OS keyring \
             (macOS Keychain, Windows Credential Manager or a Linux Secret Service such as GNOME \
             Keyring or KWallet); make sure it is running and unlocked.",
            e
        ),
        other => format!("Keyring error: {}", other),
    }
}

/// Creates the keyring entry for an allowed secret name.
fn entry_for(name: &str) -> Result<Entry, String> {
    validate_name(name)?;
    Entry::new(SERVICE, name).map_err(describe_error)
}

/// Reads a secret from `entry`. A missing entry yields `Ok(None)`.
fn read_entry(entry: &Entry) -> Result<Option<String>, String> {
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(e) => Err(describe_error(e)),
    }
}

/// Deletes the secret in `entry`. Deleting a missing entry is not an error.
fn delete_entry(entry: &Entry) -> Result<(), String> {
    match entry.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(e) => Err(describe_error(e)),
    }
}

/// Stores `value` (trimmed) in `entry`; an empty value deletes the entry.
fn write_entry(entry: &Entry, value: &str) -> Result<(), String> {
    let value = value.trim();
    if value.is_empty() {
        delete_entry(entry)
    } else {
        entry.set_password(value).map_err(describe_error)
    }
}

/// Runs a blocking keyring operation off the async runtime.
async fn run_blocking<T, F>(f: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tokio::task::spawn_blocking(f).await.map_err(|e| e.to_string())?
}

/// Reads a secret from the OS keyring.
///
/// # Arguments
/// * `name` - One of [`ALLOWED_SECRETS`].
///
/// # Returns
/// The stored value, or `None` if nothing is stored under `name`.
#[tauri::command]
pub async fn get_secret(name: String) -> Result<Option<String>, String> {
    run_blocking(move || read_entry(&entry_for(&name)?)).await
}

/// Stores a secret in the OS keyring.
///
/// # Arguments
/// * `name` - One of [`ALLOWED_SECRETS`].
/// * `value` - The secret. Surrounding whitespace is trimmed; an empty value deletes the secret.
#[tauri::command]
pub async fn set_secret(name: String, value: String) -> Result<(), String> {
    run_blocking(move || write_entry(&entry_for(&name)?, &value)).await
}

/// Deletes a secret from the OS keyring. Deleting a missing secret succeeds.
///
/// # Arguments
/// * `name` - One of [`ALLOWED_SECRETS`].
#[tauri::command]
pub async fn delete_secret(name: String) -> Result<(), String> {
    run_blocking(move || delete_entry(&entry_for(&name)?)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use keyring::mock::MockCredential;

    /// Creates a keyring entry backed by keyring's in-memory mock store.
    fn mock_entry(name: &str) -> Entry {
        keyring::set_default_credential_builder(keyring::mock::default_credential_builder());
        entry_for(name).expect("allowed name should produce an entry")
    }

    fn set_mock_error(entry: &Entry, err: KeyringError) {
        entry
            .get_credential()
            .downcast_ref::<MockCredential>()
            .expect("mock credential")
            .set_error(err);
    }

    #[test]
    fn test_allowlist_rejects_unknown_names() {
        assert!(validate_name("openai").is_ok());
        assert!(validate_name("hf_token").is_ok());
        assert_eq!(validate_name("ssh_key").unwrap_err(), "Unknown secret name: ssh_key");
        assert!(validate_name("").is_err());
        assert!(validate_name("OpenAI").is_err());
    }

    #[tokio::test]
    async fn test_commands_reject_unknown_names() {
        assert!(get_secret("other".into()).await.is_err());
        assert!(set_secret("other".into(), "x".into()).await.is_err());
        assert!(delete_secret("other".into()).await.is_err());
    }

    #[test]
    fn test_missing_entry_reads_as_none() {
        let entry = mock_entry("anthropic");
        assert_eq!(read_entry(&entry).unwrap(), None);
    }

    #[test]
    fn test_round_trip_trims_value() {
        let entry = mock_entry("openai");
        write_entry(&entry, "  sk-test-123 \n").unwrap();
        assert_eq!(read_entry(&entry).unwrap(), Some("sk-test-123".to_string()));
    }

    #[test]
    fn test_empty_value_deletes_secret() {
        let entry = mock_entry("google");
        write_entry(&entry, "key").unwrap();
        write_entry(&entry, "   ").unwrap();
        assert_eq!(read_entry(&entry).unwrap(), None);
        // Deleting again (nothing stored) is still fine.
        write_entry(&entry, "").unwrap();
        delete_entry(&entry).unwrap();
    }

    #[test]
    fn test_delete_removes_secret() {
        let entry = mock_entry("hf_token");
        write_entry(&entry, "hf_abc").unwrap();
        delete_entry(&entry).unwrap();
        assert_eq!(read_entry(&entry).unwrap(), None);
    }

    #[test]
    fn test_unavailable_keyring_returns_clear_error() {
        let entry = mock_entry("assembly");
        set_mock_error(
            &entry,
            KeyringError::NoStorageAccess("no secret service on D-Bus".into()),
        );
        let err = read_entry(&entry).unwrap_err();
        assert!(err.contains("system keyring is not available"), "{}", err);
        assert!(err.contains("no secret service on D-Bus"), "{}", err);

        set_mock_error(&entry, KeyringError::PlatformFailure("locked".into()));
        let err = write_entry(&entry, "value").unwrap_err();
        assert!(err.contains("system keyring is not available"), "{}", err);
    }
}
