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

//! Recordings table: one row per audio recording in the library.

use super::{text_column, Db};
use rusqlite::types::ValueRef;
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::Serialize;
use tauri::State;

/// A raw `Recordings` row (TS `Recording`).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Recording {
    pub id: i64,
    pub filename: String,
    pub duration: f64,
    pub timestamp: Option<String>,
    pub group_id: Option<i64>,
    pub label: Option<String>,
}

/// A recording as listed in the library (TS `LibraryRecording`).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryRecording {
    pub id: i64,
    pub filename: String,
    pub duration: f64,
    pub timestamp: Option<String>,
    pub label: Option<String>,
    pub has_transcript: bool,
    /// Only filled by [`get_library_recordings`], like the former TS query.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
}

/// Columns shared by every library query; `hasTranscript` is column 5.
const LIBRARY_COLUMNS: &str = "r.id, r.filename, r.duration, r.timestamp, r.label,
       MAX(CASE WHEN t.id IS NOT NULL THEN 1 ELSE 0 END) AS hasTranscript";

/// Parses the JSON array stored in `Recordings.tags`. `NULL`, an empty string
/// or malformed JSON yield an empty list.
pub(crate) fn parse_tags(raw: Option<&str>) -> Vec<String> {
    match raw {
        Some(s) if !s.trim().is_empty() => serde_json::from_str(s).unwrap_or_else(|e| {
            log::warn!("Ignoring malformed tags value {:?}: {}", s, e);
            Vec::new()
        }),
        _ => Vec::new(),
    }
}

/// Serializes a tag list for `Recordings.tags`.
pub(crate) fn encode_tags(tags: &[String]) -> String {
    serde_json::to_string(tags).expect("a list of strings always serializes")
}

fn library_row(row: &Row<'_>) -> rusqlite::Result<LibraryRecording> {
    Ok(LibraryRecording {
        id: row.get(0)?,
        filename: row.get(1)?,
        duration: row.get(2)?,
        timestamp: text_column(row, 3)?,
        label: text_column(row, 4)?,
        has_transcript: row.get::<_, i64>(5)? == 1,
        tags: None,
    })
}

/// Inserts a recording and returns its id. Without a (non-empty) `timestamp`
/// the column default (`CURRENT_TIMESTAMP`) is used.
pub fn save_recording(
    conn: &Connection,
    filename: &str,
    duration: f64,
    label: Option<&str>,
    timestamp: Option<&str>,
) -> rusqlite::Result<i64> {
    match timestamp.filter(|t| !t.is_empty()) {
        Some(ts) => conn.execute(
            "INSERT INTO Recordings (filename, duration, label, timestamp, tags) VALUES (?1, ?2, ?3, ?4, '[]')",
            params![filename, duration, label, ts],
        )?,
        None => conn.execute(
            "INSERT INTO Recordings (filename, duration, label, tags) VALUES (?1, ?2, ?3, '[]')",
            params![filename, duration, label],
        )?,
    };
    Ok(conn.last_insert_rowid())
}

/// All recordings, newest first, with their tags and transcript flag.
pub fn get_library_recordings(conn: &Connection) -> rusqlite::Result<Vec<LibraryRecording>> {
    let sql = format!(
        "SELECT {LIBRARY_COLUMNS}, r.tags
         FROM Recordings r
         LEFT JOIN Transcripts t ON r.id = t.recording_id
         GROUP BY r.id
         ORDER BY r.timestamp DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |row| {
        let mut rec = library_row(row)?;
        let raw: Option<String> = text_column(row, 6)?;
        rec.tags = Some(parse_tags(raw.as_deref()));
        Ok(rec)
    })?;
    rows.collect()
}

/// A single library recording (without tags), or `None`.
pub fn get_library_recording_by_id(
    conn: &Connection,
    id: i64,
) -> rusqlite::Result<Option<LibraryRecording>> {
    let sql = format!(
        "SELECT {LIBRARY_COLUMNS}
         FROM Recordings r
         LEFT JOIN Transcripts t ON r.id = t.recording_id
         WHERE r.id = ?1
         GROUP BY r.id"
    );
    conn.query_row(&sql, [id], library_row).optional()
}

/// Deletes a recording; the `delete_recording_cascade` trigger removes its
/// transcripts and summaries.
pub fn delete_recording(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM Recordings WHERE id = ?1", [id])?;
    Ok(())
}

/// Updates a recording's file name and label.
pub fn update_recording(
    conn: &Connection,
    id: i64,
    filename: &str,
    label: Option<&str>,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE Recordings SET filename = ?1, label = ?2 WHERE id = ?3",
        params![filename, label, id],
    )?;
    Ok(())
}

/// The raw recording row, or `None`.
pub fn get_raw_recording_by_id(conn: &Connection, id: i64) -> rusqlite::Result<Option<Recording>> {
    conn.query_row(
        "SELECT id, filename, duration, timestamp, group_id, label FROM Recordings WHERE id = ?1",
        [id],
        |row| {
            Ok(Recording {
                id: row.get(0)?,
                filename: row.get(1)?,
                duration: row.get(2)?,
                timestamp: text_column(row, 3)?,
                group_id: legacy_group_id(row, 4)?,
                label: text_column(row, 5)?,
            })
        },
    )
    .optional()
}

