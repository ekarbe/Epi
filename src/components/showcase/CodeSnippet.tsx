// Epi - Local-first Meeting Intelligence
// Copyright (C) 2026  Eike Christian Karbe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { CodeSnippetProps } from './types';

export function CodeSnippet({ code, title }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API fails
      setCopied(false);
    }
  };

  return (
    <div style={{
      position: 'relative',
      background: 'var(--bg-primary)',
      borderRadius: '0.75rem',
      border: '1px solid var(--card-border)',
      padding: '1rem 1.25rem',
      fontFamily: 'monospace',
      fontSize: '0.9rem',
      color: 'var(--text-primary)',
      marginBottom: '1.5rem',
      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
    }}>
      {title && (
        <div style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginBottom: '0.5rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          {title}
        </div>
      )}
      <button
        onClick={handleCopy}
        aria-label="Copy code to clipboard"
        style={{
          position: 'absolute',
          top: '0.75rem',
          right: '0.75rem',
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: '0.5rem',
          padding: '0.35rem 0.65rem',
          color: copied ? 'var(--accent-green)' : 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.8rem',
          fontWeight: 500,
          transition: 'all 0.2s ease-in-out'
        }}
      >
        {copied ? <Check size={14} style={{ color: 'var(--accent-green)' }} /> : <Copy size={14} />}
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre style={{ margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
