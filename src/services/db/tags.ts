import { getDb } from './core';
import { Tag } from './types';
import { getLibraryRecordings, updateRecordingTags } from './recordings';

export async function getTags(): Promise<Tag[]> {
  const db = await getDb();
  return await db.select<Tag[]>('SELECT * FROM Tags ORDER BY name ASC');
}

export async function saveTagContext(name: string, context: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    'INSERT INTO Tags (name, context) VALUES ($1, $2) ON CONFLICT(name) DO UPDATE SET context = $2',
    [name, context]
  );
}

export async function ensureTagExists(name: string): Promise<void> {
  const db = await getDb();
  await db.execute('INSERT OR IGNORE INTO Tags (name, context) VALUES ($1, "")', [name]);
}

export async function deleteTag(name: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM Tags WHERE name = $1', [name]);

  const recordings = await getLibraryRecordings();
  for (const rec of recordings) {
    if (rec.tags && rec.tags.includes(name)) {
      const newTags = rec.tags.filter(t => t !== name);
      await updateRecordingTags(rec.id, newTags);
    }
  }
}