/// Reads the unused legacy `group_id` column. Very old databases kept the
/// label text there, so anything but a number is reported as `None` instead of
/// failing the whole lookup.
fn legacy_group_id(row: &Row<'_>, idx: usize) -> rusqlite::Result<Option<i64>> {
    Ok(match row.get_ref(idx)? {
        ValueRef::Integer(i) => Some(i),
        ValueRef::Real(f) => Some(f as i64),
        _ => None,
    })
}

/// Recordings whose timestamp is more than 30 days in the past (without tags).
pub fn get_recordings_older_than_30_days(
    conn: &Connection,
) -> rusqlite::Result<Vec<LibraryRecording>> {
    let sql = format!(
        "SELECT {LIBRARY_COLUMNS}
         FROM Recordings r
         LEFT JOIN Transcripts t ON r.id = t.recording_id
         WHERE r.timestamp < datetime('now', '-30 days')
         GROUP BY r.id"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], library_row)?;
    rows.collect()
}

/// Replaces a recording's tag list.
pub fn update_recording_tags(conn: &Connection, id: i64, tags: &[String]) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE Recordings SET tags = ?1 WHERE id = ?2",
        params![encode_tags(tags), id],
    )?;
    Ok(())
}

#[tauri::command]
pub async fn db_save_recording(
    db: State<'_, Db>,
    filename: String,
    duration: f64,
    label: Option<String>,
    timestamp: Option<String>,
) -> Result<i64, String> {
    db.run(move |c| {
        save_recording(
            c,
            &filename,
            duration,
            label.as_deref(),
            timestamp.as_deref(),
        )
    })
    .await
}

#[tauri::command]
pub async fn db_get_library_recordings(db: State<'_, Db>) -> Result<Vec<LibraryRecording>, String> {
    db.run(|c| get_library_recordings(c)).await
}

#[tauri::command]
pub async fn db_get_library_recording_by_id(
    db: State<'_, Db>,
    id: i64,
) -> Result<Option<LibraryRecording>, String> {
    db.run(move |c| get_library_recording_by_id(c, id)).await
}

#[tauri::command]
pub async fn db_delete_recording(db: State<'_, Db>, id: i64) -> Result<(), String> {
    db.run(move |c| delete_recording(c, id)).await
}

#[tauri::command]
pub async fn db_update_recording(
    db: State<'_, Db>,
    id: i64,
    filename: String,
    label: Option<String>,
) -> Result<(), String> {
    db.run(move |c| update_recording(c, id, &filename, label.as_deref()))
        .await
}

#[tauri::command]
pub async fn db_get_raw_recording_by_id(
    db: State<'_, Db>,
    id: i64,
) -> Result<Option<Recording>, String> {
    db.run(move |c| get_raw_recording_by_id(c, id)).await
}

#[tauri::command]
pub async fn db_get_recordings_older_than_30_days(
    db: State<'_, Db>,
) -> Result<Vec<LibraryRecording>, String> {
    db.run(|c| get_recordings_older_than_30_days(c)).await
}

