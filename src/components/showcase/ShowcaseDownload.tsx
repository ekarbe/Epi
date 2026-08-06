// Epi - Local-first Meeting Intelligence
// Copyright (C) 2026  Eike Christian Karbe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import { SupportedOS, DocTab } from './types';
import { Download, AlertTriangle, ShieldCheck, Terminal, Monitor } from 'lucide-react';

interface ShowcaseDownloadProps {
  selectedOS: SupportedOS;
  setSelectedOS: (os: SupportedOS) => void;
  setActiveDocTab: (tab: DocTab) => void;
}

export function ShowcaseDownload({ selectedOS, setSelectedOS, setActiveDocTab }: ShowcaseDownloadProps) {
  return (
    <section id="download" style={{ maxWidth: '1000px', margin: '8rem auto', padding: '0 2rem', position: 'relative', zIndex: 10 }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <span className="badge green" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', borderRadius: '2rem', background: 'rgba(39,201,63,0.1)', color: '#27c93f', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Download size={14} /> Get Epi v1.1.0
        </span>
        <h2 style={{ fontSize: '3rem', marginTop: '1.5rem', marginBottom: '1rem', letterSpacing: '-0.03em' }}>Download</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem', lineHeight: 1.6 }}>
          Ready to reclaim your meeting data? Download the latest release of Epi below.
        </p>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: '2rem', border: '1px solid var(--card-border)', padding: '3rem', boxShadow: 'var(--shadow-default)', backdropFilter: 'blur(24px) saturate(180%)', textAlign: 'center' }}>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <button 
            onClick={() => setSelectedOS('linux')}
            style={{ padding: '0.75rem 1.5rem', borderRadius: '1rem', border: selectedOS === 'linux' ? '2px solid var(--accent-blue)' : '1px solid var(--card-border)', background: selectedOS === 'linux' ? 'rgba(0, 122, 255, 0.1)' : 'transparent', color: selectedOS === 'linux' ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Terminal size={18} /> Linux
          </button>
          <button 
            onClick={() => setSelectedOS('windows')}
            style={{ padding: '0.75rem 1.5rem', borderRadius: '1rem', border: selectedOS === 'windows' ? '2px solid var(--accent-blue)' : '1px solid var(--card-border)', background: selectedOS === 'windows' ? 'rgba(0, 122, 255, 0.1)' : 'transparent', color: selectedOS === 'windows' ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Monitor size={18} /> Windows
          </button>
          <button 
            onClick={() => setSelectedOS('macos')}
            style={{ padding: '0.75rem 1.5rem', borderRadius: '1rem', border: selectedOS === 'macos' ? '2px solid var(--accent-blue)' : '1px solid var(--card-border)', background: selectedOS === 'macos' ? 'rgba(0, 122, 255, 0.1)' : 'transparent', color: selectedOS === 'macos' ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} /> macOS
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
            <div style={{ fontSize: '0.85rem', color: 'var(--accent-amber)', background: 'rgba(255,189,46,0.1)', padding: '1rem', borderRadius: '1rem', border: '1px solid rgba(255,189,46,0.2)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>macOS Audio Note:</strong> Native macOS security limits system output recording. Microphone capture works natively. To capture system speaker audio on macOS, install a virtual loopback driver such as BlackHole.
              </div>
            </div>
          )}
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(0, 122, 255, 0.1)', padding: '1rem', borderRadius: '1rem', border: '1px solid rgba(0, 122, 255, 0.2)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <ShieldCheck size={20} style={{ color: 'var(--accent-blue)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--accent-blue)' }}>Note on OS Security Warnings:</strong> Early release builds use unsigned binaries. If your OS displays an "unidentified developer" or SmartScreen warning when launching Epi, <a href="#documentation" onClick={() => setActiveDocTab('setup')} style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>learn how to safely bypass it in our setup guide.</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
