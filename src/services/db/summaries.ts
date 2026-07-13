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
import { Summary, RawSummaryRow } from './types';

export async function saveSummary(transcriptId: number, summaryText: string): Promise<number> {
  const existing = await getSummaryForTranscript(transcriptId);
  if (existing) {
    await updateSummary(existing.id, summaryText);
    return existing.id;
  }
  const db = await getDb();
  const result = await db.execute(
    'INSERT INTO Summaries (transcript_id, summary_text) VALUES ($1, $2)',
    [transcriptId, summaryText]
  );
  return result.lastInsertId || 0;
}

export async function updateSummary(id: number, summaryText: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    'UPDATE Summaries SET summary_text = $1 WHERE id = $2',
    [summaryText, id]
  );
}

export async function getSummaryForTranscript(tId: number): Promise<Pick<Summary, 'id' | 'summaryText'> | null> {
  const db = await getDb();
  const rawRows = await db.select<RawSummaryRow[]>('SELECT id, summary_text FROM Summaries WHERE transcript_id = $1', [tId]);
  if (rawRows.length === 0) return null;
  const row = rawRows[0];
  return {
    id: row.id,
    summaryText: row.summary_text
  };
}
