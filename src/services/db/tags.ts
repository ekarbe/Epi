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

import { invoke } from '../../lib/api';
import { Tag } from './types';

/** All tags sorted by name. */
export async function getTags(): Promise<Tag[]> {
  return invoke<Tag[]>('db_get_tags');
}

/** Creates a tag or replaces the context of an existing one. */
export async function saveTagContext(name: string, context: string): Promise<void> {
  await invoke('db_save_tag_context', { name, context });
}

/** Creates a tag with an empty context unless it already exists. */
export async function ensureTagExists(name: string): Promise<void> {
  await invoke('db_ensure_tag_exists', { name });
}

/** Deletes a tag and removes it from every recording that carries it. */
export async function deleteTag(name: string): Promise<void> {
  await invoke('db_delete_tag', { name });
}
