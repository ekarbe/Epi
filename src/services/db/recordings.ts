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
import { Recording, LibraryRecording, RawRecordingRow, LibraryRow } from './types';

export async function saveRecording(
  filename: string,
  duration: number,
  label: string | null = null,
  timestamp?: string
): Promise<number> {
  const db = await getDb();
  let result;
  if (timestamp) {
    result = await db.execute(
      "INSERT INTO Recordings (filename, duration, label, timestamp, tags) VALUES ($1, $2, $3, $4, '[]')",
      [filename, duration, label, timestamp]
    );
  } else {
    result = await db.execute(
      "INSERT INTO Recordings (filename, duration, label, tags) VALUES ($1, $2, $3, '[]')",
      [filename, duration, label]
    );
  }
  return result.lastInsertId || 0;
}

export async function getLibraryRecordings(): Promise<LibraryRecording[]> {
  const db = await getDb();
  const rawRows = await db.select<LibraryRow[]>(`
    SELECT 
      r.id, 
      r.filename, 
      r.duration, 
      r.timestamp, 
      r.label,
      r.tags,
      MAX(CASE WHEN t.id IS NOT NULL THEN 1 ELSE 0 END) as hasTranscript
    FROM Recordings r
    LEFT JOIN Transcripts t ON r.id = t.recording_id
    GROUP BY r.id
    ORDER BY r.timestamp DESC
  `);

  return rawRows.map(row => ({
    id: row.id,
    filename: row.filename,
    duration: row.duration,
    timestamp: row.timestamp,
    label: row.label,
    hasTranscript: row.hasTranscript === 1,
    tags: row.tags ? JSON.parse(row.tags) : []
  }));
}

export async function getLibraryRecordingById(id: number): Promise<LibraryRecording | null> {
  const db = await getDb();
  const rawRows = await db.select<LibraryRow[]>(`
    SELECT 
      r.id, 
      r.filename, 
      r.duration, 
      r.timestamp, 
      r.label,
      MAX(CASE WHEN t.id IS NOT NULL THEN 1 ELSE 0 END) as hasTranscript
    FROM Recordings r
    LEFT JOIN Transcripts t ON r.id = t.recording_id
    WHERE r.id = $1
    GROUP BY r.id
  `, [id]);

  if (rawRows.length === 0) return null;
  const row = rawRows[0];

  return {
    id: row.id,
    filename: row.filename,
    duration: row.duration,
    timestamp: row.timestamp,
    label: row.label,
    hasTranscript: row.hasTranscript === 1
  };
}

export async function deleteRecordingDb(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM Recordings WHERE id = $1', [id]);
}

export async function updateRecording(id: number, filename: string, label: string | null): Promise<void> {
  const db = await getDb();
  await db.execute(
    'UPDATE Recordings SET filename = $1, label = $2 WHERE id = $3',
    [filename, label, id]
  );
}

export async function getRawRecordingById(recId: number): Promise<Recording | null> {
  const db = await getDb();
  const rawRows = await db.select<RawRecordingRow[]>('SELECT * FROM Recordings WHERE id = $1', [recId]);
  if (rawRows.length === 0) return null;
  const row = rawRows[0];
  return {
    id: row.id,
    filename: row.filename,
    duration: row.duration,
    timestamp: row.timestamp,
    groupId: row.group_id,
    label: row.label
  };
}

export async function getRecordingsOlderThan30Days(): Promise<LibraryRecording[]> {
  const db = await getDb();
  const rawRows = await db.select<LibraryRow[]>(`
    SELECT 
      r.id, 
      r.filename, 
      r.duration, 
      r.timestamp, 
      r.label,
      MAX(CASE WHEN t.id IS NOT NULL THEN 1 ELSE 0 END) as hasTranscript
    FROM Recordings r
    LEFT JOIN Transcripts t ON r.id = t.recording_id
    WHERE r.timestamp < datetime('now', '-30 days')
    GROUP BY r.id
  `);

  return rawRows.map(row => ({
    id: row.id,
    filename: row.filename,
    duration: row.duration,
    timestamp: row.timestamp,
    label: row.label,
    hasTranscript: row.hasTranscript === 1
  }));
}

export async function updateRecordingTags(id: number, tags: string[]): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE Recordings SET tags = $1 WHERE id = $2', [JSON.stringify(tags), id]);
}
