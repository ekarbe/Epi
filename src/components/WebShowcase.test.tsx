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

import { render, screen, fireEvent, act } from '@testing-library/react';
import { WebShowcase } from './WebShowcase';
import { describe, it, expect, vi } from 'vitest';

// Mock the MainApp component since it's heavy
vi.mock('../MainApp', () => ({
  MainApp: () => <div data-testid="mock-main-app" />
}));

// Mock TiltCard and EpiLogo
vi.mock('./TiltCard', () => ({
  TiltCard: ({ children }: any) => <div data-testid="mock-tilt-card">{children}</div>
}));

vi.mock('./EpiLogo', () => ({
  EpiLogo: () => <div data-testid="mock-epi-logo" />
}));

describe('WebShowcase', () => {
  it('renders correctly', () => {
    render(<WebShowcase />);
    expect(screen.getByText(/Meeting intelligence/i)).toBeInTheDocument();
    expect(screen.getByTestId('mock-main-app')).toBeInTheDocument();
  });

  it('handles doc tab changes', () => {
    render(<WebShowcase />);
    
    // Default is setup
    expect(screen.getByText(/System Requirements/)).toBeInTheDocument();
    
    // Click features
    act(() => {
      fireEvent.click(screen.getByText('Core Features & Tech'));
    });
    expect(screen.getByText(/Core Features & Technical Architecture/)).toBeInTheDocument();
    
    // Click privacy
    act(() => {
      fireEvent.click(screen.getByText('Privacy & Security'));
    });
    expect(screen.getByText(/Zero-Cloud Promise/)).toBeInTheDocument();

    // Click advanced
    act(() => {
      fireEvent.click(screen.getByText('Prompts & Automations'));
    });
    expect(screen.getByText(/Custom Prompts & Automations/)).toBeInTheDocument();

    // Click troubleshooting
    act(() => {
      fireEvent.click(screen.getByText('Troubleshooting & FAQs'));
    });
    expect(screen.getByRole('heading', { name: /Troubleshooting & FAQs/i })).toBeInTheDocument();
  });

  it('handles OS selection', () => {
    render(<WebShowcase />);
    
    // Default is linux
    expect(screen.getByText('Epi for Linux (Debian/Ubuntu and AppImage).')).toBeInTheDocument();
    
    // Select windows
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Windows' }));
    });
    expect(screen.getByText('Epi for Windows 10/11 (64-bit).')).toBeInTheDocument();

    // Select macos
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'macOS' }));
    });
    expect(screen.getByText('Epi for macOS (Intel and Apple Silicon).')).toBeInTheDocument();
  });
});
