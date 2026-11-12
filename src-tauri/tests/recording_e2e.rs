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

//! Backend-level end-to-end test of the real recording path.
//!
//! Records a few seconds from a real (virtual) audio device through exactly
//! the code the app uses (`start_recording_inner` / `stop_recording_inner`:
//! PulseAudio input on Linux, cpal stream -> TCP loopback elsewhere, then
//! ffmpeg -> Opus `.ogg` in `~/Documents/Epi Library/Recordings`). The result
//! is decoded with ffmpeg and checked for its length, its level (not silence)
//! and its dominant frequency (the expected test tone).
//!
//! The recording test is `#[ignore]`d because it needs an audio device that
//! plays a known tone; a plain `cargo test` only runs the analysis helper's
//! unit tests. To run it:
//!
//! ```text
//! e2e/ci/setup-audio-linux.sh            # Linux; see e2e/ci/ for other OSes
//! cd src-tauri
//! cargo test --test recording_e2e -- --ignored --nocapture
//! ```
//!
//! Configuration (all optional):
//! * `EPI_E2E_INPUT_DEVICE` - input device name to record from. On Windows
//!   and macOS a part of the name is enough (e.g. `CABLE Output`,
//!   `BlackHole`); on Linux it is resolved like the app resolves names.
//! * `EPI_E2E_OUTPUT_DEVICE` - output device to capture (system audio
//!   loopback; Linux and Windows only), matched the same way.
//!   Without either, the system default input device is recorded, exactly as
//!   the app does with no device selected. With both, they are mixed.
//! * `EPI_E2E_TONE_HZ` - expected tone frequency (default 440).
//! * `EPI_E2E_RECORD_SECS` - recording length in seconds (default 5).
//! * `EPI_E2E_MIN_RMS` - minimum RMS level, 0..1 (default 0.01, about -40 dBFS).
//! * `EPI_E2E_FFMPEG` - ffmpeg binary (default `ffmpeg` from `PATH`).
//! * `EPI_E2E_KEEP=1` - keep the recording and ffmpeg log for inspection.

mod support;

use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use epi_lib::e2e::{start_recording_inner, stop_recording_inner, AudioDeviceSelection, AudioState};
use support::audio_analysis::{dominant_frequency, fraction_of_blocks_above, rms, tone_share};

/// Sample rate the recording is decoded at for analysis (the app records 16 kHz mono).
const ANALYSIS_RATE: u32 = 16_000;
/// How much shorter than requested the recording may be. Audio only flows
/// once ffmpeg has started and opened every input, which the app does not wait
/// for; locally this cost 0.3-0.9 s with one PulseAudio input and up to 1.75 s
/// with two.
const MAX_STARTUP_LOSS_SECS: f32 = 2.0;
/// How much longer than the wall-clock time between start and stop the
/// recording may be (encoder padding, rounding).
const MAX_EXCESS_SECS: f32 = 0.5;
/// Allowed relative deviation of the dominant frequency from the expected tone.
const FREQUENCY_TOLERANCE: f32 = 0.03;
/// Minimum share of 250 ms blocks that must carry sound (catches dropouts).
const MIN_LOUD_BLOCK_FRACTION: f32 = 0.8;
/// Minimum ratio of the tone's amplitude to the amplitude a pure sine with the
/// recording's RMS level would have. A clean tone yields about 1.0; loud noise
/// or another signal with only a weak trace of the tone falls well below.
const MIN_TONE_SHARE: f32 = 0.5;

fn env_or<T: std::str::FromStr>(name: &str, default: T) -> T {
    match std::env::var(name) {
        Ok(v) if !v.trim().is_empty() => v
            .trim()
            .parse()
            .unwrap_or_else(|_| panic!("{} has an invalid value: {:?}", name, v)),
        _ => default,
    }
}

fn env_string(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|v| !v.trim().is_empty())
}

