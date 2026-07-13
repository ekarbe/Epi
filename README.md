<div align="center">
  <img src="https://raw.githubusercontent.com/ekarbe/epi/refs/heads/main/public/epi-logo.svg" alt="Epi Logo" width="128" height="128">
  <h1>Epi</h1>
  <p><strong>Your Local-First Meeting Intelligence</strong></p>
  <a href="https://github.com/ekarbe/epi/actions"><img src="https://github.com/ekarbe/epi/actions/workflows/release.yml/badge.svg" alt="Build Status"></a>
  <a href="https://codecov.io/gh/ekarbe/epi"><img src="https://codecov.io/gh/ekarbe/epi/branch/main/graph/badge.svg" alt="codecov"></a>
</div>

# Epi - Local-first Meeting Intelligence

[![Build Status](https://github.com/ekarbe/epi/actions/workflows/deploy.yml/badge.svg)](https://github.com/ekarbe/epi/actions/workflows/release.yml)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-orange.svg)](https://v2.tauri.app/)
[![React 19](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Rust](https://img.shields.io/badge/Rust-1.80+-black.svg)](https://www.rust-lang.org/)

**Epi** (named after Epimetheus, the Titan of afterthought) is a local-first, privacy-by-design desktop application that records meetings, transcribes them natively, and generates intelligent summaries using local Large Language Models (LLMs). 

Built with **Tauri v2** and **Rust**, Epi keeps your data securely on your machine-operating entirely offline by default with zero privacy trade-offs.

## 🧭 The Journey to Epi

Epi wasn't built in a day. It evolved from a simple need to a full-fledged local intelligence platform through multiple iterations:

- **The Itch:** It started because I wanted a simple tool that records my voice and lets me transcribe and write action points.
- **The Evolution:** Then I wanted the tool to also record the audio from videos where I could add some context or questions by stopping the video and talking. Out of that I could create a summary of that video with my remarks.
- **The Prototype:** The tool initially turned into a Python app with a Flet frontend that I had to start manually in the terminal.
- **The Final Form:** After a lot of tinkering and changes, experimenting with different layouts and prototypes, I finally ended up with Epi-a polished, local-first Tauri desktop application.

## 🌟 Live Web Showcase

Want to see how it works without downloading the app?  
Check out the interactive web preview (with simulated recording and transcription):

👉 **[Launch the Live Demo](https://eikekarbe.com/epi/)**

## ✨ Core Features

- 🎙️ **Local Audio Recording**: Low-latency, high-fidelity capture directly from your system microphone.
- ✍️ **Native Transcription**: Offline speech-to-text powered by WhisperX, running in an isolated local Python environment.
- 🧠 **Local LLM Summaries**: Generate meeting minutes, action items, and insights privately using Ollama (Llama/Mistral).
- 🎨 **Apple-Inspired Design**: A beautiful, glassmorphic UI featuring bento-grid layouts and seamless light/dark modes.
- ⚡ **Lightning Fast**: Rust backend guarantees minimal resource overhead and rapid processing.
- 📁 **Private Storage**: Your media files (`.wav` recordings, transcripts, summaries) are saved in your `~/Documents/Epi Library/` folder. App metadata and settings reside securely in the Tauri app data directory.

## ☁️ Optional Cloud Integrations
While Epi is built to be local-first, you can opt-in to use external cloud providers for enhanced speed or accuracy:
- **Cloud Transcription**: Support for OpenAI Whisper, AssemblyAI, and Google AI Studio.
- **Cloud LLM Summaries**: Generate insights using OpenAI, Anthropic, or Google AI Studio.

All providers are configured in the **Engine** tab, and your API keys are securely encrypted and stored locally using [Tauri Stronghold](https://v2.tauri.app/plugin/stronghold/).

## 🛠️ Architecture

Epi utilizes a modern, robust tech stack:

- **Frontend**: React 19, TypeScript 5.8, Vite 7
- **Styling**: Pure Vanilla CSS (`src/index.css`) utilizing CSS custom properties for a responsive, unified design system.
- **Backend**: Rust (2021 Edition) orchestrating local processes via `#[tauri::command]`.
- **Database**: SQLite (via `tauri-plugin-sql`) for metadata storage.
- **AI Tooling**: `ffmpeg` (audio), WhisperX (transcription), Ollama (summarization).

## 🚀 Getting Started

Epi is built to run across platforms and primarily targets **Linux**, but also fully supports **Windows** and **macOS**. 

> [!WARNING]
> **macOS Builds are Untested**
> While Epi is designed to be fully cross-platform and the codebase contains macOS-specific audio and path handling, the application has only been extensively tested on Linux and Windows. macOS users may encounter unexpected behavior or compilation issues. Contributions and issue reports from macOS users are highly welcome!
> 
> **Note on macOS Audio Recording:** Due to native limitations in `ffmpeg`'s `avfoundation` capture, Epi cannot directly record system output audio (Speakers/Headphones) on macOS. You can only record microphone inputs natively. To record system audio on macOS, you must install a virtual audio loopback driver like [BlackHole](https://existential.audio/blackhole/) and route your audio through it.

To build and run the desktop application locally, ensure you have the following prerequisites installed:
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)
- [FFmpeg](https://ffmpeg.org/) (must be available in your system PATH)
- [Python 3.10+](https://www.python.org/) (required for the local WhisperX virtual environment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ekarbe/epi.git
   cd epi
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   npm run tauri dev
   ```

4. **Build for production**
   ```bash
   npm run tauri build
   ```

## 🌐 Web Showcase Development

The frontend is dual-purpose. It can be built as a standard web application for showcase purposes:
```bash
# Preview the Web Showcase locally (mocked environment)
npm run dev
```

## License

See the [LICENSE](LICENSE.md) file for license rights and limitations (GPLv3).

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
