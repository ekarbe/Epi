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
import { saveSummary, updateSummary, getSummaryForTranscript } from './summaries';
import { getDb } from './core';

vi.mock('./core', () => ({
  getDb: vi.fn(),
}));

describe('summaries db service', () => {
  const mockDb = {
    execute: vi.fn(),
    select: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockResolvedValue([]);
    vi.mocked(getDb).mockResolvedValue(mockDb as any);
  });

  describe('saveSummary', () => {
    it('executes insert query if not exists', async () => {
      mockDb.execute.mockResolvedValue({ lastInsertId: 15 });
      const id = await saveSummary(10, 'Summary text');
      expect(id).toBe(15);
      expect(mockDb.execute).toHaveBeenCalledWith(
        'INSERT INTO Summaries (transcript_id, summary_text) VALUES ($1, $2)',
        [10, 'Summary text']
      );
    });

    it('executes update query if exists', async () => {
      mockDb.select.mockResolvedValue([{ id: 15, summary_text: 'Old' }]);
      const id = await saveSummary(10, 'Summary text');
      expect(id).toBe(15);
      expect(mockDb.execute).toHaveBeenCalledWith(
        'UPDATE Summaries SET summary_text = $1 WHERE id = $2',
        ['Summary text', 15]
      );
    });
  });

  describe('updateSummary', () => {
    it('executes update query', async () => {
      await updateSummary(15, 'New summary');
      expect(mockDb.execute).toHaveBeenCalledWith(
        'UPDATE Summaries SET summary_text = $1 WHERE id = $2',
        ['New summary', 15]
      );
    });
  });

  describe('getSummaryForTranscript', () => {
    it('returns null if no summary', async () => {
      mockDb.select.mockResolvedValue([]);
      const result = await getSummaryForTranscript(10);
      expect(result).toBeNull();
    });

    it('returns formatted summary', async () => {
      mockDb.select.mockResolvedValue([
        { id: 15, summary_text: 'Summary text' }
      ]);
      const result = await getSummaryForTranscript(10);
      expect(result).toEqual({
        id: 15,
        summaryText: 'Summary text'
      });
    });
  });
});