/// Resolves a configured device name to the full name the app would show.
///
/// On Windows and macOS the app matches devices by their exact `cpal` name,
/// which includes details such as the manufacturer and device type (e.g.
/// `CABLE Output (VB-Audio Virtual Cable) ...`) that differ between driver and
/// OS versions. To keep the CI configuration stable, an exact match is used if
/// there is one, otherwise the first device whose name contains `wanted`
/// (case-insensitive). All devices are printed to make mismatches easy to see.
///
/// On Linux the name is passed through unchanged: the app resolves it to a
/// PulseAudio source or sink itself (see `resolve_pulse_device`).
#[cfg(not(target_os = "linux"))]
fn resolve_device_name(wanted: &str, is_output: bool) -> String {
    use cpal::traits::HostTrait;

    let host = cpal::default_host();
    let devices = if is_output {
        host.output_devices()
    } else {
        host.input_devices()
    };
    let names: Vec<String> = devices
        .map(|d| d.map(|d| d.to_string()).collect())
        .unwrap_or_default();
    let kind = if is_output { "output" } else { "input" };
    eprintln!("[e2e] {} devices: {:?}", kind, names);

    let lower = wanted.to_lowercase();
    let resolved = names
        .iter()
        .find(|n| n.as_str() == wanted)
        .or_else(|| names.iter().find(|n| n.to_lowercase().contains(&lower)))
        .cloned()
        .unwrap_or_else(|| panic!("no {} device matches {:?}", kind, wanted));
    if resolved != wanted {
        eprintln!("[e2e] {:?} resolved to {:?}", wanted, resolved);
    }
    resolved
}

#[cfg(target_os = "linux")]
fn resolve_device_name(wanted: &str, _is_output: bool) -> String {
    wanted.to_string()
}

/// Builds the device selection from the environment (`None` = system default input).
fn device_selection() -> Option<Vec<AudioDeviceSelection>> {
    let mut devices = Vec::new();
    if let Some(name) = env_string("EPI_E2E_INPUT_DEVICE") {
        devices.push(AudioDeviceSelection {
            name: resolve_device_name(&name, false),
            is_input: true,
            is_output: false,
        });
    }
    if let Some(name) = env_string("EPI_E2E_OUTPUT_DEVICE") {
        devices.push(AudioDeviceSelection {
            name: resolve_device_name(&name, true),
            is_input: false,
            is_output: true,
        });
    }
    (!devices.is_empty()).then_some(devices)
}

/// Removes the produced files when dropped, also when an assertion fails.
struct Cleanup(Vec<PathBuf>);

impl Drop for Cleanup {
    fn drop(&mut self) {
        if env_string("EPI_E2E_KEEP").is_some() {
            for p in &self.0 {
                eprintln!("[e2e] keeping {}", p.display());
            }
            return;
        }
        for p in &self.0 {
            let _ = std::fs::remove_file(p);
        }
    }
}

/// Decodes `path` with ffmpeg into mono `f32` samples at [`ANALYSIS_RATE`].
fn decode(ffmpeg: &str, path: &Path) -> Vec<f32> {
    let out = Command::new(ffmpeg)
        .args(["-hide_banner", "-loglevel", "error", "-i"])
        .arg(path)
        .args([
            "-ac",
            "1",
            "-ar",
            &ANALYSIS_RATE.to_string(),
            "-f",
            "s16le",
            "pipe:1",
        ])
        .output()
        .expect("failed to run ffmpeg for decoding");
    assert!(
        out.status.success(),
        "ffmpeg could not decode {}: {}",
        path.display(),
        String::from_utf8_lossy(&out.stderr)
    );
    out.stdout
        .as_chunks::<2>()
        .0
        .iter()
        .map(|b| i16::from_le_bytes(*b) as f32 / 32768.0)
        .collect()
}

