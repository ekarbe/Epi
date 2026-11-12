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
import { getTags, saveTagContext, ensureTagExists, deleteTag } from './tags';
import { getGlossary, saveGlossaryTerm, deleteGlossaryTerm } from './glossary';

vi.mock('../../lib/api', () => ({
  invoke: vi.fn(),
}));

describe('tags and glossary db services', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('getTags and getGlossary return the backend lists', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([{ name: 'a', context: '' }])
      .mockResolvedValueOnce([{ term: 't', meaning: 'm' }]);
    expect(await getTags()).toEqual([{ name: 'a', context: '' }]);
    expect(await getGlossary()).toEqual([{ term: 't', meaning: 'm' }]);
    expect(vi.mocked(invoke).mock.calls).toEqual([['db_get_tags'], ['db_get_glossary']]);
  });

  it('mutations pass their arguments', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await saveTagContext('a', 'ctx');
    await ensureTagExists('b');
    await deleteTag('c');
    await saveGlossaryTerm('t', 'm');
    await deleteGlossaryTerm('t');
    expect(vi.mocked(invoke).mock.calls).toEqual([
      ['db_save_tag_context', { name: 'a', context: 'ctx' }],
      ['db_ensure_tag_exists', { name: 'b' }],
      ['db_delete_tag', { name: 'c' }],
      ['db_save_glossary_term', { term: 't', meaning: 'm' }],
      ['db_delete_glossary_term', { term: 't' }],
    ]);
  });
});
