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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnalysisTab } from './AnalysisTab';
import { useLibrarySettings } from '../../contexts/LibrarySettingsContext';
import * as db from '../../services/db';
import * as api from '../../lib/api';

vi.mock('../../contexts/LibrarySettingsContext', () => ({
  useLibrarySettings: vi.fn(),
  getTranscriptionProviderName: vi.fn(() => 'Test Provider'),
  getLlmProviderName: vi.fn(() => 'Test LLM Provider'),
}));

vi.mock('../../contexts/SessionContext', () => ({
  useActiveSession: vi.fn(),
}));

vi.mock('../../services/db', () => ({
  getPrompts: vi.fn(),
  getRawRecordingById: vi.fn(),
  updateRecordingTags: vi.fn(),
  getTranscriptForRecording: vi.fn(),
  getSummaryForTranscript: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  documentDir: vi.fn(),
  join: vi.fn(),
  readFile: vi.fn(),
  exists: vi.fn(),
  stat: vi.fn(),
  convertFileSrc: vi.fn(),
  platform: vi.fn(),
  invoke: vi.fn(),
}));

describe('AnalysisTab', () => {
  const defaultContext = {
    activeTranscript: '',
    diarized: false,
    generateSummary: vi.fn(),
    activeSummary: '',
    isSummarizing: false,
    summaryError: null,
    isTranscribing: false,
    transcriptionError: null,
    activeRecordingId: null,
    triggerTranscription: vi.fn(),
    transcriptionProvider: 'local',
    llmProvider: 'local',
    updateActiveTranscript: vi.fn(),
    updateActiveSummary: vi.fn(),
    recordings: [],
    refreshLibrary: vi.fn(),
    intelligenceContextDepth: 0,
    intelligenceContextFormat: 'transcripts',
    intelligenceContextAutoGenerate: false,
    activeRecordingDuration: 10,
    playbackPosition: 0,
    setPlaybackPosition: vi.fn(),
    isAudioPlaying: false,
    setIsAudioPlaying: vi.fn(),
    whisperXInstalled: true,
    installingWhisperX: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getPrompts).mockResolvedValue([]);
    vi.mocked(db.getRawRecordingById).mockResolvedValue(null);
    vi.mocked(api.documentDir).mockResolvedValue('/docs');
    vi.mocked(api.join).mockImplementation(async (...args) => args.join('/'));
    vi.mocked(api.exists).mockResolvedValue(true);
    vi.mocked(api.stat).mockResolvedValue({ size: 100 } as any);
    vi.mocked(api.readFile).mockResolvedValue(new Uint8Array([0, 1, 2]));
    vi.mocked(api.platform).mockReturnValue('linux');
    vi.mocked(api.convertFileSrc).mockImplementation((p) => p);
    vi.mocked(api.invoke).mockResolvedValue(null);
    
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:url');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('renders correctly with no active recording', async () => {
    vi.mocked(useLibrarySettings).mockReturnValue(defaultContext as any);
    
    render(<AnalysisTab />);
    
    await waitFor(() => {
      expect(screen.getByText('Transcription')).toBeInTheDocument();
    });
    expect(screen.getByText('Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Generated Summary')).toBeInTheDocument();
  });

  it('renders with active recording and transcribing status', async () => {
    vi.mocked(db.getRawRecordingById).mockResolvedValue({ id: 1, filename: 'test.ogg' } as any);
    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      activeRecordingId: 1,
      recordings: [{ id: 1, filename: 'test.ogg', duration: 10, timestamp: '123', tags: [] }],
      isTranscribing: true,
    } as any);
    
    render(<AnalysisTab />);
    
    await waitFor(() => {
      expect(screen.getByText('test')).toBeInTheDocument();
      expect(screen.getByText(/Transcribing with Test Provider.../)).toBeInTheDocument();
    });
  });

  it('renders transcript and allows edit toggle', async () => {
    vi.mocked(db.getRawRecordingById).mockResolvedValue({ id: 1, filename: 'test.ogg' } as any);
    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      activeRecordingId: 1,
      recordings: [{ id: 1, filename: 'test.ogg', duration: 10, timestamp: '123', tags: [] }],
      activeTranscript: '[SPEAKER_00] Hello world',
    } as any);
    
    render(<AnalysisTab />);
    
    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });
    
    const editBtn = screen.getByText('Edit');
    fireEvent.click(editBtn);
    
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
  });

  it('renders summary', async () => {
    vi.mocked(db.getRawRecordingById).mockResolvedValue({ id: 1, filename: 'test.ogg' } as any);
    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      activeRecordingId: 1,
      recordings: [{ id: 1, filename: 'test.ogg', duration: 10, timestamp: '123', tags: [] }],
      activeTranscript: 'Transcript',
      activeSummary: 'This is a summary',
    } as any);
    
    render(<AnalysisTab />);
    
    await waitFor(() => {
      expect(screen.getByText('This is a summary')).toBeInTheDocument();
    });
  });
  
  it('handles trigger transcription', async () => {
    const mockTrigger = vi.fn();
    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      activeRecordingId: 1,
      recordings: [{ id: 1, filename: 'test.ogg', duration: 10, timestamp: '123', tags: [] }],
      triggerTranscription: mockTrigger,
      activeTranscript: 'Existing text',
    } as any);
    
    vi.mocked(db.getRawRecordingById).mockResolvedValue({ id: 1, groupId: 1, filename: 'test.ogg', duration: 10, label: null, timestamp: '123' });
    
    render(<AnalysisTab />);
    
    await waitFor(() => {
      const transcribeBtn = screen.getByText('Re-transcribe');
      fireEvent.click(transcribeBtn);
    });
    
    await waitFor(() => {
      expect(mockTrigger).toHaveBeenCalledWith(1, 'test.ogg');
    });
  });

  it('handles tag input', async () => {
    vi.mocked(db.getRawRecordingById).mockResolvedValue({ id: 1, filename: 'test.ogg' } as any);
    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      activeRecordingId: 1,
      recordings: [{ id: 1, filename: 'test.ogg', duration: 10, timestamp: '123', tags: ['old_tag'] }],
      activeTranscript: 'transcript',
    } as any);

    render(<AnalysisTab />);
    
    await waitFor(() => {
      expect(screen.getByText('old_tag')).toBeInTheDocument();
    });

    const addTagInput = screen.getByPlaceholderText('+ Add Tag');
    fireEvent.change(addTagInput, { target: { value: 'new_tag' } });
    fireEvent.keyDown(addTagInput, { key: 'Enter', code: 'Enter', charCode: 13 });

    await waitFor(() => {
      expect(db.updateRecordingTags).toHaveBeenCalledWith(1, ['old_tag', 'new_tag']);
    });
  });

  it('handles generate summary button click', async () => {
    const mockGenerateSummary = vi.fn();
    vi.mocked(db.getRawRecordingById).mockResolvedValue({ id: 1, filename: 'test.ogg' } as any);
    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      activeRecordingId: 1,
      recordings: [{ id: 1, filename: 'test.ogg', duration: 10, timestamp: '123', tags: ['old_tag'] }],
      activeTranscript: 'transcript',
      generateSummary: mockGenerateSummary,
    } as any);

    render(<AnalysisTab />);
    
    await waitFor(() => {
      expect(screen.getByText('Generate Summary')).toBeInTheDocument();
    });

    const genBtn = screen.getByText('Generate Summary');
    fireEvent.click(genBtn);

    expect(mockGenerateSummary).toHaveBeenCalled();
  });

  it('handles missing audio file correctly', async () => {
    vi.mocked(api.exists).mockResolvedValue(false);
    vi.mocked(db.getRawRecordingById).mockResolvedValue({ id: 1, filename: 'test.ogg' } as any);
    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      activeRecordingId: 1,
      recordings: [{ id: 1, filename: 'test.ogg', duration: 10, timestamp: '123', tags: [] }],
    } as any);

    render(<AnalysisTab />);
    
    await waitFor(() => {
      expect(screen.getByText(/Audio source file not found:/)).toBeInTheDocument();
    });
  });

  it('handles too large audio file on Linux correctly', async () => {
    vi.mocked(api.stat).mockResolvedValue({ size: 60 * 1024 * 1024 } as any);
    vi.mocked(db.getRawRecordingById).mockResolvedValue({ id: 1, filename: 'test.ogg' } as any);
    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      activeRecordingId: 1,
      recordings: [{ id: 1, filename: 'test.ogg', duration: 10, timestamp: '123', tags: [] }],
    } as any);

    render(<AnalysisTab />);
    
    await waitFor(() => {
      expect(screen.getByText(/Audio playback disabled:/)).toBeInTheDocument();
    });
  });

  it('renders __RAW_ERROR__ block correctly', async () => {
    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      activeRecordingId: 1,
      recordings: [{ id: 1, filename: 'test.ogg', duration: 10, timestamp: '123', tags: [] }],
      transcriptionError: 'Friendly Message __RAW_ERROR__ Traceback: something went wrong',
    } as any);

    render(<AnalysisTab />);

    await waitFor(() => {
      expect(screen.getByText('Friendly Message')).toBeInTheDocument();
      expect(screen.getByText('View Raw Error')).toBeInTheDocument();
      expect(screen.getByText('Traceback: something went wrong')).toBeInTheDocument();
    });
  });

  it('handles editing and saving transcript', async () => {
    const mockUpdate = vi.fn();
    vi.mocked(db.getRawRecordingById).mockResolvedValue({ id: 1, filename: 'test.ogg' } as any);
    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      activeRecordingId: 1,
      recordings: [{ id: 1, filename: 'test.ogg', duration: 10, timestamp: '123', tags: [] }],
      activeTranscript: '[SPEAKER_00] Hello world',
      updateActiveTranscript: mockUpdate,
    } as any);

    render(<AnalysisTab />);

    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    const editBtns = screen.getAllByText('Edit');
    fireEvent.click(editBtns[0]); // Transcript edit
    
    const textarea = screen.getByDisplayValue('[SPEAKER_00] Hello world');
    fireEvent.change(textarea, { target: { value: '[SPEAKER_00] New world' } });
    
    fireEvent.click(screen.getByText('Save Changes'));

    expect(mockUpdate).toHaveBeenCalledWith('[SPEAKER_00] New world');
  });

  it('handles summary editing and deleting', async () => {
    const mockUpdateSummary = vi.fn();
    vi.mocked(db.getRawRecordingById).mockResolvedValue({ id: 1, filename: 'test.ogg' } as any);
    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      activeRecordingId: 1,
      recordings: [{ id: 1, filename: 'test.ogg', duration: 10, timestamp: '123', tags: [] }],
      activeTranscript: 'T',
      activeSummary: 'Old summary',
      updateActiveSummary: mockUpdateSummary,
    } as any);

    render(<AnalysisTab />);

    await waitFor(() => {
      expect(screen.getByText('Old summary')).toBeInTheDocument();
    });

    const editBtns = screen.getAllByText('Edit');
    fireEvent.click(editBtns[editBtns.length - 1]); // Summary edit
    
    const textarea = screen.getByDisplayValue('Old summary');
    fireEvent.change(textarea, { target: { value: 'New summary' } });
    
    fireEvent.click(screen.getByText('Save Summary'));
    expect(mockUpdateSummary).toHaveBeenCalledWith('New summary');
  });
});

