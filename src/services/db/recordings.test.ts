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
import { saveRecording, getLibraryRecordings, getLibraryRecordingById, deleteRecordingDb, updateRecording, getRawRecordingById, getRecordingsOlderThan30Days, updateRecordingTags } from './recordings';
import { getDb } from './core';

vi.mock('./core', () => ({
  getDb: vi.fn(),
}));

describe('recordings db service', () => {
  const mockDb = {
    execute: vi.fn(),
    select: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue(mockDb as any);
  });

  describe('saveRecording', () => {
    it('saves with timestamp', async () => {
      mockDb.execute.mockResolvedValue({ lastInsertId: 1 });
      const id = await saveRecording('test.ogg', 120, 'Meeting', '2026-07-08 12:00:00');
      expect(id).toBe(1);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO Recordings (filename, duration, label, timestamp, tags)'),
        ['test.ogg', 120, 'Meeting', '2026-07-08 12:00:00']
      );
    });

    it('saves without timestamp', async () => {
      mockDb.execute.mockResolvedValue({ lastInsertId: 2 });
      const id = await saveRecording('test2.ogg', 60, 'Call');
      expect(id).toBe(2);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO Recordings (filename, duration, label, tags)'),
        ['test2.ogg', 60, 'Call']
      );
    });
  });

  describe('getLibraryRecordings', () => {
    it('returns formatted library recordings', async () => {
      mockDb.select.mockResolvedValue([
        { id: 1, filename: 'a.ogg', duration: 10, timestamp: 'ts1', label: 'L1', hasTranscript: 1, tags: '["urgent"]' },
        { id: 2, filename: 'b.ogg', duration: 20, timestamp: 'ts2', label: null, hasTranscript: 0, tags: null }
      ]);
      const result = await getLibraryRecordings();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1, filename: 'a.ogg', duration: 10, timestamp: 'ts1', label: 'L1', hasTranscript: true, tags: ['urgent']
      });
      expect(result[1].tags).toEqual([]);
      expect(result[1].hasTranscript).toBe(false);
    });
  });

  describe('getLibraryRecordingById', () => {
    it('returns null if not found', async () => {
      mockDb.select.mockResolvedValue([]);
      const result = await getLibraryRecordingById(99);
      expect(result).toBeNull();
    });

    it('returns formatted recording', async () => {
      mockDb.select.mockResolvedValue([
        { id: 1, filename: 'a.ogg', duration: 10, timestamp: 'ts1', label: 'L1', hasTranscript: 1 }
      ]);
      const result = await getLibraryRecordingById(1);
      expect(result).toEqual({
        id: 1, filename: 'a.ogg', duration: 10, timestamp: 'ts1', label: 'L1', hasTranscript: true
      });
    });
  });

  describe('deleteRecordingDb', () => {
    it('executes delete query', async () => {
      await deleteRecordingDb(5);
      expect(mockDb.execute).toHaveBeenCalledWith(
        'DELETE FROM Recordings WHERE id = $1',
        [5]
      );
    });
  });

  describe('updateRecording', () => {
    it('executes update query', async () => {
      await updateRecording(5, 'new.ogg', 'Label');
      expect(mockDb.execute).toHaveBeenCalledWith(
        'UPDATE Recordings SET filename = $1, label = $2 WHERE id = $3',
        ['new.ogg', 'Label', 5]
      );
    });
  });

  describe('getRawRecordingById', () => {
    it('returns null if not found', async () => {
      mockDb.select.mockResolvedValue([]);
      const result = await getRawRecordingById(99);
      expect(result).toBeNull();
    });

    it('returns raw recording', async () => {
      mockDb.select.mockResolvedValue([
        { id: 1, filename: 'a.ogg', duration: 10, timestamp: 'ts', group_id: 2, label: 'L' }
      ]);
      const result = await getRawRecordingById(1);
      expect(result).toEqual({
        id: 1, filename: 'a.ogg', duration: 10, timestamp: 'ts', groupId: 2, label: 'L'
      });
    });
  });

  describe('getRecordingsOlderThan30Days', () => {
    it('returns old recordings', async () => {
      mockDb.select.mockResolvedValue([
        { id: 1, filename: 'a.ogg', duration: 10, timestamp: 'ts1', label: 'L1', hasTranscript: 1 }
      ]);
      const result = await getRecordingsOlderThan30Days();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  describe('updateRecordingTags', () => {
    it('executes update query with json tags', async () => {
      await updateRecordingTags(1, ['tag1', 'tag2']);
      expect(mockDb.execute).toHaveBeenCalledWith(
        'UPDATE Recordings SET tags = $1 WHERE id = $2',
        ['["tag1","tag2"]', 1]
      );
    });
  });
});
