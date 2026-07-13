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
import { getPrompts, createPrompt, updatePrompt, deletePrompt, ensureDefaultPrompts } from './prompts';
import { getDb } from './core';

vi.mock('./core', () => ({
  getDb: vi.fn(),
}));

describe('prompts db service', () => {
  const mockDb = {
    execute: vi.fn(),
    select: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue(mockDb as any);
  });

  describe('getPrompts', () => {
    it('returns formatted prompts', async () => {
      mockDb.select.mockResolvedValue([
        { id: 1, title: 'Title', template_text: 'Template' }
      ]);
      const result = await getPrompts();
      expect(result).toEqual([
        { id: 1, title: 'Title', templateText: 'Template' }
      ]);
    });
  });

  describe('createPrompt', () => {
    it('executes insert query', async () => {
      mockDb.execute.mockResolvedValue({ lastInsertId: 2 });
      const id = await createPrompt('New Title', 'New Template');
      expect(id).toBe(2);
      expect(mockDb.execute).toHaveBeenCalledWith(
        'INSERT INTO Prompts (title, template_text) VALUES ($1, $2)',
        ['New Title', 'New Template']
      );
    });
  });

  describe('updatePrompt', () => {
    it('executes update query', async () => {
      await updatePrompt(2, 'Updated', 'Updated Template');
      expect(mockDb.execute).toHaveBeenCalledWith(
        'UPDATE Prompts SET title = $1, template_text = $2 WHERE id = $3',
        ['Updated', 'Updated Template', 2]
      );
    });
  });

  describe('deletePrompt', () => {
    it('executes delete query', async () => {
      await deletePrompt(2);
      expect(mockDb.execute).toHaveBeenCalledWith(
        'DELETE FROM Prompts WHERE id = $1',
        [2]
      );
    });
  });

  describe('ensureDefaultPrompts', () => {
    it('creates defaults if empty', async () => {
      mockDb.select.mockResolvedValue([]);
      mockDb.execute.mockResolvedValue({ lastInsertId: 1 });
      await ensureDefaultPrompts();
      expect(mockDb.execute).toHaveBeenCalledTimes(4);
    });

    it('does nothing if not empty', async () => {
      mockDb.select.mockResolvedValue([
        { id: 1, title: 'Title', template_text: 'Template' }
      ]);
      await ensureDefaultPrompts();
      expect(mockDb.execute).not.toHaveBeenCalled();
    });
  });
});
