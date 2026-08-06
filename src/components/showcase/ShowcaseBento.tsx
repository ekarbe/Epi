// Epi - Local-first Meeting Intelligence
// Copyright (C) 2026  Eike Christian Karbe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import React from 'react';
import { TiltCard } from '../TiltCard';
import { Mic, FileText, Brain, Cloud, Tags, Sliders } from 'lucide-react';

export function ShowcaseBento() {
  return (
    <section style={{ maxWidth: '1000px', margin: '0 auto 8rem', padding: '0 2rem', position: 'relative', zIndex: 10 }}>
      <div className="bento-grid">
        {/* Local Recording */}
        <TiltCard className="bento-card-showcase" style={{ gridColumn: 'span 7', '--card-accent': 'var(--accent-blue)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '2.5rem' } as React.CSSProperties}>
          <div className="bento-icon-wrapper" style={{ color: 'var(--accent-blue)', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
            <Mic size={36} />
          </div>
          <h3 style={{ marginTop: 0, fontSize: '1.5rem', marginBottom: '0.75rem' }}>Local Audio Recording</h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1.05rem', lineHeight: 1.6 }}>
            High-quality, low-latency audio capture via CPAL and FFmpeg TCP loopback saving compressed Opus (.ogg) files directly to your local drive. Complete privacy from the first syllable.
          </p>
        </TiltCard>

        {/* Local Transcribing */}
        <TiltCard className="bento-card-showcase" style={{ gridColumn: 'span 5', '--card-accent': 'var(--accent-green)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '2.5rem' } as React.CSSProperties}>
          <div className="bento-icon-wrapper" style={{ color: 'var(--accent-green)', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
            <FileText size={36} />
          </div>
          <h3 style={{ marginTop: 0, fontSize: '1.5rem', marginBottom: '0.75rem' }}>Offline Transcription</h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1.05rem', lineHeight: 1.6 }}>
            Accurate, offline speech-to-text powered by WhisperX with word-level timestamps, real-time live mic preview, Global Glossary vocabulary conditioning, and CPU-only install options.
          </p>
        </TiltCard>

        {/* Local AI & Model Manager */}
        <TiltCard className="bento-card-showcase" style={{ gridColumn: 'span 5', '--card-accent': 'var(--accent-amber)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '2.5rem' } as React.CSSProperties}>
          <div className="bento-icon-wrapper" style={{ color: 'var(--accent-amber)', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
            <Brain size={36} />
          </div>
          <h3 style={{ marginTop: 0, fontSize: '1.5rem', marginBottom: '0.75rem' }}>Local LLM & Model Manager</h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1.05rem', lineHeight: 1.6 }}>
            Generate actionable summaries using Ollama (Llama 3 / Mistral). Streamed in-app model downloads with percentage progress and native disk space checks.
          </p>
        </TiltCard>

        {/* Cloud Fallbacks */}
        <TiltCard className="bento-card-showcase" style={{ gridColumn: 'span 7', '--card-accent': 'var(--accent-purple)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '2.5rem' } as React.CSSProperties}>
          <div className="bento-icon-wrapper" style={{ color: 'var(--accent-purple)', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
            <Cloud size={36} />
          </div>
          <h3 style={{ marginTop: 0, fontSize: '1.5rem', marginBottom: '0.75rem' }}>Opt-In Cloud Fallbacks</h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1.05rem', lineHeight: 1.6 }}>
            Prefer cloud processing? Epi seamlessly connects to OpenAI, Anthropic, Gemini, or AssemblyAI. Your API keys are encrypted at rest using Tauri Stronghold.
          </p>
        </TiltCard>

        {/* Tag Context & Search */}
        <TiltCard className="bento-card-showcase" style={{ gridColumn: 'span 6', '--card-accent': 'var(--accent-red)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '2.5rem' } as React.CSSProperties}>
          <div className="bento-icon-wrapper" style={{ color: 'var(--accent-red)', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
            <Tags size={36} />
          </div>
          <h3 style={{ marginTop: 0, fontSize: '1.5rem', marginBottom: '0.75rem' }}>Tag Context & Search</h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1.05rem', lineHeight: 1.6 }}>
            Enrich summarization prompts by injecting active tag background context into LLM runs. Easily search and filter your recording library by custom tag names.
          </p>
        </TiltCard>

        {/* Dynamic Naming & Automations */}
        <TiltCard className="bento-card-showcase" style={{ gridColumn: 'span 6', '--card-accent': 'var(--accent-blue)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '2.5rem' } as React.CSSProperties}>
          <div className="bento-icon-wrapper" style={{ color: 'var(--accent-blue)', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
            <Sliders size={36} />
          </div>
          <h3 style={{ marginTop: 0, fontSize: '1.5rem', marginBottom: '0.75rem' }}>Dynamic Naming & Rules</h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1.05rem', lineHeight: 1.6 }}>
            Configure recording title schemas with token replacements ({'{title}'}, {'{DD}'}, {'{MM}'}, {'{counter}'}) and set up scheduled automations for background transcription.
          </p>
        </TiltCard>
      </div>
    </section>
  );
}
