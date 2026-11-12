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

//! Glossary table: domain terms and their meaning, passed to the summarizer.

use super::Db;
use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::State;

/// A glossary entry (TS `GlossaryTerm`).
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct GlossaryTerm {
    pub term: String,
    pub meaning: String,
}

/// All glossary entries sorted by term.
pub fn get_glossary(conn: &Connection) -> rusqlite::Result<Vec<GlossaryTerm>> {
    let mut stmt = conn.prepare("SELECT term, meaning FROM Glossary ORDER BY term ASC")?;
    let rows = stmt.query_map([], |row| {
        Ok(GlossaryTerm {
            term: row.get(0)?,
            meaning: row.get(1)?,
        })
    })?;
    rows.collect()
}

/// Creates a glossary entry or replaces the meaning of an existing one.
pub fn save_glossary_term(conn: &Connection, term: &str, meaning: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO Glossary (term, meaning) VALUES (?1, ?2) ON CONFLICT(term) DO UPDATE SET meaning = ?2",
        params![term, meaning],
    )?;
    Ok(())
}

/// Deletes a glossary entry.
pub fn delete_glossary_term(conn: &Connection, term: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM Glossary WHERE term = ?1", [term])?;
    Ok(())
}

#[tauri::command]
pub async fn db_get_glossary(db: State<'_, Db>) -> Result<Vec<GlossaryTerm>, String> {
    db.run(|c| get_glossary(c)).await
}

#[tauri::command]
pub async fn db_save_glossary_term(
    db: State<'_, Db>,
    term: String,
    meaning: String,
) -> Result<(), String> {
    db.run(move |c| save_glossary_term(c, &term, &meaning))
        .await
}

#[tauri::command]
pub async fn db_delete_glossary_term(db: State<'_, Db>, term: String) -> Result<(), String> {
    db.run(move |c| delete_glossary_term(c, &term)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    #[test]
    fn test_glossary_crud() {
        let conn = open_in_memory();
        save_glossary_term(&conn, "Tauri", "old").unwrap();
        save_glossary_term(&conn, "FFmpeg", "media").unwrap();
        save_glossary_term(&conn, "Tauri", "framework").unwrap();
        assert_eq!(
            get_glossary(&conn).unwrap(),
            vec![
                GlossaryTerm {
                    term: "FFmpeg".into(),
                    meaning: "media".into()
                },
                GlossaryTerm {
                    term: "Tauri".into(),
                    meaning: "framework".into()
                },
            ]
        );
        delete_glossary_term(&conn, "FFmpeg").unwrap();
        assert_eq!(get_glossary(&conn).unwrap().len(), 1);
    }
}