#[tauri::command]
pub async fn db_update_recording_tags(
    db: State<'_, Db>,
    id: i64,
    tags: Vec<String>,
) -> Result<(), String> {
    db.run(move |c| update_recording_tags(c, id, &tags)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    #[test]
    fn test_save_recording_with_and_without_timestamp() {
        let conn = open_in_memory();
        let a = save_recording(
            &conn,
            "a.ogg",
            12.0,
            Some("Meeting"),
            Some("2026-07-08 12:00:00"),
        )
        .unwrap();
        let b = save_recording(&conn, "b.ogg", 3.5, None, None).unwrap();
        let c = save_recording(&conn, "c.ogg", 4.0, None, Some("")).unwrap();
        assert_eq!((a, b, c), (1, 2, 3));

        let rec = get_raw_recording_by_id(&conn, a).unwrap().unwrap();
        assert_eq!(
            rec,
            Recording {
                id: 1,
                filename: "a.ogg".into(),
                duration: 12.0,
                timestamp: Some("2026-07-08 12:00:00".into()),
                group_id: None,
                label: Some("Meeting".into()),
            }
        );
        let rec_b = get_raw_recording_by_id(&conn, b).unwrap().unwrap();
        assert_eq!(rec_b.duration, 3.5);
        assert!(rec_b.timestamp.is_some(), "default timestamp must be set");
        assert!(get_raw_recording_by_id(&conn, c)
            .unwrap()
            .unwrap()
            .timestamp
            .is_some());
        let tags: String = conn
            .query_row("SELECT tags FROM Recordings WHERE id = 2", [], |r| r.get(0))
            .unwrap();
        assert_eq!(tags, "[]");
    }

    #[test]
    fn test_get_library_recordings_orders_and_flags_transcripts() {
        let conn = open_in_memory();
        let old = save_recording(
            &conn,
            "old.ogg",
            1.0,
            Some("Old"),
            Some("2026-01-01 00:00:00"),
        )
        .unwrap();
        let new = save_recording(&conn, "new.ogg", 2.0, None, Some("2026-02-01 00:00:00")).unwrap();
        conn.execute(
            "INSERT INTO Transcripts (recording_id, text_content) VALUES (?1, 'a')",
            [old],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO Transcripts (recording_id, text_content) VALUES (?1, 'b')",
            [old],
        )
        .unwrap();
        update_recording_tags(&conn, new, &["urgent".into(), "sync".into()]).unwrap();
        conn.execute("UPDATE Recordings SET tags = NULL WHERE id = ?1", [old])
            .unwrap();

        let list = get_library_recordings(&conn).unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].id, new);
        assert!(!list[0].has_transcript);
        assert_eq!(
            list[0].tags,
            Some(vec!["urgent".to_string(), "sync".to_string()])
        );
        assert_eq!(list[1].id, old);
        assert!(list[1].has_transcript);
        assert_eq!(list[1].label.as_deref(), Some("Old"));
        assert_eq!(list[1].tags, Some(vec![]));
    }

    #[test]
    fn test_get_library_recording_by_id() {
        let conn = open_in_memory();
        let id = save_recording(&conn, "a.ogg", 1.0, Some("L"), None).unwrap();
        let rec = get_library_recording_by_id(&conn, id).unwrap().unwrap();
        assert_eq!(rec.filename, "a.ogg");
        assert!(!rec.has_transcript);
        assert_eq!(rec.tags, None);
        assert!(get_library_recording_by_id(&conn, 99).unwrap().is_none());
    }

    #[test]
    fn test_update_and_delete_recording() {
        let conn = open_in_memory();
        let id = save_recording(&conn, "a.ogg", 1.0, Some("L"), None).unwrap();
        conn.execute(
            "INSERT INTO Transcripts (recording_id, text_content) VALUES (?1, 't')",
            [id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO Summaries (transcript_id, summary_text) VALUES (1, 's')",
            [],
        )
        .unwrap();

        update_recording(&conn, id, "b.ogg", None).unwrap();
        let rec = get_raw_recording_by_id(&conn, id).unwrap().unwrap();
        assert_eq!((rec.filename.as_str(), rec.label), ("b.ogg", None));

        delete_recording(&conn, id).unwrap();
        assert!(get_raw_recording_by_id(&conn, id).unwrap().is_none());
        let left: i64 = conn
            .query_row(
                "SELECT (SELECT COUNT(*) FROM Transcripts) + (SELECT COUNT(*) FROM Summaries)",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(left, 0);
    }

    #[test]
    fn test_get_raw_recording_tolerates_text_in_legacy_group_id() {
        let conn = open_in_memory();
        let id = save_recording(&conn, "a.ogg", 1.0, None, None).unwrap();
        conn.execute(
            "UPDATE Recordings SET group_id = 'Weekly' WHERE id = ?1",
            [id],
        )
        .unwrap();
        assert_eq!(
            get_raw_recording_by_id(&conn, id)
                .unwrap()
                .unwrap()
                .group_id,
            None
        );
        conn.execute("UPDATE Recordings SET group_id = 4 WHERE id = ?1", [id])
            .unwrap();
        assert_eq!(
            get_raw_recording_by_id(&conn, id)
                .unwrap()
                .unwrap()
                .group_id,
            Some(4)
        );
    }

    #[test]
    fn test_get_recordings_older_than_30_days() {
        let conn = open_in_memory();
        let old = save_recording(&conn, "old.ogg", 1.0, None, Some("2000-01-01 00:00:00")).unwrap();
        save_recording(&conn, "new.ogg", 1.0, None, None).unwrap();
        let list = get_recordings_older_than_30_days(&conn).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, old);
        assert_eq!(list[0].tags, None);
    }

    #[test]
    fn test_parse_tags_tolerates_bad_values() {
        assert_eq!(parse_tags(None), Vec::<String>::new());
        assert_eq!(parse_tags(Some("")), Vec::<String>::new());
        assert_eq!(parse_tags(Some("not json")), Vec::<String>::new());
        assert_eq!(parse_tags(Some("[\"a\"]")), vec!["a".to_string()]);
    }

    #[test]
    fn test_serialized_field_names_match_frontend_types() {
        let rec = LibraryRecording {
            id: 1,
            filename: "a".into(),
            duration: 2.0,
            timestamp: Some("t".into()),
            label: None,
            has_transcript: true,
            tags: None,
        };
        let json = serde_json::to_value(&rec).unwrap();
        assert_eq!(
            json,
            serde_json::json!({"id": 1, "filename": "a", "duration": 2.0, "timestamp": "t", "label": null, "hasTranscript": true})
        );
        let raw = Recording {
            id: 1,
            filename: "a".into(),
            duration: 2.0,
            timestamp: None,
            group_id: Some(3),
            label: None,
        };
        assert_eq!(serde_json::to_value(&raw).unwrap()["groupId"], 3);
    }
}
