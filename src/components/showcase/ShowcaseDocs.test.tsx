// Epi - Local-first Meeting Intelligence
// Copyright (C) 2026  Eike Christian Karbe

import { render, screen, fireEvent } from '@testing-library/react';
import { ShowcaseDocs } from './ShowcaseDocs';
import { DocTab } from './types';
import { describe, it, expect, vi } from 'vitest';

describe('ShowcaseDocs', () => {
  const tabs: DocTab[] = ['setup', 'features', 'privacy', 'advanced', 'troubleshooting', 'journey'];

  it.each(tabs)('renders tab content for tab "%s" and handles tab switching', (tab) => {
    const setActiveDocTab = vi.fn();

    render(<ShowcaseDocs activeDocTab={tab} setActiveDocTab={setActiveDocTab} />);

    if (tab === 'setup') {
      expect(screen.getByText('Installation & Setup Guide')).toBeInTheDocument();
    } else if (tab === 'features') {
      expect(screen.getByText('Core Features & Technical Architecture')).toBeInTheDocument();
    } else if (tab === 'privacy') {
      expect(screen.getByText('Privacy & Data Security Guarantee')).toBeInTheDocument();
    } else if (tab === 'advanced') {
      expect(screen.getByText('Custom Prompts & Automations')).toBeInTheDocument();
    } else if (tab === 'troubleshooting') {
      expect(screen.getByRole('heading', { name: /Troubleshooting & FAQs/i })).toBeInTheDocument();
    } else if (tab === 'journey') {
      expect(screen.getByText('The Journey to Epi')).toBeInTheDocument();
    }

    // Click another tab button e.g. Privacy
    fireEvent.click(screen.getByRole('button', { name: /Privacy & Security/i }));
    expect(setActiveDocTab).toHaveBeenCalledWith('privacy');
  });
});
