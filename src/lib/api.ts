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

import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { mockDbCommand } from './mockDb';

// Check if we are running inside the Tauri webview
export const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

/** In-memory stand-in for the OS keyring used by the web showcase. */
const MOCK_SECRETS: Record<string, string> = {};

/**
 * A wrapper around Tauri's invoke.
 * In the browser (GitHub Pages), this intercepts calls and returns simulated data with realistic delays.
 */
export async function invoke<T>(cmd: string, args?: any): Promise<T> {
  if (isTauri) {
    return tauriInvoke(cmd, args);
  }

  if (cmd !== 'append_app_log') {
    console.log(`[Mock API] Invoked: ${cmd}`, args);
  }

  // Database commands are served from the in-memory sample library.
  if (cmd.startsWith('db_')) {
    return mockDbCommand(cmd, args) as T;
  }

  // Helper to simulate network/processing delay
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  switch (cmd) {
    case 'get_audio_devices':
      return [
        { name: "Default Microphone", is_input: true, is_output: false, is_default: true },
        { name: "Wireless Headset Microphone", is_input: true, is_output: false, is_default: false },
        { name: "Default Speakers", is_input: false, is_output: true, is_default: true }
      ] as any;
    case 'start_recording':
      if (args && args.outputPath) {
        const filename = args.outputPath.split(/[/\\]/).pop();
        if (filename) MOCK_FILES.add(filename);
      }
      return null as any;
    case 'stop_recording':
      // Return the most recently added file, or a default
      const files = Array.from(MOCK_FILES);
      const lastFile = files.length > 0 ? files[files.length - 1] : 'unknown.ogg';
      return [`/mock/document/dir/Epi Library/Recordings/${lastFile}`] as any;

    case 'check_whisperx_status':
      return { installed: true, venv_exists: true, python_version: '3.10.0' } as any;
    case 'get_wav_metadata':
      return { duration: 12, modified: new Date().toISOString() } as any;
    case 'run_whisperx':
      await delay(3000); // simulate transcription time
      return { success: true, code: 0, stdout: "Mocked transcription complete.", stderr: "" } as any;
    case 'generate_cloud_summary':
      await delay(2000); // simulate LLM generation
      const text = (args?.transcript || '').toLowerCase();
      if (text.includes('design') || text.includes('contrast')) {
        return `# Design Review Summary\n\n- **Charlie**: Praised the overall design.\n- **Dave**: Suggested improving the contrast for accessibility.` as any;
      } else if (text.includes('weekly sync') || text.includes('frontend')) {
        return `# Weekly Sync Summary\n\n- **Alice**: Started the meeting.\n- **Bob**: Shared updates regarding the frontend development.` as any;
      } else {
        return `# Meeting Summary\n\n- **Welcome**: The speaker welcomed attendees to the Epi showcase.\n- **Simulation**: This is a demonstration of the offline capabilities running in a mocked web environment.` as any;
      }
    case 'get_downloaded_models':
      return ["tiny.en", "base"] as any;
    case 'get_library_size':
      return 1024 * 1024 * 42 as any; // 42 MB
    case 'transcribe_cloud':
      await delay(3000); // simulate cloud transcription
      return "[Mocked cloud transcription text] Welcome to the Epi showcase!" as any;
    case 'check_cuda_support':
      return false as any;
    case 'install_whisperx':
      await delay(2000);
      return undefined as any;
    case 'get_storage_breakdown':
      return { 
        recordings: 1024*1024*20, 
        transcriptions: 1024*1024*2, 
        summaries: 1024*1024*1, 
        logs: 1024*1024*5, 
        total: 1024*1024*28 
      } as any;
    case 'download_model':
    case 'delete_model':
    case 'delete_recording_files':
    case 'delete_audio_file':
    case 'delete_transcript_files':
    case 'rename_recording_files':
    case 'delete_all_logs':
    case 'install_ffmpeg':
    case 'uninstall_ffmpeg':
    case 'uninstall_whisperx':
    case 'start_live_transcription':
    case 'stop_live_transcription':
      await delay(300);
      return undefined as any;
    case 'append_app_log':
      return undefined as any;
    case 'get_local_models':
      return ['llama3.2', 'mistral', 'qwen2.5'] as any;
    case 'pull_ollama_model':
      await delay(1500);
      return undefined as any;
    case 'delete_ollama_model':
      await delay(300);
      return undefined as any;
    case 'generate_local_summary':
      await delay(2000);
      return `# Local Meeting Summary\n\n- **Status**: Generated locally using a simulated LLM.\n- **Note**: This is a static mock response for the local model.` as any;
    case 'check_ffmpeg_installation':
      return "global" as any;
    // Secrets live only in memory in the web showcase.
    case 'get_secret':
      return (MOCK_SECRETS[args?.name] ?? null) as any;
    case 'set_secret':
      if (args?.value) MOCK_SECRETS[args.name] = args.value;
      else delete MOCK_SECRETS[args?.name];
      return undefined as any;
    case 'delete_secret':
      delete MOCK_SECRETS[args?.name];
      return undefined as any;
    default:
      console.warn(`[Mock API] Unhandled command: ${cmd}`);
      return undefined as any;
  }
}

