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
import { Transcript, RawTranscriptRow } from './types';

export async function saveTranscript(recordingId: number, textContent: string): Promise<number> {
  const existing = await getTranscriptForRecording(recordingId);
  if (existing) {
    await updateTranscript(existing.id, textContent);
    return existing.id;
  }
  const db = await getDb();
  const result = await db.execute(
    'INSERT INTO Transcripts (recording_id, text_content) VALUES ($1, $2)',
    [recordingId, textContent]
  );
  return result.lastInsertId || 0;
}

export async function updateTranscript(id: number, textContent: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    'UPDATE Transcripts SET text_content = $1 WHERE id = $2',
    [textContent, id]
  );
}

export async function getTranscriptForRecording(recId: number): Promise<Transcript | null> {
  const db = await getDb();
  const rawRows = await db.select<RawTranscriptRow[]>('SELECT * FROM Transcripts WHERE recording_id = $1', [recId]);
  if (rawRows.length === 0) return null;
  const row = rawRows[0];
  return {
    id: row.id,
    recordingId: row.recording_id,
    textContent: row.text_content,
    diarizedJson: row.diarized_json
  };
}

export async function deleteTranscriptAndSummaryDb(recordingId: number): Promise<void> {
  const db = await getDb();
  // Relies on SQLite cascade delete if foreign keys are PRAGMA on,
  // but we also added a TRIGGER to handle it.
  // Wait, the trigger is ON DELETE of Recordings.
  // If we just want to delete the transcript:
  await db.execute('DELETE FROM Summaries WHERE transcript_id IN (SELECT id FROM Transcripts WHERE recording_id = $1)', [recordingId]);
  await db.execute('DELETE FROM Transcripts WHERE recording_id = $1', [recordingId]);
}
