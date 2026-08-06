// Epi - Local-first Meeting Intelligence
// Copyright (C) 2026  Eike Christian Karbe

import { render, screen, fireEvent, act } from '@testing-library/react';
import { CodeSnippet } from './CodeSnippet';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('CodeSnippet', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it('renders code and optional title', () => {
    render(<CodeSnippet id="test-1" code="npm run dev" title="Development" />);
    expect(screen.getByText('Development')).toBeInTheDocument();
    expect(screen.getByText('npm run dev')).toBeInTheDocument();
  });

  it('renders code without title when title is omitted', () => {
    render(<CodeSnippet id="test-2" code="git status" />);
    expect(screen.getByText('git status')).toBeInTheDocument();
    expect(screen.queryByText('DEVELOPMENT')).not.toBeInTheDocument();
  });

  it('handles successful copy to clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<CodeSnippet id="test-3" code="echo hello" />);
    const button = screen.getByRole('button', { name: /copy code/i });
    expect(button).toHaveTextContent('Copy');

    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeTextMock).toHaveBeenCalledWith('echo hello');
    expect(button).toHaveTextContent('Copied!');

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(button).toHaveTextContent('Copy');
  });

  it('handles clipboard failure gracefully without throwing', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<CodeSnippet id="test-4" code="secret" />);
    const button = screen.getByRole('button', { name: /copy code/i });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeTextMock).toHaveBeenCalledWith('secret');
    expect(button).toHaveTextContent('Copy');
  });
});
