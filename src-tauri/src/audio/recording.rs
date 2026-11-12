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

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::State;

use crate::audio::device::{get_device_name, AudioDeviceSelection};

/// Represents an active audio recording session.
pub struct RecordingSession {
    /// The handle to the spawned `ffmpeg` process.
    pub process: Child,
    /// The path to the output WAV file.
    pub output_path: String,
    /// Active CPAL streams feeding the TCP inputs.
    pub _streams: Vec<Box<dyn std::any::Any + Send>>,
}

/// The global state manager for the audio module, managed by Tauri.
pub struct AudioState {
    pub session: Mutex<Option<RecordingSession>>,
    pub audio_tx: tokio::sync::broadcast::Sender<Vec<u8>>,
    pub cpal_builder: std::sync::Arc<dyn CpalStreamBuilder>,
}

impl Default for AudioState {
    fn default() -> Self {
        let (tx, _) = tokio::sync::broadcast::channel(1024);
        Self {
            session: Mutex::new(None),
            audio_tx: tx,
            cpal_builder: std::sync::Arc::new(DefaultCpalBuilder),
        }
    }
}

/// Capacity (in callback chunks) of the channel between a CPAL audio callback
/// and its TCP loopback writer thread.
///
/// Audio backends typically deliver one callback every ~10 ms (WASAPI, CoreAudio,
/// PulseAudio) and at most a few tens of milliseconds (ALSA with large periods),
/// so 512 chunks buffer roughly 5 seconds of audio or more. That comfortably
/// absorbs short hiccups of ffmpeg or the writer thread, while bounding memory:
/// with 10 ms chunks of 48 kHz stereo `f32` this is about 2 MB per stream. If
/// the writer stalls longer than that, chunks are dropped instead of letting
/// memory grow without limit.
pub const AUDIO_CHANNEL_CAPACITY: usize = 512;

/// Minimum interval between two "dropped audio chunks" warnings, so a stalled
/// writer does not flood the log from the real-time audio callback.
const DROP_WARNING_INTERVAL: Duration = Duration::from_secs(5);

/// Creates the bounded channel used to hand audio chunks from a CPAL callback
/// to the TCP loopback writer thread.
pub fn audio_chunk_channel() -> (mpsc::SyncSender<Vec<u8>>, mpsc::Receiver<Vec<u8>>) {
    mpsc::sync_channel(AUDIO_CHANNEL_CAPACITY)
}

/// The sending half of the audio chunk channel, as used from inside a real-time
/// audio callback.
///
/// `send` never blocks: when the channel is full the chunk is dropped and
/// counted (with a rate-limited warning), and once the receiver is gone all
/// further chunks are silently discarded.
pub struct CallbackChunkSender {
    tx: mpsc::SyncSender<Vec<u8>>,
    dropped: Arc<AtomicU64>,
    dropped_at_last_warning: u64,
    last_warning: Option<Instant>,
    disconnected: bool,
}

impl CallbackChunkSender {
    pub fn new(tx: mpsc::SyncSender<Vec<u8>>) -> Self {
        Self {
            tx,
            dropped: Arc::new(AtomicU64::new(0)),
            dropped_at_last_warning: 0,
            last_warning: None,
            disconnected: false,
        }
    }

    /// Returns a shared counter of the chunks dropped because the channel was full.
    #[cfg(test)]
    pub fn dropped_counter(&self) -> Arc<AtomicU64> {
        self.dropped.clone()
    }

    /// Hands a chunk to the writer thread without ever blocking the caller.
    pub fn send(&mut self, chunk: Vec<u8>) {
        if self.disconnected {
            return;
        }
        match self.tx.try_send(chunk) {
            Ok(()) => {}
            Err(mpsc::TrySendError::Full(_)) => {
                let total = self.dropped.fetch_add(1, Ordering::Relaxed) + 1;
                let now = Instant::now();
                let due = self
                    .last_warning
                    .is_none_or(|t| now.duration_since(t) >= DROP_WARNING_INTERVAL);
                if due {
                    log::warn!(
                        "Audio writer is not keeping up: dropped {} chunk(s) since last warning ({} total)",
                        total - self.dropped_at_last_warning,
                        total
                    );
                    self.last_warning = Some(now);
                    self.dropped_at_last_warning = total;
                }
            }
            Err(mpsc::TrySendError::Disconnected(_)) => {
                self.disconnected = true;
            }
        }
    }
}

