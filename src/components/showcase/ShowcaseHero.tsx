// Epi - Local-first Meeting Intelligence
// Copyright (C) 2026  Eike Christian Karbe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import { EpiLogo } from '../EpiLogo';
import { Download, BookOpen, Play, Sparkles } from 'lucide-react';

function GithubIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export function ShowcaseHero() {
  return (
    <header className="showcase-hero-header" style={{ textAlign: 'center' }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1.25rem',
        background: 'var(--card-bg)',
        padding: '0.5rem 1.25rem',
        borderRadius: '3rem',
        border: '1px solid var(--card-border)',
        boxShadow: 'var(--shadow-default)',
        backdropFilter: 'blur(24px) saturate(180%)'
      }}>
        <Sparkles size={16} style={{ color: 'var(--accent-blue)' }} />
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Version 1.1.0 Release
        </span>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          background: 'var(--card-bg)',
          padding: '0.75rem 1.5rem',
          borderRadius: '3rem',
          border: '1px solid var(--card-border)',
          boxShadow: 'var(--shadow-default)',
          backdropFilter: 'blur(24px) saturate(180%)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <EpiLogo className="logo-icon" style={{ width: '2.5rem', height: '2.5rem', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))', padding: 0 }} />
          <h1 className="hero-title" style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.05em' }}>Epi</h1>
        </div>
      </div>

      <h2 className="showcase-hero-title" style={{
        fontWeight: 800,
        letterSpacing: '-0.04em',
        margin: '0 auto 1.5rem',
        maxWidth: '800px'
      }}>
        Meeting intelligence, <br />
        <span style={{ color: 'var(--accent-blue)' }}>running locally.</span>
      </h2>

      <p className="showcase-hero-subtitle" style={{
        maxWidth: '600px',
        margin: '0 auto 3rem',
        color: 'var(--text-secondary)',
        fontWeight: 500,
        lineHeight: 1.6
      }}>
        Named after <strong>Epimetheus, the Titan of afterthought</strong>. The private, offline-first assistant that gives you perfect hindsight. Record, natively transcribe, and summarize your meetings without sending your data to the cloud.
      </p>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <a href="#download" className="btn btn-primary" style={{ textDecoration: 'none', width: 'auto', padding: '1rem 2rem', fontSize: '1.1rem', borderRadius: '2rem', boxShadow: '0 8px 24px rgba(0, 122, 255, 0.25)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <Download size={20} />
          Download
        </a>
        <a href="https://github.com/ekarbe/epi" target="_blank" rel="noreferrer" className="btn btn-outline" style={{ textDecoration: 'none', width: 'auto', padding: '1rem 2rem', fontSize: '1.1rem', borderRadius: '2rem', background: 'var(--card-bg)', backdropFilter: 'blur(12px)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <GithubIcon size={20} />
          View on GitHub
        </a>
        <a href="#documentation" className="btn btn-outline" style={{ textDecoration: 'none', width: 'auto', padding: '1rem 2rem', fontSize: '1.1rem', borderRadius: '2rem', background: 'var(--card-bg)', backdropFilter: 'blur(12px)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen size={20} />
          Documentation
        </a>
        <a href="#demo" className="btn btn-outline" style={{ textDecoration: 'none', width: 'auto', padding: '1rem 2rem', fontSize: '1.1rem', borderRadius: '2rem', background: 'var(--card-bg)', backdropFilter: 'blur(12px)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <Play size={20} />
          Try Live Demo
        </a>
      </div>
    </header>
  );
}
