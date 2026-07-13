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
import { TiltCard } from './TiltCard';
import { describe, it, expect } from 'vitest';

describe('TiltCard', () => {
  it('renders children', () => {
    render(<TiltCard>Hello</TiltCard>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders as an anchor if href is provided', () => {
    render(<TiltCard href="https://example.com">Link</TiltCard>);
    const link = screen.getByText('Link');
    expect(link.tagName.toLowerCase()).toBe('a');
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('handles mouse enter and leave', () => {
    render(<TiltCard>Hover me</TiltCard>);
    const card = screen.getByText('Hover me');
    
    // Move mouse
    fireEvent.mouseMove(card, { clientX: 100, clientY: 100 });
    
    // Leave mouse
    fireEvent.mouseLeave(card);
  });
});
