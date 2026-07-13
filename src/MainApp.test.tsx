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
import { render, screen } from '@testing-library/react';
import { MainApp } from './MainApp';
import { useLibrarySettings } from './contexts/LibrarySettingsContext';

vi.mock('./contexts/LibrarySettingsContext', () => ({
  useLibrarySettings: vi.fn(),
}));

vi.mock('./contexts/SessionContext', () => ({
  useActiveSession: vi.fn(() => ({ isRecording: false, recordingSeconds: 0, stopRecording: vi.fn() })),
}));

vi.mock('./components/DashboardGrid', () => ({
  DashboardGrid: ({ children }: any) => <div data-testid="grid">{children}</div>,
}));

vi.mock('./components/Tabs/StudioTab', () => ({ StudioTab: () => <div data-testid="studio-tab" /> }));
vi.mock('./components/Tabs/AnalysisTab', () => ({ AnalysisTab: () => <div data-testid="analysis-tab" /> }));
vi.mock('./components/Tabs/EngineTab', () => ({ EngineTab: () => <div data-testid="engine-tab" /> }));
vi.mock('./components/Tabs/LibraryTab', () => ({ LibraryTab: () => <div data-testid="library-tab" /> }));
vi.mock('./components/Navbar', () => ({ Navbar: () => <div data-testid="navbar" /> }));
vi.mock('./components/LanguagePromptModal', () => ({ LanguagePromptModal: () => <div data-testid="modal" /> }));
vi.mock('./components/AutomationRunner', () => ({ AutomationRunner: () => <div data-testid="runner" /> }));

describe('MainApp', () => {
  it('shows database error', () => {
    vi.mocked(useLibrarySettings).mockReturnValue({
      activeTab: 'studio',
      dbReady: false,
      dbError: 'Fake error',
    } as any);

    render(<MainApp />);
    expect(screen.getByText('Fake error')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useLibrarySettings).mockReturnValue({
      activeTab: 'studio',
      dbReady: false,
      dbError: null,
    } as any);

    render(<MainApp />);
    expect(screen.getByText('Initializing Database...')).toBeInTheDocument();
  });

  it('renders analysis tab', () => {
    vi.mocked(useLibrarySettings).mockReturnValue({
      activeTab: 'analysis',
      dbReady: true,
      dbError: null,
    } as any);

    render(<MainApp />);
    expect(screen.getByTestId('analysis-tab')).toBeInTheDocument();
  });

  it('renders engine tab', () => {
    vi.mocked(useLibrarySettings).mockReturnValue({
      activeTab: 'engine',
      dbReady: true,
      dbError: null,
    } as any);

    render(<MainApp />);
    expect(screen.getByTestId('engine-tab')).toBeInTheDocument();
  });

  it('renders library tab', () => {
    vi.mocked(useLibrarySettings).mockReturnValue({
      activeTab: 'library',
      dbReady: true,
      dbError: null,
    } as any);

    render(<MainApp />);
    expect(screen.getByTestId('library-tab')).toBeInTheDocument();
  });
});
