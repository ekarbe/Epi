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

use cpal::traits::HostTrait;

/// Information about a detected audio device.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
pub struct AudioDevice {
    /// The display name of the device.
    pub name: String,
    /// Whether this is an input device (e.g., microphone).
    pub is_input: bool,
    /// Whether this is an output/playback device (e.g., speakers).
    pub is_output: bool,
    /// Whether this is the default device for its type on the system.
    pub is_default: bool,
}

/// Structure representing a selected audio device from the frontend.
#[derive(serde::Deserialize, Clone)]
#[allow(dead_code)]
pub struct AudioDeviceSelection {
    /// The name of the selected device.
    pub name: String,
    /// Whether the device is used for input.
    pub is_input: bool,
    /// Whether the device is used for output.
    pub is_output: bool,
}

/// Helper function to retrieve the device name from a `cpal::Device`.
pub(crate) fn get_device_name(device: &cpal::Device) -> String {
    device.to_string()
}

#[cfg_attr(test, mockall::automock)]
pub trait AudioHost {
    fn default_input_device_name(&self) -> Option<String>;
    fn default_output_device_name(&self) -> Option<String>;
    fn input_device_names(&self) -> Result<Vec<String>, String>;
    fn output_device_names(&self) -> Result<Vec<String>, String>;
}

pub struct CpalHostImpl;
impl AudioHost for CpalHostImpl {
    fn default_input_device_name(&self) -> Option<String> {
        cpal::default_host().default_input_device().map(|d| get_device_name(&d))
    }
    fn default_output_device_name(&self) -> Option<String> {
        cpal::default_host().default_output_device().map(|d| get_device_name(&d))
    }
    fn input_device_names(&self) -> Result<Vec<String>, String> {
        let host = cpal::default_host();
        let devs = host.input_devices().map_err(|e| e.to_string())?;
        Ok(devs.map(|d| get_device_name(&d)).collect())
    }
    fn output_device_names(&self) -> Result<Vec<String>, String> {
        let host = cpal::default_host();
        let devs = host.output_devices().map_err(|e| e.to_string())?;
        Ok(devs.map(|d| get_device_name(&d)).collect())
    }
}

pub(crate) fn get_audio_devices_inner(host: &impl AudioHost) -> Result<Vec<AudioDevice>, String> {
    let mut devices = Vec::new();

    let default_in = host.default_input_device_name().unwrap_or_default();
    #[cfg(not(target_os = "macos"))]
    let default_out = host.default_output_device_name().unwrap_or_default();

    if let Ok(input_devices) = host.input_device_names() {
        for dev_name in input_devices {
            devices.push(AudioDevice {
                name: dev_name.clone(),
                is_input: true,
                is_output: false,
                is_default: dev_name == default_in,
            });
        }
    }

    #[cfg(not(target_os = "macos"))]
    if let Ok(output_devices) = host.output_device_names() {
        for dev_name in output_devices {
            devices.push(AudioDevice {
                name: dev_name.clone(),
                is_input: false,
                is_output: true,
                is_default: dev_name == default_out,
            });
        }
    }

    Ok(devices)
}

/// Retrieves a list of all available audio input and output devices.
///
/// # Returns
/// * `Result<Vec<AudioDevice>, String>` - A list of system audio devices.
///
/// # Side Effects
/// * Queries host audio APIs using `cpal` to enumerate physical devices.
#[tauri::command]
pub fn get_audio_devices() -> Result<Vec<AudioDevice>, String> {
    get_audio_devices_inner(&CpalHostImpl)
}

/// Helper to calculate a matching score between a cpal device name and a Pulse/PipeWire device.
#[cfg(target_os = "linux")]
pub(crate) fn get_match_score(cpal_name: &str, description: &str, properties: &[String]) -> i32 {
    let cpal_lower = cpal_name.to_lowercase();
    let desc_lower = description.to_lowercase();
    
    if desc_lower.contains(&cpal_lower) || cpal_lower.contains(&desc_lower) {
        return 1000;
    }

    let cpal_tokens: Vec<String> = cpal_lower
        .split(|c: char| !c.is_alphanumeric())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty() && s.len() > 1)
        .collect();

    if cpal_tokens.is_empty() {
        return 0;
    }

    let mut score = 0;
    for token in &cpal_tokens {
        if desc_lower.contains(token) {
            score += 10;
        }
        for prop in properties {
            if prop.to_lowercase().contains(token) {
                score += 5;
                break;
            }
        }
    }
    score
}

#[cfg(target_os = "linux")]
pub(crate) fn parse_pactl_output(stdout: &str, cpal_name: &str, is_output: bool) -> Option<String> {
    let mut current_name = String::new();
    let mut properties = Vec::new();
    let mut description = String::new();
    
    let mut best_name = String::new();
    let mut best_score = -1;

    for line in stdout.lines() {
        let line_trimmed = line.trim();
        if let Some(stripped) = line_trimmed.strip_prefix("Name: ") {
            if !current_name.is_empty() 
                && (is_output || !current_name.ends_with(".monitor"))
            {
                let score = get_match_score(cpal_name, &description, &properties);
                if score > best_score {
                    best_score = score;
                    best_name = current_name.clone();
                }
            }
            current_name = stripped.to_string();
            properties.clear();
            description.clear();
        } else if let Some(stripped) = line_trimmed.strip_prefix("Description: ") {
            description = stripped.to_string();
        } else if line_trimmed.contains("=") {
            properties.push(line_trimmed.to_string());
        }
    }
    if !current_name.is_empty() 
        && (is_output || !current_name.ends_with(".monitor"))
    {
        let score = get_match_score(cpal_name, &description, &properties);
        if score > best_score {
            best_score = score;
            best_name = current_name.clone();
        }
    }
    
    if best_score > 0 && !best_name.is_empty() {
        Some(best_name)
    } else {
        None
    }
}

