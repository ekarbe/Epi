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

import { isTauri, MockDatabase, Database } from '../../lib/api';
import { TableInfoRow } from './types';

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

export async function initDb(): Promise<Database> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const loadedDb = isTauri 
        ? await Database.load('sqlite:epi_meta.db')
        : (await MockDatabase.load('sqlite:epi_meta.db') as unknown as Database);
      
      await loadedDb.execute('PRAGMA foreign_keys = ON;');

      await loadedDb.execute(`
        CREATE TABLE IF NOT EXISTS Tags (
          name TEXT PRIMARY KEY,
          context TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS Glossary (
          term TEXT PRIMARY KEY,
          meaning TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS Recordings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT NOT NULL,
          duration INTEGER NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          group_id INTEGER,
          label TEXT
        );
      `);

      try {
        const tableInfo = await loadedDb.select<TableInfoRow[]>('PRAGMA table_info(Recordings)');
        const hasLabel = tableInfo.some((col) => col.name === 'label');
        if (!hasLabel) {
          await loadedDb.execute('ALTER TABLE Recordings ADD COLUMN label TEXT');
          await loadedDb.execute('UPDATE Recordings SET label = group_id WHERE group_id IS NOT NULL');
          await loadedDb.execute('UPDATE Recordings SET group_id = NULL');
        }
      } catch (migrationErr) {
        console.error("Migration error for Recordings label column:", migrationErr);
      }

      await loadedDb.execute(`
        CREATE TABLE IF NOT EXISTS Transcripts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          recording_id INTEGER,
          text_content TEXT,
          diarized_json TEXT,
          FOREIGN KEY(recording_id) REFERENCES Recordings(id)
        );
      `);

      await loadedDb.execute(`
        CREATE TABLE IF NOT EXISTS Groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          color_tag TEXT NOT NULL
        );
      `);

      await loadedDb.execute(`
        CREATE TABLE IF NOT EXISTS Prompts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          template_text TEXT NOT NULL
        );
      `);

      await loadedDb.execute(`
        CREATE TABLE IF NOT EXISTS Summaries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          transcript_id INTEGER,
          summary_text TEXT NOT NULL,
          FOREIGN KEY(transcript_id) REFERENCES Transcripts(id)
        );
      `);

      await loadedDb.execute(`
        CREATE TABLE IF NOT EXISTS Automations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          trigger_time TEXT NOT NULL,
          timerange_hours INTEGER NOT NULL,
          action TEXT NOT NULL
        );
      `);

      try {
        await loadedDb.execute("ALTER TABLE Recordings ADD COLUMN tags TEXT DEFAULT '[]'");
      } catch (e: any) {
        if (!e.message?.includes("duplicate column name")) {
          console.warn("Could not add tags column:", e);
        }
      }

      await loadedDb.execute('CREATE INDEX IF NOT EXISTS idx_recordings_timestamp ON Recordings(timestamp DESC);');
      await loadedDb.execute('CREATE INDEX IF NOT EXISTS idx_transcripts_recording_id ON Transcripts(recording_id);');
      await loadedDb.execute('CREATE INDEX IF NOT EXISTS idx_summaries_transcript_id ON Summaries(transcript_id);');

      await loadedDb.execute(`
        CREATE TRIGGER IF NOT EXISTS delete_recording_cascade
        BEFORE DELETE ON Recordings
        FOR EACH ROW
        BEGIN
          DELETE FROM Summaries WHERE transcript_id IN (SELECT id FROM Transcripts WHERE recording_id = OLD.id);
          DELETE FROM Transcripts WHERE recording_id = OLD.id;
        END;
      `);

      db = loadedDb;
      return db;
    } catch (err) {
      initPromise = null;
      console.error("Failed to load database:", err);
      throw err;
    }
  })();

  return initPromise;
}

export async function getDb(): Promise<Database> {
  if (!db) {
    return await initDb();
  }
  return db;
}
