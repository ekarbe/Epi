# End-to-end tests

Epi's unit tests mock audio devices, ffmpeg and the Tauri IPC layer. The end-to-end
(E2E) tests do not: they record real sound from a **virtual audio device that plays a
known test tone** (440 Hz by default), then decode the resulting `.ogg` with ffmpeg
and check that it

- exists and has the expected length (at most 2 s shorter than requested, for
  start-up loss, and at most 0.5 s longer than the measured start-to-stop time),
- is not silent (RMS level at least about -40 dBFS) and has no dropouts (at least 80 %
  of the 250 ms blocks carry sound),
- contains the tone: the dominant frequency (Goertzel) is within 3 % of the expected
  one, and the tone carries most of the signal (so noise with a trace of the tone
  fails).

There are two suites:

| Suite | Location | What it drives |
|---|---|---|
| Backend E2E | `src-tauri/tests/recording_e2e.rs` | The app's own start/stop recording code (`start_recording_inner` / `stop_recording_inner`): device -> ffmpeg -> Opus `.ogg` in `~/Documents/Epi Library/Recordings`. No UI. |
| UI E2E | `e2e/ui` (WebdriverIO + tauri-driver) | The real debug build of the desktop app: selects the input device in the Studio, records about 5 s, checks the recording in Studio and Library and the `.ogg` on disk (same thresholds as above), renames it in the Library (audio file and ffmpeg log renamed on disk) and deletes it (row and all files gone). |

Transcription and summaries are **not** covered: a summary needs a transcript, which
only WhisperX or a cloud provider can produce, so it would need a fake WhisperX
installation. No models are ever downloaded.

## Coverage per OS

| OS | Backend E2E | UI E2E | Virtual audio |
|---|---|---|---|
| Linux | Default input (virtual microphone) and system audio (null sink monitor) | Yes (WebKitWebDriver under Xvfb) | PulseAudio null sink + `module-sine` tone (`e2e/ci/setup-audio-linux.sh`) |
| Windows | `CABLE Output` (capture) and the cable's playback endpoint (WASAPI loopback) | Yes (msedgedriver matching the WebView2 Runtime) | VB-CABLE + ffplay tone (`e2e/ci/setup-audio-windows.ps1`) |
| macOS | BlackHole 2ch as input device | **No** | BlackHole 2ch + ffmpeg AudioToolbox tone (`e2e/ci/setup-audio-macos.sh`) |

