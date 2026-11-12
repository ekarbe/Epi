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

//! Summaries table: at most one summary per transcript.

use super::Db;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use tauri::State;

/// The id and text of a summary (TS `Pick<Summary, 'id' | 'summaryText'>`).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryText {
    pub id: i64,
    pub summary_text: String,
}

/// Stores the summary of a transcript, updating the existing one if there is
/// one. Returns the summary id.
pub fn save_summary(
    conn: &mut Connection,
    transcript_id: i64,
    summary_text: &str,
) -> rusqlite::Result<i64> {
    let tx = conn.transaction()?;
    let id = match get_summary_for_transcript(&tx, transcript_id)? {
        Some(existing) => {
            update_summary(&tx, existing.id, summary_text)?;
            existing.id
        }
        None => {
            tx.execute(
                "INSERT INTO Summaries (transcript_id, summary_text) VALUES (?1, ?2)",
                params![transcript_id, summary_text],
            )?;
            tx.last_insert_rowid()
        }
    };
    tx.commit()?;
    Ok(id)
}

/// Replaces the text of a summary.
pub fn update_summary(conn: &Connection, id: i64, summary_text: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE Summaries SET summary_text = ?1 WHERE id = ?2",
        params![summary_text, id],
    )?;
    Ok(())
}

/// The (first) summary of a transcript, or `None`.
pub fn get_summary_for_transcript(
    conn: &Connection,
    transcript_id: i64,
) -> rusqlite::Result<Option<SummaryText>> {
    conn.query_row(
        "SELECT id, summary_text FROM Summaries WHERE transcript_id = ?1 ORDER BY id ASC LIMIT 1",
        [transcript_id],
        |row| {
            Ok(SummaryText {
                id: row.get(0)?,
                summary_text: row.get(1)?,
            })
        },
    )
    .optional()
}

#[tauri::command]
pub async fn db_save_summary(
    db: State<'_, Db>,
    transcript_id: i64,
    summary_text: String,
) -> Result<i64, String> {
    db.run(move |c| save_summary(c, transcript_id, &summary_text))
        .await
}

#[tauri::command]
pub async fn db_update_summary(
    db: State<'_, Db>,
    id: i64,
    summary_text: String,
) -> Result<(), String> {
    db.run(move |c| update_summary(c, id, &summary_text)).await
}

#[tauri::command]
pub async fn db_get_summary_for_transcript(
    db: State<'_, Db>,
    transcript_id: i64,
) -> Result<Option<SummaryText>, String> {
    db.run(move |c| get_summary_for_transcript(c, transcript_id))
        .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{open_in_memory, recordings::save_recording, transcripts::save_transcript};

    fn transcript(conn: &mut Connection) -> i64 {
        let rec = save_recording(conn, "a.ogg", 1.0, None, None).unwrap();
        save_transcript(conn, rec, "t").unwrap()
    }

    #[test]
    fn test_save_summary_inserts_then_updates() {
        let mut conn = open_in_memory();
        let t = transcript(&mut conn);
        assert!(get_summary_for_transcript(&conn, t).unwrap().is_none());

        let id = save_summary(&mut conn, t, "first").unwrap();
        assert_eq!(save_summary(&mut conn, t, "second").unwrap(), id);
        assert_eq!(
            get_summary_for_transcript(&conn, t).unwrap(),
            Some(SummaryText {
                id,
                summary_text: "second".into()
            })
        );
    }

    #[test]
    fn test_update_summary() {
        let mut conn = open_in_memory();
        let t = transcript(&mut conn);
        let id = save_summary(&mut conn, t, "old").unwrap();
        update_summary(&conn, id, "new").unwrap();
        assert_eq!(
            get_summary_for_transcript(&conn, t)
                .unwrap()
                .unwrap()
                .summary_text,
            "new"
        );
    }

    #[test]
    fn test_serialized_field_names_match_frontend_types() {
        let s = SummaryText {
            id: 1,
            summary_text: "x".into(),
        };
        assert_eq!(
            serde_json::to_value(&s).unwrap(),
            serde_json::json!({"id": 1, "summaryText": "x"})
        );
    }
}
