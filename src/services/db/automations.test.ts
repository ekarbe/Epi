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
import { getAutomations, createAutomation, deleteAutomation } from './automations';

vi.mock('../../lib/api', () => ({
  invoke: vi.fn(),
}));

describe('automations db service', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('getAutomations returns the backend list', async () => {
    const list = [{ id: 1, name: 'A', triggerTime: '08:00', timerangeHours: 24, action: 'transcribe' }];
    vi.mocked(invoke).mockResolvedValue(list);
    expect(await getAutomations()).toEqual(list);
    expect(invoke).toHaveBeenCalledWith('db_get_automations');
  });

  it('createAutomation returns the new id', async () => {
    vi.mocked(invoke).mockResolvedValue(3);
    expect(await createAutomation('A', '08:00', 24, 'transcribe')).toBe(3);
    expect(invoke).toHaveBeenCalledWith('db_create_automation', {
      name: 'A', triggerTime: '08:00', timerangeHours: 24, action: 'transcribe',
    });
  });

  it('deleteAutomation passes the id', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await deleteAutomation(4);
    expect(invoke).toHaveBeenCalledWith('db_delete_automation', { id: 4 });
  });
});
