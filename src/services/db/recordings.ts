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

import { invoke } from '../../lib/api';
import { Recording, LibraryRecording } from './types';

/**
 * Inserts a recording and returns its id. Without `timestamp` the database
 * stores the current time.
 */
export async function saveRecording(
  filename: string,
  duration: number,
  label: string | null = null,
  timestamp?: string
): Promise<number> {
  return invoke<number>('db_save_recording', { filename, duration, label, timestamp: timestamp ?? null });
}

/** All recordings, newest first, including their tags and transcript flag. */
export async function getLibraryRecordings(): Promise<LibraryRecording[]> {
  return invoke<LibraryRecording[]>('db_get_library_recordings');
}

/** A single library recording (without tags), or `null` if it does not exist. */
export async function getLibraryRecordingById(id: number): Promise<LibraryRecording | null> {
  return invoke<LibraryRecording | null>('db_get_library_recording_by_id', { id });
}

/** Deletes a recording together with its transcripts and summaries. */
export async function deleteRecordingDb(id: number): Promise<void> {
  await invoke('db_delete_recording', { id });
}

/** Updates a recording's file name and label. */
export async function updateRecording(id: number, filename: string, label: string | null): Promise<void> {
  await invoke('db_update_recording', { id, filename, label });
}

/** The raw recording row, or `null` if it does not exist. */
export async function getRawRecordingById(recId: number): Promise<Recording | null> {
  return invoke<Recording | null>('db_get_raw_recording_by_id', { id: recId });
}

/** Recordings whose timestamp is more than 30 days in the past (without tags). */
export async function getRecordingsOlderThan30Days(): Promise<LibraryRecording[]> {
  return invoke<LibraryRecording[]>('db_get_recordings_older_than_30_days');
}

/** Replaces a recording's tag list. */
export async function updateRecordingTags(id: number, tags: string[]): Promise<void> {
  await invoke('db_update_recording_tags', { id, tags });
}
