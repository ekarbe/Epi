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

vi.mock('../../lib/api', () => ({
  invoke: vi.fn(),
}));

/** Loads fresh copies of the core module and the mocked api (no cached init promise). */
async function load() {
  vi.resetModules();
  const { initDb } = await import('./core');
  const { invoke } = await import('../../lib/api');
  return { initDb, invoke: vi.mocked(invoke) };
}

describe('db core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the database through db_init once', async () => {
    const { initDb, invoke } = await load();
    invoke.mockResolvedValue(undefined);
    await Promise.all([initDb(), initDb()]);
    await initDb();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('db_init');
  });

  it('rejects with the backend error and allows a retry', async () => {
    const { initDb, invoke } = await load();
    invoke.mockRejectedValueOnce('Could not open database').mockResolvedValueOnce(undefined);
    await expect(initDb()).rejects.toBe('Could not open database');
    await expect(initDb()).resolves.toBeUndefined();
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
