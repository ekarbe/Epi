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

export async function getStats(): Promise<{ recordingsCount: number; transcriptsCount: number }> {
  const db = await getDb();
  
  const recResult = await db.select<{ count: number }[]>('SELECT COUNT(*) as count FROM Recordings');
  const transResult = await db.select<{ count: number }[]>('SELECT COUNT(*) as count FROM Transcripts');
  
  return {
    recordingsCount: recResult[0]?.count || 0,
    transcriptsCount: transResult[0]?.count || 0,
  };
}