// --- Mocks for other Tauri plugins ---

import * as TauriEvent from '@tauri-apps/api/event';
import * as TauriPath from '@tauri-apps/api/path';
import * as TauriFs from '@tauri-apps/plugin-fs';
import * as TauriCore from '@tauri-apps/api/core';
import * as TauriOs from '@tauri-apps/plugin-os';
export const listen = isTauri ? TauriEvent.listen : async (_event: string, _handler: any) => {
  return () => {}; // return unlisten fn
};

export const documentDir = isTauri ? TauriPath.documentDir : async () => '/mock/document/dir';
export const join = isTauri ? TauriPath.join : async (...paths: string[]) => paths.join('/');
export const BaseDirectory = isTauri ? TauriPath.BaseDirectory : { Document: 1, AppData: 2 } as any;

const MOCK_FILES = new Set([
  'sync_meeting_2026.ogg',
  'design_review.ogg',
  'quick_voice_memo.ogg',
  'dummy_recording_12345.ogg'
]);

export const writeTextFile = isTauri ? TauriFs.writeTextFile : async (_path: string, _content: string, _options?: any) => {};
export const exists = isTauri ? TauriFs.exists : async (path: string, _options?: any) => {
  if (!path) return false;
  if (path === 'Epi Library' || path.includes('Epi Library/Recordings') && path.endsWith('Recordings')) return true;
  if (path.includes('Epi Library/Transcriptions') && path.endsWith('Transcriptions')) return true;
  if (path.includes('Epi Library/Summaries') && path.endsWith('Summaries')) return true;
  if (path.includes('Epi Library/Logs') && path.endsWith('Logs')) return true;
  
  const filename = path.split(/[/\\]/).pop() || '';
  if (MOCK_FILES.has(filename)) return true;
  
  return false;
};
export const readDir = isTauri ? TauriFs.readDir : async (path: string, _options?: any) => {
  if (path.includes('Recordings')) {
    return Array.from(MOCK_FILES).map(name => ({
      name,
      isFile: true,
      isDirectory: false
    })) as any;
  }
  return [];
};
export const readFile = isTauri ? TauriFs.readFile : async (_path: string, _options?: any) => new Uint8Array();
export const readTextFile = isTauri ? TauriFs.readTextFile : async (path: string, _options?: any) => {
  if (path.endsWith('.json')) {
    return JSON.stringify({
      segments: [
        { start: 0, end: 5, text: " Hello and welcome to the Epi showcase!" },
        { start: 5, end: 12, text: " This is a simulated transcription running entirely in the browser." }
      ],
      language: "en"
    });
  }
  return "";
};
export const stat = isTauri ? TauriFs.stat : async (_path: string, _options?: any) => ({ isFile: true, size: 0 });

export const convertFileSrc = isTauri ? TauriCore.convertFileSrc : (path: string) => {
  if (path.endsWith('.ogg') || path.endsWith('.wav')) {
    return "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
  }
  return path;
};
export const platform = isTauri ? TauriOs.platform : () => 'mock-os';

const MOCK_STORE: Record<string, any> = {
  'epi_naming_schema': '{title}_{YYYY}{MM}{DD}_{counter}'
};

export const loadStore = async (path: string) => {
  if (isTauri) {
    const { load } = await import('@tauri-apps/plugin-store');
    return load(path);
  }
  return {
    get: async <T>(key: string) => MOCK_STORE[key] as T,
    set: async (key: string, value: any) => { MOCK_STORE[key] = value; },
    delete: async (key: string) => { const had = key in MOCK_STORE; delete MOCK_STORE[key]; return had; },
    save: async () => {}
  } as any;
};