/// Resolves a PulseAudio or PipeWire source/sink name from a CPAL device name on Linux.
///
/// This is needed because CPAL uses ALSA names while ffmpeg uses Pulse/PipeWire names.
#[cfg(target_os = "linux")]
pub(crate) fn resolve_pulse_device(cpal_name: &str, is_output: bool) -> String {
    let clean_name = cpal_name.trim();
    if clean_name == "Default Audio Device" 
        || clean_name == "PulseAudio Sound Server" 
        || clean_name == "PipeWire Sound Server" 
        || clean_name == "default" 
    {
        let cmd_arg = if is_output { "get-default-sink" } else { "get-default-source" };
        if let Ok(output) = std::process::Command::new("pactl").arg(cmd_arg).output() {
            if output.status.success() {
                let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !name.is_empty() {
                    return name;
                }
            }
        }
        return "default".to_string();
    }

    let sub_arg = if is_output { "sinks" } else { "sources" };
    if let Ok(output) = std::process::Command::new("pactl").arg("list").arg(sub_arg).output() {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Some(best_name) = parse_pactl_output(&stdout, cpal_name, is_output) {
                return best_name;
            }
        }
    }

    clean_name.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_audio_devices_inner_default_logic() {
        let mut mock_host = MockAudioHost::new();

        mock_host.expect_default_input_device_name()
            .return_const(Some("Mic 1".to_string()));
        
        #[cfg(not(target_os = "macos"))]
        mock_host.expect_default_output_device_name()
            .return_const(Some("Speaker 2".to_string()));

        mock_host.expect_input_device_names()
            .return_const(Ok(vec!["Mic 1".to_string(), "Mic 2".to_string()]));

        #[cfg(not(target_os = "macos"))]
        mock_host.expect_output_device_names()
            .return_const(Ok(vec!["Speaker 1".to_string(), "Speaker 2".to_string()]));

        let devices = get_audio_devices_inner(&mock_host).unwrap();

        let default_in = devices.iter().find(|d| d.is_input && d.is_default).unwrap();
        assert_eq!(default_in.name, "Mic 1");

        #[cfg(not(target_os = "macos"))]
        {
            let default_out = devices.iter().find(|d| d.is_output && d.is_default).unwrap();
            assert_eq!(default_out.name, "Speaker 2");
        }
    }

    #[test]
    fn test_get_audio_devices_inner_no_default_fallback() {
        let mut mock_host = MockAudioHost::new();

        mock_host.expect_default_input_device_name()
            .return_const(None);
        
        #[cfg(not(target_os = "macos"))]
        mock_host.expect_default_output_device_name()
            .return_const(None);

        mock_host.expect_input_device_names()
            .return_const(Ok(vec!["Mic 1".to_string()]));

        #[cfg(not(target_os = "macos"))]
        mock_host.expect_output_device_names()
            .return_const(Ok(vec!["Speaker 1".to_string()]));

        let devices = get_audio_devices_inner(&mock_host).unwrap();

        // No device should be marked as default if none is returned as default
        assert!(!devices.iter().any(|d| d.is_default));
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn test_get_match_score() {
        assert_eq!(get_match_score("Built-in Audio", "Built-in Audio", &[]), 1000);
        assert_eq!(get_match_score("Built-in Audio", "built-in audio monitor", &[]), 1000);

        let score = get_match_score("Logitech Headset", "USB Audio Device", &["Logitech Headset".to_string()]);
        assert!(score > 0);

        assert_eq!(get_match_score("Microphone", "Speakers", &[]), 0);
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn test_parse_pactl_output_success() {
        let fake_stdout = "Sink #1
        State: IDLE
        Name: alsa_output.pci-0000_00_1f.3.analog-stereo
        Description: Built-in Audio Analog Stereo
        Driver: PipeWire
        Properties:
                device.description = \"Built-in Audio Analog Stereo\"
                device.name = \"alsa_card.pci-0000_00_1f.3\"
Sink #2
        State: IDLE
        Name: bluez_sink.11_22_33_44_55_66.a2dp_sink
        Description: WH-1000XM4
        Properties:
                device.description = \"WH-1000XM4\"
";

        // Match on exact description
        let name = parse_pactl_output(fake_stdout, "WH-1000XM4", true);
        assert_eq!(name.unwrap(), "bluez_sink.11_22_33_44_55_66.a2dp_sink");

        // Match on a property that contains the tokens
        let name2 = parse_pactl_output(fake_stdout, "Built-in Audio", true);
        assert_eq!(name2.unwrap(), "alsa_output.pci-0000_00_1f.3.analog-stereo");
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn test_parse_pactl_output_ignore_monitor_for_input() {
        let fake_stdout = "Source #1
        State: IDLE
        Name: alsa_output.pci-0000_00_1f.3.analog-stereo.monitor
        Description: Monitor of Built-in Audio Analog Stereo
Source #2
        State: IDLE
        Name: alsa_input.pci-0000_00_1f.3.analog-stereo
        Description: Built-in Audio Analog Stereo
";

        // When looking for an input source, it should ignore .monitor if it matches equally well
        let name = parse_pactl_output(fake_stdout, "Built-in Audio", false);
        assert_eq!(name.unwrap(), "alsa_input.pci-0000_00_1f.3.analog-stereo");
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn test_resolve_pulse_device_default() {
        let res = resolve_pulse_device("Default Audio Device", false);
        assert!(!res.is_empty());
    }
}
