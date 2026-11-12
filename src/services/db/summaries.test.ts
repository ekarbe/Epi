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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '../../lib/api';
import { saveSummary, updateSummary, getSummaryForTranscript } from './summaries';

vi.mock('../../lib/api', () => ({
  invoke: vi.fn(),
}));

describe('summaries db service', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('saveSummary returns the summary id', async () => {
    vi.mocked(invoke).mockResolvedValue(3);
    expect(await saveSummary(1, 'sum')).toBe(3);
    expect(invoke).toHaveBeenCalledWith('db_save_summary', { transcriptId: 1, summaryText: 'sum' });
  });

  it('updateSummary passes id and text', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await updateSummary(2, 'new');
    expect(invoke).toHaveBeenCalledWith('db_update_summary', { id: 2, summaryText: 'new' });
  });

  it('getSummaryForTranscript returns the summary or null', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ id: 1, summaryText: 's' }).mockResolvedValueOnce(null);
    expect(await getSummaryForTranscript(9)).toEqual({ id: 1, summaryText: 's' });
    expect(await getSummaryForTranscript(10)).toBeNull();
    expect(invoke).toHaveBeenCalledWith('db_get_summary_for_transcript', { transcriptId: 9 });
  });
});
