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

import { render, screen, fireEvent } from '@testing-library/react';
import { LanguagePromptModal } from './LanguagePromptModal';
import { describe, it, expect, vi } from 'vitest';
import { useLibrarySettings } from '../contexts/LibrarySettingsContext';

vi.mock('../contexts/LibrarySettingsContext', () => ({
  useLibrarySettings: vi.fn(),
}));

vi.mock('../contexts/SessionContext', () => ({
  useActiveSession: vi.fn(),
}));

describe('LanguagePromptModal', () => {
  it('renders nothing when there is no prompt', () => {
    vi.mocked(useLibrarySettings).mockReturnValue({
      pendingLanguagePrompt: null,
      handleRetryTranscription: vi.fn(),
      handleCancelLanguagePrompt: vi.fn(),
    } as any);

    const { container } = render(<LanguagePromptModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal when prompt exists', () => {
    vi.mocked(useLibrarySettings).mockReturnValue({
      pendingLanguagePrompt: {
        recordingId: 1,
        filePath: '/some/path/test.ogg',
        detectedLanguage: 'cy'
      },
      handleRetryTranscription: vi.fn(),
      handleCancelLanguagePrompt: vi.fn(),
    } as any);

    render(<LanguagePromptModal />);
    expect(screen.getByText('WhisperX Alignment Missing')).toBeInTheDocument();
    expect(screen.getByText('test.ogg')).toBeInTheDocument();
    expect(screen.getByText('cy')).toBeInTheDocument();
  });

  it('handles retry with selected language and no_align', () => {
    const handleRetry = vi.fn();
    vi.mocked(useLibrarySettings).mockReturnValue({
      pendingLanguagePrompt: {
        recordingId: 1,
        filePath: '/test.ogg',
        detectedLanguage: 'cy'
      },
      handleRetryTranscription: handleRetry,
      handleCancelLanguagePrompt: vi.fn(),
    } as any);

    render(<LanguagePromptModal />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'de' } });

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    fireEvent.click(screen.getByText('Retry Transcription'));
    expect(handleRetry).toHaveBeenCalledWith(1, '/test.ogg', 'de', true);
  });

  it('handles custom language input', () => {
    const handleRetry = vi.fn();
    // mock alert
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    vi.mocked(useLibrarySettings).mockReturnValue({
      pendingLanguagePrompt: {
        recordingId: 1,
        filePath: '/test.ogg',
        detectedLanguage: 'cy'
      },
      handleRetryTranscription: handleRetry,
      handleCancelLanguagePrompt: vi.fn(),
    } as any);

    render(<LanguagePromptModal />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'other' } });

    // Try without value
    fireEvent.click(screen.getByText('Retry Transcription'));
    expect(alertMock).toHaveBeenCalledWith('Please enter a custom language code.');
    expect(handleRetry).not.toHaveBeenCalled();

    // Enter value
    const input = screen.getByPlaceholderText('e.g. cy, nl, uk');
    fireEvent.change(input, { target: { value: 'nl' } });

    fireEvent.click(screen.getByText('Retry Transcription'));
    expect(handleRetry).toHaveBeenCalledWith(1, '/test.ogg', 'nl', false);

    alertMock.mockRestore();
  });

  it('handles cancel', () => {
    const handleCancel = vi.fn();
    vi.mocked(useLibrarySettings).mockReturnValue({
      pendingLanguagePrompt: {
        recordingId: 1,
        filePath: '/test.ogg',
        detectedLanguage: 'cy'
      },
      handleRetryTranscription: vi.fn(),
      handleCancelLanguagePrompt: handleCancel,
    } as any);

    render(<LanguagePromptModal />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(handleCancel).toHaveBeenCalled();
  });
});
