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
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AppProviders } from './AppProviders';
import { useActiveSession } from './SessionContext';
import { useLibrarySettings } from './LibrarySettingsContext';
import * as db from '../services/db';

vi.mock('../services/db', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    saveRecording: vi.fn().mockResolvedValue(123),
  };
});

vi.mock('./LibrarySettingsContext', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    useLibrarySettings: vi.fn(),
    LibrarySettingsProvider: ({ children }: any) => <div>{children}</div>,
  };
});

vi.mock('../lib/api', () => ({
  invoke: vi.fn().mockImplementation(async (cmd) => {
    if (cmd === 'stop_recording') return ['/fake/path.ogg'];
    if (cmd === 'get_audio_devices') return [];
    if (cmd === 'get_whisperx_status') return { installed: true, binary_path: '/fake/path' };
    if (cmd === 'get_ffmpeg_status') return { installed: true };
    return undefined;
  }),
  listen: vi.fn().mockResolvedValue(vi.fn()),
  documentDir: vi.fn().mockResolvedValue('/fake/docs'),
  join: vi.fn().mockResolvedValue('/fake/joined/path'),
  exists: vi.fn().mockResolvedValue(false),
  BaseDirectory: { Document: 1 },
}));

function TestComponent() {
  const { startRecording, stopRecording, isRecording } = useActiveSession();
  const settings = useLibrarySettings();

  return (
    <div>
      <button onClick={() => startRecording('test-label')}>Start Recording</button>
      <button onClick={() => stopRecording()}>Stop Recording</button>
      <span data-testid="settings-ok">{settings ? 'yes' : 'no'}</span>
      <span data-testid="is-recording">{isRecording ? 'recording' : 'idle'}</span>
    </div>
  );
}

describe('AppProviders', () => {
  it('handles recording stopped callback and triggers transcription', async () => {
    const handleTranscriptionMock = vi.fn().mockResolvedValue(undefined);
    const loadRecordingMock = vi.fn().mockResolvedValue(undefined);
    const refreshLibraryMock = vi.fn();

    vi.mocked(useLibrarySettings).mockReturnValue({
      refreshLibrary: refreshLibraryMock,
      autoTranscribe: true,
      handleTranscription: handleTranscriptionMock,
      loadRecordingIntoAnalysis: loadRecordingMock,
      namingSchema: 'Recording {counter}',
      recordings: [],
    } as any);



    render(
      <AppProviders>
        <TestComponent />
      </AppProviders>
    );

    await act(async () => {
      screen.getByText('Start Recording').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-recording').textContent).toBe('recording');
    });

    await act(async () => {
      screen.getByText('Stop Recording').click();
    });

    await waitFor(() => {
      expect(db.saveRecording).toHaveBeenCalledWith('path.ogg', expect.any(Number), expect.any(String));
      expect(refreshLibraryMock).toHaveBeenCalled();
      expect(loadRecordingMock).toHaveBeenCalledWith(123);
      expect(handleTranscriptionMock).toHaveBeenCalledWith('/fake/path.ogg', 123);
    });
  });
  
  it('warns when handleTranscription is not exposed', async () => {
    const loadRecordingMock = vi.fn().mockResolvedValue(undefined);
    const refreshLibraryMock = vi.fn();
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(useLibrarySettings).mockReturnValue({
      refreshLibrary: refreshLibraryMock,
      autoTranscribe: true,
      handleTranscription: undefined,
      loadRecordingIntoAnalysis: loadRecordingMock,
      namingSchema: 'Recording {counter}',
      recordings: [],
    } as any);

    render(
      <AppProviders>
        <TestComponent />
      </AppProviders>
    );

    await act(async () => {
      screen.getByText('Start Recording').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-recording').textContent).toBe('recording');
    });

    await act(async () => {
      screen.getByText('Stop Recording').click();
    });

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith("handleTranscription is not exposed by LibrarySettingsContext");
    });
    
    consoleWarnSpy.mockRestore();
  });
});
