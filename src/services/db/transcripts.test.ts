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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '../../lib/api';
import { saveTranscript, updateTranscript, getTranscriptForRecording, deleteTranscriptAndSummaryDb } from './transcripts';

vi.mock('../../lib/api', () => ({
  invoke: vi.fn(),
}));

describe('transcripts db service', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('saveTranscript returns the transcript id', async () => {
    vi.mocked(invoke).mockResolvedValue(7);
    expect(await saveTranscript(1, 'hello')).toBe(7);
    expect(invoke).toHaveBeenCalledWith('db_save_transcript', { recordingId: 1, textContent: 'hello' });
  });

  it('getTranscriptForRecording returns the backend row', async () => {
    const row = { id: 1, recordingId: 2, textContent: 'x', diarizedJson: null };
    vi.mocked(invoke).mockResolvedValueOnce(row).mockResolvedValueOnce(null);
    expect(await getTranscriptForRecording(2)).toEqual(row);
    expect(await getTranscriptForRecording(3)).toBeNull();
    expect(invoke).toHaveBeenCalledWith('db_get_transcript_for_recording', { recordingId: 2 });
  });

  it('mutations pass their arguments', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await updateTranscript(4, 'new');
    await deleteTranscriptAndSummaryDb(5);
    expect(vi.mocked(invoke).mock.calls).toEqual([
      ['db_update_transcript', { id: 4, textContent: 'new' }],
      ['db_delete_transcript_and_summary', { recordingId: 5 }],
    ]);
  });
});
