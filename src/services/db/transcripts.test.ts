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
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveTranscript, updateTranscript, getTranscriptForRecording, deleteTranscriptAndSummaryDb } from './transcripts';
import { getDb } from './core';

vi.mock('./core', () => ({
  getDb: vi.fn(),
}));

describe('transcripts db service', () => {
  const mockDb = {
    execute: vi.fn(),
    select: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockResolvedValue([]);
    vi.mocked(getDb).mockResolvedValue(mockDb as any);
  });

  describe('saveTranscript', () => {
    it('executes insert query if not exists', async () => {
      mockDb.execute.mockResolvedValue({ lastInsertId: 10 });
      const id = await saveTranscript(5, 'Hello world');
      expect(id).toBe(10);
      expect(mockDb.execute).toHaveBeenCalledWith(
        'INSERT INTO Transcripts (recording_id, text_content) VALUES ($1, $2)',
        [5, 'Hello world']
      );
    });

    it('executes update query if exists', async () => {
      mockDb.select.mockResolvedValue([
        { id: 10, recording_id: 5, text_content: 'Old', diarized_json: '[]' }
      ]);
      const id = await saveTranscript(5, 'Hello world');
      expect(id).toBe(10);
      expect(mockDb.execute).toHaveBeenCalledWith(
        'UPDATE Transcripts SET text_content = $1 WHERE id = $2',
        ['Hello world', 10]
      );
    });
  });

  describe('updateTranscript', () => {
    it('executes update query', async () => {
      await updateTranscript(10, 'New text');
      expect(mockDb.execute).toHaveBeenCalledWith(
        'UPDATE Transcripts SET text_content = $1 WHERE id = $2',
        ['New text', 10]
      );
    });
  });

  describe('getTranscriptForRecording', () => {
    it('returns null if no transcript', async () => {
      mockDb.select.mockResolvedValue([]);
      const result = await getTranscriptForRecording(5);
      expect(result).toBeNull();
    });

    it('returns formatted transcript', async () => {
      mockDb.select.mockResolvedValue([
        { id: 10, recording_id: 5, text_content: 'Text', diarized_json: '[]' }
      ]);
      const result = await getTranscriptForRecording(5);
      expect(result).toEqual({
        id: 10,
        recordingId: 5,
        textContent: 'Text',
        diarizedJson: '[]'
      });
    });
  });

  describe('deleteTranscriptAndSummaryDb', () => {
    it('executes deletion queries', async () => {
      await deleteTranscriptAndSummaryDb(5);
      expect(mockDb.execute).toHaveBeenCalledWith(
        'DELETE FROM Summaries WHERE transcript_id IN (SELECT id FROM Transcripts WHERE recording_id = $1)',
        [5]
      );
      expect(mockDb.execute).toHaveBeenCalledWith(
        'DELETE FROM Transcripts WHERE recording_id = $1',
        [5]
      );
    });
  });
});
