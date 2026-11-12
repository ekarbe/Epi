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

/**
 * In-memory stand-in for the Rust `db_*` commands, used by the web showcase
 * (GitHub Pages) where no Tauri backend exists. Results have the same shape
 * as the real commands in `src-tauri/src/db`.
 */

interface MockRecording {
  id: number;
  filename: string;
  duration: number;
  timestamp: string;
  groupId: number | null;
  label: string | null;
  tags: string[];
}

interface MockTranscript {
  id: number;
  recordingId: number;
  textContent: string;
  diarizedJson: string | null;
}

interface MockSummary {
  id: number;
  transcriptId: number;
  summaryText: string;
}

interface MockPrompt {
  id: number;
  title: string;
  templateText: string;
}

interface MockAutomation {
  id: number;
  name: string;
  triggerTime: string;
  timerangeHours: number;
  action: string;
}

interface MockTables {
  recordings: MockRecording[];
  transcripts: MockTranscript[];
  summaries: MockSummary[];
  prompts: MockPrompt[];
  automations: MockAutomation[];
  glossary: { term: string; meaning: string }[];
  tags: { name: string; context: string }[];
}

/** Default prompt templates, identical to `DEFAULT_PROMPTS` in `src-tauri/src/db/prompts.rs`. */
const DEFAULT_PROMPTS: Omit<MockPrompt, 'id'>[] = [
  {
    title: "Executive Summary & Action Items",
    templateText: `System: You are an expert executive assistant. Your task is to analyze the provided meeting transcript and generate a highly structured Executive Summary.

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
    title: "Detailed Meeting Minutes",
    templateText: `System: You are a meticulous meeting secretary. Your task is to generate Detailed Meeting Minutes from the provided transcript.

Instructions:
1. Use Markdown formatting.
2. Structure the notes chronologically to reflect the flow of the conversation.
3. For each major topic discussed, provide a subheading and a detailed paragraph or bulleted list capturing the nuances of the discussion, differing opinions, and the final consensus.
4. Identify any open questions that were left unresolved.

Transcript:
{{transcript}}`
  },
  {
    title: "Technical Architecture Notes",
    templateText: `System: You are a Senior Staff Software Engineer analyzing a technical discussion. Your task is to extract all architectural, engineering, and technical information from the transcript.

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
    title: "User Research & Feedback",
    templateText: `System: You are an expert UX Researcher analyzing a user interview or feedback session. Your task is to synthesize the user's feedback into actionable product insights.

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
];

/** Builds the showcase's sample library. */
function seedTables(): MockTables {
  return {
    recordings: [
      {
        id: 1,
        filename: "sync_meeting_2026.ogg",
        duration: 1800,
        label: "Weekly Sync",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        groupId: null,
        tags: ["frontend", "sync"]
      },
      {
        id: 2,
        filename: "design_review.ogg",
        duration: 3600,
        label: "Design Review",
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        groupId: null,
        tags: ["design", "urgent"]
      },
      {
        id: 3,
        filename: "quick_voice_memo.ogg",
        duration: 120,
        label: "Quick Voice Memo",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        groupId: null,
        tags: []
      }
    ],
    transcripts: [
      {
        id: 1,
        recordingId: 1,
        textContent: "[Alice] Okay, let's start the weekly sync.\n[Bob] I have updates on the frontend.",
        diarizedJson: null
      },
      {
        id: 2,
        recordingId: 2,
        textContent: "[Charlie] This design looks great.\n[Dave] I agree, but we need more contrast.",
        diarizedJson: null
      },
      {
        id: 3,
        recordingId: 3,
        textContent: "Just a quick note to myself to check the Web Showcase build tomorrow.",
        diarizedJson: null
      }
    ],
    summaries: [
      {
        id: 1,
        transcriptId: 1,
        summaryText: "# Weekly Sync Summary\n\n- **Alice**: Started the meeting.\n- **Bob**: Shared updates regarding the frontend development."
      },
      {
        id: 2,
        transcriptId: 2,
        summaryText: "# Design Review Summary\n\n- **Charlie**: Praised the overall design.\n- **Dave**: Suggested improving the contrast for accessibility."
      }
    ],
    prompts: DEFAULT_PROMPTS.map((p, i) => ({ id: i + 1, ...p })),
    automations: [
      { id: 1, name: "Morning Auto-Transcribe", triggerTime: "08:00", timerangeHours: 24, action: "transcribe" },
      { id: 2, name: "Friday Summaries", triggerTime: "17:00", timerangeHours: 120, action: "summarize" }
    ],
    glossary: [
      { term: 'Tauri', meaning: 'A framework for building tiny, blazingly fast binaries for all major desktop platforms.' },
      { term: 'FFmpeg', meaning: 'A complete, cross-platform solution to record, convert and stream audio and video.' }
    ],
    tags: [
      { name: 'frontend', context: 'UI updates and components.' },
      { name: 'design', context: 'Discussing aesthetics and UX.' },
      { name: 'sync', context: 'Regular team sync.' },
      { name: 'urgent', context: 'High priority tasks.' }
    ]
  };
}

let tables: MockTables = seedTables();

/** Restores the sample library (used by tests). */
export function resetMockDb(): void {
  tables = seedTables();
}

/** Next AUTOINCREMENT-style id for `rows`. */
function nextId(rows: { id: number }[]): number {
  return rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
}

function hasTranscript(recordingId: number): boolean {
  return tables.transcripts.some(t => t.recordingId === recordingId);
}

/** A recording as returned by the library commands (tags only when requested). */
function toLibraryRecording(r: MockRecording, withTags: boolean) {
  const base = {
    id: r.id,
    filename: r.filename,
    duration: r.duration,
    timestamp: r.timestamp,
    label: r.label,
    hasTranscript: hasTranscript(r.id)
  };
  return withTags ? { ...base, tags: [...r.tags] } : base;
}

function byName<T>(key: keyof T) {
  return (a: T, b: T) => String(a[key]).localeCompare(String(b[key]));
}

function deleteTranscriptsOf(recordingId: number): void {
  const ids = new Set(tables.transcripts.filter(t => t.recordingId === recordingId).map(t => t.id));
  tables.summaries = tables.summaries.filter(s => !ids.has(s.transcriptId));
  tables.transcripts = tables.transcripts.filter(t => t.recordingId !== recordingId);
}

/**
 * Serves a `db_*` command from the in-memory tables.
 *
 * @param cmd - Command name, e.g. `db_get_library_recordings`.
 * @param args - The arguments the frontend passes to `invoke` (camelCase).
 * @returns The command result, shaped like the Rust command's JSON.
 * @throws If `cmd` is not a known database command.
 */
export function mockDbCommand(cmd: string, args: any = {}): unknown {
  switch (cmd) {
    case 'db_init':
      return null;

    // Recordings
    case 'db_save_recording': {
      const id = nextId(tables.recordings);
      tables.recordings.push({
        id,
        filename: args.filename,
        duration: args.duration,
        label: args.label ?? null,
        timestamp: args.timestamp || new Date().toISOString(),
        groupId: null,
        tags: []
      });
      return id;
    }
    case 'db_get_library_recordings':
      return [...tables.recordings]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .map(r => toLibraryRecording(r, true));
    case 'db_get_library_recording_by_id': {
      const rec = tables.recordings.find(r => r.id === args.id);
      return rec ? toLibraryRecording(rec, false) : null;
    }
    case 'db_delete_recording':
      deleteTranscriptsOf(args.id);
      tables.recordings = tables.recordings.filter(r => r.id !== args.id);
      return null;
    case 'db_update_recording': {
      const rec = tables.recordings.find(r => r.id === args.id);
      if (rec) {
        rec.filename = args.filename;
        rec.label = args.label ?? null;
      }
      return null;
    }
    case 'db_get_raw_recording_by_id': {
      const rec = tables.recordings.find(r => r.id === args.id);
      if (!rec) return null;
      const { tags: _tags, ...raw } = rec;
      return raw;
    }
    case 'db_get_recordings_older_than_30_days': {
      const cutoff = Date.now() - 30 * 86400000;
      return tables.recordings
        .filter(r => new Date(r.timestamp).getTime() < cutoff)
        .map(r => toLibraryRecording(r, false));
    }
    case 'db_update_recording_tags': {
      const rec = tables.recordings.find(r => r.id === args.id);
      if (rec) rec.tags = [...args.tags];
      return null;
    }

    // Transcripts
    case 'db_save_transcript': {
      const existing = tables.transcripts.find(t => t.recordingId === args.recordingId);
      if (existing) {
        existing.textContent = args.textContent;
        return existing.id;
      }
      const id = nextId(tables.transcripts);
      tables.transcripts.push({ id, recordingId: args.recordingId, textContent: args.textContent, diarizedJson: null });
      return id;
    }
    case 'db_update_transcript': {
      const t = tables.transcripts.find(t => t.id === args.id);
      if (t) t.textContent = args.textContent;
      return null;
    }
    case 'db_get_transcript_for_recording': {
      const t = tables.transcripts.find(t => t.recordingId === args.recordingId);
      return t ? { ...t } : null;
    }
    case 'db_delete_transcript_and_summary':
      deleteTranscriptsOf(args.recordingId);
      return null;

    // Summaries
    case 'db_save_summary': {
      const existing = tables.summaries.find(s => s.transcriptId === args.transcriptId);
      if (existing) {
        existing.summaryText = args.summaryText;
        return existing.id;
      }
      const id = nextId(tables.summaries);
      tables.summaries.push({ id, transcriptId: args.transcriptId, summaryText: args.summaryText });
      return id;
    }
    case 'db_update_summary': {
      const s = tables.summaries.find(s => s.id === args.id);
      if (s) s.summaryText = args.summaryText;
      return null;
    }
    case 'db_get_summary_for_transcript': {
      const s = tables.summaries.find(s => s.transcriptId === args.transcriptId);
      return s ? { id: s.id, summaryText: s.summaryText } : null;
    }

    // Prompts
    case 'db_get_prompts':
      return tables.prompts.map(p => ({ ...p }));
    case 'db_create_prompt': {
      const id = nextId(tables.prompts);
      tables.prompts.push({ id, title: args.title, templateText: args.templateText });
      return id;
    }
    case 'db_update_prompt': {
      const p = tables.prompts.find(p => p.id === args.id);
      if (p) {
        p.title = args.title;
        p.templateText = args.templateText;
      }
      return null;
    }
    case 'db_delete_prompt':
      tables.prompts = tables.prompts.filter(p => p.id !== args.id);
      return null;
    case 'db_ensure_default_prompts':
      if (tables.prompts.length === 0) {
        tables.prompts = DEFAULT_PROMPTS.map((p, i) => ({ id: i + 1, ...p }));
      }
      return null;

    // Tags
    case 'db_get_tags':
      return [...tables.tags].sort(byName('name')).map(t => ({ ...t }));
    case 'db_save_tag_context': {
      const tag = tables.tags.find(t => t.name === args.name);
      if (tag) tag.context = args.context;
      else tables.tags.push({ name: args.name, context: args.context });
      return null;
    }
    case 'db_ensure_tag_exists':
      if (!tables.tags.some(t => t.name === args.name)) {
        tables.tags.push({ name: args.name, context: '' });
      }
      return null;
    case 'db_delete_tag':
      tables.tags = tables.tags.filter(t => t.name !== args.name);
      for (const rec of tables.recordings) {
        rec.tags = rec.tags.filter(t => t !== args.name);
      }
      return null;

    // Glossary
    case 'db_get_glossary':
      return [...tables.glossary].sort(byName('term')).map(g => ({ ...g }));
    case 'db_save_glossary_term': {
      const entry = tables.glossary.find(g => g.term === args.term);
      if (entry) entry.meaning = args.meaning;
      else tables.glossary.push({ term: args.term, meaning: args.meaning });
      return null;
    }
    case 'db_delete_glossary_term':
      tables.glossary = tables.glossary.filter(g => g.term !== args.term);
      return null;

    // Automations
    case 'db_get_automations':
      return [...tables.automations].sort((a, b) => b.id - a.id).map(a => ({ ...a }));
    case 'db_create_automation': {
      const id = nextId(tables.automations);
      tables.automations.push({
        id,
        name: args.name,
        triggerTime: args.triggerTime,
        timerangeHours: args.timerangeHours,
        action: args.action
      });
      return id;
    }
    case 'db_delete_automation':
      tables.automations = tables.automations.filter(a => a.id !== args.id);
      return null;

    // Stats
    case 'db_get_stats':
      return { recordingsCount: tables.recordings.length, transcriptsCount: tables.transcripts.length };

    default:
      throw new Error(`[Mock API] Unknown database command: ${cmd}`);
  }
}
