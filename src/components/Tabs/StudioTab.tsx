import { useActiveSession } from '../../contexts/SessionContext';
import { useLibrarySettings } from '../../contexts/LibrarySettingsContext';
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

import { useState, useMemo, useEffect } from 'react';
import { BentoCard } from '../DashboardGrid';
import { Mic, Settings2 } from 'lucide-react';
import { LibraryRecording } from '../../services/db';
import { formatTime, formatTimestamp } from '../../utils/date';

/**
 * StudioTab Component
 * Renders the core recording studio screen. Allows the user to select input and output
 * devices, toggle live transcription, specify labels, and control recording sessions.
 */
export function StudioTab() {
  const __lib = useLibrarySettings();
  const __sess = useActiveSession();
  const { 
    isRecording, 
    isRecordingTransitioning,
    recordingSeconds, 
    startRecording, 
    stopRecording, 
    recordingError,
    audioDevices,
    selectedAudioDevices,
    toggleAudioDevice,

    loadRecordingIntoAnalysis,
    setActiveTab,
    recordings,
    autoTranscribe,
    setAutoTranscribe
  } = { ...__lib, ...__sess };

  const recentRecordings = useMemo(() => {
    return recordings.slice(0, 3);
  }, [recordings]);

  const [showInputSources, setShowInputSources] = useState(false);
  const [showOutputSources, setShowOutputSources] = useState(false);
  const [recordingLabel, setRecordingLabel] = useState("");

  const inputs = useMemo(() => {
    return audioDevices.filter(d => d.is_input).sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));
  }, [audioDevices]);

  const outputs = useMemo(() => {
    return audioDevices.filter(d => d.is_output).sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));
  }, [audioDevices]);

  useEffect(() => {
    if (isRecording || isRecordingTransitioning) {
      setShowInputSources(false);
      setShowOutputSources(false);
    }
  }, [isRecording, isRecordingTransitioning]);


  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
      setRecordingLabel("");
    } else {
      startRecording(recordingLabel);
    }
  };

  return (
    <>
      <BentoCard className="studio-card" style={{ gridColumn: 'span 8', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h2 style={{ fontSize: '2rem', margin: 0 }}>Studio Recording</h2>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => { setShowInputSources(!showInputSources); setShowOutputSources(false); }}
                className="btn-outline" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
                disabled={isRecording || isRecordingTransitioning}
              >
                <Mic size={16} /> Select Inputs
              </button>
              
              {showInputSources && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  background: 'var(--card-bg-solid)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '1rem',
                  padding: '1rem',
                  width: '250px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                  zIndex: 10
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                    {inputs.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No inputs found</p>
                    ) : (
                      inputs.map((device, idx) => (
                        <label key={idx} className="source-item" style={{ fontSize: '0.85rem', padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: '0.5rem' }}>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            {device.name}
                          </span>
                          <input 
                            type="checkbox" 
                            className="custom-checkbox" 
                            checked={selectedAudioDevices.some((d: any) => d.name === device.name && d.is_input)}
                            onChange={() => toggleAudioDevice({ name: device.name, is_input: true, is_output: false })}
                          />
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => { setShowOutputSources(!showOutputSources); setShowInputSources(false); }}
                className="btn-outline" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
                disabled={isRecording || isRecordingTransitioning}
              >
                <Settings2 size={16} /> Select Outputs
              </button>
              
              {showOutputSources && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  background: 'var(--card-bg-solid)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '1rem',
                  padding: '1rem',
                  width: '250px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                  zIndex: 10
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                    {outputs.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No outputs found</p>
                    ) : (
                      outputs.map((device, idx) => (
                        <label key={idx} className="source-item" style={{ fontSize: '0.85rem', padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: '0.5rem' }}>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            {device.name}
                          </span>
                          <input 
                            type="checkbox" 
                            className="custom-checkbox" 
                            checked={selectedAudioDevices.some((d: any) => d.name === device.name && d.is_output)}
                            onChange={() => toggleAudioDevice({ name: device.name, is_input: false, is_output: true })}
                          />
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>


        
        {recordingError && (
          <div style={{ padding: '1rem', marginTop: '1rem', background: 'rgba(255, 59, 48, 0.1)', color: 'var(--accent-red)', borderRadius: '0.5rem', textAlign: 'center', border: '1px solid rgba(255, 59, 48, 0.2)' }}>
            <div style={{ marginBottom: recordingError.toLowerCase().includes('ffmpeg') ? '0.75rem' : '0' }}>{recordingError}</div>
            {recordingError.toLowerCase().includes('ffmpeg') && (
              <div>
                <button 
                  className="btn-primary" 
                  onClick={() => {
                    setActiveTab('engine');
                    setTimeout(() => {
                      const el = document.getElementById('ffmpeg-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                  style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}
                >
                  Install FFmpeg in Engine Tab
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3rem', margin: '3rem 0' }}>
          <button 
            className={`record-btn ${isRecording ? 'recording' : ''}`}
            onClick={toggleRecording}
            disabled={isRecordingTransitioning}
          >
            {isRecording ? <div style={{ width: '2rem', height: '2rem', backgroundColor: 'white', borderRadius: '4px' }}></div> : <Mic size={48} />}
          </button>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <p className={`time-display ${isRecording ? 'recording' : ''}`}>
                {formatTime(recordingSeconds)}
              </p>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '1.2rem' }}>
                {isRecording ? 'Recording in progress...' : 'Ready to record'}
              </p>
            </div>
            
            <input 
              type="text" 
              placeholder="Recording label (optional)" 
              value={recordingLabel} 
              onChange={(e) => setRecordingLabel(e.target.value)}
              disabled={isRecording || isRecordingTransitioning}
              className="config-input"
              style={{ width: '100%', maxWidth: '300px', fontSize: '1rem' }}
            />

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <input 
                type="checkbox" 
                checked={autoTranscribe} 
                onChange={e => setAutoTranscribe(e.target.checked)} 
                disabled={isRecording || isRecordingTransitioning}
              />
              Auto-transcribe after recording
            </label>
          </div>
        </div>

        {isRecording && (
          <div className="waveform">
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
          </div>
        )}
      </BentoCard>

      <BentoCard className="recent-card" style={{ gridColumn: 'span 4' }}>
        <div className="card-title">
          <Mic size={18} />
          Recent Recordings
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
          {recentRecordings.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No recent recordings</p>
          ) : (
            recentRecordings.map((rec: LibraryRecording) => (
              <div 
                key={rec.id} 
                onClick={() => {
                  loadRecordingIntoAnalysis(rec.id);
                  setActiveTab('analysis');
                }}
                style={{ 
                  padding: '1rem', 
                  background: 'var(--card-bg-solid)', 
                  border: '1px solid var(--card-border)', 
                  borderRadius: '0.75rem',
                  cursor: 'pointer'
                }}>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rec.filename.replace(/\.ogg$/i, '')}</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>{formatTimestamp(rec.timestamp, 'dateOnly')}</span>
                  <span>{rec.duration}s</span>
                </div>
              </div>
            ))
          )}
        </div>
      </BentoCard>


    </>
  );
}
