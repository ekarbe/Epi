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
import { Navbar } from './Navbar';
import { useLibrarySettings } from '../contexts/LibrarySettingsContext';

vi.mock('../contexts/LibrarySettingsContext', () => ({
  useLibrarySettings: vi.fn(),
}));

vi.mock('../contexts/SessionContext', () => ({
  useActiveSession: vi.fn(),
}));

describe('Navbar', () => {
  it('renders tabs and toggles theme', () => {
    const mockSetTab = vi.fn();
    const mockSetDark = vi.fn();

    vi.mocked(useLibrarySettings).mockReturnValue({
      activeTab: 'studio',
      setActiveTab: mockSetTab,
      isDark: false,
      setIsDark: mockSetDark,
    } as any);

    render(<Navbar />);

    expect(screen.getByText('Epi')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Analysis'));
    expect(mockSetTab).toHaveBeenCalledWith('analysis');

    fireEvent.click(screen.getByText('Library'));
    expect(mockSetTab).toHaveBeenCalledWith('library');

    fireEvent.click(screen.getByText('Engine'));
    expect(mockSetTab).toHaveBeenCalledWith('engine');

    fireEvent.click(screen.getByText('Studio'));
    expect(mockSetTab).toHaveBeenCalledWith('studio');

    const themeToggle = screen.getByRole('button', { name: 'Toggle theme' });
    fireEvent.click(themeToggle);
    expect(mockSetDark).toHaveBeenCalledWith(true);
  });
});
