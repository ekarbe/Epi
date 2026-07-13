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
import { initDb } from './core';
import { MockDatabase } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  isTauri: false,
  Database: {
    load: vi.fn(),
  },
  MockDatabase: {
    load: vi.fn(),
  },
}));

describe('db core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes database and runs migrations', async () => {
    const mockExecute = vi.fn().mockResolvedValue(null);
    const mockSelect = vi.fn().mockResolvedValue([{ name: 'id' }]); // Missing 'label' column to trigger migration

    const mockDbInstance = {
      execute: mockExecute,
      select: mockSelect,
    };

    vi.mocked(MockDatabase.load).mockResolvedValue(mockDbInstance as any);

    const db = await initDb();

    expect(MockDatabase.load).toHaveBeenCalledWith('sqlite:epi_meta.db');
    expect(mockExecute).toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
    expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS Recordings'));
    expect(mockSelect).toHaveBeenCalledWith('PRAGMA table_info(Recordings)');
    expect(mockExecute).toHaveBeenCalledWith('ALTER TABLE Recordings ADD COLUMN label TEXT');
    expect(db).toBeDefined();
  });

  it('handles migration errors gracefully', async () => {
    vi.resetModules();
    const { getDb: newGetDb } = await import('./core');
    const { MockDatabase: NewMockDatabase } = await import('../../lib/api');

    const mockExecute = vi.fn().mockImplementation((query) => {
      if (query.includes('ALTER TABLE Recordings ADD COLUMN tags')) {
        return Promise.reject(new Error('duplicate column name'));
      }
      return Promise.resolve(null);
    });
    const mockSelect = vi.fn().mockResolvedValue([{ name: 'label' }]);

    const mockDbInstance = {
      execute: mockExecute,
      select: mockSelect,
    };

    vi.mocked(NewMockDatabase.load).mockResolvedValue(mockDbInstance as any);

    const db = await newGetDb();
    expect(db).toBeDefined();
  });

  it('throws error if database load fails', async () => {
    vi.resetModules();
    const { initDb: newInitDb } = await import('./core');
    const { MockDatabase: NewMockDatabase } = await import('../../lib/api');

    vi.mocked(NewMockDatabase.load).mockRejectedValue(new Error('Load failed'));

    await expect(newInitDb()).rejects.toThrow('Load failed');
  });
});
