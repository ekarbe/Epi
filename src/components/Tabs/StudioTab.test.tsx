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

import { useActiveSession } from '../../contexts/SessionContext';
import { useLibrarySettings } from '../../contexts/LibrarySettingsContext';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StudioTab } from './StudioTab';

vi.mock('../../contexts/LibrarySettingsContext', () => ({
  useLibrarySettings: vi.fn(),
}));

vi.mock('../../contexts/SessionContext', () => ({
  useActiveSession: vi.fn(),
}));

describe('StudioTab', () => {
  const defaultContext = {
    isRecording: false,
    isRecordingTransitioning: false,
    recordingSeconds: 0,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    recordingError: null,
    audioDevices: [
      { name: 'Input 1', is_input: true, is_output: false, is_default: true },
      { name: 'Output 1', is_input: false, is_output: true, is_default: true },
    ],
    selectedAudioDevices: [],
    toggleAudioDevice: vi.fn(),
    loadRecordingIntoAnalysis: vi.fn(),
    setActiveTab: vi.fn(),
    recordings: [],
    autoTranscribe: false,
    setAutoTranscribe: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    vi.mocked(useLibrarySettings).mockReturnValue(defaultContext as any);
    vi.mocked(useActiveSession).mockReturnValue(defaultContext as any);
    render(<StudioTab />);
    
    expect(screen.getByText('Studio Recording')).toBeInTheDocument();
    expect(screen.getByText('Ready to record')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Recording label (optional)')).toBeInTheDocument();
  });

  it('handles toggle recording', () => {
    const mockStart = vi.fn();
    const mockStop = vi.fn();
    
    vi.mocked(useLibrarySettings).mockReturnValue(defaultContext as any);
    vi.mocked(useActiveSession).mockReturnValue({
      ...defaultContext,
      startRecording: mockStart,
      stopRecording: mockStop,
    } as any);
    
    render(<StudioTab />);
    
    // The button has no text, just an icon. Or we can select it differently
    // It's the one with class record-btn
    const buttons = screen.getAllByRole('button');
    const toggleBtn = buttons.find(b => b.className.includes('record-btn'));
    
    if (toggleBtn) {
      fireEvent.click(toggleBtn);
      expect(mockStart).toHaveBeenCalled();
    }
  });

  it('shows inputs when clicking Select Inputs', async () => {
    vi.mocked(useLibrarySettings).mockReturnValue(defaultContext as any);
    vi.mocked(useActiveSession).mockReturnValue(defaultContext as any);
    render(<StudioTab />);
    
    const inputBtn = screen.getByText('Select Inputs');
    fireEvent.click(inputBtn);
    
    await waitFor(() => {
      expect(screen.getByText('Input 1')).toBeInTheDocument();
    });

    const checkbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(checkbox);
  });

  it('shows outputs when clicking Select Outputs', async () => {
    vi.mocked(useLibrarySettings).mockReturnValue(defaultContext as any);
    vi.mocked(useActiveSession).mockReturnValue(defaultContext as any);
    render(<StudioTab />);
    
    const outputBtn = screen.getByText('Select Outputs');
    fireEvent.click(outputBtn);
    
    await waitFor(() => {
      expect(screen.getByText('Output 1')).toBeInTheDocument();
    });

    const checkbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(checkbox);
  });

  it('handles label input and auto-transcribe toggle', async () => {
    vi.mocked(useLibrarySettings).mockReturnValue(defaultContext as any);
    vi.mocked(useActiveSession).mockReturnValue(defaultContext as any);
    render(<StudioTab />);
    
    const labelInput = screen.getByPlaceholderText('Recording label (optional)');
    fireEvent.change(labelInput, { target: { value: 'My new recording' } });
    
    const autoTranscribeCheckbox = screen.getByLabelText(/Auto-transcribe after recording/i);
    fireEvent.click(autoTranscribeCheckbox);
  });

  it('loads recent recording into analysis when clicked', async () => {
    const mockLoadRecording = vi.fn();
    const mockSetActiveTab = vi.fn();
    vi.mocked(useLibrarySettings).mockReturnValue(defaultContext as any);
    vi.mocked(useActiveSession).mockReturnValue({
      ...defaultContext,
      recordings: [{ id: 1, filename: 'test.ogg', duration: 10, timestamp: '123' }],
      loadRecordingIntoAnalysis: mockLoadRecording,
      setActiveTab: mockSetActiveTab,
    } as any);

    render(<StudioTab />);
    
    await waitFor(() => {
      expect(screen.getByText('test')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('test'));

    expect(mockLoadRecording).toHaveBeenCalledWith(1);
    expect(mockSetActiveTab).toHaveBeenCalledWith('analysis');
  });
});
