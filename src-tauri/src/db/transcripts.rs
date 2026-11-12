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

//! Transcripts table: at most one transcript per recording.

use super::Db;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use tauri::State;

/// A transcript row (TS `Transcript`).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Transcript {
    pub id: i64,
    pub recording_id: Option<i64>,
    pub text_content: Option<String>,
    pub diarized_json: Option<String>,
}

/// Stores the transcript of a recording, updating the existing one if there
/// is one. Returns the transcript id.
pub fn save_transcript(conn: &mut Connection, recording_id: i64, text_content: &str) -> rusqlite::Result<i64> {
    let tx = conn.transaction()?;
    let id = match get_transcript_for_recording(&tx, recording_id)? {
        Some(existing) => {
            update_transcript(&tx, existing.id, text_content)?;
            existing.id
        }
        None => {
            tx.execute(
                "INSERT INTO Transcripts (recording_id, text_content) VALUES (?1, ?2)",
                params![recording_id, text_content],
            )?;
            tx.last_insert_rowid()
        }
    };
    tx.commit()?;
    Ok(id)
}

/// Replaces the text of a transcript.
pub fn update_transcript(conn: &Connection, id: i64, text_content: &str) -> rusqlite::Result<()> {
    conn.execute("UPDATE Transcripts SET text_content = ?1 WHERE id = ?2", params![text_content, id])?;
    Ok(())
}

/// The (first) transcript of a recording, or `None`.
pub fn get_transcript_for_recording(conn: &Connection, recording_id: i64) -> rusqlite::Result<Option<Transcript>> {
    conn.query_row(
        "SELECT id, recording_id, text_content, diarized_json FROM Transcripts
         WHERE recording_id = ?1 ORDER BY id ASC LIMIT 1",
        [recording_id],
        |row| {
            Ok(Transcript {
                id: row.get(0)?,
                recording_id: row.get(1)?,
                text_content: row.get(2)?,
                diarized_json: row.get(3)?,
            })
        },
    )
    .optional()
}

/// Deletes all transcripts of a recording together with their summaries.
pub fn delete_transcript_and_summary(conn: &mut Connection, recording_id: i64) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    tx.execute(
        "DELETE FROM Summaries WHERE transcript_id IN (SELECT id FROM Transcripts WHERE recording_id = ?1)",
        [recording_id],
    )?;
    tx.execute("DELETE FROM Transcripts WHERE recording_id = ?1", [recording_id])?;
    tx.commit()
}

#[tauri::command]
pub async fn db_save_transcript(db: State<'_, Db>, recording_id: i64, text_content: String) -> Result<i64, String> {
    db.run(move |c| save_transcript(c, recording_id, &text_content)).await
}

#[tauri::command]
pub async fn db_update_transcript(db: State<'_, Db>, id: i64, text_content: String) -> Result<(), String> {
    db.run(move |c| update_transcript(c, id, &text_content)).await
}

#[tauri::command]
pub async fn db_get_transcript_for_recording(
    db: State<'_, Db>,
    recording_id: i64,
) -> Result<Option<Transcript>, String> {
    db.run(move |c| get_transcript_for_recording(c, recording_id)).await
}

#[tauri::command]
pub async fn db_delete_transcript_and_summary(db: State<'_, Db>, recording_id: i64) -> Result<(), String> {
    db.run(move |c| delete_transcript_and_summary(c, recording_id)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{open_in_memory, recordings::save_recording, summaries};

    #[test]
    fn test_save_transcript_inserts_then_updates() {
        let mut conn = open_in_memory();
        let rec = save_recording(&conn, "a.ogg", 1.0, None, None).unwrap();
        assert!(get_transcript_for_recording(&conn, rec).unwrap().is_none());

        let id = save_transcript(&mut conn, rec, "first").unwrap();
        let again = save_transcript(&mut conn, rec, "second").unwrap();
        assert_eq!(id, again);

        let t = get_transcript_for_recording(&conn, rec).unwrap().unwrap();
        assert_eq!(
            t,
            Transcript { id, recording_id: Some(rec), text_content: Some("second".into()), diarized_json: None }
        );
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM Transcripts", [], |r| r.get(0)).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_save_transcript_rejects_unknown_recording() {
        let mut conn = open_in_memory();
        assert!(save_transcript(&mut conn, 42, "orphan").is_err(), "foreign keys must be enforced");
    }

    #[test]
    fn test_update_transcript() {
        let mut conn = open_in_memory();
        let rec = save_recording(&conn, "a.ogg", 1.0, None, None).unwrap();
        let id = save_transcript(&mut conn, rec, "old").unwrap();
        update_transcript(&conn, id, "new").unwrap();
        let t = get_transcript_for_recording(&conn, rec).unwrap().unwrap();
        assert_eq!(t.text_content.as_deref(), Some("new"));
    }

    #[test]
    fn test_delete_transcript_and_summary_keeps_recording() {
        let mut conn = open_in_memory();
        let rec = save_recording(&conn, "a.ogg", 1.0, None, None).unwrap();
        let other = save_recording(&conn, "b.ogg", 1.0, None, None).unwrap();
        let t = save_transcript(&mut conn, rec, "t").unwrap();
        let t_other = save_transcript(&mut conn, other, "u").unwrap();
        summaries::save_summary(&mut conn, t, "s").unwrap();
        summaries::save_summary(&mut conn, t_other, "v").unwrap();

        delete_transcript_and_summary(&mut conn, rec).unwrap();

        assert!(get_transcript_for_recording(&conn, rec).unwrap().is_none());
        assert!(summaries::get_summary_for_transcript(&conn, t).unwrap().is_none());
        assert!(get_transcript_for_recording(&conn, other).unwrap().is_some());
        assert!(summaries::get_summary_for_transcript(&conn, t_other).unwrap().is_some());
        let recs: i64 = conn.query_row("SELECT COUNT(*) FROM Recordings", [], |r| r.get(0)).unwrap();
        assert_eq!(recs, 2);
    }

    #[test]
    fn test_serialized_field_names_match_frontend_types() {
        let t = Transcript { id: 1, recording_id: Some(2), text_content: Some("x".into()), diarized_json: None };
        assert_eq!(
            serde_json::to_value(&t).unwrap(),
            serde_json::json!({"id": 1, "recordingId": 2, "textContent": "x", "diarizedJson": null})
        );
    }
}
