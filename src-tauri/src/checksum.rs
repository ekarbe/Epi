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

//! Integrity checks for third-party binaries that Epi downloads at runtime
//! (portable Python, FFmpeg).
//!
//! Every download URL is pinned to an immutable release asset and paired with
//! the SHA-256 digest of that asset. The digest is verified over the downloaded
//! bytes before anything is extracted or written to disk.

use sha2::{Digest, Sha256};

/// A download URL pinned to the expected SHA-256 digest of its content.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PinnedDownload {
    /// Immutable (versioned) release asset URL.
    pub url: &'static str,
    /// Expected SHA-256 digest of the asset as 64 lowercase hex characters.
    pub sha256: &'static str,
}

/// Computes the SHA-256 digest of `bytes` as a lowercase hex string.
pub fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Verifies that `bytes` hash to `expected_sha256` (hex, case-insensitive).
///
/// # Arguments
/// * `bytes` - The downloaded content.
/// * `expected_sha256` - The pinned SHA-256 digest.
/// * `label` - Human-readable name of the download, used in the error message.
///
/// # Returns
/// * `Result<(), String>` - `Ok(())` if the digests match, or an error describing
///   the mismatch (including both digests) otherwise.
pub fn verify_sha256(bytes: &[u8], expected_sha256: &str, label: &str) -> Result<(), String> {
    let actual = sha256_hex(bytes);
    if actual.eq_ignore_ascii_case(expected_sha256.trim()) {
        Ok(())
    } else {
        Err(format!(
            "Checksum mismatch for {}: expected SHA-256 {}, got {}. The download may be corrupted or tampered with; aborting installation.",
            label, expected_sha256, actual
        ))
    }
}

/// Returns true if `s` looks like a SHA-256 hex digest (exactly 64 hex characters).
#[cfg(test)]
pub fn is_sha256_hex(s: &str) -> bool {
    s.len() == 64 && s.chars().all(|c| c.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sha256_hex_known_vector() {
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn test_verify_sha256_match() {
        let expected = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
        assert!(verify_sha256(b"abc", expected, "test").is_ok());
        assert!(verify_sha256(b"abc", &expected.to_uppercase(), "test").is_ok());
    }

    #[test]
    fn test_verify_sha256_mismatch() {
        let expected = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
        let err = verify_sha256(b"abd", expected, "test archive").unwrap_err();
        assert!(err.contains("Checksum mismatch for test archive"));
        assert!(err.contains(expected));
    }

    #[test]
    fn test_is_sha256_hex() {
        assert!(is_sha256_hex(&sha256_hex(b"")));
        assert!(!is_sha256_hex("abc"));
        assert!(!is_sha256_hex(&"g".repeat(64)));
    }
}
