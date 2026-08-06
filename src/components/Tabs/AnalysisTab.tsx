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

import { BentoCard } from '../DashboardGrid';
import { Wand2 } from 'lucide-react';
import { useLibrarySettings, getTranscriptionProviderName, getLlmProviderName } from '../../contexts/LibrarySettingsContext';
import { useState, useEffect, useMemo } from 'react';
import { getRawRecordingById, updateRecordingTags, getPrompts, PromptTemplate, getTranscriptForRecording, getSummaryForTranscript, ensureTagExists, getTags, Tag } from '../../services/db';
import { documentDir, join, readFile, exists, stat, convertFileSrc, platform } from '../../lib/api';
import { TagAutocomplete } from '../TagAutocomplete';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { X } from 'lucide-react';

/**
 * AnalysisTab Component
 * Renders the recording player, interactive transcript editing panel, and AI-generated summary panel.
 */
export function AnalysisTab() {
  const { 
    activeTranscript, 
    diarized, 
    generateSummary, 
    activeSummary, 
    isSummarizing, 
    summaryError,
    isTranscribing,
    transcriptionError,
    activeRecordingId,
    triggerTranscription,
    transcriptionProvider,
    llmProvider,
    updateActiveTranscript,
    updateActiveSummary,
    recordings,
    refreshLibrary,
    intelligenceContextDepth,
    intelligenceContextFormat,
    whisperXInstalled,
    installingWhisperX,
  } = useLibrarySettings();

  const activeRecording = useMemo(() => {
    return recordings.find(r => r.id === activeRecordingId) || null;
  }, [recordings, activeRecordingId]);

  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [promptTemplate, setPromptTemplate] = useState('Please provide an executive summary and action items for:\n\n{{transcript}}');
  const [allTags, setAllTags] = useState<Tag[]>([]);
  
  useEffect(() => {
    getPrompts().then(p => {
      setPrompts(p);
      if (p.length > 0) {
        setPromptTemplate(p[0].templateText);
      }
    }).catch(console.error);
    getTags().then(setAllTags).catch(console.error);
  }, []);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Edit toggles and local fields
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState('');
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  const [isAudioMissing, setIsAudioMissing] = useState(false);
  const [isAudioTooLarge, setIsAudioTooLarge] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  const handleAddTag = async (tagToSave: string) => {
    if (!activeRecording) return;
    const trimmed = tagToSave.trim();
    if (!trimmed) return;
    const currentTags = activeRecording.tags || [];
    if (currentTags.includes(trimmed)) return;
    
    try {
      await ensureTagExists(trimmed);
      await updateRecordingTags(activeRecording.id, [...currentTags, trimmed]);
      refreshLibrary();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!activeRecording) return;
    const currentTags = activeRecording.tags || [];
    const newTags = currentTags.filter(t => t !== tagToRemove);
    try {
      await updateRecordingTags(activeRecording.id, newTags);
      refreshLibrary();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    let active = true;
    setIsEditingTranscript(false);
    setIsEditingSummary(false);
    if (active) {
      setIsAudioMissing(false);
      setIsAudioTooLarge(false);
    }
    
    let currentBlobUrl: string | null = null;
    
    if (activeRecordingId) {
      const loadAudio = async () => {
        try {
          const rec = await getRawRecordingById(activeRecordingId);
          if (!active) return;
          if (rec) {
            const docsDir = await documentDir();
            if (!active) return;
            const filePath = await join(docsDir, 'Epi Library', 'Recordings', rec.filename);
            if (!active) return;
            
            const fileExists = await exists(filePath);
            if (!fileExists) {
              if (active) {
                setAudioUrl(null);
                setIsAudioMissing(true);
              }
              return;
            }

            const currentOs = platform();
            let url: string;
            if (currentOs === 'linux') {
              // Get file size using stat to prevent memory/heap crash on large files
              try {
                const fileInfo = await stat(filePath);
                if (fileInfo.size > 50 * 1024 * 1024) {
                  if (active) {
                    setIsAudioTooLarge(true);
                    setAudioUrl(null);
                  }
                  return;
                }
              } catch (statErr) {
                console.warn("Failed to get file stats:", statErr);
              }

              // Read file bytes directly on Linux to work around WebKitGTK / GStreamer asset protocol issues
              const fileBytes = await readFile(filePath);
              if (!active) return;
              
              const blob = new Blob([fileBytes], { type: 'audio/wav' });
              const blobUrl = URL.createObjectURL(blob);
              currentBlobUrl = blobUrl;
              url = blobUrl;
            } else {
              url = convertFileSrc(filePath);
            }
            
            setAudioUrl(url);
            if (active) setIsAudioMissing(false);
          } else {
            if (active) {
              setAudioUrl(null);
              setIsAudioMissing(false);
            }
          }
        } catch (err) {
          console.error("Failed to resolve audio path:", err);
          if (active) {
            setAudioUrl(null);
            setIsAudioMissing(true);
          }
        }
      };
      loadAudio();
    } else {
      setAudioUrl(null);
      setIsAudioMissing(false);
    }
    
    return () => {
      active = false;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [activeRecordingId]);

  /**
   * Parses raw transcript text into formatted blocks containing speakers.
   * Memoized to prevent heavy re-parsing when unrelated UI updates occur.
   */
  const parsedLines = useMemo(() => {
    if (!activeTranscript) return [];
    return activeTranscript
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line, idx) => {
        const defaultIsA = idx % 2 === 0;
        let speakerLabel = defaultIsA ? 'Speaker 1' : 'Speaker 2';
        let bubbleText = line;
        let speakerKey = defaultIsA ? 'a' : 'b';

        const match = line.match(/^\[([^\]]+)\]\s*(.*)$/);
        if (match) {
          const rawSpeaker = match[1];
          bubbleText = match[2];
          if (rawSpeaker.toUpperCase().startsWith('SPEAKER_')) {
            const parsedNum = parseInt(rawSpeaker.split('_')[1]);
            const num = isNaN(parsedNum) ? 1 : parsedNum + 1;
            speakerLabel = `Speaker ${num}`;
            speakerKey = num % 2 === 1 ? 'a' : 'b';
          } else {
            speakerLabel = rawSpeaker;
            speakerKey = rawSpeaker.toLowerCase().includes('1') ? 'a' : 'b';
          }
        } else if (!diarized) {
          // If undiarized, drop the false alternating labels
          speakerLabel = '';
          speakerKey = 'neutral';
        }

        return {
          key: `${idx}-${line.substring(0, 10)}`,
          speakerLabel,
          bubbleText,
          speakerKey,
        };
      });
  }, [activeTranscript, diarized]);

  const renderTranscript = () => {
    if (transcriptionError) {
      let friendlyMsg = transcriptionError;
      let rawMsg = '';
      if (transcriptionError.includes('__RAW_ERROR__')) {
        const parts = transcriptionError.split('__RAW_ERROR__');
        friendlyMsg = parts[0].trim();
        rawMsg = parts.slice(1).join('__RAW_ERROR__').trim();
      }

      return (
        <div style={{ padding: '1rem', background: 'rgba(255, 59, 48, 0.1)', color: 'var(--accent-red)', border: '1px solid rgba(255, 59, 48, 0.2)', borderRadius: '0.75rem', marginBottom: '1rem' }}>
          <strong style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Transcription Error</strong>
          <div style={{ marginBottom: rawMsg ? '1rem' : 0 }}>{friendlyMsg}</div>
          {rawMsg && (
            <details style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '0.5rem', marginTop: '0.5rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', opacity: 0.9 }}>View Raw Error</summary>
              <pre style={{ marginTop: '0.75rem', fontSize: '0.75rem', whiteSpace: 'pre-wrap', overflowX: 'auto', fontFamily: 'monospace', opacity: 0.8 }}>
                {rawMsg}
              </pre>
            </details>
          )}
        </div>
      );
    }

    if (isTranscribing) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent-blue)', fontStyle: 'italic', padding: '1rem 0' }}>
          <span className="spinner" style={{
            display: 'inline-block',
            width: '18px',
            height: '18px',
            border: '2px solid rgba(0, 122, 255, 0.2)',
            borderTopColor: 'var(--accent-blue)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></span>
          <span>Transcribing with {getTranscriptionProviderName(transcriptionProvider)}...</span>
        </div>
      );
    }

    if (!activeTranscript) {
      return <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No transcript available yet. Transcribe the audio first!</p>;
    }

    if (isEditingTranscript) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <textarea
            className="config-input"
            style={{ width: '100%', minHeight: '300px', resize: 'vertical', fontFamily: 'monospace', lineHeight: '1.5' }}
            value={editedTranscript}
            onChange={(e) => setEditedTranscript(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              className="btn-primary"
              style={{ width: 'auto', padding: '0.5rem 1.5rem' }}
              onClick={async () => {
                try {
                  await updateActiveTranscript(editedTranscript);
                  setIsEditingTranscript(false);
                } catch (err: any) {
                  console.error("Failed to save transcript:", err);
                  alert("Failed to save transcript: " + (err.message || String(err)));
                }
              }}
            >
              Save Changes
            </button>
            <button
              className="btn-outline"
              style={{ width: 'auto', padding: '0.5rem 1.5rem' }}
              onClick={() => setIsEditingTranscript(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="chat-container">
        {parsedLines.map((line) => (
          <div key={line.key} style={{ marginBottom: '1rem' }}>
            {line.speakerLabel && (
              <div className={`speaker-label ${line.speakerKey}`}>{line.speakerLabel}</div>
            )}
            <div className={`chat-bubble speaker-${line.speakerKey}`}>
              {line.bubbleText}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {activeRecording && (
        <BentoCard 
          style={{ 
            gridColumn: '1 / -1', 
            padding: '1.25rem 2.5rem', 
            display: 'flex', 
            alignItems: 'center',
            borderRadius: '1.5rem',
            background: 'var(--card-bg)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.95rem', color: 'var(--text-secondary)', flexWrap: 'wrap', width: '100%' }}>
            <span style={{ 
              display: 'inline-block', 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: isTranscribing ? 'var(--accent-amber)' : isSummarizing ? 'var(--accent-purple)' : 'var(--accent-blue)',
              boxShadow: isTranscribing ? '0 0 10px var(--accent-amber)' : isSummarizing ? '0 0 10px var(--accent-purple)' : '0 0 6px var(--accent-blue)',
              animation: (isTranscribing || isSummarizing) ? 'pulse 1.5s infinite ease-in-out' : 'none'
            }} />
            <span style={{ fontWeight: 500 }}>Analyzing:</span>
            <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '1.05rem', letterSpacing: '-0.01em' }}>{activeRecording.filename.replace(/\.ogg$/i, '')}</strong>
            {isTranscribing && (
              <span className="badge amber" style={{ marginLeft: '0.5rem' }}>
                Transcribing...
              </span>
            )}
            {isSummarizing && (
              <span className="badge purple" style={{ marginLeft: '0.5rem', background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple)' }}>
                Summarizing...
              </span>
            )}
          </div>
        </BentoCard>
      )}

      <BentoCard className="transcription-card" style={{ gridColumn: 'span 8', maxHeight: '600px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.8rem', margin: 0 }}>Transcription</h2>
          {activeRecordingId && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {activeTranscript && !isTranscribing && (
                <button 
                  className="btn-outline" 
                  style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                  onClick={() => {
                    setEditedTranscript(activeTranscript);
                    setIsEditingTranscript(!isEditingTranscript);
                  }}
                >
                  {isEditingTranscript ? 'Cancel' : 'Edit'}
                </button>
              )}
                <button 
                className="btn-outline" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.4rem', 
                  fontSize: '0.8rem', 
                  padding: '0.3rem 0.6rem',
                  opacity: (isTranscribing || activeRecording?.hasAudio === false || isAudioMissing || (transcriptionProvider === 'local' && (!whisperXInstalled || installingWhisperX))) ? 0.5 : 1,
                  cursor: (isTranscribing || activeRecording?.hasAudio === false || isAudioMissing || (transcriptionProvider === 'local' && (!whisperXInstalled || installingWhisperX))) ? 'not-allowed' : 'pointer'
                }}
                onClick={async () => {
                  if (activeRecordingId) {
                    const rec = await getRawRecordingById(activeRecordingId);
                    if (rec) {
                      triggerTranscription(activeRecordingId, rec.filename);
                    }
                  }
                }}
                disabled={isTranscribing || activeRecording?.hasAudio === false || isAudioMissing || (transcriptionProvider === 'local' && (!whisperXInstalled || installingWhisperX))}
                title={
                  isAudioMissing 
                    ? "Audio file is missing from local library" 
                    : activeRecording?.hasAudio === false 
                      ? "Audio file is missing" 
                      : (transcriptionProvider === 'local' && (!whisperXInstalled || installingWhisperX))
                        ? "WhisperX is not fully installed yet"
                        : undefined
                }
              >
                <Wand2 size={14} /> {activeTranscript ? 'Re-transcribe' : 'Transcribe'}
              </button>
              {activeTranscript && <span className="badge purple">{diarized ? 'Diarized' : 'Raw Text'}</span>}
            </div>
          )}
        </div>

        {isAudioMissing && (
          <div style={{ 
            padding: '1rem', 
            background: 'rgba(255, 69, 58, 0.1)', 
            border: '1px solid rgba(255, 69, 58, 0.2)', 
            borderRadius: '0.75rem', 
            color: 'var(--accent-red)',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            lineHeight: '1.4'
          }}>
            <strong>Audio source file not found:</strong> The original recording WAV file is missing or has been deleted from your Documents directory. You can still view or edit the transcript, but audio playback and transcription services are disabled.
          </div>
        )}

        {isAudioTooLarge && (
          <div style={{ 
            padding: '1rem', 
            background: 'rgba(255, 159, 10, 0.1)', 
            border: '1px solid rgba(255, 159, 10, 0.2)', 
            borderRadius: '0.75rem', 
            color: 'var(--accent-orange, #ff9f0a)',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            lineHeight: '1.4'
          }}>
            <strong>Audio playback disabled:</strong> This recording is larger than 50MB. Playback is disabled on Linux to prevent memory exhaustion in WebKitGTK. You can still play this file using your system's external media player.
          </div>
        )}

        {audioUrl && (
          <div style={{ marginBottom: '1.5rem', width: '100%' }}>
            <audio controls src={audioUrl} style={{ width: '100%', outline: 'none' }} />
          </div>
        )}

        {renderTranscript()}
      </BentoCard>

      <BentoCard className="intelligence-card" style={{ gridColumn: 'span 4' }}>
        <div className="card-title">
          <Wand2 />
          Intelligence
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Context Groups (Tags)</h4>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {activeRecording?.tags?.map(tag => (
              <span key={tag} className="tag" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {tag}
                <X size={12} style={{ cursor: 'pointer' }} onClick={async () => {
                  await handleRemoveTag(tag);
                }} />
              </span>
            ))}
            <TagAutocomplete 
              availableTags={allTags.map(t => t.name)}
              onAdd={handleAddTag}
              placeholder="+ Add Tag"
              className="config-input"
              style={{
                background: 'transparent',
                border: '1px dashed var(--card-border)',
                borderRadius: '0.5rem',
                padding: '0.2rem 0.5rem',
                fontSize: '0.8rem',
                width: '100px',
                color: 'var(--text-primary)'
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Prompt Template</h4>
          <select 
            className="config-input"
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
          >
            {prompts.map(p => (
              <option key={p.id} value={p.templateText}>{p.title}</option>
            ))}
          </select>
        </div>

        <button 
          className="btn-primary" 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: activeTranscript ? 'white' : 'var(--card-bg)', color: activeTranscript ? 'black' : 'var(--text-secondary)', opacity: activeTranscript ? 1 : 0.5, cursor: activeTranscript ? 'pointer' : 'not-allowed' }}
          onClick={async () => {
            const tags = activeRecording?.tags || [];
            let fullPrompt = promptTemplate;
            
            let relatedContextBlock = '';
            if (tags.length > 0 && intelligenceContextDepth > 0) {
              const relatedRecordingIds = new Set<number>();
              
              for (const tag of tags) {
                const matches = recordings
                  .filter(r => r.id !== activeRecordingId && r.tags && r.tags.includes(tag))
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .slice(0, intelligenceContextDepth);
                  
                for (const match of matches) {
                  relatedRecordingIds.add(match.id);
                }
              }

              if (relatedRecordingIds.size > 0) {
                for (const recId of relatedRecordingIds) {
                  const rec = recordings.find(r => r.id === recId);
                  const t = await getTranscriptForRecording(recId);
                  if (t) {
                    let contentToAppend = '';
                    if (intelligenceContextFormat === 'summaries') {
                      const s = await getSummaryForTranscript(t.id);
                      if (s && s.summaryText) {
                        contentToAppend = s.summaryText;
                      }
                    } else {
                      // Only use a snippet of the transcript if format is 'transcripts' to avoid blowing up context
                      contentToAppend = t.textContent.length > 2000 ? t.textContent.substring(0, 2000) + '... (truncated)' : t.textContent;
                    }
                    
                    if (contentToAppend) {
                      relatedContextBlock += `[Recording: ${rec?.label || rec?.filename}]\n${contentToAppend}\n\n`;
                    }
                  }
                }
              }
            }
            generateSummary(promptTemplate, relatedContextBlock);
          }}
          disabled={!activeTranscript || isSummarizing}
        >
          <Wand2 size={18} />
          {isSummarizing ? 'Generating...' : 'Generate Summary'}
        </button>
      </BentoCard>

      <BentoCard className="summary-card" style={{ gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.8rem', margin: 0 }}>Generated Summary</h2>
          {activeSummary && !isSummarizing && (
            <button
              className="btn-outline"
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
              onClick={() => {
                setEditedSummary(activeSummary);
                setIsEditingSummary(!isEditingSummary);
              }}
            >
              {isEditingSummary ? 'Cancel' : 'Edit'}
            </button>
          )}
        </div>
        <div style={{ 
          background: 'var(--card-bg-solid)', 
          padding: '2rem', 
          borderRadius: '1rem', 
          lineHeight: '1.6'
        }}>
          {summaryError ? (
            <p style={{ color: 'var(--accent-red)' }}>{summaryError}</p>
          ) : isSummarizing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent-blue)', fontStyle: 'italic' }}>
              <span className="spinner" style={{
                display: 'inline-block',
                width: '18px',
                height: '18px',
                border: '2px solid rgba(0, 122, 255, 0.2)',
                borderTopColor: 'var(--accent-blue)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></span>
              <span>Summarizing transcript with {getLlmProviderName(llmProvider)}...</span>
            </div>
          ) : isEditingSummary ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <textarea
                className="config-input"
                style={{ width: '100%', minHeight: '300px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6' }}
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  className="btn-primary"
                  style={{ width: 'auto', padding: '0.5rem 1.5rem' }}
                  onClick={async () => {
                    try {
                      await updateActiveSummary(editedSummary);
                      setIsEditingSummary(false);
                    } catch (err: any) {
                      console.error("Failed to save summary:", err);
                      alert("Failed to save summary: " + (err.message || String(err)));
                    }
                  }}
                >
                  Save Summary
                </button>
                <button
                  className="btn-outline"
                  style={{ width: 'auto', padding: '0.5rem 1.5rem' }}
                  onClick={() => setIsEditingSummary(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : activeSummary ? (
            <MarkdownRenderer content={activeSummary} />
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              Generate a summary to see it here...
            </p>
          )}
        </div>
      </BentoCard>
    </>
  );
}
