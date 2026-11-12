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

//! Library statistics shown in the Engine tab.

use super::Db;
use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

/// Row counts of the library (TS `{ recordingsCount, transcriptsCount }`).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Stats {
    pub recordings_count: i64,
    pub transcripts_count: i64,
}

/// Counts recordings and transcripts.
pub fn get_stats(conn: &Connection) -> rusqlite::Result<Stats> {
    conn.query_row(
        "SELECT (SELECT COUNT(*) FROM Recordings), (SELECT COUNT(*) FROM Transcripts)",
        [],
        |row| Ok(Stats { recordings_count: row.get(0)?, transcripts_count: row.get(1)? }),
    )
}

#[tauri::command]
pub async fn db_get_stats(db: State<'_, Db>) -> Result<Stats, String> {
    db.run(|c| get_stats(c)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{open_in_memory, recordings::save_recording, transcripts::save_transcript};

    #[test]
    fn test_get_stats_counts_rows() {
        let mut conn = open_in_memory();
        assert_eq!(get_stats(&conn).unwrap(), Stats { recordings_count: 0, transcripts_count: 0 });
        let a = save_recording(&conn, "a.ogg", 1.0, None, None).unwrap();
        save_recording(&conn, "b.ogg", 1.0, None, None).unwrap();
        save_transcript(&mut conn, a, "t").unwrap();
        let stats = get_stats(&conn).unwrap();
        assert_eq!(stats, Stats { recordings_count: 2, transcripts_count: 1 });
        assert_eq!(
            serde_json::to_value(&stats).unwrap(),
            serde_json::json!({"recordingsCount": 2, "transcriptsCount": 1})
        );
    }
}
