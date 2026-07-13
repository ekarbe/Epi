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

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AudioRecorderPill } from './AudioRecorderPill';
import { useLibrarySettings } from '../contexts/LibrarySettingsContext';
import { useActiveSession } from '../contexts/SessionContext';

vi.mock('../contexts/LibrarySettingsContext', () => ({
  useLibrarySettings: vi.fn(),
}));

vi.mock('../contexts/SessionContext', () => ({
  useActiveSession: vi.fn(),
}));

describe('AudioRecorderPill', () => {
  it('returns null if not recording', () => {
    vi.mocked(useActiveSession).mockReturnValue({ isRecording: false } as any);
    vi.mocked(useLibrarySettings).mockReturnValue({ activeTab: 'analysis' } as any);

    const { container } = render(<AudioRecorderPill />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null if on studio tab', () => {
    vi.mocked(useActiveSession).mockReturnValue({ isRecording: true } as any);
    vi.mocked(useLibrarySettings).mockReturnValue({ activeTab: 'studio' } as any);

    const { container } = render(<AudioRecorderPill />);
    expect(container.firstChild).toBeNull();
  });

  it('renders and formats time correctly', () => {
    const mockStopRecording = vi.fn();
    vi.mocked(useActiveSession).mockReturnValue({ 
      isRecording: true, 
      recordingSeconds: 65,
      stopRecording: mockStopRecording
    } as any);
    vi.mocked(useLibrarySettings).mockReturnValue({ activeTab: 'analysis' } as any);

    render(<AudioRecorderPill />);

    expect(screen.getByText('01:05')).toBeInTheDocument();

    const stopBtn = screen.getByTitle('Stop Recording');
    fireEvent.click(stopBtn);
    expect(mockStopRecording).toHaveBeenCalled();
  });
});
