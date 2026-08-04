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
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

import { useState } from 'react';
import { MainApp } from '../MainApp';
import { EpiLogo } from './EpiLogo';
import { TiltCard } from './TiltCard';

export function WebShowcase() {
  const [activeDocTab, setActiveDocTab] = useState('setup');
  const [selectedOS, setSelectedOS] = useState<'linux' | 'windows' | 'macos'>('linux');

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: 'var(--font-family, Inter, sans-serif)',
      background: 'transparent',
      color: 'var(--text-primary)',
      paddingBottom: '4rem',
      position: 'relative'
    }}>
      <div className="mesh-bg">
        <div className="mesh-blob mesh-blob-1"></div>
        <div className="mesh-blob mesh-blob-2"></div>
      </div>
      
      {/* Hero Section */}
      <header className="showcase-hero-header" style={{
        textAlign: 'center',
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', background: 'var(--card-bg)', padding: '0.75rem 1.5rem', borderRadius: '3rem', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-default)', backdropFilter: 'blur(24px) saturate(180%)' }}>
          <EpiLogo className="logo-icon" style={{ width: '2.5rem', height: '2.5rem', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))', padding: 0 }} />
          <h1 className="hero-title" style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.05em' }}>Epi</h1>
        </div>
        <h2 className="showcase-hero-title" style={{ 
          fontWeight: 800, 
          letterSpacing: '-0.04em', 
          margin: '0 auto 1.5rem',
          maxWidth: '800px'
        }}>
          Meeting intelligence, <br/><span style={{ color: 'var(--accent-blue)' }}>running locally.</span>
        </h2>
        <p className="showcase-hero-subtitle" style={{ 
          maxWidth: '600px', 
          margin: '0 auto 3rem', 
          color: 'var(--text-secondary)',
          fontWeight: 500
        }}>
          Named after <strong>Epimetheus, the Titan of afterthought</strong>. The private, offline-first assistant that gives you perfect hindsight. Record, natively transcribe, and summarize your meetings without sending your data to the cloud.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#download" className="btn btn-primary" style={{ textDecoration: 'none', width: 'auto', padding: '1rem 2rem', fontSize: '1.1rem', borderRadius: '2rem', boxShadow: '0 8px 24px rgba(0, 122, 255, 0.25)' }}>
            Download
          </a>
          <a href="https://github.com/ekarbe/epi" target="_blank" rel="noreferrer" className="btn btn-outline" style={{ textDecoration: 'none', width: 'auto', padding: '1rem 2rem', fontSize: '1.1rem', borderRadius: '2rem', background: 'var(--card-bg)', backdropFilter: 'blur(12px)' }}>
            View on GitHub
          </a>
          <a href="#documentation" className="btn btn-outline" style={{ textDecoration: 'none', width: 'auto', padding: '1rem 2rem', fontSize: '1.1rem', borderRadius: '2rem', background: 'var(--card-bg)', backdropFilter: 'blur(12px)' }}>
            Documentation
          </a>
          <a href="#demo" className="btn btn-outline" style={{ textDecoration: 'none', width: 'auto', padding: '1rem 2rem', fontSize: '1.1rem', borderRadius: '2rem', background: 'var(--card-bg)', backdropFilter: 'blur(12px)' }}>
            Try Live Demo
          </a>
        </div>
      </header>

      {/* Docs Overview */}
      <section style={{ maxWidth: '1000px', margin: '0 auto 8rem', padding: '0 2rem', position: 'relative', zIndex: 10 }}>
        <div className="bento-grid">
          <TiltCard className="bento-card-showcase" style={{ gridColumn: 'span 7', '--card-accent': 'var(--accent-blue)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '2.5rem' } as React.CSSProperties}>
            <div className="bento-icon-wrapper" style={{ color: 'var(--accent-blue)', fontSize: '2.5rem', marginBottom: '1rem' }}>🎙️</div>
            <h3 style={{ marginTop: 0, fontSize: '1.5rem', marginBottom: '0.75rem' }}>Local Recording</h3>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1.05rem', lineHeight: 1.6 }}>
              High-quality, low-latency audio capture directly saving to your local drive. Complete privacy from the first syllable.
            </p>
          </TiltCard>
          <TiltCard className="bento-card-showcase" style={{ gridColumn: 'span 5', '--card-accent': 'var(--accent-green)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '2.5rem' } as React.CSSProperties}>
            <div className="bento-icon-wrapper" style={{ color: 'var(--accent-green)', fontSize: '2.5rem', marginBottom: '1rem' }}>✍️</div>
            <h3 style={{ marginTop: 0, fontSize: '1.5rem', marginBottom: '0.75rem' }}>Local Transcribing</h3>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1.05rem', lineHeight: 1.6 }}>
              Accurate, offline speech-to-text powered by WhisperX, featuring word-level timestamps.
            </p>
          </TiltCard>
          <TiltCard className="bento-card-showcase" style={{ gridColumn: 'span 5', '--card-accent': 'var(--accent-amber)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '2.5rem' } as React.CSSProperties}>
            <div className="bento-icon-wrapper" style={{ color: 'var(--accent-amber)', fontSize: '2.5rem', marginBottom: '1rem' }}>🧠</div>
            <h3 style={{ marginTop: 0, fontSize: '1.5rem', marginBottom: '0.75rem' }}>Local AI</h3>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1.05rem', lineHeight: 1.6, maxWidth: '800px' }}>
              Generate actionable summaries, extract insights, and ask questions about your meetings securely on your machine using Large Language Models (LLMs) via Ollama. No API keys required, zero data leaves your computer.
            </p>
          </TiltCard>
          <TiltCard className="bento-card-showcase" style={{ gridColumn: 'span 7', '--card-accent': 'var(--accent-red)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '2.5rem' } as React.CSSProperties}>
            <div className="bento-icon-wrapper" style={{ color: 'var(--accent-red)', fontSize: '2.5rem', marginBottom: '1rem' }}>☁️</div>
            <h3 style={{ marginTop: 0, fontSize: '1.5rem', marginBottom: '0.75rem' }}>Cloud Ready</h3>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1.05rem', lineHeight: 1.6 }}>
              Prefer the cloud? Epi seamlessly integrates with OpenAI, Anthropic, and Google APIs for state-of-the-art processing.
            </p>
          </TiltCard>
        </div>
      </section>

      {/* Interactive Demo */}
      <section id="demo" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem', position: 'relative', zIndex: 10 }}>
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '3rem' 
        }}>
          <span className="badge purple" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', borderRadius: '2rem' }}>Interactive Preview</span>
          <h2 style={{ fontSize: '3rem', marginTop: '1.5rem', marginBottom: '1rem', letterSpacing: '-0.03em' }}>Experience Epi</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto', fontSize: '1.1rem', lineHeight: 1.6 }}>
            Experience the real Epi interface right in your browser. Try recording a sample meeting and see how the AI summarizes it!
          </p>
          <div style={{ marginTop: '1.5rem', display: 'inline-block', background: 'rgba(255,189,46,0.1)', border: '1px solid rgba(255,189,46,0.3)', color: '#ffbd2e', padding: '0.75rem 1.25rem', borderRadius: '1rem', fontSize: '0.95rem', fontWeight: 500, maxWidth: '600px', textAlign: 'left' }}>
            ⚠️ <strong style={{color: '#ffbd2e'}}>Mock Demo Only:</strong> All transcription, summarization, and AI features are completely simulated. This demo does not make any external network requests or connect to any local AI engines.
          </div>
        </div>

        {/* Mac OS Window Wrapper */}
        <div className="desktop-only" style={{
          background: 'var(--card-bg)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderRadius: '1.5rem',
          border: '1px solid var(--card-border)',
          boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '850px',
          transform: 'translateZ(0)' // Hardware acceleration
        }}>
          {/* Window Header */}
          <div style={{ 
            height: '3rem', 
            background: 'var(--card-bg-solid)', 
            borderBottom: '1px solid var(--card-border)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 1.25rem',
            gap: '0.5rem'
          }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56', boxShadow: '0 0 4px rgba(255,95,86,0.5)' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e', boxShadow: '0 0 4px rgba(255,189,46,0.5)' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27c93f', boxShadow: '0 0 4px rgba(39,201,63,0.5)' }} />
            <div style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '4rem', letterSpacing: '0.02em' }}>
              Epi
            </div>
          </div>
          
          {/* App Container */}
          <div style={{ flex: 1, overflowY: 'auto', position: 'relative', background: 'var(--bg-primary)' }}>
            <MainApp />
          </div>
        </div>

        {/* Mobile Placeholder */}
        <div className="mobile-only bento-card" style={{ textAlign: 'center', padding: '3rem 2rem', margin: '0 auto', maxWidth: '500px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>💻</div>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Desktop Experience</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Epi is a powerful desktop application. Please visit this showcase on a larger screen to experience the interactive live demo.
          </p>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" style={{ maxWidth: '1000px', margin: '8rem auto', padding: '0 2rem', position: 'relative', zIndex: 10 }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span className="badge green" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', borderRadius: '2rem', background: 'rgba(39,201,63,0.1)', color: '#27c93f' }}>Get Epi</span>
          <h2 style={{ fontSize: '3rem', marginTop: '1.5rem', marginBottom: '1rem', letterSpacing: '-0.03em' }}>Download</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem', lineHeight: 1.6 }}>
            Ready to reclaim your meeting data? Download the latest release of Epi below.
          </p>
        </div>

        <div style={{ background: 'var(--card-bg)', borderRadius: '2rem', border: '1px solid var(--card-border)', padding: '3rem', boxShadow: 'var(--shadow-default)', backdropFilter: 'blur(24px) saturate(180%)', textAlign: 'center' }}>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <button 
              onClick={() => setSelectedOS('linux')}
              style={{ padding: '0.75rem 1.5rem', borderRadius: '1rem', border: selectedOS === 'linux' ? '2px solid var(--accent-blue)' : '1px solid var(--card-border)', background: selectedOS === 'linux' ? 'rgba(0, 122, 255, 0.1)' : 'transparent', color: selectedOS === 'linux' ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
              Linux
            </button>
            <button 
              onClick={() => setSelectedOS('windows')}
              style={{ padding: '0.75rem 1.5rem', borderRadius: '1rem', border: selectedOS === 'windows' ? '2px solid var(--accent-blue)' : '1px solid var(--card-border)', background: selectedOS === 'windows' ? 'rgba(0, 122, 255, 0.1)' : 'transparent', color: selectedOS === 'windows' ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
              Windows
            </button>
            <button 
              onClick={() => setSelectedOS('macos')}
              style={{ padding: '0.75rem 1.5rem', borderRadius: '1rem', border: selectedOS === 'macos' ? '2px solid var(--accent-blue)' : '1px solid var(--card-border)', background: selectedOS === 'macos' ? 'rgba(0, 122, 255, 0.1)' : 'transparent', color: selectedOS === 'macos' ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
              macOS
            </button>
          </div>

          <div style={{ minHeight: '120px' }}>
            {selectedOS === 'linux' && (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Epi for Linux (Debian/Ubuntu and AppImage).</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <a href="https://github.com/ekarbe/epi/releases/latest/download/epi_1.1.0_amd64.deb" className="btn btn-primary" style={{ textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: '2rem' }}>Download .deb</a>
                  <a href="https://github.com/ekarbe/epi/releases/latest/download/epi_1.1.0_amd64.AppImage" className="btn btn-outline" style={{ textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: '2rem' }}>Download AppImage</a>
                </div>
              </div>
            )}
            
            {selectedOS === 'windows' && (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Epi for Windows 10/11 (64-bit).</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <a href="https://github.com/ekarbe/epi/releases/latest/download/Epi_1.1.0_x64_en-US.msi" className="btn btn-primary" style={{ textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: '2rem' }}>Download .msi</a>
                  <a href="https://github.com/ekarbe/epi/releases/latest/download/Epi_1.1.0_x64-setup.exe" className="btn btn-outline" style={{ textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: '2rem' }}>Download .exe</a>
                </div>
              </div>
            )}
            
            {selectedOS === 'macos' && (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Epi for macOS (Intel and Apple Silicon).</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <a href="https://github.com/ekarbe/epi/releases/latest/download/Epi_1.1.0_aarch64.dmg" className="btn btn-primary" style={{ textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: '2rem' }}>Apple Silicon (M1/M2/M3)</a>
                  <a href="https://github.com/ekarbe/epi/releases/latest/download/Epi_1.1.0_x64.dmg" className="btn btn-outline" style={{ textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: '2rem' }}>Intel Mac</a>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem', textAlign: 'left' }}>
            {selectedOS === 'macos' && (
              <div style={{ fontSize: '0.85rem', color: 'var(--accent-amber)', background: 'rgba(255,189,46,0.1)', padding: '1rem', borderRadius: '1rem', border: '1px solid rgba(255,189,46,0.2)' }}>
                <strong>⚠️ macOS Builds are Untested:</strong> While Epi is designed to be cross-platform, the macOS builds have not been extensively tested. You may encounter unexpected behavior or compilation issues.
                <br/><br/>
                <strong>Note on macOS Audio Recording:</strong> Due to native limitations in macOS CoreAudio, Epi cannot directly record system output audio (Speakers/Headphones). You can only record microphone inputs natively. To record system audio on macOS, you must install a virtual audio loopback driver like BlackHole.
              </div>
            )}
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(0, 122, 255, 0.1)', padding: '1rem', borderRadius: '1rem', border: '1px solid rgba(0, 122, 255, 0.2)' }}>
              <strong style={{ color: 'var(--accent-blue)' }}>Note on OS Warnings:</strong> Version 1 is released using unsigned binaries. When opening Epi for the first time, your OS (particularly macOS and Windows SmartScreen) might display an "unidentified developer" warning. <a href="#documentation" onClick={() => setActiveDocTab('setup')} style={{ color: 'var(--accent-blue)' }}>Learn how to safely bypass this in our setup guide.</a>
            </div>
          </div>
        </div>
      </section>

      {/* Documentation Section */}
      <section id="documentation" style={{ maxWidth: '1200px', margin: '8rem auto 4rem', padding: '0 2rem', position: 'relative', zIndex: 10 }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span className="badge purple" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', borderRadius: '2rem' }}>Knowledge Base</span>
          <h2 style={{ fontSize: '3rem', marginTop: '1.5rem', marginBottom: '1rem', letterSpacing: '-0.03em' }}>Documentation</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem', lineHeight: 1.6 }}>
            Everything you need to know about how Epi operates under the hood.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {/* Sidebar Tabs */}
          <div className="doc-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button 
              onClick={() => setActiveDocTab('setup')}
              style={{ textAlign: 'left', padding: '1rem 1.5rem', background: activeDocTab === 'setup' ? 'var(--card-bg-solid)' : 'transparent', border: 'none', borderRadius: '1rem', color: activeDocTab === 'setup' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeDocTab === 'setup' ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeDocTab === 'setup' ? 'var(--shadow-default)' : 'none' }}>
              Installation & Setup
            </button>
            <button 
              onClick={() => setActiveDocTab('features')}
              style={{ textAlign: 'left', padding: '1rem 1.5rem', background: activeDocTab === 'features' ? 'var(--card-bg-solid)' : 'transparent', border: 'none', borderRadius: '1rem', color: activeDocTab === 'features' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeDocTab === 'features' ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeDocTab === 'features' ? 'var(--shadow-default)' : 'none' }}>
              Core Features & Tech
            </button>
            <button 
              onClick={() => setActiveDocTab('privacy')}
              style={{ textAlign: 'left', padding: '1rem 1.5rem', background: activeDocTab === 'privacy' ? 'var(--card-bg-solid)' : 'transparent', border: 'none', borderRadius: '1rem', color: activeDocTab === 'privacy' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeDocTab === 'privacy' ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeDocTab === 'privacy' ? 'var(--shadow-default)' : 'none' }}>
              Privacy & Security
            </button>
            <button 
              onClick={() => setActiveDocTab('advanced')}
              style={{ textAlign: 'left', padding: '1rem 1.5rem', background: activeDocTab === 'advanced' ? 'var(--card-bg-solid)' : 'transparent', border: 'none', borderRadius: '1rem', color: activeDocTab === 'advanced' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeDocTab === 'advanced' ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeDocTab === 'advanced' ? 'var(--shadow-default)' : 'none' }}>
              Prompts & Automations
            </button>
            <button 
              onClick={() => setActiveDocTab('troubleshooting')}
              style={{ textAlign: 'left', padding: '1rem 1.5rem', background: activeDocTab === 'troubleshooting' ? 'var(--card-bg-solid)' : 'transparent', border: 'none', borderRadius: '1rem', color: activeDocTab === 'troubleshooting' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeDocTab === 'troubleshooting' ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeDocTab === 'troubleshooting' ? 'var(--shadow-default)' : 'none' }}>
              Troubleshooting & FAQs
            </button>
            <button 
              onClick={() => setActiveDocTab('journey')}
              style={{ textAlign: 'left', padding: '1rem 1.5rem', background: activeDocTab === 'journey' ? 'var(--card-bg-solid)' : 'transparent', border: 'none', borderRadius: '1rem', color: activeDocTab === 'journey' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeDocTab === 'journey' ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeDocTab === 'journey' ? 'var(--shadow-default)' : 'none' }}>
              The Journey
            </button>
          </div>

          {/* Content Area */}
          <div className="doc-content" style={{ background: 'var(--card-bg)', borderRadius: '2rem', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-default)', backdropFilter: 'blur(24px) saturate(180%)', minHeight: '500px' }}>
            
            {activeDocTab === 'setup' && (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <h3 style={{ fontSize: '2rem', marginTop: 0, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>Installation & Setup Guide</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0, 122, 255, 0.1)', border: '1px solid rgba(0, 122, 255, 0.2)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem' }}>
                  <div style={{ fontSize: '2.5rem' }}>🚀</div>
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-blue)', fontSize: '1.1rem' }}>Quick Start</h4>
                    <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.5 }}>Everything you need to get Epi running on your machine, from system requirements to bypassing OS warnings.</p>
                  </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  Epi is distributed as a standalone desktop application. Because it relies heavily on native APIs, you must install the packaged app to get the full experience.
                </p>
                <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>1. System Requirements</h4>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
                  <li><strong>OS:</strong> Linux (AppImage/deb), Windows (exe/msi), or macOS (dmg).</li>
                  <li><strong>Memory:</strong> Minimum 8GB RAM (16GB recommended for local LLM inference).</li>
                  <li><strong>Storage:</strong> At least 10GB free space for models and audio libraries.</li>
                </ul>
                <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>2. Installing Dependencies</h4>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  You can initialize the isolated WhisperX environment directly from the Engine tab. Ensure your system allows background script execution. If you plan to use local LLMs, you must install <a href="https://ollama.com" target="_blank" rel="noreferrer" style={{color: 'var(--accent-blue)', textDecoration: 'none'}}>Ollama</a> separately and ensure it is running in the background.
                </p>
                <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>3. Handling Unsigned Binaries</h4>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  Version 1 is released using unsigned binaries, which may trigger security warnings on your operating system. Here is how to safely bypass them:
                </p>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
                  <li><strong>macOS:</strong> If you see an "unidentified developer" warning, right-click (or Control-click) the Epi application icon in Finder, and select <strong>Open</strong> from the context menu.</li>
                  <li><strong>Windows:</strong> If Microsoft Defender SmartScreen blocks the app, click <strong>More info</strong> and then click <strong>Run anyway</strong>.</li>
                  <li><strong>Linux (AppImage):</strong> Ensure the file is executable. You can do this in the terminal by running <code>chmod +x Epi_1.1.0_amd64.AppImage</code> before launching it.</li>
                </ul>
              </div>
            )}

            {activeDocTab === 'features' && (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <h3 style={{ fontSize: '2rem', marginTop: 0, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>Core Features & Technical Architecture</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(175, 82, 222, 0.1)', border: '1px solid rgba(175, 82, 222, 0.2)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem' }}>
                  <div style={{ fontSize: '2.5rem' }}>⚙️</div>
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-purple)', fontSize: '1.1rem' }}>Under the Hood</h4>
                    <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.5 }}>Explore the technical architecture, file storage locations, and AI configuration settings that power Epi's local intelligence.</p>
                  </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '2rem' }}>
                  Epi's backend is powered by <strong>Rust & Tauri v2</strong>, ensuring minimal resource overhead. The frontend is built in React 19.
                </p>

                <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>File Storage Locations</h4>
                <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--card-border)', marginBottom: '2rem' }}>
                  <ul className="break-words" style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--text-primary)', lineHeight: 1.8, fontFamily: 'monospace', fontSize: '0.9rem' }}>
                    <li><strong>Recordings:</strong> ~/Documents/Epi Library/Recordings/</li>
                    <li><strong>Transcriptions:</strong> ~/Documents/Epi Library/Transcriptions/</li>
                    <li><strong>Summaries:</strong> ~/Documents/Epi Library/Summaries/</li>
                    <li><strong>Database:</strong> {"{AppData}/epi_meta.db"} (SQLite)</li>
                    <li><strong>WhisperX:</strong> {"{AppData}/whisperx_env/"} (Python venv)</li>
                  </ul>
                </div>

                <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>Engine & Settings</h4>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
                  The <em>Engine tab</em> allows you to configure your pipeline:
                </p>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
                  <li><strong>AI Providers:</strong> Choose between local Ollama or cloud providers. API keys are stored securely.</li>
                </ul>
              </div>
            )}

            {activeDocTab === 'privacy' && (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <h3 style={{ fontSize: '2rem', marginTop: 0, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>Privacy & Data Security Guarantee</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(52, 199, 89, 0.1)', border: '1px solid rgba(52, 199, 89, 0.2)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem' }}>
                  <div style={{ fontSize: '2.5rem' }}>🔒</div>
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-green)', fontSize: '1.1rem' }}>Zero-Cloud Promise</h4>
                    <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.5 }}>By default, absolutely no data leaves your machine. Your audio recordings, transcripts, and generated summaries are processed locally.</p>
                  </div>
                </div>
                <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>Audio Capture</h4>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  Epi hooks directly into your system's audio output (e.g., PulseAudio monitor on Linux) and microphone input. The audio is piped through an isolated ffmpeg instance. No audio is ever sent to external transcription APIs unless you explicitly enable a Cloud Provider.
                </p>
                <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>Local AI Inference</h4>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  We utilize Ollama to perform summarization. You can completely disconnect your internet, and Epi will continue to function at 100% capability.
                </p>
              </div>
            )}

            {activeDocTab === 'advanced' && (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <h3 style={{ fontSize: '2rem', marginTop: 0, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>Custom Prompts & Automations</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255, 149, 0, 0.1)', border: '1px solid rgba(255, 149, 0, 0.2)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem' }}>
                  <div style={{ fontSize: '2.5rem' }}>🪄</div>
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-amber)', fontSize: '1.1rem' }}>Power User</h4>
                    <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.5 }}>Unlock Epi's full potential by configuring custom Ollama prompt templates, setting up automations, and leveraging context tags.</p>
                  </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '2rem' }}>
                  Epi isn't just a transcriber; it's a fully programmable meeting intelligence engine. You can define custom workflows.
                </p>
                <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>Prompt Templates</h4>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
                  You can design custom prompts for Ollama. A prompt template is defined with placeholders that Epi injects at runtime.
                </p>
                <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--card-border)', marginBottom: '2rem' }}>
                  <code style={{ color: 'var(--accent-blue)', display: 'block', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {`System: You are an expert technical project manager.
User: Please analyze the following meeting transcript and extract:
1. All architectural decisions made.
2. A bulleted list of action items with assignees.

Transcript:
{{TRANSCRIPT}}`}
                  </code>
                </div>
                <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>Automations</h4>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  Automations are time-based triggers. You can currently schedule automated transcriptions or default summarizations at specific times.
                </p>
                <h4 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>Tag Context Pulling</h4>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  Epi can automatically pull in past summaries that share the same tags as your current recording. This gives the AI historical context across multiple meetings, allowing it to track project progress, recall past decisions, and maintain continuity in its generated insights.
                </p>
              </div>
            )}

            {activeDocTab === 'troubleshooting' && (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <h3 style={{ fontSize: '2rem', marginTop: 0, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>Troubleshooting & FAQs</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255, 59, 48, 0.1)', border: '1px solid rgba(255, 59, 48, 0.2)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem' }}>
                  <div style={{ fontSize: '2.5rem' }}>🛠️</div>
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-red)', fontSize: '1.1rem' }}>Help & Support</h4>
                    <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.5 }}>Find solutions to common issues, including audio capture configuration and local LLM connectivity problems.</p>
                  </div>
                </div>
                
                <h4 style={{ fontSize: '1.1rem', marginTop: '2rem', marginBottom: '0.5rem' }}>Why is my recording failing instantly?</h4>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  This usually indicates `ffmpeg` cannot find the requested audio device. The user can check the ffmpeg log in the documents folder. Ensure you have proper permissions granted for microphone access.
                </p>

                <h4 style={{ fontSize: '1.1rem', marginTop: '2rem', marginBottom: '0.5rem' }}>Ollama fails to generate summaries.</h4>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  Epi connects to Ollama on `localhost:11434`. Make sure the Ollama daemon is running in the background.
                </p>
              </div>
            )}

            {activeDocTab === 'journey' && (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <h3 style={{ fontSize: '2rem', marginTop: 0, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>The Journey to Epi</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0, 122, 255, 0.1)', border: '1px solid rgba(0, 122, 255, 0.2)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem' }}>
                  <div style={{ fontSize: '2.5rem' }}>🗺️</div>
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-blue)', fontSize: '1.1rem' }}>The Origin Story</h4>
                    <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.5 }}>Learn how Epi evolved from a simple idea into a full-fledged local intelligence platform through multiple iterations.</p>
                  </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  Epi wasn't built in a day. It evolved from a simple need to a full-fledged local intelligence platform through multiple iterations:
                </p>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
                  <li style={{ marginBottom: '1rem' }}><strong>The Itch:</strong> It started because I wanted a simple tool that records my voice and lets me transcribe and write action points.</li>
                  <li style={{ marginBottom: '1rem' }}><strong>The Evolution:</strong> Then I wanted the tool to also record the audio from videos where I could add some context or questions by stopping the video and talking. Out of that I could create a summary of that video with my remarks.</li>
                  <li style={{ marginBottom: '1rem' }}><strong>The Prototype:</strong> The tool initially turned into a Python app with a Flet frontend that I had to start manually in the terminal.</li>
                  <li style={{ marginBottom: '1rem' }}><strong>The Final Form:</strong> After a lot of tinkering and changes, experimenting with different layouts and prototypes, I finally ended up with Epi—a polished, local-first desktop application.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '2rem 0',
        marginTop: '4rem',
        color: 'var(--text-secondary)',
        fontSize: '0.9rem',
        borderTop: '1px solid var(--card-border)',
        position: 'relative',
        zIndex: 10
      }}>
        © 2026 Eike Christian Karbe. Licensed under the{' '}
        <a 
          href="https://github.com/ekarbe/epi/blob/main/LICENSE.md" 
          target="_blank" 
          rel="noreferrer"
          style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}
        >
          GNU General Public License v3.0
        </a>.
      </footer>
    </div>
  );
}
