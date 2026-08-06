import { getDb } from './core';
import { GlossaryTerm } from './types';

export async function getGlossary(): Promise<GlossaryTerm[]> {
  const db = await getDb();
  return await db.select<GlossaryTerm[]>('SELECT * FROM Glossary ORDER BY term ASC');
}

export async function saveGlossaryTerm(term: string, meaning: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    'INSERT INTO Glossary (term, meaning) VALUES ($1, $2) ON CONFLICT(term) DO UPDATE SET meaning = $2',
    [term, meaning]
  );
}

export async function deleteGlossaryTerm(term: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM Glossary WHERE term = $1', [term]);
}
