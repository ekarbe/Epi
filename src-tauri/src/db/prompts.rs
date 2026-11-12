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

//! Prompts table: summary prompt templates (`{{transcript}}` is replaced by
//! the transcript text).

use super::Db;
use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::State;

/// A prompt template (TS `PromptTemplate`).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptTemplate {
    pub id: i64,
    pub title: String,
    pub template_text: String,
}

/// Default "Executive Summary & Action Items" template.
const EXEC_SUMMARY: &str = r#"System: You are an expert executive assistant. Your task is to analyze the provided meeting transcript and generate a highly structured Executive Summary.

Instructions:
1. Use Markdown formatting.
2. Do not include any filler text. Start directly with the summary.
3. Organize the output into the following sections:
   - **Meeting Goal/Topic**: A one-sentence summary of the meeting's purpose.
   - **Key Decisions**: Bullet points of finalized decisions.
   - **Main Discussion Points**: A concise summary of the core topics discussed.
   - **Action Items**: A checklist of tasks, including the assignee (if mentioned) and deadline (if mentioned).

Transcript:
{{transcript}}"#;

/// Default "Detailed Meeting Minutes" template.
const DETAILED_MINUTES: &str = r#"System: You are a meticulous meeting secretary. Your task is to generate Detailed Meeting Minutes from the provided transcript.

Instructions:
1. Use Markdown formatting.
2. Structure the notes chronologically to reflect the flow of the conversation.
3. For each major topic discussed, provide a subheading and a detailed paragraph or bulleted list capturing the nuances of the discussion, differing opinions, and the final consensus.
4. Identify any open questions that were left unresolved.

Transcript:
{{transcript}}"#;

/// Default "Technical Architecture Notes" template.
const TECH_ARCH: &str = r#"System: You are a Senior Staff Software Engineer analyzing a technical discussion. Your task is to extract all architectural, engineering, and technical information from the transcript.

Instructions:
1. Use Markdown formatting.
2. Organize the output into the following sections:
   - **System Architecture**: Any changes, proposals, or decisions regarding system design, infrastructure, or architecture.
   - **API & Data Models**: Any discussion about endpoints, database schemas, or payloads.
   - **Technical Debt & Blockers**: Any mentioned bugs, refactoring needs, or development blockers.
   - **Next Engineering Steps**: Actionable development tasks.
3. If a section is not applicable to the transcript, write "None discussed."

Transcript:
{{transcript}}"#;

/// Default "User Research & Feedback" template.
const USER_RESEARCH: &str = r#"System: You are an expert UX Researcher analyzing a user interview or feedback session. Your task is to synthesize the user's feedback into actionable product insights.

Instructions:
1. Use Markdown formatting.
2. Extract information into the following sections:
   - **User Profile/Context**: Briefly describe the user and their use case based on the transcript.
   - **Pain Points**: A bulleted list of frustrations, bugs, or difficulties the user experienced. Include exact quotes where highly relevant.
   - **Feature Requests**: Any new features, improvements, or workflows the user explicitly asked for or implicitly needed.
   - **General Sentiment**: A short summary of the user's overall feeling towards the product or topic.

Transcript:
{{transcript}}"#;

/// Templates inserted by [`ensure_default_prompts`], in order.
pub const DEFAULT_PROMPTS: &[(&str, &str)] = &[
    ("Executive Summary & Action Items", EXEC_SUMMARY),
    ("Detailed Meeting Minutes", DETAILED_MINUTES),
    ("Technical Architecture Notes", TECH_ARCH),
    ("User Research & Feedback", USER_RESEARCH),
];

/// All prompts in creation order.
pub fn get_prompts(conn: &Connection) -> rusqlite::Result<Vec<PromptTemplate>> {
    let mut stmt = conn.prepare("SELECT id, title, template_text FROM Prompts ORDER BY id ASC")?;
    let rows = stmt.query_map([], |row| {
        Ok(PromptTemplate {
            id: row.get(0)?,
            title: row.get(1)?,
            template_text: row.get(2)?,
        })
    })?;
    rows.collect()
}

