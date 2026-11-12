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
import {
  saveRecording, getLibraryRecordings, getLibraryRecordingById, deleteRecordingDb, updateRecording,
  getRawRecordingById, getRecordingsOlderThan30Days, updateRecordingTags,
} from './recordings';

vi.mock('../../lib/api', () => ({
  invoke: vi.fn(),
}));

describe('recordings db service', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('saveRecording passes the timestamp when given', async () => {
    vi.mocked(invoke).mockResolvedValue(1);
    expect(await saveRecording('test.ogg', 120, 'Meeting', '2026-07-08 12:00:00')).toBe(1);
    expect(invoke).toHaveBeenCalledWith('db_save_recording', {
      filename: 'test.ogg', duration: 120, label: 'Meeting', timestamp: '2026-07-08 12:00:00',
    });
  });

  it('saveRecording defaults label and timestamp to null', async () => {
    vi.mocked(invoke).mockResolvedValue(2);
    expect(await saveRecording('test2.ogg', 60)).toBe(2);
    expect(invoke).toHaveBeenCalledWith('db_save_recording', {
      filename: 'test2.ogg', duration: 60, label: null, timestamp: null,
    });
  });

  it('getLibraryRecordings returns the backend list unchanged', async () => {
    const list = [{ id: 1, filename: 'a.ogg', duration: 10, timestamp: 'ts', label: null, hasTranscript: true, tags: ['x'] }];
    vi.mocked(invoke).mockResolvedValue(list);
    expect(await getLibraryRecordings()).toEqual(list);
    expect(invoke).toHaveBeenCalledWith('db_get_library_recordings');
  });

  it('lookups by id pass the id and return null when missing', async () => {
    vi.mocked(invoke).mockResolvedValue(null);
    expect(await getLibraryRecordingById(5)).toBeNull();
    expect(invoke).toHaveBeenCalledWith('db_get_library_recording_by_id', { id: 5 });
    expect(await getRawRecordingById(6)).toBeNull();
    expect(invoke).toHaveBeenCalledWith('db_get_raw_recording_by_id', { id: 6 });
  });

  it('getRecordingsOlderThan30Days invokes its command', async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    expect(await getRecordingsOlderThan30Days()).toEqual([]);
    expect(invoke).toHaveBeenCalledWith('db_get_recordings_older_than_30_days');
  });

  it('mutations pass their arguments', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await deleteRecordingDb(1);
    await updateRecording(2, 'new.ogg', null);
    await updateRecordingTags(3, ['a', 'b']);
    expect(vi.mocked(invoke).mock.calls).toEqual([
      ['db_delete_recording', { id: 1 }],
      ['db_update_recording', { id: 2, filename: 'new.ogg', label: null }],
      ['db_update_recording_tags', { id: 3, tags: ['a', 'b'] }],
    ]);
  });

  it('propagates backend errors', async () => {
    vi.mocked(invoke).mockRejectedValue('Database error: disk I/O error');
    await expect(getLibraryRecordings()).rejects.toBe('Database error: disk I/O error');
  });
});
