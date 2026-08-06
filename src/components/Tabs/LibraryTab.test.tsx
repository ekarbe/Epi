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
import { LibraryTab } from './LibraryTab';
import { useLibrarySettings } from '../../contexts/LibrarySettingsContext';
import * as db from '../../services/db';
import { invoke } from '../../lib/api';

vi.mock('../../contexts/LibrarySettingsContext', () => ({
  useLibrarySettings: vi.fn(),
}));

vi.mock('../../contexts/SessionContext', () => ({
  useActiveSession: vi.fn(),
}));

vi.mock('../../services/db', () => ({
  updateRecording: vi.fn(),
  deleteRecordingDb: vi.fn(),
  deleteTranscriptAndSummaryDb: vi.fn(),
  updateRecordingTags: vi.fn(),
  getTags: vi.fn().mockResolvedValue([]),
  ensureTagExists: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/api', () => ({
  invoke: vi.fn(),
}));

describe('LibraryTab', () => {
  const defaultContext = {
    recordings: [],
    refreshLibrary: vi.fn().mockResolvedValue(undefined),
    loadRecordingIntoAnalysis: vi.fn(),
    triggerTranscription: vi.fn().mockResolvedValue(undefined),
    setActiveTab: vi.fn(),
    activeRecordingId: null,
    transcribingIds: [],
    summarizingRecIds: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly when loading', async () => {
    vi.mocked(useLibrarySettings).mockReturnValue(defaultContext as any);
    
    render(<LibraryTab />);
    
    expect(screen.getByText('Recording Library')).toBeInTheDocument();
    // Wait for the refresh promise to settle
    await waitFor(() => {
      expect(screen.getByText('No recordings found. Go to the Studio tab to create one!')).toBeInTheDocument();
    });
  });

  it('renders recordings', async () => {
    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      recordings: [
        { id: 1, filename: 'test1.ogg', label: null, duration: 10, timestamp: '123', tags: [], hasAudio: true, hasTranscript: false },
        { id: 2, filename: 'test2.ogg', label: null, duration: 20, timestamp: '456', tags: [], hasAudio: true, hasTranscript: true },
      ],
    } as any);
    
    render(<LibraryTab />);
    
    await waitFor(() => {
      expect(screen.getByText('test1')).toBeInTheDocument();
      expect(screen.getByText('test2')).toBeInTheDocument();
    });
  });

  it('filters recordings by search', async () => {
    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      recordings: [
        { id: 1, filename: 'test1.ogg', label: null, duration: 10, timestamp: '123', tags: [], hasAudio: true, hasTranscript: false },
        { id: 2, filename: 'other.ogg', label: null, duration: 20, timestamp: '456', tags: [], hasAudio: true, hasTranscript: true },
      ],
    } as any);
    
    render(<LibraryTab />);
    
    await waitFor(() => {
      expect(screen.getByText('test1')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: 'other' } });

    await waitFor(() => {
      expect(screen.getByText('other')).toBeInTheDocument();
      expect(screen.queryByText('test1')).not.toBeInTheDocument();
    });
  });

  it('handles analyze button click', async () => {
    const mockLoad = vi.fn();
    const mockSetTab = vi.fn();

    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      loadRecordingIntoAnalysis: mockLoad,
      setActiveTab: mockSetTab,
      recordings: [
        { id: 1, filename: 'test1.ogg', label: null, duration: 10, timestamp: '123', tags: [], hasAudio: true, hasTranscript: false },
      ],
    } as any);
    
    render(<LibraryTab />);
    
    await waitFor(() => {
      expect(screen.getByText('test1')).toBeInTheDocument();
    });

    const analyzeBtn = screen.getByText('Analyze');
    fireEvent.click(analyzeBtn);

    expect(mockLoad).toHaveBeenCalledWith(1);
    await waitFor(() => {
      expect(mockSetTab).toHaveBeenCalledWith('analysis');
    });
  });

  it('handles deletion', async () => {
    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      recordings: [
        { id: 1, filename: 'test1.ogg', label: null, duration: 10, timestamp: '123', tags: [], hasAudio: true, hasTranscript: false },
      ],
    } as any);
    
    render(<LibraryTab />);
    
    await waitFor(() => {
      expect(screen.getByText('test1')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTestId('delete-btn-1');
    fireEvent.click(deleteBtn);
    
    await waitFor(() => {
      expect(screen.getByText('Delete Everything')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByText('Delete Everything');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(db.deleteRecordingDb).toHaveBeenCalledWith(1);
    });
  });

  it('handles renaming', async () => {
    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      recordings: [
        { id: 1, filename: 'test1.ogg', label: null, duration: 10, timestamp: '123', tags: [], hasAudio: true, hasTranscript: false },
      ],
    } as any);
    
    render(<LibraryTab />);
    
    await waitFor(() => {
      expect(screen.getByText('test1')).toBeInTheDocument();
    });

    const editBtn = screen.getByTestId('edit-btn-1');
    fireEvent.click(editBtn);

    const input = screen.getByDisplayValue('test1');
    fireEvent.change(input, { target: { value: 'new_name' } });
    
    const saveBtn = screen.getByTestId('save-rename-btn');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(db.updateRecording).toHaveBeenCalledWith(1, 'new_name.ogg', null);
    });
  });

  it('handles granular deletion (audio only)', async () => {
    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      recordings: [
        { id: 1, filename: 'test1.ogg', label: null, duration: 10, timestamp: '123', tags: [], hasAudio: true, hasTranscript: true },
      ],
    } as any);
    
    render(<LibraryTab />);
    
    await waitFor(() => {
      expect(screen.getByText('test1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-btn-1'));
    
    await waitFor(() => {
      expect(screen.getByText('Delete Audio File Only')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete Audio File Only'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('delete_audio_file', { filename: 'test1.ogg' });
    });
  });

  it('handles granular deletion (transcript only)', async () => {
    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      recordings: [
        { id: 1, filename: 'test1.ogg', label: null, duration: 10, timestamp: '123', tags: [], hasAudio: true, hasTranscript: true },
      ],
    } as any);
    
    render(<LibraryTab />);
    
    await waitFor(() => {
      expect(screen.getByText('test1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-btn-1'));
    
    await waitFor(() => {
      expect(screen.getByText('Delete Transcript & Summary')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete Transcript & Summary'));

    await waitFor(() => {
      expect(db.deleteTranscriptAndSummaryDb).toHaveBeenCalledWith(1);
    });
  });

  it('handles adding and removing tags', async () => {
    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      recordings: [
        { id: 1, filename: 'test1.ogg', label: null, duration: 10, timestamp: '123', tags: ['existing_tag'], hasAudio: true, hasTranscript: false },
      ],
    } as any);
    
    render(<LibraryTab />);
    
    await waitFor(() => {
      expect(screen.getByText('existing_tag')).toBeInTheDocument();
    });

    // Add tag
    const tagInput = screen.getByPlaceholderText('+ tag');
    fireEvent.change(tagInput, { target: { value: 'new_tag' } });
    fireEvent.keyDown(tagInput, { key: 'Enter', code: 'Enter', charCode: 13 });

    await waitFor(() => {
      expect(db.updateRecordingTags).toHaveBeenCalledWith(1, ['existing_tag', 'new_tag']);
    });
  });

  it('handles pagination (Show More)', async () => {
    // Generate 10 recordings
    const recordings = Array.from({ length: 10 }).map((_, i) => ({
      id: i + 1, filename: `rec${i}.ogg`, label: null, duration: 10, timestamp: '123', tags: [], hasAudio: true, hasTranscript: false
    }));

    vi.mocked(useLibrarySettings).mockReturnValue({
      ...defaultContext,
      recordings,
    } as any);
    
    render(<LibraryTab />);
    
    // Initially only 5 should be visible
    await waitFor(() => {
      expect(screen.getByText('rec0')).toBeInTheDocument();
      expect(screen.queryByText('rec9')).not.toBeInTheDocument();
    });

    // Click Show More
    const showMoreBtn = screen.getByText('Show More');
    fireEvent.click(showMoreBtn);

    await waitFor(() => {
      expect(screen.getByText('rec9')).toBeInTheDocument();
    });
  });
});
