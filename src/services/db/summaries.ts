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
import { Summary } from './types';

/**
 * Stores the summary of a transcript, updating the existing summary if there
 * is one. Returns the summary id.
 */
export async function saveSummary(transcriptId: number, summaryText: string): Promise<number> {
  return invoke<number>('db_save_summary', { transcriptId, summaryText });
}

/** Replaces the text of a summary. */
export async function updateSummary(id: number, summaryText: string): Promise<void> {
  await invoke('db_update_summary', { id, summaryText });
}

/** The summary of a transcript, or `null` if it has none. */
export async function getSummaryForTranscript(tId: number): Promise<Pick<Summary, 'id' | 'summaryText'> | null> {
  return invoke<Pick<Summary, 'id' | 'summaryText'> | null>('db_get_summary_for_transcript', { transcriptId: tId });
}
