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

//! Automations table: scheduled transcription / summarization jobs.

use super::Db;
use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::State;

/// An automation (TS `Automation`).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Automation {
    pub id: i64,
    pub name: String,
    /// Time of day in `HH:mm` format.
    pub trigger_time: String,
    pub timerange_hours: f64,
    pub action: String,
}

/// All automations, newest first.
pub fn get_automations(conn: &Connection) -> rusqlite::Result<Vec<Automation>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, trigger_time, timerange_hours, action FROM Automations ORDER BY id DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Automation {
            id: row.get(0)?,
            name: row.get(1)?,
            trigger_time: row.get(2)?,
            timerange_hours: row.get(3)?,
            action: row.get(4)?,
        })
    })?;
    rows.collect()
}

/// Inserts an automation and returns its id.
pub fn create_automation(
    conn: &Connection,
    name: &str,
    trigger_time: &str,
    timerange_hours: f64,
    action: &str,
) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO Automations (name, trigger_time, timerange_hours, action) VALUES (?1, ?2, ?3, ?4)",
        params![name, trigger_time, timerange_hours, action],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Deletes an automation.
pub fn delete_automation(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM Automations WHERE id = ?1", [id])?;
    Ok(())
}

#[tauri::command]
pub async fn db_get_automations(db: State<'_, Db>) -> Result<Vec<Automation>, String> {
    db.run(|c| get_automations(c)).await
}

#[tauri::command]
pub async fn db_create_automation(
    db: State<'_, Db>,
    name: String,
    trigger_time: String,
    timerange_hours: f64,
    action: String,
) -> Result<i64, String> {
    db.run(move |c| create_automation(c, &name, &trigger_time, timerange_hours, &action))
        .await
}

#[tauri::command]
pub async fn db_delete_automation(db: State<'_, Db>, id: i64) -> Result<(), String> {
    db.run(move |c| delete_automation(c, id)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    #[test]
    fn test_automation_crud() {
        let conn = open_in_memory();
        let a = create_automation(&conn, "Morning", "08:00", 24.0, "transcribe").unwrap();
        let b = create_automation(&conn, "Friday", "17:00", 120.0, "summarize").unwrap();
        let list = get_automations(&conn).unwrap();
        assert_eq!(list.iter().map(|x| x.id).collect::<Vec<_>>(), vec![b, a]);
        assert_eq!(
            list[1],
            Automation {
                id: a,
                name: "Morning".into(),
                trigger_time: "08:00".into(),
                timerange_hours: 24.0,
                action: "transcribe".into(),
            }
        );
        delete_automation(&conn, b).unwrap();
        assert_eq!(get_automations(&conn).unwrap().len(), 1);
    }

    #[test]
    fn test_serialized_field_names_match_frontend_types() {
        let a = Automation {
            id: 1,
            name: "n".into(),
            trigger_time: "08:00".into(),
            timerange_hours: 24.0,
            action: "x".into(),
        };
        assert_eq!(
            serde_json::to_value(&a).unwrap(),
            serde_json::json!({"id": 1, "name": "n", "triggerTime": "08:00", "timerangeHours": 24.0, "action": "x"})
        );
    }
}
