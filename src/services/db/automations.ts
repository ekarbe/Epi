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

export interface Automation {
  id: number;
  name: string;
  triggerTime: string; // HH:mm format
  timerangeHours: number;
  action: string;
}

/** All automations, newest first. */
export async function getAutomations(): Promise<Automation[]> {
  return invoke<Automation[]>('db_get_automations');
}

/** Inserts an automation and returns its id. */
export async function createAutomation(name: string, triggerTime: string, timerangeHours: number, action: string): Promise<number> {
  return invoke<number>('db_create_automation', { name, triggerTime, timerangeHours, action });
}

/** Deletes an automation. */
export async function deleteAutomation(id: number): Promise<void> {
  await invoke('db_delete_automation', { id });
}
