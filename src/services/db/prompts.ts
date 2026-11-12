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

export interface PromptTemplate {
  id: number;
  title: string;
  templateText: string;
}

/** All prompt templates in creation order. */
export async function getPrompts(): Promise<PromptTemplate[]> {
  return invoke<PromptTemplate[]>('db_get_prompts');
}

/** Inserts a prompt template and returns its id. */
export async function createPrompt(title: string, templateText: string): Promise<number> {
  return invoke<number>('db_create_prompt', { title, templateText });
}

/** Updates the title and text of a prompt template. */
export async function updatePrompt(id: number, title: string, templateText: string): Promise<void> {
  await invoke('db_update_prompt', { id, title, templateText });
}

/** Deletes a prompt template. */
export async function deletePrompt(id: number): Promise<void> {
  await invoke('db_delete_prompt', { id });
}

/**
 * Inserts the built-in prompt templates when no prompt exists (the templates
 * live in `src-tauri/src/db/prompts.rs`).
 */
export async function ensureDefaultPrompts(): Promise<void> {
  await invoke('db_ensure_default_prompts');
}
