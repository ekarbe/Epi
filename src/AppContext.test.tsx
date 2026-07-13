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

import { useActiveSession } from './contexts/SessionContext';
import { useLibrarySettings } from './contexts/LibrarySettingsContext';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AppProviders } from './contexts/AppProviders';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from './services/db';
import { invoke } from './lib/api';

vi.mock('./services/db', async () => ({
  initDb: vi.fn().mockResolvedValue(true),
  getLibraryRecordings: vi.fn().mockResolvedValue([{ id: 1, filename: 'test.ogg' }]),
  deleteRecordingDb: vi.fn(),
  getRecordingById: vi.fn().mockResolvedValue({ id: 1, filename: 'test.ogg', group_id: null }),
  getTranscriptForRecording: vi.fn().mockResolvedValue({ id: 1, text: 'hello' }),
  getTranscriptByRecordingId: vi.fn().mockResolvedValue({ id: 1, text: 'hello' }),
  getEpiryByRecordingId: vi.fn().mockResolvedValue(null),
  getPrompts: vi.fn().mockResolvedValue([]),
  saveEpiry: vi.fn(),
  deleteTranscriptDb: vi.fn(),
  ensureDefaultPrompts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./services/whisper', () => ({
  transcribeAudio: vi.fn().mockResolvedValue(true),
}));

vi.mock('./services/ollama', () => ({
  summarizeTranscript: vi.fn().mockResolvedValue('epiry text'),
}));

vi.mock('./lib/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    invoke: vi.fn(async (cmd: string, args?: any) => {
      if (cmd === 'get_audio_devices') {
        return [{ name: "Mock Mic", is_input: true, is_output: false, is_default: true }];
      }
      if (cmd === 'check_whisperx_status') {
        return { installed: true, binary_path: '/mock/path' };
      }
      if (cmd === 'check_ffmpeg_installation') {
        return 'installed';
      }
      if (cmd === 'set_tray_recording_state') {
        return null;
      }
      if (cmd === 'stop_recording') {
        return ['/path/to/test.ogg'];
      }
      if (cmd === 'start_recording') {
        // Allow the test to simulate an IPC failure if the label is 'fail_ipc'
        if (args?.outputPath?.includes('fail_ipc')) {
          throw new Error('Microphone denied');
        }
        return 'started';
      }
      if (cmd === 'delete_file') {
        return true;
      }
      if (cmd === 'rename_file') {
        return '/path/to/new.ogg';
      }
      return (actual as any).invoke(cmd, args);
    })
  };
});

function TestComponent() {
  const __lib = useLibrarySettings();
  const __sess = useActiveSession();
  const ctx = { ...__lib, ...__sess } as any;

  return (
    <div>
      <span data-testid="recording">{ctx.isRecording ? 'recording' : 'idle'}</span>
      <span data-testid="recording-error">{ctx.recordingError || 'none'}</span>
      <button onClick={() => ctx.startRecording('test')}>Start</button>
      <button onClick={() => ctx.startRecording('fail_ipc')}>Fail</button>
      <button onClick={ctx.stopRecording}>Stop</button>
      <span data-testid="devices">{ctx.audioDevices.length}</span>
      <span data-testid="whisper-status">{ctx.whisperXInstalled ? 'installed' : 'not_installed'}</span>
      <button onClick={() => ctx.handleRetryTranscription(1, '/path.ogg', 'en', false)}>Retry Transcription</button>
      <button onClick={() => ctx.loadRecordingIntoAnalysis(1)}>Load Analysis</button>
      <button onClick={() => ctx.generateSummary('prompt')}>Generate Summary</button>
      <button onClick={() => ctx.triggerTranscription(1, 'test.ogg')}>Trigger Transcription</button>
      <button onClick={() => ctx.refreshLibrary()}>Refresh</button>
    </div>
  );
}

describe('AppContext Full', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles full lifecycle', async () => {
    render(
      <AppProviders>
        <TestComponent />
      </AppProviders>
    );

    await waitFor(() => {
        expect(screen.getByTestId('devices').textContent).toBe('1');
    });

    await act(async () => {
      screen.getByText('Start').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('recording').textContent).toBe('recording');
    });

    await act(async () => {
      screen.getByText('Stop').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('recording').textContent).toBe('idle');
    });

    await act(async () => {
      screen.getByText('Retry Transcription').click();
    });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalled();
    });

    await act(async () => {
      screen.getByText('Load Analysis').click();
    });

    await waitFor(() => {
      expect(db.getTranscriptForRecording).toHaveBeenCalled();
    });

    await act(async () => {
      screen.getByText('Generate Summary').click();
    });

    await act(async () => {
      screen.getByText('Trigger Transcription').click();
    });

    await act(async () => {
      screen.getByText('Refresh').click();
    });

    await waitFor(() => {
      expect(db.getLibraryRecordings).toHaveBeenCalled();
    });
  });

  it('handles IPC failure during recording gracefully', async () => {
    render(
      <AppProviders>
        <TestComponent />
      </AppProviders>
    );

    await act(async () => {
      screen.getByText('Fail').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('recording-error').textContent).toBe('Microphone denied');
      expect(screen.getByTestId('recording').textContent).toBe('idle');
    });
  });
});
