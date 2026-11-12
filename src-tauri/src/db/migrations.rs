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

//! Versioned schema migrations tracked with `PRAGMA user_version`.
//!
//! Migration `n` (1-based) runs when `user_version < n`, inside its own
//! transaction that also sets `user_version = n`, so a failed migration leaves
//! the database untouched and is retried on the next start.

use rusqlite::{Connection, Transaction};

/// A single migration step.
type Migration = fn(&Transaction<'_>) -> rusqlite::Result<()>;

/// All migrations in order; index 0 is version 1.
const MIGRATIONS: &[Migration] = &[migrate_v1];

/// Schema version a fully migrated database reports in `user_version`.
pub const LATEST_VERSION: i64 = MIGRATIONS.len() as i64;

/// Reads `PRAGMA user_version`.
pub fn schema_version(conn: &Connection) -> rusqlite::Result<i64> {
    conn.pragma_query_value(None, "user_version", |row| row.get(0))
}

/// Applies every migration newer than the database's `user_version`.
///
/// A database written by a newer Epi (higher `user_version`) is left as is.
pub fn run_migrations(conn: &mut Connection) -> rusqlite::Result<()> {
    let current = schema_version(conn)?;
    if current > LATEST_VERSION {
        log::warn!(
            "epi_meta.db has schema version {} but this build only knows up to {}; leaving it unchanged",
            current,
            LATEST_VERSION
        );
    }
    for (index, migration) in MIGRATIONS.iter().enumerate() {
        let version = index as i64 + 1;
        if version <= current {
            continue;
        }
        let tx = conn.transaction()?;
        migration(&tx)?;
        tx.pragma_update(None, "user_version", version)?;
        tx.commit()?;
        log::info!("Migrated epi_meta.db to schema version {}", version);
    }
    Ok(())
}

/// Returns whether `table` has a column called `column`.
fn has_column(conn: &Connection, table: &str, column: &str) -> rusqlite::Result<bool> {
    let mut stmt = conn.prepare("SELECT 1 FROM pragma_table_info(?1) WHERE name = ?2")?;
    stmt.exists([table, column])
}

/// Version 1: the schema the frontend used to create through tauri-plugin-sql.
///
/// Databases created by earlier Epi versions have `user_version = 0` and
/// already contain (part of) this schema, so every statement is idempotent
/// (`IF NOT EXISTS`, column checks) and the result is identical for a fresh
/// and an upgraded database.
fn migrate_v1(tx: &Transaction<'_>) -> rusqlite::Result<()> {
    tx.execute_batch(
        "CREATE TABLE IF NOT EXISTS Tags (
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
         );",
    )?;

    // Very old databases stored the recording label in `group_id`.
    if !has_column(tx, "Recordings", "label")? {
        tx.execute_batch(
            "ALTER TABLE Recordings ADD COLUMN label TEXT;
             UPDATE Recordings SET label = group_id WHERE group_id IS NOT NULL;
             UPDATE Recordings SET group_id = NULL;",
        )?;
    }

    tx.execute_batch(
        "CREATE TABLE IF NOT EXISTS Transcripts (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           recording_id INTEGER,
           text_content TEXT,
           diarized_json TEXT,
           FOREIGN KEY(recording_id) REFERENCES Recordings(id)
         );
         CREATE TABLE IF NOT EXISTS Groups (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           name TEXT NOT NULL,
           color_tag TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS Prompts (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           title TEXT NOT NULL,
           template_text TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS Summaries (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           transcript_id INTEGER,
           summary_text TEXT NOT NULL,
           FOREIGN KEY(transcript_id) REFERENCES Transcripts(id)
         );
         CREATE TABLE IF NOT EXISTS Automations (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           name TEXT NOT NULL,
           trigger_time TEXT NOT NULL,
           timerange_hours INTEGER NOT NULL,
           action TEXT NOT NULL
         );",
    )?;

    if !has_column(tx, "Recordings", "tags")? {
        tx.execute_batch("ALTER TABLE Recordings ADD COLUMN tags TEXT DEFAULT '[]';")?;
    }

    tx.execute_batch(
        "CREATE INDEX IF NOT EXISTS idx_recordings_timestamp ON Recordings(timestamp DESC);
         CREATE INDEX IF NOT EXISTS idx_transcripts_recording_id ON Transcripts(recording_id);
         CREATE INDEX IF NOT EXISTS idx_summaries_transcript_id ON Summaries(transcript_id);
         CREATE TRIGGER IF NOT EXISTS delete_recording_cascade
         BEFORE DELETE ON Recordings
         FOR EACH ROW
         BEGIN
           DELETE FROM Summaries WHERE transcript_id IN (SELECT id FROM Transcripts WHERE recording_id = OLD.id);
           DELETE FROM Transcripts WHERE recording_id = OLD.id;
         END;",
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Columns of `table` as (name, declared type, default value).
    fn columns(conn: &Connection, table: &str) -> Vec<(String, String, Option<String>)> {
        let mut stmt = conn
            .prepare("SELECT name, type, dflt_value FROM pragma_table_info(?1) ORDER BY cid")
            .unwrap();
        stmt.query_map([table], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap()
    }

    /// Names of all tables, indexes and triggers, excluding SQLite internals.
    fn schema_objects(conn: &Connection) -> Vec<(String, String)> {
        let mut stmt = conn
            .prepare("SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name")
            .unwrap();
        stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap()
    }

    fn fresh() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        run_migrations(&mut conn).unwrap();
        conn
    }

    #[test]
    fn test_fresh_database_gets_full_schema() {
        let conn = fresh();
        assert_eq!(schema_version(&conn).unwrap(), LATEST_VERSION);

        let names: Vec<String> = columns(&conn, "Recordings")
            .into_iter()
            .map(|c| c.0)
            .collect();
        assert_eq!(
            names,
            [
                "id",
                "filename",
                "duration",
                "timestamp",
                "group_id",
                "label",
                "tags"
            ]
        );
        let tags = columns(&conn, "Recordings").pop().unwrap();
        assert_eq!(tags, ("tags".into(), "TEXT".into(), Some("'[]'".into())));

        let objects = schema_objects(&conn);
        for expected in [
            ("index", "idx_recordings_timestamp"),
            ("index", "idx_summaries_transcript_id"),
            ("index", "idx_transcripts_recording_id"),
            ("table", "Automations"),
            ("table", "Glossary"),
            ("table", "Groups"),
            ("table", "Prompts"),
            ("table", "Recordings"),
            ("table", "Summaries"),
            ("table", "Tags"),
            ("table", "Transcripts"),
            ("trigger", "delete_recording_cascade"),
        ] {
            assert!(
                objects.contains(&(expected.0.to_string(), expected.1.to_string())),
                "missing {:?}",
                expected
            );
        }
    }

    #[test]
    fn test_rerun_is_idempotent() {
        let mut conn = fresh();
        conn.execute(
            "INSERT INTO Recordings (filename, duration, label) VALUES ('a.ogg', 1, 'L')",
            [],
        )
        .unwrap();
        let before = schema_objects(&conn);

        // Force migration 1 to run again on an already migrated database.
        conn.pragma_update(None, "user_version", 0).unwrap();
        run_migrations(&mut conn).unwrap();
        run_migrations(&mut conn).unwrap();

        assert_eq!(schema_objects(&conn), before);
        assert_eq!(schema_version(&conn).unwrap(), LATEST_VERSION);
        let label: String = conn
            .query_row("SELECT label FROM Recordings", [], |r| r.get(0))
            .unwrap();
        assert_eq!(label, "L");
    }

    #[test]
    fn test_upgrades_legacy_database_without_label_and_tags_columns() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE Recordings (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               filename TEXT NOT NULL,
               duration INTEGER NOT NULL,
               timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
               group_id INTEGER
             );
             INSERT INTO Recordings (filename, duration, group_id) VALUES ('old.ogg', 5, 7);
             INSERT INTO Recordings (filename, duration) VALUES ('plain.ogg', 6);",
        )
        .unwrap();

        run_migrations(&mut conn).unwrap();

        /// (filename, group_id, label, tags) of one migrated row.
        type Row = (String, Option<i64>, Option<String>, Option<String>);
        let rows: Vec<Row> = conn
            .prepare("SELECT filename, group_id, label, tags FROM Recordings ORDER BY id")
            .unwrap()
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(
            rows,
            vec![
                ("old.ogg".into(), None, Some("7".into()), Some("[]".into())),
                ("plain.ogg".into(), None, None, Some("[]".into())),
            ]
        );
        assert_eq!(schema_objects(&conn), schema_objects(&fresh()));
    }

    #[test]
    fn test_upgrades_database_created_by_previous_frontend_code() {
        // The previous code created Recordings with `label` and added `tags`
        // later, but never set user_version.
        let mut conn = fresh();
        conn.pragma_update(None, "user_version", 0).unwrap();
        conn.execute("INSERT INTO Recordings (filename, duration, label, tags) VALUES ('a.ogg', 1, 'L', '[\"x\"]')", [])
            .unwrap();

        run_migrations(&mut conn).unwrap();

        let tags: String = conn
            .query_row("SELECT tags FROM Recordings", [], |r| r.get(0))
            .unwrap();
        assert_eq!(tags, "[\"x\"]");
        assert_eq!(schema_version(&conn).unwrap(), LATEST_VERSION);
    }

    #[test]
    fn test_newer_schema_version_is_left_alone() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "user_version", LATEST_VERSION + 5)
            .unwrap();
        run_migrations(&mut conn).unwrap();
        assert_eq!(schema_version(&conn).unwrap(), LATEST_VERSION + 5);
        assert!(schema_objects(&conn).is_empty());
    }

    #[test]
    fn test_delete_trigger_cascades_to_transcripts_and_summaries() {
        let conn = fresh();
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             INSERT INTO Recordings (id, filename, duration) VALUES (1, 'a.ogg', 1);
             INSERT INTO Transcripts (id, recording_id, text_content) VALUES (1, 1, 't');
             INSERT INTO Summaries (transcript_id, summary_text) VALUES (1, 's');
             DELETE FROM Recordings WHERE id = 1;",
        )
        .unwrap();
        let remaining: i64 = conn
            .query_row(
                "SELECT (SELECT COUNT(*) FROM Transcripts) + (SELECT COUNT(*) FROM Summaries)",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(remaining, 0);
    }
}