pub type AudioStreamConfig = (Box<dyn std::any::Any + Send>, u32, u16, &'static str);

#[cfg_attr(test, mockall::automock)]
pub trait CpalStreamBuilder: Send + Sync {
    fn build_and_start(
        &self,
        selection: &AudioDeviceSelection,
        tx: mpsc::SyncSender<Vec<u8>>,
    ) -> Result<AudioStreamConfig, String>;
}

pub struct DefaultCpalBuilder;

impl CpalStreamBuilder for DefaultCpalBuilder {
    fn build_and_start(
        &self,
        selection: &AudioDeviceSelection,
        tx: mpsc::SyncSender<Vec<u8>>,
    ) -> Result<AudioStreamConfig, String> {
        let host = cpal::default_host();
        let device = find_device(&host, selection)
            .ok_or_else(|| format!("Device not found: {}", selection.name))?;

        let supported_config = if selection.is_input {
            device.default_input_config()
        } else {
            device.default_output_config()
        }
        .map_err(|e| format!("Failed to get device config: {}", e))?;

        let sample_rate = supported_config.sample_rate();
        let channels = supported_config.channels();
        let sample_format = supported_config.sample_format();
        let format_str = get_ffmpeg_format(sample_format);

        let stream = build_stream(&device, &supported_config.into(), tx, sample_format)?;
        Ok((Box::new(stream), sample_rate, channels, format_str))
    }
}

/// How long a loopback writer thread waits for ffmpeg to connect before giving up.
pub const LOOPBACK_ACCEPT_TIMEOUT: Duration = Duration::from_secs(10);

/// Polling interval of the non-blocking accept loop in [`accept_single_loopback`].
const LOOPBACK_ACCEPT_POLL_INTERVAL: Duration = Duration::from_millis(20);

/// Accepts exactly one connection from a loopback peer on `listener`.
///
/// The listener is polled in non-blocking mode until `timeout` elapses.
/// Connections from non-loopback peers are closed immediately and ignored.
/// The listener is consumed and dropped as soon as the first loopback
/// connection has been accepted (or the deadline has passed), so the port
/// is closed and no further connections can be made to it.
///
/// Returns the accepted stream in blocking mode, or `None` on timeout or error.
pub fn accept_single_loopback(listener: TcpListener, timeout: Duration) -> Option<TcpStream> {
    if let Err(e) = listener.set_nonblocking(true) {
        log::error!("Failed to make audio loopback listener non-blocking: {}", e);
        return None;
    }
    let deadline = Instant::now() + timeout;

    let stream = loop {
        match listener.accept() {
            Ok((stream, peer)) => {
                if !peer.ip().is_loopback() {
                    log::warn!(
                        "Rejected non-loopback connection to audio loopback port from {}",
                        peer
                    );
                    drop(stream);
                    continue;
                }
                break stream;
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                if Instant::now() >= deadline {
                    log::warn!(
                        "Timed out after {:?} waiting for ffmpeg to connect to the audio loopback port",
                        timeout
                    );
                    return None;
                }
                thread::sleep(LOOPBACK_ACCEPT_POLL_INTERVAL);
            }
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(e) => {
                log::error!("Failed to accept audio loopback connection: {}", e);
                return None;
            }
        }
    };

    // Close the listening socket right away so nobody else can connect.
    drop(listener);

    // Accepted sockets may inherit the non-blocking flag on some platforms.
    if let Err(e) = stream.set_nonblocking(false) {
        log::error!("Failed to make audio loopback stream blocking: {}", e);
        return None;
    }
    Some(stream)
}

/// Spawns the writer thread that streams audio chunks from `rx` to ffmpeg.
///
/// The thread accepts a single loopback connection on `listener` (see
/// [`accept_single_loopback`]) and exits cleanly if ffmpeg does not connect
/// within [`LOOPBACK_ACCEPT_TIMEOUT`].
pub fn spawn_tcp_loopback(
    listener: TcpListener,
    rx: mpsc::Receiver<Vec<u8>>,
    sample_rate: u32,
    channels: u16,
    format_str: &'static str,
) -> std::thread::JoinHandle<()> {
    spawn_tcp_loopback_with_timeout(
        listener,
        rx,
        sample_rate,
        channels,
        format_str,
        LOOPBACK_ACCEPT_TIMEOUT,
    )
}

fn spawn_tcp_loopback_with_timeout(
    listener: TcpListener,
    rx: mpsc::Receiver<Vec<u8>>,
    sample_rate: u32,
    channels: u16,
    format_str: &'static str,
    accept_timeout: Duration,
) -> std::thread::JoinHandle<()> {
    thread::spawn(move || {
        if let Some(mut stream) = accept_single_loopback(listener, accept_timeout) {
            use std::io::Write;

            let bytes_per_sample = match format_str {
                "f64le" => 8,
                "f32le" | "s32le" => 4,
                "s16le" | "u16le" => 2,
                "s8" | "u8" => 1,
                _ => 4,
            };

            let bytes_per_sec = (sample_rate * channels as u32 * bytes_per_sample) as f64;
            let frame_size = (channels as u32 * bytes_per_sample) as u64;

            let mut silence_buf = vec![0u8; 4096];
            let buf_len = (silence_buf.len() as u64 / frame_size) * frame_size;
            silence_buf.truncate(buf_len as usize);

            if format_str == "u8" {
                silence_buf.fill(128);
            } else if format_str == "u16le" {
                for i in (0..silence_buf.len()).step_by(2) {
                    silence_buf[i] = 0x00;
                    silence_buf[i + 1] = 0x80;
                }
            }

            let start_time = Instant::now();
            let mut total_bytes_sent: u64 = 0;

            loop {
                match rx.recv_timeout(Duration::from_millis(50)) {
                    Ok(data) => {
                        if stream.write_all(&data).is_err() {
                            break;
                        }
                        total_bytes_sent += data.len() as u64;
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        let elapsed_secs = start_time.elapsed().as_secs_f64();
                        let expected_bytes = (elapsed_secs * bytes_per_sec) as u64;

                        if expected_bytes > total_bytes_sent {
                            let mut missing_bytes = expected_bytes - total_bytes_sent;
                            missing_bytes = (missing_bytes / frame_size) * frame_size;

                            if missing_bytes > 0 {
                                let mut to_write = missing_bytes;
                                while to_write > 0 {
                                    let chunk = std::cmp::min(to_write, silence_buf.len() as u64);
                                    if stream.write_all(&silence_buf[..chunk as usize]).is_err() {
                                        return;
                                    }
                                    to_write -= chunk;
                                    total_bytes_sent += chunk;
                                }
                            }
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => {
                        break;
                    }
                }
            }
        }
    })
}

pub fn build_ffmpeg_command(
    ffmpeg_path: &str,
    output_path: &str,
    tcp_ports: &[(u16, u32, u16, &'static str)],
    linux_pulse_inputs: &[String],
) -> Command {
    let mut cmd = Command::new(ffmpeg_path);
    cmd.arg("-y");

    let input_count = tcp_ports.len() + linux_pulse_inputs.len();

    for input_name in linux_pulse_inputs {
        cmd.arg("-f").arg("pulse");
        cmd.arg("-i").arg(input_name);
    }

    for (port, rate, channels, format_str) in tcp_ports {
        cmd.arg("-f")
            .arg(*format_str)
            .arg("-ar")
            .arg(rate.to_string())
            .arg("-ac")
            .arg(channels.to_string())
            .arg("-i")
            .arg(format!("tcp://127.0.0.1:{}", port));
    }

    let mut filter_inputs = String::new();
    for i in 0..input_count {
        filter_inputs.push_str(&format!("[{}:a]", i));
    }

    if input_count > 1 {
        cmd.arg("-filter_complex").arg(format!(
            "{}amix=inputs={}:duration=longest:normalize=0,asplit=2[out1][out2]",
            filter_inputs, input_count
        ));
    } else if input_count == 1 {
        cmd.arg("-filter_complex").arg("[0:a]asplit=2[out1][out2]");
    }

    cmd.arg("-map").arg("[out2]");
    cmd.arg("-vn");
    cmd.arg("-map_metadata").arg("-1");
    cmd.arg("-c:a").arg("libopus");
    cmd.arg("-b:a").arg("24k");
    cmd.arg("-application").arg("voip");
    cmd.arg("-ac").arg("1");
    cmd.arg("-ar").arg("16000");
    cmd.arg(output_path);

    cmd.arg("-map").arg("[out1]");
    cmd.arg("-f").arg("s16le");
    cmd.arg("-ac").arg("1");
    cmd.arg("-ar").arg("16000");
    cmd.arg("pipe:1");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    cmd
}

fn get_ffmpeg_format(format: cpal::SampleFormat) -> &'static str {
    match format {
        cpal::SampleFormat::F32 => "f32le",
        cpal::SampleFormat::I16 => "s16le",
        cpal::SampleFormat::U16 => "u16le",
        cpal::SampleFormat::I8 => "s8",
        cpal::SampleFormat::U8 => "u8",
        cpal::SampleFormat::I32 => "s32le",
        cpal::SampleFormat::F64 => "f64le",
        _ => "f32le",
    }
}

/// Copies a slice of interleaved samples into a byte buffer in native byte
/// order, ready to be streamed to ffmpeg as raw PCM.
///
/// Uses `bytemuck::cast_slice`, so the conversion is checked at compile time
/// (the sample type must be `Pod`) instead of relying on an unsafe pointer cast.
fn samples_to_bytes<T: bytemuck::Pod>(data: &[T]) -> Vec<u8> {
    bytemuck::cast_slice::<T, u8>(data).to_vec()
}

fn build_stream(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    tx: mpsc::SyncSender<Vec<u8>>,
    format: cpal::SampleFormat,
) -> Result<cpal::Stream, String> {
    let err_fn = |err| eprintln!("an error occurred on stream: {}", err);

    // The callback runs on the real-time audio thread, so it must never block:
    // `CallbackChunkSender` only ever uses `try_send`.
    let mut sender = CallbackChunkSender::new(tx);

    macro_rules! build {
        ($type:ty) => {{
            device
                .build_input_stream(
                    *config,
                    move |data: &[$type], _: &cpal::InputCallbackInfo| {
                        sender.send(samples_to_bytes(data));
                    },
                    err_fn,
                    None,
                )
                .map_err(|e| e.to_string())
        }};
    }

    let stream = match format {
        cpal::SampleFormat::F32 => build!(f32),
        cpal::SampleFormat::I16 => build!(i16),
        cpal::SampleFormat::U16 => build!(u16),
        cpal::SampleFormat::I8 => build!(i8),
        cpal::SampleFormat::U8 => build!(u8),
        cpal::SampleFormat::I32 => build!(i32),
        cpal::SampleFormat::F64 => build!(f64),
        _ => Err(format!("Unsupported format {:?}", format)),
    }?;

    stream.play().map_err(|e| e.to_string())?;
    Ok(stream)
}

fn find_device(host: &cpal::Host, selection: &AudioDeviceSelection) -> Option<cpal::Device> {
    if selection.name == "Default Audio Device" || selection.name == "default" {
        return if selection.is_input {
            host.default_input_device()
        } else {
            host.default_output_device()
        };
    }

    let target = selection.name.clone();

    if let Ok(devices) = host.input_devices() {
        for d in devices {
            if get_device_name(&d) == target {
                return Some(d);
            }
        }
    }
    if let Ok(devices) = host.output_devices() {
        for d in devices {
            if get_device_name(&d) == target {
                return Some(d);
            }
        }
    }
    None
}

#[tauri::command]
pub async fn start_recording_inner(
    state: &AudioState,
    ffmpeg_path: String,
    output_path: String,
    log_path: Option<String>,
    device_names: Option<Vec<AudioDeviceSelection>>,
) -> Result<String, String> {
    let output_path = crate::utils::validate_path_in_library(&output_path)?
        .to_string_lossy()
        .to_string();
    let log_path = match log_path {
        Some(path) => {
            let valid = crate::utils::validate_path_in_library(&path)?
                .to_string_lossy()
                .to_string();
            Some(valid)
        }
        None => None,
    };

    {
        let mut session_guard = state.session.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(ref mut session) = *session_guard {
            if let Ok(None) = session.process.try_wait() {
                return Err("Recording is already in progress".into());
            }
            *session_guard = None;
        }
    }

    let base_path = PathBuf::from(&output_path);
    if let Some(parent) = base_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let host = cpal::default_host();
    let names_to_use = match device_names {
        Some(devices) if !devices.is_empty() => devices,
        _ => {
            if let Some(def_in) = host.default_input_device() {
                vec![AudioDeviceSelection {
                    name: get_device_name(&def_in),
                    is_input: true,
                    is_output: false,
                }]
            } else {
                vec![]
            }
        }
    };

    if names_to_use.is_empty() {
        return Err("No input device available".into());
    }

    #[allow(unused_mut)]
    let mut streams = Vec::new();
    #[allow(unused_mut)]
    let mut tcp_ports = Vec::new();
    #[allow(unused_mut)]
    let mut linux_pulse_inputs = Vec::new();

    for selection in &names_to_use {
        #[cfg(target_os = "linux")]
        {
            let resolved_name =
                crate::audio::device::resolve_pulse_device(&selection.name, selection.is_output);
            let mut input_name = resolved_name;
            if selection.is_output && !input_name.ends_with(".monitor") {
                input_name = format!("{}.monitor", input_name);
            }
            linux_pulse_inputs.push(input_name);
            continue;
        }

        #[cfg(target_os = "macos")]
        if selection.is_output {
            continue; // Cannot natively loopback output on macOS with cpal
        }

        #[allow(unreachable_code)]
        let listener =
            TcpListener::bind("127.0.0.1:0").map_err(|e| format!("Failed to bind TCP: {}", e))?;
        let port = listener.local_addr().unwrap().port();

        let (tx, rx) = audio_chunk_channel();

        let (stream_box, sample_rate, channels, format_str) =
            state.cpal_builder.build_and_start(selection, tx)?;

        tcp_ports.push((port, sample_rate, channels, format_str));

        spawn_tcp_loopback(listener, rx, sample_rate, channels, format_str);

        streams.push(stream_box);
    }

    if tcp_ports.is_empty() && linux_pulse_inputs.is_empty() {
        return Err("No valid devices configured for recording".into());
    }

    let mut cmd = build_ffmpeg_command(&ffmpeg_path, &output_path, &tcp_ports, &linux_pulse_inputs);

    if let Some(path) = &log_path {
        if let Ok(log_file) = std::fs::File::create(path) {
            cmd.stderr(std::process::Stdio::from(log_file));
        } else {
            cmd.stderr(std::process::Stdio::null());
        }
    } else {
        cmd.stderr(std::process::Stdio::null());
    }

    cmd.stdout(std::process::Stdio::piped());
    cmd.stdin(std::process::Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;

    let tx = state.audio_tx.clone();
    if let Some(mut stdout) = child.stdout.take() {
        thread::spawn(move || {
            use std::io::Read;
            let mut buf = [0u8; 4096];
            while let Ok(n) = stdout.read(&mut buf) {
                if n == 0 {
                    break;
                }
                let _ = tx.send(buf[..n].to_vec());
            }
        });
    }

    tokio::time::sleep(std::time::Duration::from_millis(200)).await;

    if let Ok(Some(status)) = child.try_wait() {
        let mut err_msg = format!("Recording process exited prematurely: {}. ", status);
        if let Some(path) = &log_path {
            if let Ok(logs) = std::fs::read_to_string(path) {
                if logs.contains("Connection refused") {
                    err_msg.push_str("FFmpeg failed to connect to local audio stream.");
                }
            }
        }
        return Err(err_msg);
    }

    let mut session_guard = state.session.lock().unwrap_or_else(|e| e.into_inner());
    *session_guard = Some(RecordingSession {
        process: child,
        output_path: output_path.clone(),
        _streams: streams,
    });

    Ok("Recording started".into())
}

#[tauri::command]
#[allow(unused_mut, unreachable_code)]
pub async fn start_recording(
    app: tauri::AppHandle,
    state: State<'_, AudioState>,
    output_path: String,
    log_path: Option<String>,
    device_names: Option<Vec<AudioDeviceSelection>>,
) -> Result<String, String> {
    let ffmpeg_path = crate::ffmpeg::get_local_ffmpeg_path(&app)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "ffmpeg".to_string());

    start_recording_inner(&state, ffmpeg_path, output_path, log_path, device_names).await
}

pub async fn stop_recording_inner(state: &AudioState) -> Result<Vec<String>, String> {
    let session = {
        let mut session_guard = state.session.lock().unwrap_or_else(|e| e.into_inner());
        session_guard
            .take()
            .ok_or_else(|| "Not recording".to_string())?
    };

    let mut child = session.process;
    let path = session.output_path;

    // Drop CPAL streams immediately to stop data flow and close TCP connections
    drop(session._streams);

    let mut stopped = false;
    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        if stdin.write_all(b"q").is_ok() && stdin.flush().is_ok() {
            for _ in 0..50 {
                if let Ok(Some(_)) = child.try_wait() {
                    stopped = true;
                    break;
                }
                tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            }
        }
    }

    if !stopped {
        #[cfg(unix)]
        {
            unsafe {
                libc::kill(child.id() as libc::pid_t, libc::SIGTERM);
            }
        }
        #[cfg(not(unix))]
        {
            let _ = child.kill();
        }

        let mut terminated = false;
        for _ in 0..30 {
            if let Ok(Some(_)) = child.try_wait() {
                terminated = true;
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }

        if !terminated {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    // Check file size to discard empty/corrupted recordings
    // A valid 1-second Opus OGG file is generally well over 1KB.
    // If it's less than 1024 bytes, it's essentially empty (or just headers).
    let is_empty = std::fs::metadata(&path)
        .map(|m| m.len() < 1024)
        .unwrap_or(true); // If we can't read metadata, assume invalid/missing

    if is_empty {
        let _ = std::fs::remove_file(&path);
        return Err("Recording was empty and discarded".to_string());
    }

    // _streams drops here, stopping cpal capture
    Ok(vec![path])
}

#[tauri::command]
pub async fn stop_recording(state: State<'_, AudioState>) -> Result<Vec<String>, String> {
    stop_recording_inner(&state).await
}

#[cfg(test)]
mod tests {
    use super::*;

    use std::io::Read;

    #[test]
    fn test_samples_to_bytes_native_endian() {
        let f: [f32; 2] = [1.0, -0.5];
        let mut expected = Vec::new();
        for v in f {
            expected.extend_from_slice(&v.to_ne_bytes());
        }
        assert_eq!(samples_to_bytes(&f), expected);

        let i: [i16; 3] = [0, i16::MAX, i16::MIN];
        let mut expected = Vec::new();
        for v in i {
            expected.extend_from_slice(&v.to_ne_bytes());
        }
        assert_eq!(samples_to_bytes(&i), expected);

        let u: [u8; 2] = [0, 255];
        assert_eq!(samples_to_bytes(&u), vec![0u8, 255]);

        let d: [f64; 1] = [0.25];
        assert_eq!(samples_to_bytes(&d), 0.25f64.to_ne_bytes().to_vec());

        let empty: [i32; 0] = [];
        assert!(samples_to_bytes(&empty).is_empty());
    }

    #[test]
    fn test_tcp_loopback_logic() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let (tx, rx) = audio_chunk_channel();

        let handle = spawn_tcp_loopback(listener, rx, 48000, 2, "f32le");

        let mut stream = std::net::TcpStream::connect(format!("127.0.0.1:{}", port)).unwrap();

        tx.send(vec![1, 2, 3]).unwrap();
        tx.send(vec![4, 5]).unwrap();
        drop(tx);

        let mut buf = Vec::new();
        stream.read_to_end(&mut buf).unwrap();

        assert_eq!(buf, vec![1, 2, 3, 4, 5]);
        handle.join().unwrap();
    }

    #[test]
    fn test_accept_single_loopback_closes_listener() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();

        let client = std::net::TcpStream::connect(addr).unwrap();
        let accepted = accept_single_loopback(listener, Duration::from_secs(5))
            .expect("first loopback connection should be accepted");
        assert!(accepted.peer_addr().unwrap().ip().is_loopback());
        assert_eq!(accepted.peer_addr().unwrap(), client.local_addr().unwrap());

        // The listener has been dropped, so further connections are refused.
        let second = std::net::TcpStream::connect_timeout(&addr, Duration::from_secs(2));
        assert!(second.is_err(), "second connection must not succeed");
    }

    #[test]
    fn test_accept_single_loopback_stream_is_blocking() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let mut client = std::net::TcpStream::connect(addr).unwrap();
        let mut accepted = accept_single_loopback(listener, Duration::from_secs(5)).unwrap();

        // A read on a non-blocking stream would fail with WouldBlock here.
        let writer = thread::spawn(move || {
            use std::io::Write;
            thread::sleep(Duration::from_millis(100));
            client.write_all(&[42]).unwrap();
        });
        let mut buf = [0u8; 1];
        accepted.read_exact(&mut buf).unwrap();
        assert_eq!(buf, [42]);
        writer.join().unwrap();
    }

    #[test]
    fn test_accept_single_loopback_times_out() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();

        let start = Instant::now();
        assert!(accept_single_loopback(listener, Duration::from_millis(200)).is_none());
        let elapsed = start.elapsed();
        assert!(elapsed >= Duration::from_millis(200));
        assert!(elapsed < Duration::from_secs(5));

        // The listener is closed after the timeout as well.
        assert!(std::net::TcpStream::connect_timeout(&addr, Duration::from_secs(2)).is_err());
    }

    #[test]
    fn test_tcp_loopback_thread_exits_when_nobody_connects() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let (tx, rx) = audio_chunk_channel();

        let handle = spawn_tcp_loopback_with_timeout(
            listener,
            rx,
            48000,
            2,
            "f32le",
            Duration::from_millis(200),
        );
        handle.join().unwrap();

        // The receiver was dropped together with the thread.
        assert!(tx.send(vec![1]).is_err());
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_build_ffmpeg_command_windows_multiple_sources() {
        let cmd = build_ffmpeg_command(
            "ffmpeg.exe",
            "out.ogg",
            &[(8080, 48000, 2, "f32le"), (8081, 44100, 1, "s16le")],
            &[],
        );
        let args: Vec<String> = cmd
            .get_args()
            .map(|s| s.to_string_lossy().to_string())
            .collect();
        assert!(args.contains(&"-filter_complex".to_string()));
        assert!(args.contains(
            &"[0:a][1:a]amix=inputs=2:duration=longest:normalize=0,asplit=2[out1][out2]"
                .to_string()
        ));
        assert!(args.contains(&"tcp://127.0.0.1:8080".to_string()));
        assert!(args.contains(&"tcp://127.0.0.1:8081".to_string()));
        assert!(args.contains(&"out.ogg".to_string()));
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_build_ffmpeg_command_windows_single_source() {
        let cmd = build_ffmpeg_command("ffmpeg.exe", "out.ogg", &[(8080, 48000, 2, "f32le")], &[]);
        let args: Vec<String> = cmd
            .get_args()
            .map(|s| s.to_string_lossy().to_string())
            .collect();
        assert!(args.contains(&"-filter_complex".to_string()));
        assert!(args.contains(&"[0:a]asplit=2[out1][out2]".to_string()));
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn test_build_ffmpeg_command_linux() {
        let cmd = build_ffmpeg_command(
            "ffmpeg",
            "out.ogg",
            &[],
            &["alsa_input.pci-0000_00_1f.3.analog-stereo".to_string()],
        );
        let args: Vec<String> = cmd
            .get_args()
            .map(|s| s.to_string_lossy().to_string())
            .collect();
        assert!(args.contains(&"-f".to_string()));
        assert!(args.contains(&"pulse".to_string()));
        assert!(args.contains(&"alsa_input.pci-0000_00_1f.3.analog-stereo".to_string()));
        assert!(args.contains(&"[0:a]asplit=2[out1][out2]".to_string()));
    }

    #[test]
    fn test_callback_send_does_not_block_when_full() {
        let (tx, rx) = mpsc::sync_channel(2);
        let mut sender = CallbackChunkSender::new(tx);
        let dropped = sender.dropped_counter();

        // Run the sends on another thread so a regression to a blocking send
        // fails the test instead of hanging it.
        let (done_tx, done_rx) = mpsc::channel();
        let worker = thread::spawn(move || {
            for i in 0..10u8 {
                sender.send(vec![i]);
            }
            done_tx.send(()).unwrap();
            sender
        });
        done_rx
            .recv_timeout(Duration::from_secs(5))
            .expect("callback-side send blocked on a full channel");
        let mut sender = worker.join().unwrap();

        assert_eq!(dropped.load(Ordering::Relaxed), 8);
        assert_eq!(rx.try_recv().unwrap(), vec![0]);
        assert_eq!(rx.try_recv().unwrap(), vec![1]);
        assert!(rx.try_recv().is_err());

        // Once the receiver is gone, sends are discarded quietly and are not
        // counted as drops.
        drop(rx);
        sender.send(vec![42]);
        sender.send(vec![43]);
        assert!(sender.disconnected);
        assert_eq!(dropped.load(Ordering::Relaxed), 8);
    }

    struct DropDetector(std::sync::Arc<std::sync::atomic::AtomicBool>);
    impl Drop for DropDetector {
        fn drop(&mut self) {
            self.0.store(true, std::sync::atomic::Ordering::SeqCst);
        }
    }

    #[test]
    fn test_streams_dropped_on_session_end() {
        let dropped = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let detector = DropDetector(dropped.clone());

        let session = RecordingSession {
            #[cfg(unix)]
            process: std::process::Command::new("echo").spawn().unwrap(),
            #[cfg(windows)]
            process: std::process::Command::new("cmd")
                .arg("/c")
                .arg("echo")
                .spawn()
                .unwrap(),
            output_path: "test".to_string(),
            _streams: vec![Box::new(detector)],
        };

        drop(session);
        assert!(dropped.load(std::sync::atomic::Ordering::SeqCst));
    }

    #[test]
    fn test_mock_cpal_stream_builder() {
        let mut mock_builder = MockCpalStreamBuilder::new();
        mock_builder
            .expect_build_and_start()
            .times(1)
            .returning(|_, _| Ok((Box::new(5), 48000, 2, "f32le")));

        let selection = AudioDeviceSelection {
            name: "Test".to_string(),
            is_input: true,
            is_output: false,
        };
        let (tx, _rx) = audio_chunk_channel();

        let res = mock_builder.build_and_start(&selection, tx);
        assert!(res.is_ok());
        let (_, rate, channels, fmt) = res.unwrap();
        assert_eq!(rate, 48000);
        assert_eq!(channels, 2);
        assert_eq!(fmt, "f32le");
    }

    #[tokio::test]
    async fn test_stop_recording_inner_not_recording() {
        let state = AudioState::default();
        let res = stop_recording_inner(&state).await;
        assert_eq!(res.unwrap_err(), "Not recording");
    }

    #[tokio::test]
    async fn test_start_recording_inner_already_recording() {
        let state = AudioState::default();

        let mut cmd = std::process::Command::new(if cfg!(windows) { "cmd" } else { "sleep" });
        if cfg!(windows) {
            cmd.args(["/c", "timeout 10"]);
        } else {
            cmd.arg("10");
        }
        let child = cmd.spawn().unwrap();

        {
            let mut guard = state.session.lock().unwrap();
            *guard = Some(RecordingSession {
                process: child,
                output_path: "test".to_string(),
                _streams: vec![],
            });
        }

        let res = start_recording_inner(
            &state,
            "ffmpeg".to_string(),
            "out.ogg".to_string(),
            Some("out.log".to_string()),
            Some(vec![]),
        )
        .await;

        assert_eq!(res.unwrap_err(), "Recording is already in progress");

        let mut guard = state.session.lock().unwrap();
        let mut session = guard.take().unwrap();
        let _ = session.process.kill();
        let _ = session.process.wait();
    }

    #[test]
    fn test_get_ffmpeg_format_mapping() {
        assert_eq!(get_ffmpeg_format(cpal::SampleFormat::F32), "f32le");
        assert_eq!(get_ffmpeg_format(cpal::SampleFormat::I16), "s16le");
        assert_eq!(get_ffmpeg_format(cpal::SampleFormat::U16), "u16le");
        assert_eq!(get_ffmpeg_format(cpal::SampleFormat::I8), "s8");
        assert_eq!(get_ffmpeg_format(cpal::SampleFormat::U8), "u8");
        assert_eq!(get_ffmpeg_format(cpal::SampleFormat::I32), "s32le");
        assert_eq!(get_ffmpeg_format(cpal::SampleFormat::F64), "f64le");
    }

    #[tokio::test]
    async fn test_start_recording_inner_success() {
        let mut mock_builder = MockCpalStreamBuilder::new();

        #[cfg(not(target_os = "linux"))]
        mock_builder
            .expect_build_and_start()
            .times(1)
            .returning(|_, _| Ok((Box::new(5), 48000, 2, "f32le")));

        #[cfg(target_os = "linux")]
        mock_builder.expect_build_and_start().times(0);

        let (tx, _) = tokio::sync::broadcast::channel(1024);
        let state = AudioState {
            session: Mutex::new(None),
            audio_tx: tx,
            cpal_builder: std::sync::Arc::new(mock_builder),
        };

        let temp_dir = std::env::temp_dir();
        #[cfg(unix)]
        let fake_ffmpeg = temp_dir.join("fake_ffmpeg.sh");
        #[cfg(windows)]
        let fake_ffmpeg = temp_dir.join("fake_ffmpeg.bat");

        #[cfg(unix)]
        {
            std::fs::write(&fake_ffmpeg, "#!/bin/sh\nsleep 2\n").unwrap();
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&fake_ffmpeg).unwrap().permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&fake_ffmpeg, perms).unwrap();
        }

        #[cfg(windows)]
        {
            std::fs::write(&fake_ffmpeg, "@echo off\ntimeout /t 2 /nobreak >nul\n").unwrap();
        }

        let docs = dirs::document_dir().unwrap_or_else(std::env::temp_dir);
        let epi_lib = docs.join("Epi Library");
        let rec_dir = epi_lib.join("Recordings");
        let logs_dir = epi_lib.join("Logs");
        std::fs::create_dir_all(&rec_dir).unwrap();
        std::fs::create_dir_all(&logs_dir).unwrap();

        let out_path = rec_dir.join("test_out.ogg").to_string_lossy().to_string();
        let log_path = logs_dir.join("test_log.log").to_string_lossy().to_string();

        let device = AudioDeviceSelection {
            name: "Test Input".to_string(),
            is_input: true,
            is_output: false,
        };

        let res = start_recording_inner(
            &state,
            fake_ffmpeg.to_string_lossy().to_string(),
            out_path,
            Some(log_path),
            Some(vec![device]),
        )
        .await;

        assert!(res.is_ok());

        let mut guard = state.session.lock().unwrap();
        if let Some(mut session) = guard.take() {
            let _ = session.process.kill();
            let _ = session.process.wait();
        }
    }

    #[tokio::test]
    async fn test_stop_recording_inner_success() {
        let temp_dir = std::env::temp_dir();
        #[cfg(unix)]
        let fake_ffmpeg = temp_dir.join("fake_ffmpeg2.sh");
        #[cfg(windows)]
        let fake_ffmpeg = temp_dir.join("fake_ffmpeg2.bat");

        #[cfg(unix)]
        {
            std::fs::write(&fake_ffmpeg, "#!/bin/sh\nsleep 10\n").unwrap();
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&fake_ffmpeg).unwrap().permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&fake_ffmpeg, perms).unwrap();
        }

        #[cfg(windows)]
        {
            std::fs::write(&fake_ffmpeg, "@echo off\ntimeout /t 10 /nobreak >nul\n").unwrap();
        }

        let child = std::process::Command::new(&fake_ffmpeg).spawn().unwrap();

        // Write the fake recording into the temp dir so the test never leaves
        // an artifact in the working directory (previously src-tauri/).
        let out_path = temp_dir.join("epi_test_stop_out.ogg");
        let out_path_str = out_path.to_string_lossy().to_string();

        let state = AudioState::default();
        {
            let mut guard = state.session.lock().unwrap();
            *guard = Some(RecordingSession {
                process: child,
                output_path: out_path_str.clone(),
                _streams: vec![],
            });
        }

        std::fs::write(&out_path, vec![0u8; 1024]).unwrap();

        let res = stop_recording_inner(&state).await;
        let _ = std::fs::remove_file(&out_path);
        assert!(res.is_ok());
        let paths = res.unwrap();
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0], out_path_str);
    }
}
