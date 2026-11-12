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
import { GlossaryTerm } from './types';

/** All glossary entries sorted by term. */
export async function getGlossary(): Promise<GlossaryTerm[]> {
  return invoke<GlossaryTerm[]>('db_get_glossary');
}

/** Creates a glossary entry or replaces the meaning of an existing one. */
export async function saveGlossaryTerm(term: string, meaning: string): Promise<void> {
  await invoke('db_save_glossary_term', { term, meaning });
}

/** Deletes a glossary entry. */
export async function deleteGlossaryTerm(term: string): Promise<void> {
  await invoke('db_delete_glossary_term', { term });
}