#[test]
#[ignore = "needs a virtual audio device playing a test tone; run with --ignored (see module docs)"]
fn records_test_tone_from_real_audio_device() {
    let tone_hz: f32 = env_or("EPI_E2E_TONE_HZ", 440.0);
    let record_secs: f32 = env_or("EPI_E2E_RECORD_SECS", 5.0);
    let min_rms: f32 = env_or("EPI_E2E_MIN_RMS", 0.01);
    let ffmpeg = env_string("EPI_E2E_FFMPEG").unwrap_or_else(|| "ffmpeg".to_string());
    let devices = device_selection();

    let docs = dirs::document_dir().expect(
        "No documents directory found. On Linux define XDG_DOCUMENTS_DIR in \
         ~/.config/user-dirs.dirs (e2e/ci/setup-audio-linux.sh does this).",
    );
    let library = docs.join("Epi Library");
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let base = format!("epi-e2e-{}-{}", std::process::id(), stamp);
    let output_path = library.join("Recordings").join(format!("{}.ogg", base));
    let log_path = library.join("Logs").join(format!("{}_ffmpeg.log", base));
    std::fs::create_dir_all(library.join("Logs")).unwrap();
    let _cleanup = Cleanup(vec![output_path.clone(), log_path.clone()]);

    eprintln!(
        "[e2e] devices: {}",
        match &devices {
            Some(d) => d
                .iter()
                .map(|s| format!(
                    "{} ({})",
                    s.name,
                    if s.is_output { "output" } else { "input" }
                ))
                .collect::<Vec<_>>()
                .join(", "),
            None => "system default input".to_string(),
        }
    );
    eprintln!(
        "[e2e] recording {:.1} s to {}",
        record_secs,
        output_path.display()
    );

    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_time()
        .build()
        .unwrap();
    let state = AudioState::default();

    let started = Instant::now();
    let start = runtime.block_on(start_recording_inner(
        &state,
        ffmpeg.clone(),
        output_path.to_string_lossy().to_string(),
        Some(log_path.to_string_lossy().to_string()),
        devices,
    ));
    let ffmpeg_log = || std::fs::read_to_string(&log_path).unwrap_or_default();
    if let Err(e) = start {
        panic!(
            "start_recording failed: {}\nffmpeg log:\n{}",
            e,
            ffmpeg_log()
        );
    }
    // `start_recording_inner` already waited ~200 ms after spawning ffmpeg.
    let remaining = Duration::from_secs_f32(record_secs).saturating_sub(started.elapsed());
    runtime.block_on(async { tokio::time::sleep(remaining).await });
    let stopped = runtime.block_on(stop_recording_inner(&state));
    let wall_secs = started.elapsed().as_secs_f32();
    let paths = stopped.unwrap_or_else(|e| {
        panic!(
            "stop_recording failed: {}\nffmpeg log:\n{}",
            e,
            ffmpeg_log()
        )
    });
    assert_eq!(paths, vec![output_path.to_string_lossy().to_string()]);

    // The file exists and is an Ogg container.
    let bytes = std::fs::read(&output_path).expect("recording file is missing");
    assert!(bytes.starts_with(b"OggS"), "recording is not an Ogg file");

    let samples = decode(&ffmpeg, &output_path);
    let duration = samples.len() as f32 / ANALYSIS_RATE as f32;

    // Skip the first and last moments, where devices and the encoder settle.
    let rate = ANALYSIS_RATE as usize;
    let body = &samples[(rate / 2).min(samples.len())..samples.len().saturating_sub(rate / 4)];
    let level = rms(body);
    let loud_blocks = fraction_of_blocks_above(body, rate / 4, min_rms);
    let dominant = dominant_frequency(body, ANALYSIS_RATE as f32, 50.0, 4000.0);
    let tone_share = tone_share(body, ANALYSIS_RATE as f32, dominant);

    eprintln!(
        "[e2e] file: {} bytes, duration {:.2} s (requested {:.1} s, wall {:.2} s)",
        bytes.len(),
        duration,
        record_secs,
        wall_secs
    );
    eprintln!(
        "[e2e] rms {:.4} (min {:.4}), loud blocks {:.0}%, dominant {:.1} Hz (expected {:.1} Hz), tone share {:.2}",
        level,
        min_rms,
        loud_blocks * 100.0,
        dominant,
        tone_hz,
        tone_share
    );

    let mut failures = Vec::new();
    let (min_duration, max_duration) = (
        record_secs - MAX_STARTUP_LOSS_SECS,
        wall_secs + MAX_EXCESS_SECS,
    );
    if duration < min_duration || duration > max_duration {
        failures.push(format!(
            "duration {:.2} s is outside {:.2}..{:.2} s",
            duration, min_duration, max_duration
        ));
    }
    if level < min_rms {
        failures.push(format!(
            "recording is silent: rms {:.5} < {:.5}",
            level, min_rms
        ));
    }
    if loud_blocks < MIN_LOUD_BLOCK_FRACTION {
        failures.push(format!(
            "only {:.0}% of 250 ms blocks carry sound (need {:.0}%)",
            loud_blocks * 100.0,
            MIN_LOUD_BLOCK_FRACTION * 100.0
        ));
    }
    if (dominant - tone_hz).abs() / tone_hz > FREQUENCY_TOLERANCE {
        failures.push(format!(
            "dominant frequency {:.1} Hz is not within {:.0}% of {:.1} Hz",
            dominant,
            FREQUENCY_TOLERANCE * 100.0,
            tone_hz
        ));
    }
    if tone_share < MIN_TONE_SHARE {
        failures.push(format!(
            "the tone carries too little of the signal: share {:.2} < {:.2} (noise?)",
            tone_share, MIN_TONE_SHARE
        ));
    }
    assert!(
        failures.is_empty(),
        "recording check failed:\n  {}\nffmpeg log:\n{}",
        failures.join("\n  "),
        ffmpeg_log()
    );
}