/// Inserts a prompt and returns its id.
pub fn create_prompt(conn: &Connection, title: &str, template_text: &str) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO Prompts (title, template_text) VALUES (?1, ?2)",
        params![title, template_text],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Updates the title and text of a prompt.
pub fn update_prompt(
    conn: &Connection,
    id: i64,
    title: &str,
    template_text: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE Prompts SET title = ?1, template_text = ?2 WHERE id = ?3",
        params![title, template_text, id],
    )?;
    Ok(())
}

/// Deletes a prompt.
pub fn delete_prompt(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM Prompts WHERE id = ?1", [id])?;
    Ok(())
}

/// Inserts the [`DEFAULT_PROMPTS`] when the table is empty (first start, or
/// after the user deleted every prompt).
pub fn ensure_default_prompts(conn: &mut Connection) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    let count: i64 = tx.query_row("SELECT COUNT(*) FROM Prompts", [], |r| r.get(0))?;
    if count == 0 {
        for (title, text) in DEFAULT_PROMPTS {
            create_prompt(&tx, title, text)?;
        }
    }
    tx.commit()
}

#[tauri::command]
pub async fn db_get_prompts(db: State<'_, Db>) -> Result<Vec<PromptTemplate>, String> {
    db.run(|c| get_prompts(c)).await
}

#[tauri::command]
pub async fn db_create_prompt(
    db: State<'_, Db>,
    title: String,
    template_text: String,
) -> Result<i64, String> {
    db.run(move |c| create_prompt(c, &title, &template_text))
        .await
}

#[tauri::command]
pub async fn db_update_prompt(
    db: State<'_, Db>,
    id: i64,
    title: String,
    template_text: String,
) -> Result<(), String> {
    db.run(move |c| update_prompt(c, id, &title, &template_text))
        .await
}

#[tauri::command]
pub async fn db_delete_prompt(db: State<'_, Db>, id: i64) -> Result<(), String> {
    db.run(move |c| delete_prompt(c, id)).await
}

#[tauri::command]
pub async fn db_ensure_default_prompts(db: State<'_, Db>) -> Result<(), String> {
    db.run(ensure_default_prompts).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    #[test]
    fn test_prompt_crud() {
        let conn = open_in_memory();
        let a = create_prompt(&conn, "A", "x {{transcript}}").unwrap();
        let b = create_prompt(&conn, "B", "y").unwrap();
        update_prompt(&conn, a, "A2", "z").unwrap();
        delete_prompt(&conn, b).unwrap();
        assert_eq!(
            get_prompts(&conn).unwrap(),
            vec![PromptTemplate {
                id: a,
                title: "A2".into(),
                template_text: "z".into()
            }]
        );
    }

    #[test]
    fn test_ensure_default_prompts_only_fills_an_empty_table() {
        let mut conn = open_in_memory();
        ensure_default_prompts(&mut conn).unwrap();
        ensure_default_prompts(&mut conn).unwrap();
        let prompts = get_prompts(&conn).unwrap();
        let titles: Vec<&str> = prompts.iter().map(|p| p.title.as_str()).collect();
        assert_eq!(
            titles,
            DEFAULT_PROMPTS.iter().map(|p| p.0).collect::<Vec<_>>()
        );
        assert!(prompts
            .iter()
            .all(|p| p.template_text.ends_with("Transcript:\n{{transcript}}")));

        let mut custom = open_in_memory();
        create_prompt(&custom, "Mine", "t").unwrap();
        ensure_default_prompts(&mut custom).unwrap();
        assert_eq!(get_prompts(&custom).unwrap().len(), 1);
    }

    #[test]
    fn test_serialized_field_names_match_frontend_types() {
        let p = PromptTemplate {
            id: 1,
            title: "t".into(),
            template_text: "x".into(),
        };
        assert_eq!(
            serde_json::to_value(&p).unwrap(),
            serde_json::json!({"id": 1, "title": "t", "templateText": "x"})
        );
    }
}
