// Epi - Local-first Meeting Intelligence
// Copyright (C) 2026  Eike Christian Karbe

import { render, screen, fireEvent } from '@testing-library/react';
import { ShowcaseDownload } from './ShowcaseDownload';
import { describe, it, expect, vi } from 'vitest';

describe('ShowcaseDownload', () => {
  it('renders correctly for Linux and switches OS', () => {
    const setSelectedOS = vi.fn();
    const setActiveDocTab = vi.fn();

    render(
      <ShowcaseDownload
        selectedOS="linux"
        setSelectedOS={setSelectedOS}
        setActiveDocTab={setActiveDocTab}
      />
    );

    expect(screen.getByText('Get Epi v1.1.0')).toBeInTheDocument();
    expect(screen.getByText('Epi for Linux (Debian/Ubuntu and AppImage).')).toBeInTheDocument();
    expect(screen.getByText('Download .deb')).toBeInTheDocument();
    expect(screen.getByText('Download AppImage')).toBeInTheDocument();

    // Click Windows button
    fireEvent.click(screen.getByRole('button', { name: /Windows/i }));
    expect(setSelectedOS).toHaveBeenCalledWith('windows');
  });

  it('renders macOS notes and allows navigating to setup guide', () => {
    const setSelectedOS = vi.fn();
    const setActiveDocTab = vi.fn();

    render(
      <ShowcaseDownload
        selectedOS="macos"
        setSelectedOS={setSelectedOS}
        setActiveDocTab={setActiveDocTab}
      />
    );

    expect(screen.getByText('Epi for macOS (Intel and Apple Silicon).')).toBeInTheDocument();
    expect(screen.getByText(/macOS Audio Note:/)).toBeInTheDocument();

    const guideLink = screen.getByText('learn how to safely bypass it in our setup guide.');
    fireEvent.click(guideLink);
    expect(setActiveDocTab).toHaveBeenCalledWith('setup');
  });
});
