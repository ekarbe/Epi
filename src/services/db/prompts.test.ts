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
import { getPrompts, createPrompt, updatePrompt, deletePrompt, ensureDefaultPrompts } from './prompts';

vi.mock('../../lib/api', () => ({
  invoke: vi.fn(),
}));

describe('prompts db service', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('getPrompts returns the backend list', async () => {
    const prompts = [{ id: 1, title: 'T', templateText: 'x' }];
    vi.mocked(invoke).mockResolvedValue(prompts);
    expect(await getPrompts()).toEqual(prompts);
    expect(invoke).toHaveBeenCalledWith('db_get_prompts');
  });

  it('createPrompt returns the new id', async () => {
    vi.mocked(invoke).mockResolvedValue(5);
    expect(await createPrompt('T', 'x')).toBe(5);
    expect(invoke).toHaveBeenCalledWith('db_create_prompt', { title: 'T', templateText: 'x' });
  });

  it('update, delete and ensureDefaultPrompts invoke their commands', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await updatePrompt(1, 'T2', 'y');
    await deletePrompt(2);
    await ensureDefaultPrompts();
    expect(vi.mocked(invoke).mock.calls).toEqual([
      ['db_update_prompt', { id: 1, title: 'T2', templateText: 'y' }],
      ['db_delete_prompt', { id: 2 }],
      ['db_ensure_default_prompts'],
    ]);
  });
});
