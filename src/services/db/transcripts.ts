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
import { Transcript } from './types';

/**
 * Stores the transcript of a recording, updating the existing transcript if
 * there is one. Returns the transcript id.
 */
export async function saveTranscript(recordingId: number, textContent: string): Promise<number> {
  return invoke<number>('db_save_transcript', { recordingId, textContent });
}

/** Replaces the text of a transcript. */
export async function updateTranscript(id: number, textContent: string): Promise<void> {
  await invoke('db_update_transcript', { id, textContent });
}

/** The transcript of a recording, or `null` if it has none. */
export async function getTranscriptForRecording(recId: number): Promise<Transcript | null> {
  return invoke<Transcript | null>('db_get_transcript_for_recording', { recordingId: recId });
}

/** Deletes the transcripts of a recording and their summaries; the recording stays. */
export async function deleteTranscriptAndSummaryDb(recordingId: number): Promise<void> {
  await invoke('db_delete_transcript_and_summary', { recordingId });
}
