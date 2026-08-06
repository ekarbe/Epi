// Epi - Local-first Meeting Intelligence
// Copyright (C) 2026  Eike Christian Karbe

import { render, screen } from '@testing-library/react';
import { ShowcaseBento } from './ShowcaseBento';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../TiltCard', () => ({
  TiltCard: ({ children, className, style }: any) => (
    <div data-testid="mock-tilt-card" className={className} style={style}>
      {children}
    </div>
  )
}));

describe('ShowcaseBento', () => {
  it('renders all 6 feature cards with correct titles and descriptions', () => {
    render(<ShowcaseBento />);

    const cards = screen.getAllByTestId('mock-tilt-card');
    expect(cards).toHaveLength(6);

    expect(screen.getByText('Local Audio Recording')).toBeInTheDocument();
    expect(screen.getByText('Offline Transcription')).toBeInTheDocument();
    expect(screen.getByText('Local LLM & Model Manager')).toBeInTheDocument();
    expect(screen.getByText('Opt-In Cloud Fallbacks')).toBeInTheDocument();
    expect(screen.getByText('Tag Context & Search')).toBeInTheDocument();
    expect(screen.getByText('Dynamic Naming & Rules')).toBeInTheDocument();
  });
});
