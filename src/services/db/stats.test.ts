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
import { getStats } from './stats';
import { getDb } from './core';

vi.mock('./core', () => ({
  getDb: vi.fn(),
}));

describe('stats db service', () => {
  const mockDb = {
    execute: vi.fn(),
    select: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue(mockDb as any);
  });

  describe('getStats', () => {
    it('returns combined counts', async () => {
      mockDb.select
        .mockResolvedValueOnce([{ count: 10 }]) // recordings
        .mockResolvedValueOnce([{ count: 5 }]); // transcripts
      
      const result = await getStats();
      expect(result).toEqual({ recordingsCount: 10, transcriptsCount: 5 });
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });

    it('handles empty results', async () => {
      mockDb.select.mockResolvedValue([]);
      
      const result = await getStats();
      expect(result).toEqual({ recordingsCount: 0, transcriptsCount: 0 });
    });
  });
});
