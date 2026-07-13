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

vi.mock('./MainApp', () => ({ MainApp: () => <div data-testid="main-app" /> }));
vi.mock('./components/WebShowcase', () => ({ WebShowcase: () => <div data-testid="web-showcase" /> }));

vi.mock('./lib/api', () => ({
  isTauri: false,
}));

describe('App Component', () => {
  it('renders WebShowcase by default when not in Tauri', async () => {
    // We need to dynamically import App because of the module mock cache
    const AppModule = await import('./App');
    const TestApp = AppModule.default;
    
    render(<TestApp />);
    expect(screen.getByTestId('web-showcase')).toBeInTheDocument();
  });

  it('renders MainApp when in Tauri', async () => {
    vi.resetModules();
    vi.doMock('./lib/api', () => ({ isTauri: true }));
    
    const AppModule = await import('./App');
    const TestApp = AppModule.default;
    
    render(<TestApp />);
    expect(screen.getByTestId('main-app')).toBeInTheDocument();
  });
});
