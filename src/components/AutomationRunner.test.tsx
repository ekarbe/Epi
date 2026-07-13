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

import { useLibrarySettings } from '../contexts/LibrarySettingsContext';
import { render, waitFor } from '@testing-library/react';
import { AutomationRunner } from './AutomationRunner';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAutomations } from '../services/db/automations';
import { getLibraryRecordings, getTranscriptForRecording, saveTranscript, saveSummary, getSummaryForTranscript } from '../services/db';
import { transcribeAudio } from '../services/whisper';
import { summarizeTranscript } from '../services/ollama';

vi.mock('../contexts/LibrarySettingsContext', () => ({
  useLibrarySettings: vi.fn(),
}));

vi.mock('../contexts/SessionContext', () => ({
  useActiveSession: vi.fn(),
}));

vi.mock('../services/db/automations', () => ({
  getAutomations: vi.fn(),
}));

vi.mock('../services/db', () => ({
  getLibraryRecordings: vi.fn(),
  getTranscriptForRecording: vi.fn(),
  saveTranscript: vi.fn(),
  getSummaryForTranscript: vi.fn(),
  saveSummary: vi.fn(),
}));

vi.mock('../services/whisper', () => ({
  transcribeAudio: vi.fn(),
}));

vi.mock('../services/ollama', () => ({
  summarizeTranscript: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  documentDir: vi.fn().mockResolvedValue('/docs'),
  join: vi.fn().mockImplementation(async (...args) => args.join('/')),
  BaseDirectory: { Document: 1 },
  writeTextFile: vi.fn().mockResolvedValue(undefined),
}));

describe('AutomationRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing if db is not ready', () => {
    vi.mocked(useLibrarySettings).mockReturnValue({ dbReady: false } as any);
    render(<AutomationRunner />);
    expect(getAutomations).not.toHaveBeenCalled();
  });

  it('fetches automations and triggers matching rules', async () => {
    const mockContext = {
      dbReady: true,
      whisperXModel: 'base',
      transcriptionProvider: 'local',
      apiKeys: {},
      addTranscribingId: vi.fn(),
      removeTranscribingId: vi.fn(),
      addSummarizingRecId: vi.fn(),
      removeSummarizingRecId: vi.fn(),
      refreshLibrary: vi.fn(),
      ollamaModel: 'llama2',
      llmProvider: 'local',
    };
    vi.mocked(useLibrarySettings).mockReturnValue(mockContext as any);

    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    vi.mocked(getAutomations).mockResolvedValue([
      { id: 1, name: 'Test Rule', triggerTime: currentHHMM, timerangeHours: 24, action: 'transcribe' }
    ]);

    // Mock a recording within the last 24h
    vi.mocked(getLibraryRecordings).mockResolvedValue([
      { id: 1, filename: 'rec.ogg', timestamp: now.toISOString().replace('T', ' ').substring(0, 19), hasTranscript: false, duration: 0, label: '', tags: [] }
    ]);

    vi.mocked(transcribeAudio).mockResolvedValue('Transcribed text');

    render(<AutomationRunner />);

    await waitFor(() => {
      expect(getLibraryRecordings).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(transcribeAudio).toHaveBeenCalled();
      expect(saveTranscript).toHaveBeenCalledWith(1, 'Transcribed text');
    });
  });

  it('runs summarize action', async () => {
    const mockContext = {
      dbReady: true,
      whisperXModel: 'base',
      transcriptionProvider: 'local',
      apiKeys: {},
      addTranscribingId: vi.fn(),
      removeTranscribingId: vi.fn(),
      addSummarizingRecId: vi.fn(),
      removeSummarizingRecId: vi.fn(),
      refreshLibrary: vi.fn(),
      ollamaModel: 'llama2',
      llmProvider: 'local',
    };
    vi.mocked(useLibrarySettings).mockReturnValue(mockContext as any);

    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    vi.mocked(getAutomations).mockResolvedValue([
      { id: 1, name: 'Test Rule Sum', triggerTime: currentHHMM, timerangeHours: 24, action: 'summarize' }
    ]);

    vi.mocked(getLibraryRecordings).mockResolvedValue([
      { id: 1, filename: 'rec.ogg', timestamp: now.toISOString().replace('T', ' ').substring(0, 19), hasTranscript: true, duration: 0, label: '', tags: [] }
    ]);

    vi.mocked(getTranscriptForRecording).mockResolvedValue({
      id: 10,
      recordingId: 1,
      textContent: 'Long text',
      diarizedJson: ''
    });

    vi.mocked(getSummaryForTranscript).mockResolvedValue(null);
    vi.mocked(summarizeTranscript).mockResolvedValue('Summary text');

    render(<AutomationRunner />);

    await waitFor(() => {
      expect(summarizeTranscript).toHaveBeenCalled();
      expect(saveSummary).toHaveBeenCalledWith(10, 'Summary text');
    });
  });
});
