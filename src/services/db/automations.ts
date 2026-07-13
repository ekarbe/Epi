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

import { getDb } from './core';

export interface Automation {
  id: number;
  name: string;
  triggerTime: string; // HH:mm format
  timerangeHours: number;
  action: string;
}

interface RawAutomationRow {
  id: number;
  name: string;
  trigger_time: string;
  timerange_hours: number;
  action: string;
}

export async function getAutomations(): Promise<Automation[]> {
  const db = await getDb();
  const rawRows = await db.select<RawAutomationRow[]>('SELECT * FROM Automations ORDER BY id DESC');
  
  return rawRows.map(row => ({
    id: row.id,
    name: row.name,
    triggerTime: row.trigger_time,
    timerangeHours: row.timerange_hours,
    action: row.action
  }));
}

export async function createAutomation(name: string, triggerTime: string, timerangeHours: number, action: string): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    'INSERT INTO Automations (name, trigger_time, timerange_hours, action) VALUES ($1, $2, $3, $4)',
    [name, triggerTime, timerangeHours, action]
  );
  return result.lastInsertId || 0;
}

export async function deleteAutomation(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM Automations WHERE id = $1', [id]);
}
