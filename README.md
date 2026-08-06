<div align="center">
  <img src="https://raw.githubusercontent.com/ekarbe/epi/refs/heads/main/public/epi-logo.svg" alt="Epi Logo" width="128" height="128">
  <h1>Epi</h1>
  <p><strong>Your Local-First Meeting Intelligence</strong></p>
  <a href="https://github.com/ekarbe/epi/actions/workflows/release.yml"><img src="https://github.com/ekarbe/epi/actions/workflows/release.yml/badge.svg" alt="Build Status"></a>
  <a href="https://codecov.io/gh/ekarbe/epi"><img src="https://codecov.io/gh/ekarbe/epi/branch/main/graph/badge.svg" alt="codecov"></a>
</div>

# Epi — Local-First Meeting Intelligence (v1.1.0)

[![Build Status](https://github.com/ekarbe/epi/actions/workflows/release.yml/badge.svg)](https://github.com/ekarbe/epi/actions/workflows/release.yml)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2.0-orange.svg?style=flat-square&logo=tauri)](https://v2.tauri.app/)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript 5.8](https://img.shields.io/badge/TypeScript-5.8-blue.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Rust 2021](https://img.shields.io/badge/Rust-2021_Edition-000000.svg?style=flat-square&logo=rust)](https://www.rust-lang.org/)
[![Vite 7](https://img.shields.io/badge/Vite-7.0-646CFF.svg?style=flat-square&logo=vite)](https://vitejs.dev/)
[![License: GPLv3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat-square)](LICENSE.md)

**Epi** (named after Epimetheus, the Titan of afterthought) is a privacy-by-design desktop application that records meetings, transcribes them natively offline, and generates intelligent summaries using local Large Language Models (LLMs).

Built with **Tauri v2**, **React 19**, **TypeScript 5.8**, and **Rust**, Epi keeps your data securely on your machine — operating entirely offline by default with zero privacy trade-offs.

---

## 🧭 The Journey to Epi

Epi wasn't built in a day. It evolved from a simple need into a context-aware local intelligence platform:

- **The Itch:** It started because I wanted a simple tool that records my voice and lets me transcribe and write action points.
- **The Evolution:** Then I wanted the tool to also record the audio from videos where I could add some context or questions by stopping the video and talking. Out of that I could create a summary of that video with my remarks.
- **The Prototype:** The tool initially turned into a Python app with a Flet frontend that I had to start manually in the terminal.
- **The Final Form:** After a lot of tinkering and changes, experimenting with different layouts and prototypes, I finally ended up with Epi — a polished, local-first Tauri desktop application.

---

## 🌟 Live Web Showcase

Want to see how it works without downloading the desktop app? Check out the interactive web preview (with simulated recording, transcription, and summarization):

👉 **[Launch the Live Demo](https://eikekarbe.com/Epi/#demo)**

---

## ✨ Core Features & What's New in v1.1.0

### 🎙️ Native Local Audio Capture
- Low-latency, high-fidelity capture powered by `cpal` device resolution and TCP loopback streaming to an isolated `ffmpeg` process.
- Audio is saved directly on your local disk as compressed Opus (`.ogg`) files (`~/Documents/Epi Library/Recordings/`).
- Supports simultaneous multi-device input and output selection.

### ✍️ Offline Speech-to-Text (WhisperX)
- Offline transcription using WhisperX running in a managed local Python virtual environment (`whisperx_env`).
- Word-level timestamps, real-time live microphone transcription (`live_transcribe.py`), and speaker diarization (with Pyannote HuggingFace token support).
- **CPU-Only Install Option**: Option to install CPU-only PyTorch dependencies in `whisperx_env`, saving ~3.8 GB of disk space.

### 🧠 Local LLM Summaries & In-App Model Management
- Extract meeting minutes, decisions, and action items using Ollama (Llama 3, Mistral, Qwen, etc.).
- **In-App Ollama Model Manager (New in v1.1.0)**: Browse, pull (with live streamed percentage download progress), and delete Ollama models directly in the Engine tab, backed by native Rust disk space checks (`sysinfo`).

### 📖 Global Glossary & Tag-Based Context Injection (New in v1.1.0)
- **Global Glossary**: Define domain-specific terms and acronyms that are automatically fed into WhisperX's `initial_prompt` to improve speech recognition accuracy on technical jargon.
- **Tag Context Injection**: Assign tags with background context to recordings. During LLM summarization, active tag contexts and related historical recording summaries are injected inside `<BACKGROUND_CONTEXT>` tags ahead of the transcript.

### 🏷️ Dynamic Recording Naming Schemas (New in v1.1.0)
- Flexible filename templating (`epi_naming_schema`) with token replacement (`{title}`, `{DD}`, `{MM}`, `{YYYY}`, `{HH}`, `{mm}`, `{counter}`).
- Daily counters are automatically calculated against local SQLite timestamps.

### 📌 Sticky Pill Navigation & Tag Search (New in v1.1.0)
- **Sticky Pill Header**: Floating navigation bar stays pinned to the top while scrolling long transcriptions or library lists.
- **Tag Search**: Filter recordings in the Library tab by assigned tags alongside title and text content.

### ⏰ Scheduled Automations & Multi-Tier Storage Cleanup
- **Scheduled Automations**: Configure background rules to automatically run transcriptions or default summarizations on recordings.
- **Multi-Tier Storage Cleanup**: Reclaim disk space by performing audio-only deletions (preserving text transcripts and summaries), deleting summaries/transcripts only, or clearing application logs.

### ☁️ Opt-In Cloud Integrations
- Optional cloud fallbacks for OpenAI (Whisper & GPT-4o), AssemblyAI, Google AI Studio (Gemini), and Anthropic (Claude).
- API keys are encrypted at rest using **Tauri Stronghold** (`tauri-plugin-stronghold`).

---

## 🖥️ Application Tab Architecture

Epi is organized into four core workspace tabs:

1. **Studio Tab**: Microphones and audio output device selection, record/stop button, real-time audio waveform visualization, and live microphone transcription.
2. **Analysis Tab**: Complete transcript editor, speaker label inspection, summary generation, custom prompt template selection, and tag context injection.
3. **Library Tab**: Filterable recording history with tag search, playback control, re-transcription actions, and granular multi-tier storage deletion options.
4. **Engine Tab**: Central control center for Ollama model downloading/deletion, WhisperX setup & CPU-only toggle, built-in one-click FFmpeg manager, Global Glossary & Tags configuration, Naming Schemas, Automations, and Stronghold-encrypted Cloud API keys.

---

## 🛠️ Tech Stack Matrix

| Subsystem | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19 · TypeScript 5.8 (Strict) · Vite 7 | Modern reactive component interface |
| **Styling & Icons** | Vanilla CSS Custom Properties · `lucide-react` | Glassmorphism aesthetic, dark/light theme binding |
| **Desktop Runtime** | Tauri v2 (`@tauri-apps/api/core`) | Native OS IPC, window management, permissions |
| **Backend Core** | Rust 2021 Edition · Tokio · `sysinfo` | Async command dispatch, disk space check, process supervision |
| **Audio Engine** | `cpal` · `ffmpeg` (TCP Loopback) | Device enumeration, audio streaming, Opus `.ogg` encoding |
| **Local AI Engine** | WhisperX (Python 3.10+ venv) · Ollama Daemon | Offline speech recognition & LLM summarization |
| **Storage & Security** | SQLite (`tauri-plugin-sql`) · Tauri Stronghold | Relational metadata storage & encrypted secret storage |

---

## 📐 Architecture & Data Flow

```
+-----------------------------------------------------------------------------------+
|                                 REACT 19 FRONTEND                                 |
|   App.tsx  <-->  SessionContext  <-->  LibrarySettingsContext  <-->  WebShowcase  |
+------------------------------------------+----------------------------------------+
                                           | Tauri IPC invoke()
                                           v
+-----------------------------------------------------------------------------------+
|                                RUST TAURI BACKEND                                 |
|   lib.rs  <-->  audio/  <-->  whisperx/  <-->  cloud_llm/  <-->  local_llm/       |
+---------+--------------------+---------------------+------------------------------+
          |                    |                     |
          v                    v                     v
   +--------------+   +------------------+   +-------------------+
   | CPAL / FFmpeg|   | Python WhisperX  |   | Ollama Local API  |
   | TCP Stream   |   | (whisperx_env)   |   | (localhost:11434) |
   +------+-------+   +--------+---------+   +---------+---------+
          |                    |                       |
          +--------------------+-----------------------+
                               | File System / SQLite
                               v
   +-----------------------------------------------------------------+
   | LOCAL STORAGE: ~/Documents/Epi Library/ & AppData/epi_meta.db   |
   +-----------------------------------------------------------------+
```

### Key Data Flows
1. **Recording Lifecycle**: `SessionContext.startRecording()` -> Tauri IPC `start_recording` -> Rust allocates `cpal` audio buffer -> streams over local TCP socket -> `ffmpeg` writes `.ogg` -> `stop_recording` flushes output -> SQLite record created.
2. **Transcription Lifecycle**: Audio path passed to `run_whisperx` -> Rust invokes `whisperx_env/bin/whisperx` with Glossary `initial_prompt` -> generates text + word timestamps -> `.txt`/`.json` saved to `Transcriptions/` -> SQLite updated.
3. **Summarization Lifecycle**: Transcript text + prompt template + `<BACKGROUND_CONTEXT>` tags sent to `generate_local_summary` (Ollama) or `generate_cloud_summary` -> markdown result saved to `Summaries/` and SQLite.

---

## 🚀 Getting Started

Epi runs across platforms and primarily targets **Linux**, while fully supporting **Windows** and **macOS**.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust Toolchain](https://www.rust-lang.org/tools/install) (1.80+)
- **FFmpeg**: Available in system PATH **OR** automatically downloaded via Epi's built-in one-click installer into `{AppData}/ffmpeg/`.
- [Python 3.10+](https://www.python.org/) (required for the local WhisperX virtual environment).
- [Ollama](https://ollama.com/) *(Optional, for local LLM inference)*: Running on `http://localhost:11434`.

### Installation & Development Commands

```bash
# 1. Clone the repository
git clone https://github.com/ekarbe/epi.git
cd epi

# 2. Install Node dependencies
npm install

# 3. Launch full Tauri desktop dev mode (Frontend + Rust Backend)
npm run tauri dev

# 4. Preview Web Showcase only (Mocked environment)
npm run dev

# 5. Type-check TypeScript codebase
npx tsc --noEmit

# 6. Build production desktop installer
npm run tauri build
```

---

## 💻 OS Support & Operating Notes

- **Linux (Primary Target)**: Supported via `.deb` and `.AppImage`. Audio capture integrates natively with PulseAudio / PipeWire monitor sources.
- **Windows**: Supported via `.msi` and `.exe` installers. Uses WASAPI loopback audio capture. Unsigned binaries trigger Windows Defender SmartScreen ("More info" -> "Run anyway").
- **macOS**: Supported via `.dmg` installers (Apple Silicon & Intel).
  - *macOS Audio Note*: Native macOS security restrictions prevent direct recording of system output audio (Speakers/Headphones) via standard APIs. Microphone capture works out of the box. To capture system audio on macOS, install a virtual audio loopback driver such as [BlackHole](https://existential.audio/blackhole/) and select it in the Studio tab.
  - *macOS Gatekeeper Note*: Unsigned macOS builds trigger an "unidentified developer" warning. Bypass by Control-clicking (or right-clicking) `Epi.app` in Finder and selecting **Open**.

---

## 📁 Storage Directory Index

| Content Type | Location | Description |
|---|---|---|
| Audio Recordings | `~/Documents/Epi Library/Recordings/` | Compressed Opus (`.ogg`) audio files |
| Transcripts | `~/Documents/Epi Library/Transcriptions/` | Raw text (`.txt`) and word-timestamp JSON (`.json`) |
| Summaries | `~/Documents/Epi Library/Summaries/` | Markdown (`.md`) LLM-generated summaries |
| Application Logs | `~/Documents/Epi Library/Logs/` | Process logs (`app.log`, `_ffmpeg.log`) |
| Database | `{AppData}/epi_meta.db` | SQLite metadata database (`tauri-plugin-sql`) |
| Secrets & Settings | `{AppData}/settings.json` | Encrypted store (`tauri-plugin-stronghold`) |
| WhisperX Venv | `{AppData}/whisperx_env/` | Isolated Python virtual environment |
| Local FFmpeg | `{AppData}/ffmpeg/` | Managed standalone FFmpeg binary |

---

## 📄 License

See the [LICENSE](LICENSE.md) file for license rights and limitations (GPLv3).

```
Epi - Local-first Meeting Intelligence
Copyright (C) 2026  Eike Christian Karbe

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
```
