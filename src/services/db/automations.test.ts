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
import { getAutomations, createAutomation, deleteAutomation } from './automations';
import { getDb } from './core';

vi.mock('./core', () => ({
  getDb: vi.fn(),
}));

describe('automations db service', () => {
  const mockDb = {
    execute: vi.fn(),
    select: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue(mockDb as any);
  });

  describe('getAutomations', () => {
    it('returns formatted automations', async () => {
      mockDb.select.mockResolvedValue([
        { id: 1, name: 'Auto', trigger_time: '10:00', timerange_hours: 24, action: 'summarize' }
      ]);
      const result = await getAutomations();
      expect(result).toEqual([
        { id: 1, name: 'Auto', triggerTime: '10:00', timerangeHours: 24, action: 'summarize' }
      ]);
    });
  });

  describe('createAutomation', () => {
    it('executes insert query', async () => {
      mockDb.execute.mockResolvedValue({ lastInsertId: 5 });
      const id = await createAutomation('Auto', '10:00', 24, 'summarize');
      expect(id).toBe(5);
      expect(mockDb.execute).toHaveBeenCalledWith(
        'INSERT INTO Automations (name, trigger_time, timerange_hours, action) VALUES ($1, $2, $3, $4)',
        ['Auto', '10:00', 24, 'summarize']
      );
    });
  });

  describe('deleteAutomation', () => {
    it('executes delete query', async () => {
      await deleteAutomation(5);
      expect(mockDb.execute).toHaveBeenCalledWith(
        'DELETE FROM Automations WHERE id = $1',
        [5]
      );
    });
  });
});
