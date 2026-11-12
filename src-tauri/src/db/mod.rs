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

//! Metadata database (`epi_meta.db`).
//!
//! The webview has no SQL access of its own: every query lives in this module
//! and is exposed as a typed `db_*` Tauri command, one per function of the
//! frontend's `src/services/db` services. All statements use bound parameters.
//!
//! A single SQLite connection is opened lazily on first use, configured
//! (`foreign_keys = ON`, busy timeout) and brought up to date by
//! [`migrations::run_migrations`]. Queries run on Tokio's blocking thread pool
//! so the async runtime is never blocked by disk I/O.

pub mod automations;
pub mod glossary;
pub mod migrations;
pub mod prompts;
pub mod recordings;
pub mod stats;
pub mod summaries;
pub mod tags;
pub mod transcripts;

use rusqlite::types::ValueRef;
use rusqlite::{Connection, Row};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// File name of the metadata database.
///
/// Earlier versions opened it through tauri-plugin-sql as `sqlite:epi_meta.db`,
/// which the plugin resolves against the app config directory
/// (`app.path().app_config_dir()`). The same file is opened here so existing
/// libraries keep their data.
pub const DB_FILE_NAME: &str = "epi_meta.db";

/// Managed Tauri state that owns the database connection.
pub struct Db {
    /// Location of the database file; `None` for a connection supplied up front (tests).
    path: Option<PathBuf>,
    /// The open connection, created on first use.
    conn: Arc<Mutex<Option<Connection>>>,
}

impl Db {
    /// Creates a handle for the database at `path`. The file is opened (and
    /// created, together with its parent directory) on first use.
    pub fn new(path: PathBuf) -> Self {
        Self {
            path: Some(path),
            conn: Arc::new(Mutex::new(None)),
        }
    }

    /// Wraps an already opened and migrated connection.
    #[cfg(test)]
    pub fn from_connection(conn: Connection) -> Self {
        Self {
            path: None,
            conn: Arc::new(Mutex::new(Some(conn))),
        }
    }

    /// Runs `f` with the connection on the blocking thread pool, opening and
    /// migrating the database first if this is the first call.
    pub async fn run<T, F>(&self, f: F) -> Result<T, String>
    where
        T: Send + 'static,
        F: FnOnce(&mut Connection) -> rusqlite::Result<T> + Send + 'static,
    {
        let conn = Arc::clone(&self.conn);
        let path = self.path.clone();
        tokio::task::spawn_blocking(move || {
            let mut guard = conn.lock().unwrap_or_else(|e| e.into_inner());
            if guard.is_none() {
                let path = path.ok_or_else(|| "The database is not configured".to_string())?;
                *guard = Some(open(&path)?);
            }
            let conn = guard.as_mut().expect("connection was just opened");
            f(conn).map_err(|e| format!("Database error: {}", e))
        })
        .await
        .map_err(|e| e.to_string())?
    }
}

/// Opens (creating if necessary) the database file at `path`, configures the
/// connection and applies pending migrations.
pub fn open(path: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| {
            format!(
                "Could not create database directory {}: {}",
                parent.display(),
                e
            )
        })?;
    }
    let mut conn = Connection::open(path)
        .map_err(|e| format!("Could not open database {}: {}", path.display(), e))?;
    prepare(&mut conn).map_err(|e| format!("Could not initialize database: {}", e))?;
    Ok(conn)
}

/// Configures a freshly opened connection and applies pending migrations.
pub fn prepare(conn: &mut Connection) -> rusqlite::Result<()> {
    conn.pragma_update(None, "foreign_keys", true)?;
    conn.busy_timeout(Duration::from_secs(5))?;
    migrations::run_migrations(conn)
}

/// Opens a migrated in-memory database for unit tests.
#[cfg(test)]
pub fn open_in_memory() -> Connection {
    let mut conn = Connection::open_in_memory().expect("open in-memory database");
    prepare(&mut conn).expect("prepare in-memory database");
    conn
}

/// Reads a column as text whatever its storage class.
///
/// `DATETIME` columns have numeric affinity, so SQLite may store a value as an
/// integer or real; tauri-plugin-sql returned such values as they were, and
/// this keeps them usable as strings for the frontend.
pub(crate) fn text_column(row: &Row<'_>, idx: usize) -> rusqlite::Result<Option<String>> {
    Ok(match row.get_ref(idx)? {
        ValueRef::Null => None,
        ValueRef::Integer(i) => Some(i.to_string()),
        ValueRef::Real(f) => Some(f.to_string()),
        ValueRef::Text(t) => Some(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(b) => Some(String::from_utf8_lossy(b).into_owned()),
    })
}

/// Opens the database once at start-up so that `db_init` reports problems
/// (unwritable directory, corrupt file, failed migration) to the UI.
#[tauri::command]
pub async fn db_init(db: tauri::State<'_, Db>) -> Result<(), String> {
    db.run(|_| Ok(())).await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn block_on<F: std::future::Future>(f: F) -> F::Output {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(f)
    }

    #[test]
    fn test_open_creates_file_and_parent_directory() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested").join(DB_FILE_NAME);
        let conn = open(&path).unwrap();
        assert!(path.exists());
        let fk: i64 = conn
            .pragma_query_value(None, "foreign_keys", |r| r.get(0))
            .unwrap();
        assert_eq!(fk, 1);
    }

    #[test]
    fn test_run_opens_lazily_and_reuses_connection() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(DB_FILE_NAME);
        let db = Db::new(path.clone());
        assert!(!path.exists());

        let id =
            block_on(db.run(|c| recordings::save_recording(c, "a.ogg", 1.0, None, None))).unwrap();
        let count = block_on(db.run(|c| stats::get_stats(c)))
            .unwrap()
            .recordings_count;
        assert!(path.exists());
        assert_eq!(id, 1);
        assert_eq!(count, 1);
    }

    #[test]
    fn test_run_reports_sql_errors() {
        let db = Db::from_connection(open_in_memory());
        let err =
            block_on(db.run(|c| c.execute("INSERT INTO Missing VALUES (1)", []))).unwrap_err();
        assert!(err.starts_with("Database error:"), "{}", err);
    }

    #[test]
    fn test_run_reports_open_errors() {
        let dir = tempfile::tempdir().unwrap();
        // A directory cannot be opened as a database file.
        let db = Db::new(dir.path().to_path_buf());
        assert!(block_on(db.run(|_| Ok(()))).is_err());
    }

    #[test]
    fn test_text_column_accepts_any_storage_class() {
        let conn = Connection::open_in_memory().unwrap();
        let values: Vec<Option<String>> = conn
            .prepare("SELECT NULL UNION ALL SELECT 42 UNION ALL SELECT 'x'")
            .unwrap()
            .query_map([], |r| text_column(r, 0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(values, vec![None, Some("42".into()), Some("x".into())]);
    }
}
