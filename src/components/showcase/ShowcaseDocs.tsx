// Epi - Local-first Meeting Intelligence
// Copyright (C) 2026  Eike Christian Karbe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import { DocTab } from './types';
import { CodeSnippet } from './CodeSnippet';
import { 
  Rocket, 
  Cpu, 
  Lock, 
  Sparkles, 
  Wrench, 
  MapPin, 
  AlertCircle
} from 'lucide-react';

interface ShowcaseDocsProps {
  activeDocTab: DocTab;
  setActiveDocTab: (tab: DocTab) => void;
}

export function ShowcaseDocs({ activeDocTab, setActiveDocTab }: ShowcaseDocsProps) {
  return (
    <section id="documentation" style={{ maxWidth: '1200px', margin: '8rem auto 4rem', padding: '0 2rem', position: 'relative', zIndex: 10 }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <span className="badge purple" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', borderRadius: '2rem' }}>Knowledge Base</span>
        <h2 style={{ fontSize: '3rem', marginTop: '1.5rem', marginBottom: '1rem', letterSpacing: '-0.03em' }}>Documentation</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem', lineHeight: 1.6 }}>
          Everything you need to know about how Epi operates under the hood.
        </p>
      </div>
      
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div className="doc-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '0 0 200px' }}>
          <button 
            onClick={() => setActiveDocTab('setup')}
            style={{ textAlign: 'left', padding: '0.75rem 1rem', background: activeDocTab === 'setup' ? 'var(--card-bg-solid)' : 'transparent', border: 'none', borderRadius: '1rem', color: activeDocTab === 'setup' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeDocTab === 'setup' ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeDocTab === 'setup' ? 'var(--shadow-default)' : 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Rocket size={18} style={{ color: activeDocTab === 'setup' ? 'var(--accent-blue)' : 'inherit' }} />
            Installation & Setup
          </button>
          <button 
            onClick={() => setActiveDocTab('features')}
            style={{ textAlign: 'left', padding: '0.75rem 1rem', background: activeDocTab === 'features' ? 'var(--card-bg-solid)' : 'transparent', border: 'none', borderRadius: '1rem', color: activeDocTab === 'features' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeDocTab === 'features' ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeDocTab === 'features' ? 'var(--shadow-default)' : 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Cpu size={18} style={{ color: activeDocTab === 'features' ? 'var(--accent-purple)' : 'inherit' }} />
            Core Features & Tech
          </button>
          <button 
            onClick={() => setActiveDocTab('privacy')}
            style={{ textAlign: 'left', padding: '0.75rem 1rem', background: activeDocTab === 'privacy' ? 'var(--card-bg-solid)' : 'transparent', border: 'none', borderRadius: '1rem', color: activeDocTab === 'privacy' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeDocTab === 'privacy' ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeDocTab === 'privacy' ? 'var(--shadow-default)' : 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Lock size={18} style={{ color: activeDocTab === 'privacy' ? 'var(--accent-green)' : 'inherit' }} />
            Privacy & Security
          </button>
          <button 
            onClick={() => setActiveDocTab('advanced')}
            style={{ textAlign: 'left', padding: '0.75rem 1rem', background: activeDocTab === 'advanced' ? 'var(--card-bg-solid)' : 'transparent', border: 'none', borderRadius: '1rem', color: activeDocTab === 'advanced' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeDocTab === 'advanced' ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeDocTab === 'advanced' ? 'var(--shadow-default)' : 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Sparkles size={18} style={{ color: activeDocTab === 'advanced' ? 'var(--accent-amber)' : 'inherit' }} />
            Prompts & Automations
          </button>
          <button 
            onClick={() => setActiveDocTab('troubleshooting')}
            style={{ textAlign: 'left', padding: '0.75rem 1rem', background: activeDocTab === 'troubleshooting' ? 'var(--card-bg-solid)' : 'transparent', border: 'none', borderRadius: '1rem', color: activeDocTab === 'troubleshooting' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeDocTab === 'troubleshooting' ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeDocTab === 'troubleshooting' ? 'var(--shadow-default)' : 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Wrench size={18} style={{ color: activeDocTab === 'troubleshooting' ? 'var(--accent-red)' : 'inherit' }} />
            Troubleshooting & FAQs
          </button>
          <button 
            onClick={() => setActiveDocTab('journey')}
            style={{ textAlign: 'left', padding: '0.75rem 1rem', background: activeDocTab === 'journey' ? 'var(--card-bg-solid)' : 'transparent', border: 'none', borderRadius: '1rem', color: activeDocTab === 'journey' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeDocTab === 'journey' ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeDocTab === 'journey' ? 'var(--shadow-default)' : 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <MapPin size={18} style={{ color: activeDocTab === 'journey' ? 'var(--accent-blue)' : 'inherit' }} />
            The Journey
          </button>
        </div>

        {/* Content Area */}
        <div className="doc-content" style={{ flex: 1, background: 'var(--card-bg)', borderRadius: '2rem', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-default)', backdropFilter: 'blur(24px) saturate(180%)', padding: '2.5rem', minHeight: '500px' }}>
          
          {/* 1. SETUP */}
          {activeDocTab === 'setup' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <h3 style={{ fontSize: '2rem', marginTop: 0, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>Installation & Setup Guide</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0, 122, 255, 0.1)', border: '1px solid rgba(0, 122, 255, 0.2)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem' }}>
                <Rocket size={36} style={{ color: 'var(--accent-blue)' }} />
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-blue)', fontSize: '1.1rem' }}>Quick Start</h4>
                  <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.5 }}>Everything you need to get Epi running on your machine, from system requirements to bypassing OS warnings.</p>
                </div>
              </div>

              <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>1. System Requirements</h4>
              <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
                <li><strong>OS:</strong> Linux (AppImage/deb), Windows 10/11 (exe/msi), or macOS (dmg).</li>
                <li><strong>Memory:</strong> Minimum 8GB RAM (16GB recommended for local LLM inference).</li>
                <li><strong>Storage:</strong> At least 10GB free space for models and audio libraries.</li>
                <li><strong>FFmpeg:</strong> Available in system PATH or automatically installed via Epi's one-click manager into <code>{'{AppData}'}/ffmpeg/</code>.</li>
              </ul>

              <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>2. Source Installation & Development</h4>
              <CodeSnippet 
                id="clone-build"
                title="Build from source"
                code={`# Clone repository
git clone https://github.com/ekarbe/epi.git
cd epi

# Install Node dependencies
npm install

# Run full desktop app (Frontend + Rust Backend)
npm run tauri dev

# Type check TypeScript codebase
npx tsc --noEmit`}
              />

              <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>3. Handling Unsigned Binaries</h4>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Early release builds use unsigned binaries, which may trigger security warnings on your operating system. Here is how to safely bypass them:
              </p>
              <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
                <li><strong>macOS:</strong> If you see an "unidentified developer" warning, Control-click (or right-click) the Epi application icon in Finder, and select <strong>Open</strong> from the context menu.</li>
                <li><strong>Windows:</strong> If Microsoft Defender SmartScreen blocks the app, click <strong>More info</strong> and then click <strong>Run anyway</strong>.</li>
                <li><strong>Linux (AppImage):</strong> Ensure the file is executable before launching: <code>chmod +x epi_1.1.0_amd64.AppImage</code>.</li>
              </ul>
            </div>
          )}

          {/* 2. FEATURES */}
          {activeDocTab === 'features' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <h3 style={{ fontSize: '2rem', marginTop: 0, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>Core Features & Technical Architecture</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(175, 82, 222, 0.1)', border: '1px solid rgba(175, 82, 222, 0.2)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem' }}>
                <Cpu size={36} style={{ color: 'var(--accent-purple)' }} />
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-purple)', fontSize: '1.1rem' }}>Under the Hood</h4>
                  <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.5 }}>Explore the technical architecture, file storage locations, and AI configuration settings powering Epi v1.1.0.</p>
                </div>
              </div>

              <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>File Storage Locations</h4>
              <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--card-border)', marginBottom: '2rem' }}>
                <ul className="break-words" style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--text-primary)', lineHeight: 1.8, fontFamily: 'monospace', fontSize: '0.9rem' }}>
                  <li><strong>Recordings:</strong> ~/Documents/Epi Library/Recordings/ (.ogg Opus)</li>
                  <li><strong>Transcriptions:</strong> ~/Documents/Epi Library/Transcriptions/ (.txt & .json)</li>
                  <li><strong>Summaries:</strong> ~/Documents/Epi Library/Summaries/ (.md)</li>
                  <li><strong>Logs:</strong> ~/Documents/Epi Library/Logs/ (app.log & _ffmpeg.log)</li>
                  <li><strong>Database:</strong> {"{AppData}/epi_meta.db"} (SQLite)</li>
                  <li><strong>WhisperX Venv:</strong> {"{AppData}/whisperx_env/"} (Python venv)</li>
                  <li><strong>Managed FFmpeg:</strong> {"{AppData}/ffmpeg/"} (Standalone binary)</li>
                </ul>
              </div>

              <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>Engine & Settings Highlights</h4>
              <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
                <li><strong>Ollama Model Manager:</strong> Streamed in-app model downloads with progress percentage and disk space inspection (<code>sysinfo</code>).</li>
                <li><strong>WhisperX & CPU-Only Mode:</strong> Offline speech-to-text with option for CPU-only installation saving ~3.8GB disk space.</li>
                <li><strong>Global Glossary:</strong> Define custom vocabulary injected into WhisperX <code>initial_prompt</code> for technical term accuracy.</li>
                <li><strong>Dynamic Naming Schemas:</strong> Customizable title templates with token replacement (<code>{'{title}'}</code>, <code>{'{DD}'}</code>, <code>{'{MM}'}</code>, <code>{'{YYYY}'}</code>, <code>{'{counter}'}</code>).</li>
                <li><strong>Multi-Tier Storage Cleanup:</strong> Reclaim space via audio-only deletion while retaining transcriptions and summaries.</li>
                <li><strong>Speaker Diarization:</strong> Speaker identification with optional Pyannote Hugging Face token support.</li>
              </ul>
            </div>
          )}

          {/* 3. PRIVACY */}
          {activeDocTab === 'privacy' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <h3 style={{ fontSize: '2rem', marginTop: 0, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>Privacy & Data Security Guarantee</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(52, 199, 89, 0.1)', border: '1px solid rgba(52, 199, 89, 0.2)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem' }}>
                <Lock size={36} style={{ color: 'var(--accent-green)' }} />
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-green)', fontSize: '1.1rem' }}>Zero-Cloud Promise</h4>
                  <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.5 }}>By default, absolutely no data leaves your machine. Your audio recordings, transcripts, and generated summaries are processed 100% locally.</p>
                </div>
              </div>

              <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>Local Audio Capture & Storage</h4>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Epi hooks into system audio devices via Rust <code>cpal</code> and pipes stream data through a local TCP loopback to an isolated FFmpeg process. Audio is stored locally in compressed Opus (<code>.ogg</code>) format. No audio is ever transmitted over the network unless you explicitly select an opt-in Cloud Provider.
              </p>

              <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>Encrypted Secrets Storage</h4>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                When opt-in cloud providers are enabled, API keys are stored encrypted at rest using <strong>Tauri Stronghold</strong> (<code>tauri-plugin-stronghold</code>). Master keys are held securely in system keyring storage.
              </p>
            </div>
          )}

          {/* 4. ADVANCED */}
          {activeDocTab === 'advanced' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <h3 style={{ fontSize: '2rem', marginTop: 0, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>Custom Prompts & Automations</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255, 149, 0, 0.1)', border: '1px solid rgba(255, 149, 0, 0.2)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem' }}>
                <Sparkles size={36} style={{ color: 'var(--accent-amber)' }} />
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-amber)', fontSize: '1.1rem' }}>Context-Aware Workflows</h4>
                  <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.5 }}>Configure custom LLM prompt templates, scheduled automations, and tag background context injection.</p>
                </div>
              </div>

              <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>Custom Prompt Template Example</h4>
              <CodeSnippet 
                id="prompt-template"
                title="Ollama Prompt Template"
                code={`System: You are an expert technical meeting assistant.
User: Please analyze the following transcript and extract:
1. Architectural decisions and technical tradeoffs discussed.
2. Action items grouped by owner with clear deadlines.

Background Context:
<BACKGROUND_CONTEXT>

Transcript:
{{TRANSCRIPT}}`}
              />

              <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>Tag Context Injection</h4>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Epi allows you to attach context to tags (e.g. project goals or team background). When generating summaries, active tag context and related historical meeting notes are formatted inside <code>&lt;BACKGROUND_CONTEXT&gt;</code> tags, enabling multi-pass LLM reasoning across meetings.
              </p>

              <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>Scheduled Automations</h4>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Configure background rules in the Engine tab to automatically run WhisperX transcription or Ollama summarization on recordings created during specified time windows.
              </p>
            </div>
          )}

          {/* 5. TROUBLESHOOTING */}
          {activeDocTab === 'troubleshooting' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <h3 style={{ fontSize: '2rem', marginTop: 0, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>Troubleshooting & FAQs</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255, 59, 48, 0.1)', border: '1px solid rgba(255, 59, 48, 0.2)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem' }}>
                <Wrench size={36} style={{ color: 'var(--accent-red)' }} />
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-red)', fontSize: '1.1rem' }}>Help & Support</h4>
                  <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.5 }}>Solutions to common audio capture, FFmpeg binary, and local Ollama connection issues.</p>
                </div>
              </div>
              
              <h4 style={{ fontSize: '1.1rem', marginTop: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={18} style={{ color: 'var(--accent-red)' }} /> Why is my recording failing instantly?
              </h4>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                This usually indicates FFmpeg cannot open the requested audio device. Check the log file at <code>~/Documents/Epi Library/Logs/_ffmpeg.log</code>. Ensure microphone permissions are granted and that FFmpeg is available (or use the one-click installer in Engine tab).
              </p>

              <h4 style={{ fontSize: '1.1rem', marginTop: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={18} style={{ color: 'var(--accent-amber)' }} /> Ollama fails to generate summaries.
              </h4>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Epi connects to Ollama on <code>http://localhost:11434</code>. Verify the Ollama daemon is running in the background and that the target model is downloaded via the Engine tab's Model Manager.
              </p>
            </div>
          )}

          {/* 6. JOURNEY */}
          {activeDocTab === 'journey' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <h3 style={{ fontSize: '2rem', marginTop: 0, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>The Journey to Epi</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0, 122, 255, 0.1)', border: '1px solid rgba(0, 122, 255, 0.2)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem' }}>
                <MapPin size={36} style={{ color: 'var(--accent-blue)' }} />
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-blue)', fontSize: '1.1rem' }}>Origin Story</h4>
                  <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.5 }}>How Epi evolved from a terminal Python script into a production desktop application.</p>
                </div>
              </div>
              <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
                <li style={{ marginBottom: '1rem' }}><strong>The Itch:</strong> It started because I wanted a simple tool that records my voice and lets me transcribe and write action points.</li>
                <li style={{ marginBottom: '1rem' }}><strong>The Evolution:</strong> Then I wanted the tool to also record the audio from videos where I could add some context or questions by stopping the video and talking. Out of that I could create a summary of that video with my remarks.</li>
                <li style={{ marginBottom: '1rem' }}><strong>The Prototype:</strong> The tool initially turned into a Python app with a Flet frontend that I had to start manually in the terminal.</li>
                <li style={{ marginBottom: '1rem' }}><strong>The Final Form:</strong> After experimenting with layouts and prototypes, I landed on Epi — a polished, local-first Tauri v2 desktop application.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
