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
import { getStats } from './stats';

vi.mock('../../lib/api', () => ({
  invoke: vi.fn(),
}));

describe('stats db service', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('getStats returns the backend counts', async () => {
    vi.mocked(invoke).mockResolvedValue({ recordingsCount: 2, transcriptsCount: 1 });
    expect(await getStats()).toEqual({ recordingsCount: 2, transcriptsCount: 1 });
    expect(invoke).toHaveBeenCalledWith('db_get_stats');
  });
});
