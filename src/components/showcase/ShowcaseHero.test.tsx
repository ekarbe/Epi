// Epi - Local-first Meeting Intelligence
// Copyright (C) 2026  Eike Christian Karbe

import { render, screen } from '@testing-library/react';
import { ShowcaseHero } from './ShowcaseHero';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../EpiLogo', () => ({
  EpiLogo: () => <div data-testid="mock-epi-logo" />
}));

describe('ShowcaseHero', () => {
  it('renders hero title, badge, logo, and call-to-action buttons', () => {
    render(<ShowcaseHero />);

    expect(screen.getByText('Version 1.1.0 Release')).toBeInTheDocument();
    expect(screen.getByTestId('mock-epi-logo')).toBeInTheDocument();
    expect(screen.getByText('Meeting intelligence,')).toBeInTheDocument();
    expect(screen.getByText('running locally.')).toBeInTheDocument();

    const downloadBtn = screen.getByRole('link', { name: /Download/i });
    expect(downloadBtn).toHaveAttribute('href', '#download');

    const githubBtn = screen.getByRole('link', { name: /View on GitHub/i });
    expect(githubBtn).toHaveAttribute('href', 'https://github.com/ekarbe/epi');

    const docsBtn = screen.getByRole('link', { name: /Documentation/i });
    expect(docsBtn).toHaveAttribute('href', '#documentation');

    const demoBtn = screen.getByRole('link', { name: /Try Live Demo/i });
    expect(demoBtn).toHaveAttribute('href', '#demo');
  });
});
