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
import { DocTab, SupportedOS } from './showcase/types';
import { ShowcaseHero } from './showcase/ShowcaseHero';
import { ShowcaseBento } from './showcase/ShowcaseBento';
import { ShowcaseDownload } from './showcase/ShowcaseDownload';
import { ShowcaseDocs } from './showcase/ShowcaseDocs';
import { Monitor, AlertTriangle } from 'lucide-react';

export function WebShowcase() {
  const [activeDocTab, setActiveDocTab] = useState<DocTab>('setup');
  const [selectedOS, setSelectedOS] = useState<SupportedOS>('linux');

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
      <ShowcaseHero />

      {/* Bento Grid Core Features */}
      <ShowcaseBento />

      {/* Interactive Demo Preview Window */}
      <section id="demo" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem', position: 'relative', zIndex: 10 }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span className="badge purple" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', borderRadius: '2rem' }}>
            Interactive Preview
          </span>
          <h2 style={{ fontSize: '3rem', marginTop: '1.5rem', marginBottom: '1rem', letterSpacing: '-0.03em' }}>
            Experience Epi
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto', fontSize: '1.1rem', lineHeight: 1.6 }}>
            Experience the real Epi interface right in your browser. Try recording a sample meeting and see how the AI summarizes it!
          </p>
          <div style={{ marginTop: '1.5rem', display: 'inline-block', background: 'rgba(255,189,46,0.1)', border: '1px solid rgba(255,189,46,0.3)', color: '#ffbd2e', padding: '0.75rem 1.25rem', borderRadius: '1rem', fontSize: '0.95rem', fontWeight: 500, maxWidth: '600px', textAlign: 'left' }}>
            <AlertTriangle size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.5rem' }} />
            <strong style={{ color: '#ffbd2e' }}>Mock Demo Only:</strong> All transcription, summarization, and AI features are completely simulated. This demo does not make any external network requests or connect to any local AI engines.
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
          transform: 'translateZ(0)'
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
          <Monitor size={48} style={{ marginBottom: '1rem', color: 'var(--accent-blue)' }} />
          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Desktop Experience</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Epi is a powerful desktop application. Please visit this showcase on a larger screen to experience the interactive live demo.
          </p>
        </div>
      </section>

      {/* Download Section */}
      <ShowcaseDownload 
        selectedOS={selectedOS}
        setSelectedOS={setSelectedOS}
        setActiveDocTab={setActiveDocTab}
      />

      {/* Documentation Section */}
      <ShowcaseDocs 
        activeDocTab={activeDocTab}
        setActiveDocTab={setActiveDocTab}
      />

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
