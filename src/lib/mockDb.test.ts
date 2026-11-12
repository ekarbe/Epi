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

import { describe, it, expect, beforeEach } from 'vitest';
import { mockDbCommand, resetMockDb } from './mockDb';
import { invoke } from './api';

describe('web showcase database mock', () => {
  beforeEach(() => {
    resetMockDb();
  });

  it('is served by the non-Tauri invoke', async () => {
    const stats = await invoke<{ recordingsCount: number; transcriptsCount: number }>('db_get_stats');
    expect(stats).toEqual({ recordingsCount: 3, transcriptsCount: 3 });
    await expect(invoke('db_unknown')).rejects.toThrow('Unknown database command');
  });

  it('lists the sample library newest first with tags', () => {
    const list = mockDbCommand('db_get_library_recordings') as any[];
    expect(list.map(r => r.id)).toEqual([3, 1, 2]);
    expect(list[1]).toMatchObject({ label: 'Weekly Sync', hasTranscript: true, tags: ['frontend', 'sync'] });
    expect(mockDbCommand('db_get_library_recording_by_id', { id: 1 })).not.toHaveProperty('tags');
  });

  it('saves recordings, transcripts and summaries as upserts', () => {
    const recId = mockDbCommand('db_save_recording', { filename: 'n.ogg', duration: 5, label: null, timestamp: null }) as number;
    expect(recId).toBe(4);
    const t1 = mockDbCommand('db_save_transcript', { recordingId: recId, textContent: 'a' });
    const t2 = mockDbCommand('db_save_transcript', { recordingId: recId, textContent: 'b' });
    expect(t1).toBe(t2);
    expect(mockDbCommand('db_get_transcript_for_recording', { recordingId: recId })).toMatchObject({ textContent: 'b' });

    const s1 = mockDbCommand('db_save_summary', { transcriptId: t1, summaryText: 'x' });
    expect(mockDbCommand('db_save_summary', { transcriptId: t1, summaryText: 'y' })).toBe(s1);
    expect(mockDbCommand('db_get_summary_for_transcript', { transcriptId: t1 })).toEqual({ id: s1, summaryText: 'y' });

    mockDbCommand('db_delete_recording', { id: recId });
    expect(mockDbCommand('db_get_raw_recording_by_id', { id: recId })).toBeNull();
    expect(mockDbCommand('db_get_summary_for_transcript', { transcriptId: t1 })).toBeNull();
  });

  it('deleting a tag removes it from recordings', () => {
    mockDbCommand('db_delete_tag', { name: 'sync' });
    expect((mockDbCommand('db_get_tags') as any[]).map(t => t.name)).toEqual(['design', 'frontend', 'urgent']);
    expect(mockDbCommand('db_get_library_recording_by_id', { id: 1 })).toBeTruthy();
    const rec = (mockDbCommand('db_get_library_recordings') as any[]).find(r => r.id === 1);
    expect(rec.tags).toEqual(['frontend']);
  });

  it('gives new prompts and automations unique ids and restores default prompts', () => {
    expect(mockDbCommand('db_create_prompt', { title: 'P', templateText: 't' })).toBe(5);
    expect(mockDbCommand('db_create_automation', { name: 'A', triggerTime: '09:00', timerangeHours: 1, action: 'transcribe' })).toBe(3);
    for (const p of mockDbCommand('db_get_prompts') as any[]) {
      mockDbCommand('db_delete_prompt', { id: p.id });
    }
    mockDbCommand('db_ensure_default_prompts');
    expect((mockDbCommand('db_get_prompts') as any[]).length).toBe(4);
  });
});
