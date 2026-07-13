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

// Check if we are running inside the Tauri webview
export const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

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
    case 'generate_local_summary':
      await delay(2000);
      return `# Local Meeting Summary\n\n- **Status**: Generated locally using a simulated LLM.\n- **Note**: This is a static mock response for the local model.` as any;
    case 'check_ffmpeg_installation':
      return "global" as any;
    default:
      console.warn(`[Mock API] Unhandled command: ${cmd}`);
      return undefined as any;
  }
}

/**
 * A mock Database class to simulate @tauri-apps/plugin-sql behavior in the browser.
 */
export class MockDatabase {
  private tables: Record<string, any[]> = {
    Recordings: [
      {
        id: 1,
        filename: "sync_meeting_2026.ogg",
        duration: 1800,
        label: "Weekly Sync",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        group_id: null,
        tags: '["frontend", "sync"]'
      },
      {
        id: 2,
        filename: "design_review.ogg",
        duration: 3600,
        label: "Design Review",
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        group_id: null,
        tags: '["design", "urgent"]'
      },
      {
        id: 3,
        filename: "quick_voice_memo.ogg",
        duration: 120,
        label: "Quick Voice Memo",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        group_id: null,
        tags: '[]'
      }
    ],
    Transcripts: [
      {
        id: 1,
        recording_id: 1,
        text_content: "[Alice] Okay, let's start the weekly sync.\n[Bob] I have updates on the frontend.",
        diarized_json: null
      },
      {
        id: 2,
        recording_id: 2,
        text_content: "[Charlie] This design looks great.\n[Dave] I agree, but we need more contrast.",
        diarized_json: null
      },
      {
        id: 3,
        recording_id: 3,
        text_content: "Just a quick note to myself to check the Web Showcase build tomorrow.",
        diarized_json: null
      }
    ],
    Summaries: [
      {
        id: 1,
        transcript_id: 1,
        summary_text: "# Weekly Sync Summary\n\n- **Alice**: Started the meeting.\n- **Bob**: Shared updates regarding the frontend development."
      },
      {
        id: 2,
        transcript_id: 2,
        summary_text: "# Design Review Summary\n\n- **Charlie**: Praised the overall design.\n- **Dave**: Suggested improving the contrast for accessibility."
      }
    ],
    Groups: [],
    Prompts: [
      {
        id: 1,
        title: "Executive Summary & Action Items",
        template_text: `System: You are an expert executive assistant. Your task is to analyze the provided meeting transcript and generate a highly structured Executive Summary.

Instructions:
1. Use Markdown formatting.
2. Do not include any filler text. Start directly with the summary.
3. Organize the output into the following sections:
   - **Meeting Goal/Topic**: A one-sentence summary of the meeting's purpose.
   - **Key Decisions**: Bullet points of finalized decisions.
   - **Main Discussion Points**: A concise summary of the core topics discussed.
   - **Action Items**: A checklist of tasks, including the assignee (if mentioned) and deadline (if mentioned).

Transcript:
{{transcript}}`
      },
      {
        id: 2,
        title: "Detailed Meeting Minutes",
        template_text: `System: You are a meticulous meeting secretary. Your task is to generate Detailed Meeting Minutes from the provided transcript.

Instructions:
1. Use Markdown formatting.
2. Structure the notes chronologically to reflect the flow of the conversation.
3. For each major topic discussed, provide a subheading and a detailed paragraph or bulleted list capturing the nuances of the discussion, differing opinions, and the final consensus.
4. Identify any open questions that were left unresolved.

Transcript:
{{transcript}}`
      },
      {
        id: 3,
        title: "Technical Architecture Notes",
        template_text: `System: You are a Senior Staff Software Engineer analyzing a technical discussion. Your task is to extract all architectural, engineering, and technical information from the transcript.

Instructions:
1. Use Markdown formatting.
2. Organize the output into the following sections:
   - **System Architecture**: Any changes, proposals, or decisions regarding system design, infrastructure, or architecture.
   - **API & Data Models**: Any discussion about endpoints, database schemas, or payloads.
   - **Technical Debt & Blockers**: Any mentioned bugs, refactoring needs, or development blockers.
   - **Next Engineering Steps**: Actionable development tasks.
3. If a section is not applicable to the transcript, write "None discussed."

Transcript:
{{transcript}}`
      },
      {
        id: 4,
        title: "User Research & Feedback",
        template_text: `System: You are an expert UX Researcher analyzing a user interview or feedback session. Your task is to synthesize the user's feedback into actionable product insights.

Instructions:
1. Use Markdown formatting.
2. Extract information into the following sections:
   - **User Profile/Context**: Briefly describe the user and their use case based on the transcript.
   - **Pain Points**: A bulleted list of frustrations, bugs, or difficulties the user experienced. Include exact quotes where highly relevant.
   - **Feature Requests**: Any new features, improvements, or workflows the user explicitly asked for or implicitly needed.
   - **General Sentiment**: A short summary of the user's overall feeling towards the product or topic.

Transcript:
{{transcript}}`
      }
    ],
    Automations: [
      {
        id: 1,
        name: "Morning Auto-Transcribe",
        trigger_time: "08:00",
        timerange_hours: 24,
        action: "transcribe"
      },
      {
        id: 2,
        name: "Friday Summaries",
        trigger_time: "17:00",
        timerange_hours: 120,
        action: "summarize"
      }
    ]
  };

