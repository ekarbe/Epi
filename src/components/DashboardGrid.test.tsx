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

import { render, screen } from '@testing-library/react';
import { DashboardGrid, BentoCard } from './DashboardGrid';
import { describe, it, expect } from 'vitest';

describe('DashboardGrid', () => {
  it('renders children', () => {
    render(
      <DashboardGrid>
        <div>Item 1</div>
        <div>Item 2</div>
      </DashboardGrid>
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });
});

describe('BentoCard', () => {
  it('renders children without title', () => {
    render(<BentoCard>Card Content</BentoCard>);
    expect(screen.getByText('Card Content')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('renders with title', () => {
    render(<BentoCard title="My Title">Card Content</BentoCard>);
    expect(screen.getByRole('heading', { name: 'My Title' })).toBeInTheDocument();
    expect(screen.getByText('Card Content')).toBeInTheDocument();
  });

  it('applies custom class name', () => {
    const { container } = render(<BentoCard className="custom-class">Card Content</BentoCard>);
    expect(container.firstChild).toHaveClass('bento-card custom-class');
  });
});