There is no UI E2E on macOS because WKWebView has no WebDriver implementation that
tauri-driver could use (see the [Tauri WebDriver docs](https://v2.tauri.app/develop/tests/webdriver/)).
macOS also has no system-audio loopback in the app, so only the input path is tested
there.

## Running the backend E2E test

The test is `#[ignore]`d, so a plain `cargo test` only runs the analysis helper's unit
tests and needs no audio hardware. Run it explicitly with `--ignored` once a virtual
device plays the tone. ffmpeg with the `libopus` encoder must be on `PATH` (or set
`EPI_E2E_FFMPEG`).

### Linux

Packages (Debian/Ubuntu): `pulseaudio pulseaudio-utils libasound2-plugins ffmpeg`
plus the usual Tauri build dependencies.

```bash
e2e/ci/setup-audio-linux.sh            # PulseAudio, null sink, virtual mic, 440 Hz tone
cd src-tauri
cargo test --test recording_e2e -- --ignored --nocapture                         # default input
EPI_E2E_OUTPUT_DEVICE=epi_null cargo test --test recording_e2e -- --ignored --nocapture  # system audio
cd .. && e2e/ci/setup-audio-linux.sh stop   # stop the PulseAudio daemon again
```

`setup-audio-linux.sh tone-off` / `tone-on` switch only the tone, e.g. to see the test
fail on silence. The script is meant for headless machines (CI, containers, VMs): it
starts its own PulseAudio daemon if none runs, makes the null sink and the virtual
microphone the **default** sink and source, appends an ALSA-to-PulseAudio block to
`~/.asoundrc` and, if missing, `XDG_DOCUMENTS_DIR` to `~/.config/user-dirs.dirs`. On a
desktop, expect your default audio devices to change; it does not support a
PipeWire-only system without the `pulseaudio` binary.

### Windows

From an **elevated** Windows PowerShell 5.1 in the repository root, with ffmpeg
(including `ffplay.exe`) on `PATH` (e.g. `choco install ffmpeg`):

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\e2e\ci\setup-audio-windows.ps1
cd src-tauri
$env:EPI_E2E_INPUT_DEVICE = 'CABLE Output'
cargo test --test recording_e2e -- --ignored --nocapture
Remove-Item Env:EPI_E2E_INPUT_DEVICE
$env:EPI_E2E_OUTPUT_DEVICE = 'VB-Audio Virtual Cable'   # matches the playback endpoint
cargo test --test recording_e2e -- --ignored --nocapture
Stop-Process -Id (Get-Content "$env:TEMP\epi-e2e-audio\tone.pid")   # stop the tone
```

The script is written for GitHub's Windows Server runners and changes the machine: it
allows microphone access for desktop apps (privacy setting and policy), enables and
starts the Windows Audio services, adds the VB-CABLE signing certificate to
the machine's TrustedPublisher store, installs VB-CABLE (pack 43, "win7" driver,
pinned by SHA-256) via `devcon.exe`, makes the cable the default playback and recording
device and plays the tone with `ffplay`. On a developer machine you can instead install
VB-CABLE normally, make its playback endpoint the default playback device and play a tone
yourself (`ffplay -nodisp -f lavfi sine=frequency=440`).

The playback endpoint is called `CABLE Input (VB-Audio Virtual Cable)` on older Windows
versions and `Speakers (VB-Audio Virtual Cable)` on recent ones, which is why it is
selected by the substring `VB-Audio Virtual Cable` (the test only searches output
devices for `EPI_E2E_OUTPUT_DEVICE`).

### macOS

```bash
brew install ffmpeg
e2e/ci/setup-audio-macos.sh            # installs BlackHole 2ch, restarts coreaudiod, plays the tone
cd src-tauri
EPI_E2E_INPUT_DEVICE=BlackHole cargo test --test recording_e2e -- --ignored --nocapture
cd .. && e2e/ci/setup-audio-macos.sh stop
```

The script needs `sudo` (BlackHole's installer, the coreaudiod restart). It also tries to
grant microphone access by writing TCC rows, which only works with SIP disabled (as on
GitHub's runners). On a normal Mac, allow microphone access for your terminal when
macOS asks (System Settings -> Privacy & Security -> Microphone). **Denied access
records silence instead of failing**, so a "silent recording" failure on macOS usually
means missing permission.

### Options

All optional; see the doc comment of `src-tauri/tests/recording_e2e.rs`:
`EPI_E2E_INPUT_DEVICE`, `EPI_E2E_OUTPUT_DEVICE` (part of the device name is enough on
Windows and macOS; both set = mixed), `EPI_E2E_TONE_HZ` (default 440; also read by the
setup scripts), `EPI_E2E_RECORD_SECS` (default 5), `EPI_E2E_MIN_RMS` (default 0.01),
`EPI_E2E_FFMPEG`, `EPI_E2E_KEEP=1` (keep the recording and ffmpeg log in the library).

## Running the UI E2E suite

Prerequisites on both platforms: Node.js, the Rust toolchain and
`cargo install tauri-driver --locked` (CI pins version 2.1.0). The suite has its own
`package.json` so WebdriverIO stays out of the app's lockfile. By default `npm test`
first builds the app with `npm run tauri build -- --debug --no-bundle`; a binary from a
plain `cargo build`/`cargo test` loads the Vite dev server instead and does not work.
Set `EPI_E2E_SKIP_BUILD=1` to reuse an existing build (rebuild after any `cargo test`,
which overwrites `src-tauri/target/debug/epi`).

### Linux

Additional packages: `webkit2gtk-driver xvfb`.

```bash
npm ci
e2e/ci/setup-audio-linux.sh
cd e2e/ui && npm ci
xvfb-run -a --server-args="-screen 0 1280x1024x24" npm test   # or plain `npm test` with a display
cd ../.. && e2e/ci/setup-audio-linux.sh stop
```

The app runs with a throw-away `HOME` and XDG directories under the work directory
(default `$TMPDIR/epi-e2e-ui`), so your real library, database and settings are never
touched; the PulseAudio socket and cookie and `~/.asoundrc` are passed through. It records
from "PulseAudio Sound Server", which the app maps to PulseAudio's default source (the
virtual microphone).

### Windows

Elevated Windows PowerShell 5.1 in the repository root, after `npm ci`:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\e2e\ci\setup-audio-windows.ps1
$env:EPI_E2E_NATIVE_DRIVER = .\e2e\ci\setup-msedgedriver.ps1
$env:EPI_E2E_INPUT_DEVICE = 'CABLE Output'
cd e2e\ui; npm ci; npm test
```

`setup-msedgedriver.ps1` downloads the msedgedriver matching the installed **WebView2
Runtime** (not the Edge browser), verifies its Microsoft signature and prints its path.
Windows' Documents and AppData folders cannot be redirected, so the suite uses your
**real** library and only creates (and finally removes) files whose names start with
`epi-e2e-ui-`.

### Options

See the doc comment of `e2e/ui/wdio.conf.mjs`: `EPI_E2E_SKIP_BUILD`, `EPI_E2E_APP`,
`TAURI_DRIVER` (default `~/.cargo/bin/tauri-driver`), `EPI_E2E_NATIVE_DRIVER`,
`EPI_E2E_INPUT_DEVICE`, `EPI_E2E_TONE_HZ`, `EPI_E2E_RECORD_SECS`,
`EPI_E2E_UI_WORK_DIR`, `EPI_E2E_NO_ISOLATION=1`, `EPI_E2E_KEEP=1`. A failed test saves
a screenshot to `<work dir>/screenshots`; wdio logs go to `<work dir>/wdio-logs`.

## CI

`.github/workflows/e2e.yml` runs on every `pull_request` (no branch filter, so stacked
PRs run it too) and on `workflow_dispatch`, with `fail-fast: false`. It is separate from
`test.yml`, so unit tests are not slowed down or blocked by audio setup.

- **backend-e2e** (`ubuntu-latest`, `windows-latest`, `macos-latest`): installs ffmpeg,
  builds the test binary, runs the platform's setup script and the ignored test
  (Linux: default input and `epi_null` monitor; Windows: `CABLE Output` and
  loopback of the cable's playback endpoint; macOS: `BlackHole`). On macOS the test binary is passed to
  the setup script so it gets a microphone TCC row.
- **ui-e2e** (`ubuntu-latest`, `windows-latest`): installs a pinned, cached
  tauri-driver (and on Windows the matching msedgedriver), builds the debug app, sets up
  virtual audio and runs `npm test` in `e2e/ui` (Linux under `xvfb-run`).

On failure both jobs upload recordings, app and ffmpeg logs, the audio setup logs and
(UI) wdio logs and screenshots as artifacts for 7 days.

## Known limitations and risks

- **Windows virtual audio.** Hosted runners have no audio hardware. The setup relies on
  the legacy cross-signed VB-CABLE "win7" driver from pack 43 (newer packs are only
  attestation-signed, which Windows Server rejects). If a runner image enables Secure
  Boot or stops accepting cross-signed drivers, the endpoints do not appear and the
  setup step fails. If the runner session cannot play audio, the recording is silent and
  the test reports that.
- **Pinned downloads.** The VB-CABLE pack and `devcon.exe` are pinned by SHA-256; a
  changed upstream file fails the setup until the pin is updated (see the comments in
  `setup-audio-windows.ps1`).
- **WebView2 / msedgedriver.** After a WebView2 update there may briefly be no published
  driver of the exact version; the script then falls back to the newest driver of the
  same major version, then the runner's preinstalled one.
- **WebView2 browser arguments.** msedgedriver passes `--remote-debugging-port` through
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`, which WebView2 ignores because wry always sets
  its own arguments. The app therefore merges that variable into its window's WebView2
  arguments itself (`src-tauri/src/webview_args.rs`); without it the session fails with
  "DevToolsActivePort file doesn't exist".
- **macOS TCC.** Microphone access depends on the runner image's TCC rows and the rows
  the script adds (only possible with SIP disabled). Denied access yields silence, not an
  error. Apple or runner image changes to TCC can break this without any code change.
- **Timing.** Audio only flows once ffmpeg has opened its inputs, which the app does not
  wait for, so recordings may be up to 2 s shorter than requested; the tolerance covers
  what was measured locally, a slow runner could exceed it.
- Only Linux was run before the workflow was added; Windows and macOS are validated on
  GitHub's runners.