  private idCounters: Record<string, number> = {
    Recordings: 4,
    Transcripts: 4,
    Summaries: 3,
    Groups: 1,
    Prompts: 3,
    Automations: 3
  };

  static async load(path: string): Promise<MockDatabase> {
    console.log(`[Mock API] Database.load(${path})`);
    return new MockDatabase();
  }

  async execute(query: string, bindValues?: any[]): Promise<{ lastInsertId: number; rowsAffected: number }> {
    console.log(`[Mock API] DB execute: ${query}`, bindValues);
    
    // Very naive SQL parsing for inserts to keep the demo working
    if (query.toUpperCase().includes('INSERT INTO RECORDINGS')) {
      const id = this.idCounters.Recordings++;
      this.tables.Recordings.push({
        id,
        filename: bindValues![0],
        duration: bindValues![1],
        label: bindValues![2] || null,
        timestamp: bindValues![3] || new Date().toISOString(),
        group_id: null
      });
      return { lastInsertId: id, rowsAffected: 1 };
    }
    
    if (query.toUpperCase().includes('INSERT INTO TRANSCRIPTS')) {
      const id = this.idCounters.Transcripts++;
      this.tables.Transcripts.push({
        id,
        recording_id: bindValues![0],
        text_content: bindValues![1],
        diarized_json: null
      });
      return { lastInsertId: id, rowsAffected: 1 };
    }

    if (query.toUpperCase().includes('INSERT INTO SUMMARIES')) {
      const id = this.idCounters.Summaries++;
      this.tables.Summaries.push({
        id,
        transcript_id: bindValues![0],
        summary_text: bindValues![1]
      });
      return { lastInsertId: id, rowsAffected: 1 };
    }

    if (query.toUpperCase().includes('DELETE FROM RECORDINGS')) {
      const id = bindValues![0];
      this.tables.Recordings = this.tables.Recordings.filter(r => r.id !== id);
      this.tables.Transcripts = this.tables.Transcripts.filter(t => t.recording_id !== id);
      // Not perfect cascade but sufficient for demo
      return { lastInsertId: 0, rowsAffected: 1 };
    }

    return { lastInsertId: 0, rowsAffected: 0 };
  }

  async select<T>(query: string, bindValues?: any[]): Promise<T> {
    console.log(`[Mock API] DB select: ${query}`, bindValues);

    if (query.includes('PRAGMA table_info(Recordings)')) {
      return [{ name: 'label' }] as any; // simulate migrated db
    }

    if (query.includes('FROM Recordings r') && (query.includes('EXISTS') || query.includes('LEFT JOIN Transcripts'))) {
      let results = this.tables.Recordings.map(r => ({
        ...r,
        hasTranscript: this.tables.Transcripts.some(t => t.recording_id === r.id) ? 1 : 0
      }));

      if (query.includes('WHERE r.id = $1')) {
         return results.filter(r => r.id === bindValues![0]) as any;
      }
      return results.sort((a,b) => b.id - a.id) as any;
    }

    if (query.includes('FROM Transcripts WHERE recording_id')) {
      const recId = bindValues![0];
      const match = this.tables.Transcripts.filter(t => t.recording_id === recId).pop();
      return (match ? [match] : []) as any;
    }

    if (query.includes('FROM Summaries WHERE transcript_id')) {
      const tId = bindValues![0];
      const match = this.tables.Summaries.filter(s => s.transcript_id === tId).pop();
      return (match ? [match] : []) as any;
    }

    if (query.includes('FROM Recordings WHERE id')) {
      const id = bindValues![0];
      const match = this.tables.Recordings.find(r => r.id === id);
      return (match ? [match] : []) as any;
    }

    if (query.includes('FROM Prompts')) {
      return this.tables.Prompts as any;
    }

    if (query.includes('FROM Automations')) {
      return this.tables.Automations.sort((a,b) => b.id - a.id) as any;
    }
    
    if (query.includes('COUNT(*)')) {
      return [{ count: 0 }] as any;
    }

    return [] as any;
  }
}

// --- Mocks for other Tauri plugins ---

import * as TauriEvent from '@tauri-apps/api/event';
import * as TauriPath from '@tauri-apps/api/path';
import * as TauriFs from '@tauri-apps/plugin-fs';
import * as TauriCore from '@tauri-apps/api/core';
import * as TauriOs from '@tauri-apps/plugin-os';
import Database from '@tauri-apps/plugin-sql';

export { Database };

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

export const loadStore = async (path: string) => {
  if (isTauri) {
    const { load } = await import('@tauri-apps/plugin-store');
    return load(path);
  }
  return {
    get: async <T>(_key: string) => null as T,
    set: async (_key: string, _value: any) => {},
    save: async () => {}
  } as any;
};
