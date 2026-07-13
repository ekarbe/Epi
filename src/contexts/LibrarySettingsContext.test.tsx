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

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { 
  getTranscriptionProviderName, 
  getLlmProviderName, 
  LibrarySettingsProvider 
} from './LibrarySettingsContext';

// Mock dependencies
vi.mock('./usePersistentState', () => ({
  getAudioDevices: vi.fn(),
  usePersistentState: (_key: string, def: any) => [def, vi.fn()]
}));

vi.mock('../lib/api', () => ({
  invoke: vi.fn().mockImplementation(async (cmd) => {
    if (cmd === 'get_whisperx_status') return { installed: true, binary_path: '/fake/path' };
    if (cmd === 'get_ffmpeg_status') return { installed: true };
    return undefined;
  }),
  listen: vi.fn().mockResolvedValue(vi.fn()),
  documentDir: vi.fn().mockResolvedValue('/docs'),
  join: vi.fn((...args) => args.join('/')),
  BaseDirectory: { Document: 1 },
  writeTextFile: vi.fn(),
  exists: vi.fn().mockResolvedValue(false),
  readDir: vi.fn().mockResolvedValue([]),
  loadStore: vi.fn().mockResolvedValue({ get: vi.fn().mockResolvedValue(null), set: vi.fn(), save: vi.fn() })
}));

vi.mock('../services/db', () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  saveRecording: vi.fn(),
  saveTranscript: vi.fn(),
  saveSummary: vi.fn(),
  getTranscriptForRecording: vi.fn(),
  getSummaryForTranscript: vi.fn(),
  getRawRecordingById: vi.fn(),
  getLibraryRecordings: vi.fn().mockResolvedValue([]),
  updateTranscript: vi.fn(),
  updateSummary: vi.fn(),
  ensureDefaultPrompts: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../services/whisper', () => ({
  transcribeAudio: vi.fn()
}));

vi.mock('../services/ollama', () => ({
  summarizeTranscript: vi.fn()
}));

describe('LibrarySettingsContext helper functions', () => {
  it('getTranscriptionProviderName', () => {
    expect(getTranscriptionProviderName('local')).toBe('WhisperX');
    expect(getTranscriptionProviderName('openai')).toBe('OpenAI Whisper');
    expect(getTranscriptionProviderName('google')).toBe('Google AI Studio');
    expect(getTranscriptionProviderName('assembly')).toBe('AssemblyAI');
    expect(getTranscriptionProviderName('unknown')).toBe('WhisperX');
  });

  it('getLlmProviderName', () => {
    expect(getLlmProviderName('local')).toBe('Ollama');
    expect(getLlmProviderName('openai')).toBe('OpenAI GPT');
    expect(getLlmProviderName('google')).toBe('Google AI Studio');
    expect(getLlmProviderName('anthropic')).toBe('Anthropic Claude');
    expect(getLlmProviderName('unknown')).toBe('Ollama');
  });
});

import { useLibrarySettings } from './LibrarySettingsContext';
import { act } from '@testing-library/react';

function FullTestComponent() {
  const settings = useLibrarySettings();

  return (
    <div>
      <button onClick={() => settings.refreshLibrary()}>refreshLibrary</button>
      <button onClick={() => settings.updateActiveTranscript('new text')}>updateTranscript</button>
      <button onClick={() => settings.updateActiveSummary('new sum')}>updateSummary</button>
      <button onClick={() => settings.loadRecordingIntoAnalysis(1)}>loadRecording</button>
      <button onClick={() => settings.generateSummary('prompt')}>generateSummary</button>
      <button onClick={() => settings.triggerTranscription(1, 'foo.ogg')}>triggerTranscription</button>
      <button onClick={() => settings.handleRetryTranscription(1, 'foo.ogg', 'en', false)}>handleRetryTranscription</button>
    </div>
  );
}

describe('LibrarySettingsProvider full functions', () => {
  it('allows calling context functions', async () => {
    const { getLibraryRecordings, updateTranscript, updateSummary, getTranscriptForRecording, getSummaryForTranscript, getRawRecordingById } = await import('../services/db');
    vi.mocked(getLibraryRecordings).mockResolvedValue([{
      id: 1, file_path: 'foo.ogg', filename: 'foo.ogg', label: 'test', duration: 10, created_at: '2023'
    }] as any);
    vi.mocked(getTranscriptForRecording).mockResolvedValue({ id: 1, text: 'old', language: 'en', json_data: null, created_at: '' } as any);
    vi.mocked(getSummaryForTranscript).mockResolvedValue({ id: 1, transcript_id: 1, content: 'sum', prompt_template: '', created_at: '' } as any);
    vi.mocked(getRawRecordingById).mockResolvedValue({ id: 1, file_path: 'foo.ogg', filename: 'foo.ogg', label: 'test', duration: 10, created_at: '' } as any);
    
    render(
      <LibrarySettingsProvider>
        <FullTestComponent />
      </LibrarySettingsProvider>
    );

    await act(async () => {
      screen.getByText('refreshLibrary').click();
    });

    await act(async () => {
      screen.getByText('loadRecording').click();
    });
    
    await act(async () => {
      screen.getByText('updateTranscript').click();
    });
    expect(updateTranscript).toHaveBeenCalled();

    await act(async () => {
      screen.getByText('updateSummary').click();
    });
    expect(updateSummary).toHaveBeenCalled();

    await act(async () => {
      screen.getByText('generateSummary').click();
    });

    await act(async () => {
      screen.getByText('triggerTranscription').click();
    });

    await act(async () => {
      screen.getByText('handleRetryTranscription').click();
    });
  });
});
