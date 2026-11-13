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

//! WebView2 browser arguments on Windows.
//!
//! wry always sets WebView2's `AdditionalBrowserArguments` (by default
//! `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection`), and the
//! WebView2 Runtime then ignores the `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`
//! environment variable. That variable is how msedgedriver (used by
//! tauri-driver for WebDriver tests) passes `--remote-debugging-port`, so
//! without it no WebDriver session can attach to the app.
//!
//! When the variable is set, [`merged_browser_args`] builds the arguments wry
//! would use plus the ones from the variable, and the app sets them on its
//! windows. Without the variable nothing changes.

// Only called on Windows; the unit tests run everywhere.
#![cfg_attr(not(target_os = "windows"), allow(dead_code))]

/// Environment variable read by WebView2 (and set by msedgedriver).
pub const ENV_VAR: &str = "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS";

/// The features wry disables by default (see wry's `webview2` module).
const WRY_DISABLED_FEATURES: &str = "msWebOOUI,msPdfOOUI,msSmartScreenProtection";

/// Returns wry's default WebView2 arguments merged with `extra`, or `None`
/// if `extra` is empty (keep wry's defaults untouched).
///
/// Chromium honours only the last `--disable-features` switch, so all
/// disabled features are combined into one switch, wry's first. `autoplay`
/// adds the switch wry adds for windows with autoplay enabled.
pub fn merged_browser_args(extra: Option<&str>, autoplay: bool) -> Option<String> {
    let extra = extra.map(str::trim).filter(|s| !s.is_empty())?;

    let mut features: Vec<&str> = WRY_DISABLED_FEATURES.split(',').collect();
    let mut rest: Vec<&str> = Vec::new();
    if autoplay {
        rest.push("--autoplay-policy=no-user-gesture-required");
    }
    for arg in extra.split_whitespace() {
        match arg.strip_prefix("--disable-features=") {
            Some(list) => {
                for feature in list.split(',').filter(|f| !f.is_empty()) {
                    if !features.contains(&feature) {
                        features.push(feature);
                    }
                }
            }
            None => rest.push(arg),
        }
    }

    let mut args = format!("--disable-features={}", features.join(","));
    for arg in rest {
        args.push(' ');
        args.push_str(arg);
    }
    Some(args)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_no_extra_args_keeps_wry_defaults() {
        assert_eq!(merged_browser_args(None, true), None);
        assert_eq!(merged_browser_args(Some("   "), false), None);
    }

    #[test]
    fn test_extra_args_are_appended_to_wry_defaults() {
        assert_eq!(
            merged_browser_args(Some("--remote-debugging-port=0"), false).unwrap(),
            "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --remote-debugging-port=0"
        );
    }

    #[test]
    fn test_autoplay_switch_is_kept() {
        assert_eq!(
            merged_browser_args(Some("--enable-logging"), true).unwrap(),
            "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection \
             --autoplay-policy=no-user-gesture-required --enable-logging"
        );
    }

    #[test]
    fn test_disable_features_are_merged_into_one_switch() {
        let args = merged_browser_args(
            Some("--enable-automation --disable-features=IgnoreDuplicateNavs,Prewarm,msWebOOUI --remote-debugging-port=0"),
            false,
        )
        .unwrap();
        assert_eq!(
            args,
            "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,IgnoreDuplicateNavs,Prewarm \
             --enable-automation --remote-debugging-port=0"
        );
        assert_eq!(args.matches("--disable-features=").count(), 1);
    }
}
