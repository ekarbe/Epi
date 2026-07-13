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

import { getDb } from './core';

export interface PromptTemplate {
  id: number;
  title: string;
  templateText: string;
}

interface RawPromptRow {
  id: number;
  title: string;
  template_text: string;
}

export async function getPrompts(): Promise<PromptTemplate[]> {
  const db = await getDb();
  const rawRows = await db.select<RawPromptRow[]>('SELECT * FROM Prompts ORDER BY id ASC');
  
  return rawRows.map(row => ({
    id: row.id,
    title: row.title,
    templateText: row.template_text
  }));
}

export async function createPrompt(title: string, templateText: string): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    'INSERT INTO Prompts (title, template_text) VALUES ($1, $2)',
    [title, templateText]
  );
  return result.lastInsertId || 0;
}

export async function updatePrompt(id: number, title: string, templateText: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    'UPDATE Prompts SET title = $1, template_text = $2 WHERE id = $3',
    [title, templateText, id]
  );
}

export async function deletePrompt(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM Prompts WHERE id = $1', [id]);
}

// Ensure default prompts exist
export async function ensureDefaultPrompts(): Promise<void> {
  const prompts = await getPrompts();
  if (prompts.length === 0) {
    const execSummary = `System: You are an expert executive assistant. Your task is to analyze the provided meeting transcript and generate a highly structured Executive Summary.

Instructions:
1. Use Markdown formatting.
2. Do not include any filler text. Start directly with the summary.
3. Organize the output into the following sections:
   - **Meeting Goal/Topic**: A one-sentence summary of the meeting's purpose.
   - **Key Decisions**: Bullet points of finalized decisions.
   - **Main Discussion Points**: A concise summary of the core topics discussed.
   - **Action Items**: A checklist of tasks, including the assignee (if mentioned) and deadline (if mentioned).

Transcript:
{{transcript}}`;

    const detailedMinutes = `System: You are a meticulous meeting secretary. Your task is to generate Detailed Meeting Minutes from the provided transcript.

Instructions:
1. Use Markdown formatting.
2. Structure the notes chronologically to reflect the flow of the conversation.
3. For each major topic discussed, provide a subheading and a detailed paragraph or bulleted list capturing the nuances of the discussion, differing opinions, and the final consensus.
4. Identify any open questions that were left unresolved.

Transcript:
{{transcript}}`;

    const techArch = `System: You are a Senior Staff Software Engineer analyzing a technical discussion. Your task is to extract all architectural, engineering, and technical information from the transcript.

Instructions:
1. Use Markdown formatting.
2. Organize the output into the following sections:
   - **System Architecture**: Any changes, proposals, or decisions regarding system design, infrastructure, or architecture.
   - **API & Data Models**: Any discussion about endpoints, database schemas, or payloads.
   - **Technical Debt & Blockers**: Any mentioned bugs, refactoring needs, or development blockers.
   - **Next Engineering Steps**: Actionable development tasks.
3. If a section is not applicable to the transcript, write "None discussed."

Transcript:
{{transcript}}`;

    const userResearch = `System: You are an expert UX Researcher analyzing a user interview or feedback session. Your task is to synthesize the user's feedback into actionable product insights.

Instructions:
1. Use Markdown formatting.
2. Extract information into the following sections:
   - **User Profile/Context**: Briefly describe the user and their use case based on the transcript.
   - **Pain Points**: A bulleted list of frustrations, bugs, or difficulties the user experienced. Include exact quotes where highly relevant.
   - **Feature Requests**: Any new features, improvements, or workflows the user explicitly asked for or implicitly needed.
   - **General Sentiment**: A short summary of the user's overall feeling towards the product or topic.

Transcript:
{{transcript}}`;

    await createPrompt("Executive Summary & Action Items", execSummary);
    await createPrompt("Detailed Meeting Minutes", detailedMinutes);
    await createPrompt("Technical Architecture Notes", techArch);
    await createPrompt("User Research & Feedback", userResearch);
  }
}
