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

//! Tags table: tag names with an optional context description that is passed
//! to the summarizer. Recordings reference tags by name in their `tags` JSON
//! array.

use super::recordings::{encode_tags, parse_tags};
use super::Db;
use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::State;

/// A tag (TS `Tag`).
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Tag {
    pub name: String,
    pub context: String,
}

/// All tags sorted by name.
pub fn get_tags(conn: &Connection) -> rusqlite::Result<Vec<Tag>> {
    let mut stmt = conn.prepare("SELECT name, context FROM Tags ORDER BY name ASC")?;
    let rows = stmt.query_map([], |row| {
        Ok(Tag {
            name: row.get(0)?,
            context: row.get(1)?,
        })
    })?;
    rows.collect()
}

/// Creates a tag or replaces the context of an existing one.
pub fn save_tag_context(conn: &Connection, name: &str, context: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO Tags (name, context) VALUES (?1, ?2) ON CONFLICT(name) DO UPDATE SET context = ?2",
        params![name, context],
    )?;
    Ok(())
}

/// Creates a tag with an empty context unless it already exists.
pub fn ensure_tag_exists(conn: &Connection, name: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO Tags (name, context) VALUES (?1, '')",
        [name],
    )?;
    Ok(())
}

/// Deletes a tag and removes it from every recording that carries it.
pub fn delete_tag(conn: &mut Connection, name: &str) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    tx.execute("DELETE FROM Tags WHERE name = ?1", [name])?;

    let tagged: Vec<(i64, Vec<String>)> = {
        let mut stmt = tx.prepare("SELECT id, tags FROM Recordings")?;
        let rows = stmt.query_map([], |row| {
            let raw: Option<String> = super::text_column(row, 1)?;
            Ok((row.get(0)?, parse_tags(raw.as_deref())))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()?
            .into_iter()
            .filter(|(_, tags)| tags.iter().any(|t| t == name))
            .collect()
    };
    for (id, tags) in tagged {
        let remaining: Vec<String> = tags.into_iter().filter(|t| t != name).collect();
        tx.execute(
            "UPDATE Recordings SET tags = ?1 WHERE id = ?2",
            params![encode_tags(&remaining), id],
        )?;
    }
    tx.commit()
}

#[tauri::command]
pub async fn db_get_tags(db: State<'_, Db>) -> Result<Vec<Tag>, String> {
    db.run(|c| get_tags(c)).await
}

#[tauri::command]
pub async fn db_save_tag_context(
    db: State<'_, Db>,
    name: String,
    context: String,
) -> Result<(), String> {
    db.run(move |c| save_tag_context(c, &name, &context)).await
}

#[tauri::command]
pub async fn db_ensure_tag_exists(db: State<'_, Db>, name: String) -> Result<(), String> {
    db.run(move |c| ensure_tag_exists(c, &name)).await
}

#[tauri::command]
pub async fn db_delete_tag(db: State<'_, Db>, name: String) -> Result<(), String> {
    db.run(move |c| delete_tag(c, &name)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::db::recordings::{get_library_recordings, save_recording, update_recording_tags};

    #[test]
    fn test_save_and_ensure_tags() {
        let conn = open_in_memory();
        ensure_tag_exists(&conn, "b").unwrap();
        save_tag_context(&conn, "a", "first").unwrap();
        save_tag_context(&conn, "a", "second").unwrap();
        save_tag_context(&conn, "b", "ctx").unwrap();
        ensure_tag_exists(&conn, "b").unwrap();
        assert_eq!(
            get_tags(&conn).unwrap(),
            vec![
                Tag {
                    name: "a".into(),
                    context: "second".into()
                },
                Tag {
                    name: "b".into(),
                    context: "ctx".into()
                },
            ]
        );
    }

    #[test]
    fn test_delete_tag_removes_it_from_recordings() {
        let mut conn = open_in_memory();
        save_tag_context(&conn, "urgent", "").unwrap();
        save_tag_context(&conn, "sync", "").unwrap();
        let a = save_recording(&conn, "a.ogg", 1.0, None, Some("2026-01-02")).unwrap();
        let b = save_recording(&conn, "b.ogg", 1.0, None, Some("2026-01-01")).unwrap();
        update_recording_tags(&conn, a, &["urgent".into(), "sync".into()]).unwrap();
        update_recording_tags(&conn, b, &["sync".into()]).unwrap();

        delete_tag(&mut conn, "urgent").unwrap();

        assert_eq!(
            get_tags(&conn).unwrap(),
            vec![Tag {
                name: "sync".into(),
                context: "".into()
            }]
        );
        let recs = get_library_recordings(&conn).unwrap();
        assert_eq!(recs[0].tags, Some(vec!["sync".to_string()]));
        assert_eq!(recs[1].tags, Some(vec!["sync".to_string()]));
    }
}
