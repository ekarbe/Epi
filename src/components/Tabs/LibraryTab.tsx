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

import { useState, useEffect, useMemo } from 'react';
import { BentoCard } from '../DashboardGrid';
import { Library, Trash2, Edit2, Wand2, Search, X, Check } from 'lucide-react';
import { LibraryRecording, updateRecording, deleteRecordingDb, deleteTranscriptAndSummaryDb, updateRecordingTags } from '../../services/db';
import { useLibrarySettings } from '../../contexts/LibrarySettingsContext';
import { invoke } from '../../lib/api';
import { formatTimestamp } from '../../utils/date';
import { sanitizeFilename } from '../../utils/path';

const ITEMS_PER_PAGE = 5;

/**
 * LibraryTab Component
 * Renders the list of local recordings, allowing users to search, label, rename, delete,
 * analyze, or re-transcribe recordings.
 */
export function LibraryTab() {
  const { 
    recordings, 
    refreshLibrary, 
    loadRecordingIntoAnalysis, 
    triggerTranscription, 
    setActiveTab, 
    activeRecordingId, 
    transcribingIds,
    summarizingRecIds,
    transcriptionProvider,
    whisperXInstalled,
    installingWhisperX
  } = useLibrarySettings();
  const [loading, setLoading] = useState(true);

  // Search and Debounce states
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Inline edit states
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFilename, setEditFilename] = useState('');

  // Inline delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Pagination / Lazy rendering limit
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
    refreshLibrary().finally(() => setLoading(false));
  }, []);

  // Debounce search input changes by 200ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchInput);
      setVisibleCount(ITEMS_PER_PAGE); // Reset pagination on search change
    }, 200);
    return () => clearTimeout(handler);
  }, [searchInput]);

  /**
   * Deletes a recording from the local SQLite database and its associated assets from disk.
   * Handles filesystem deletions gracefully to prevent UI crashes if individual files are missing.
   */
  const handleDeleteOption = async (
    rec: LibraryRecording,
    option: 'everything' | 'audio' | 'transcript'
  ) => {
    try {
      if (option === 'everything') {
        // 1. Delete DB record
        await deleteRecordingDb(rec.id);
        
        if (activeRecordingId === rec.id) {
          await loadRecordingIntoAnalysis(null);
        }
        
        // 2. Delete files on disk using atomic Rust command
        await invoke('delete_recording_files', { filename: rec.filename });
      } else if (option === 'audio') {
        // Delete audio file only from disk using Rust command
        await invoke('delete_audio_file', { filename: rec.filename });
        
        // If it has no transcript, it has no files left -> delete entirely
        if (!rec.hasTranscript) {
          await deleteRecordingDb(rec.id);
          if (activeRecordingId === rec.id) {
            await loadRecordingIntoAnalysis(null);
          }
          await invoke('delete_recording_files', { filename: rec.filename });
        }
      } else if (option === 'transcript') {
        // Delete transcript and summary from DB
        await deleteTranscriptAndSummaryDb(rec.id);
        
        // Delete physical transcript/summary files using Rust command
        await invoke('delete_transcript_files', { filename: rec.filename });
        
        // If it has no audio, it has no files left -> delete entirely
        if (!rec.hasAudio) {
          await deleteRecordingDb(rec.id);
          if (activeRecordingId === rec.id) {
            await loadRecordingIntoAnalysis(null);
          }
          await invoke('delete_recording_files', { filename: rec.filename });
        } else {
          // Reset active analysis view if it's currently loaded
          if (activeRecordingId === rec.id) {
            await loadRecordingIntoAnalysis(rec.id);
          }
        }
      }

      // Refresh
      await refreshLibrary();
      setConfirmDeleteId(null);
    } catch (err) {
      console.error(`Failed to perform deletion (${option}):`, err);
      alert('Failed to perform deletion.');
    }
  };

  /**
   * Renames a recording, including its audio file and all associated transcripts/metadata files.
   * Optimistically updates UI state and rolls back on failure.
   */
  const handleSaveRename = async (rec: LibraryRecording) => {
    let targetNameRaw = editFilename.trim();
    targetNameRaw = sanitizeFilename(targetNameRaw);
    if (!targetNameRaw) {
      alert("Invalid filename: cannot consist solely of special characters.");
      setEditingId(null);
      return;
    }
    if (targetNameRaw === rec.filename) {
      setEditingId(null);
      return;
    }

    try {
      let targetName = targetNameRaw;
      const extMatch = rec.filename.match(/\.[^.]+$/);
      if (extMatch) {
        const ext = extMatch[0];
        if (!targetName.endsWith(ext)) {
          targetName += ext;
        }
      }
      
      if (targetName !== rec.filename) {
        // Perform atomic rename on the backend in Rust
        await invoke('rename_recording_files', { oldFilename: rec.filename, newFilename: targetName });

        try {
          await updateRecording(rec.id, targetName, rec.label);
        } catch (dbErr) {
          // Rollback: rename files back to their original names
          try {
            await invoke('rename_recording_files', { oldFilename: targetName, newFilename: rec.filename });
          } catch (rollbackErr) {
            console.error('Critical: Rollback failed after db rename error:', rollbackErr);
          }
          throw dbErr;
        }

        await refreshLibrary();
      }
    } catch (err: any) {
      console.error('Failed to rename file:', err);
      alert(`Failed to rename file: ${err.message || String(err)}`);
    } finally {
      setEditingId(null);
    }
  };



  const handleAddTag = async (rec: LibraryRecording, newTag: string) => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    const currentTags = rec.tags || [];
    if (currentTags.includes(trimmed)) return;
    
    try {
      await updateRecordingTags(rec.id, [...currentTags, trimmed]);
      await refreshLibrary();
    } catch (err: any) {
      console.error('Failed to add tag:', err);
    }
  };

  const handleRemoveTag = async (rec: LibraryRecording, tagToRemove: string) => {
    const currentTags = rec.tags || [];
    const newTags = currentTags.filter(t => t !== tagToRemove);
    try {
      await updateRecordingTags(rec.id, newTags);
      await refreshLibrary();
    } catch (err: any) {
      console.error('Failed to remove tag:', err);
    }
  };

  const handleAnalyze = async (rec: LibraryRecording) => {
    await loadRecordingIntoAnalysis(rec.id);
    setActiveTab('analysis');
  };

  const handleTranscribe = (rec: LibraryRecording) => {
    triggerTranscription(rec.id, rec.filename)
      .then(() => {
        refreshLibrary();
      })
      .catch(err => {
        console.error("Background transcription error:", err);
        refreshLibrary();
      });
  };

  // Compute search & filtering list
  const filteredRecordings = useMemo(() => {
    const q = debouncedSearchQuery.toLowerCase().trim();
    if (!q) return recordings;
    return recordings.filter(
      (rec) =>
        rec.filename.toLowerCase().includes(q) ||
        (rec.label && rec.label.toLowerCase().includes(q))
    );
  }, [recordings, debouncedSearchQuery]);

  // Slice list for pagination performance
  const paginatedRecordings = useMemo(() => {
    return filteredRecordings.slice(0, visibleCount);
  }, [filteredRecordings, visibleCount]);

  return (
    <>
      <BentoCard className="library-card" style={{ gridColumn: 'span 12' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card-title" style={{ margin: 0 }}>
            <Library />
            Recording Library
          </div>

          {/* Search Input Bar */}
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Search recordings or labels..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{
                paddingLeft: '2.5rem',
                paddingRight: searchInput ? '2.2rem' : '1rem',
                fontSize: '0.9rem',
                borderRadius: '1.5rem',
                height: '38px',
                paddingTop: 0,
                paddingBottom: 0,
              }}
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading library...</p>
        ) : filteredRecordings.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No recordings found. Go to the Studio tab to create one!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {paginatedRecordings.map((rec) => (
              <div key={rec.id} style={{
                background: 'var(--card-bg-solid)',
                border: '1px solid var(--card-border)',
                borderRadius: '1rem',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}>
                <div style={{ flex: 1 }}>
                  {editingId === rec.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input
                        type="text"
                        value={editFilename}
                        onChange={(e) => setEditFilename(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(rec);
                          else if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        style={{
                          fontSize: '1rem',
                          padding: '0.3rem 0.6rem',
                          height: 'auto',
                          width: '250px',
                          borderRadius: '0.5rem',
                        }}
                      />
                      <button
                        data-testid={`save-rename-btn`}
                        onClick={() => handleSaveRename(rec)}
                        style={{ background: 'var(--accent-green)', border: 'none', borderRadius: '0.4rem', color: 'white', padding: '0.35rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{ background: 'var(--card-border)', border: 'none', borderRadius: '0.4rem', color: 'var(--text-primary)', padding: '0.35rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{rec.filename.replace(/\.ogg$/i, '')}</h3>
                      <button
                        data-testid={`edit-btn-${rec.id}`}
                        onClick={() => {
                          setEditingId(rec.id);
                          setEditFilename(rec.filename.replace(/\.ogg$/i, ''));
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                      >
                        <Edit2 size={14} />
                      </button>
                      {rec.hasAudio === false && (
                        <span className="badge amber">Transcript Only</span>
                      )}
                      {transcribingIds.includes(rec.id) && (
                        <span className="badge amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem' }}>
                          <span className="spinner" style={{ display: 'inline-block', width: '10px', height: '10px', border: '1px solid rgba(255, 149, 0, 0.2)', borderTopColor: 'var(--accent-amber)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                          Transcribing...
                        </span>
                      )}
                      {summarizingRecIds.includes(rec.id) && (
                        <span className="badge purple" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple)' }}>
                          <span className="spinner" style={{ display: 'inline-block', width: '10px', height: '10px', border: '1px solid rgba(175, 82, 222, 0.2)', borderTopColor: 'var(--accent-purple)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                          Summarizing...
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', alignItems: 'center' }}>
                    <span>End Time: {formatTimestamp(rec.timestamp)}</span>
                    <span>{rec.duration}s</span>
                    

                    
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {(rec.tags || []).map(tag => (
                        <span key={tag} style={{ background: 'rgba(0,122,255,0.1)', color: 'var(--accent-blue)', padding: '0.2rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {tag}
                          <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveTag(rec, tag)} />
                        </span>
                      ))}
                      <input 
                        type="text"
                        placeholder="+ tag"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddTag(rec, (e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px dashed var(--card-border)',
                          borderRadius: '0.5rem',
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.75rem',
                          width: '60px',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <button 
                    className="btn-primary" 
                    onClick={() => handleAnalyze(rec)} 
                    style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                  >
                    Analyze
                  </button>
                  
                  <button 
                    className="btn-outline" 
                    onClick={() => handleTranscribe(rec)} 
                    disabled={
                      transcribingIds.includes(rec.id) || 
                      rec.hasAudio === false || 
                      (transcriptionProvider === 'local' && (!whisperXInstalled || installingWhisperX))
                    }
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.4rem', 
                      padding: '0.5rem 1rem',
                      fontSize: '0.9rem',
                      opacity: (transcribingIds.includes(rec.id) || rec.hasAudio === false || (transcriptionProvider === 'local' && (!whisperXInstalled || installingWhisperX))) ? 0.6 : 1,
                      cursor: (transcribingIds.includes(rec.id) || rec.hasAudio === false || (transcriptionProvider === 'local' && (!whisperXInstalled || installingWhisperX))) ? 'not-allowed' : 'pointer'
                    }}
                    title={rec.hasAudio === false ? "Audio file is missing" : undefined}
                  >
                    <Wand2 size={16} style={{ animation: transcribingIds.includes(rec.id) ? 'spin 1s linear infinite' : 'none' }} />
                    {transcribingIds.includes(rec.id) ? 'Transcribing...' : rec.hasTranscript ? 'Re-transcribe' : 'Transcribe'}
                  </button>
                  
                  {confirmDeleteId === rec.id ? (
                    <div style={{
                      position: 'absolute',
                      right: '1.25rem',
                      top: '100%',
                      marginTop: '0.25rem',
                      background: 'var(--card-bg-solid)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '1rem',
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                      zIndex: 50,
                      width: '260px',
                    }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', padding: '0.25rem 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delete Options</div>
                      
                      <button
                        onClick={() => handleDeleteOption(rec, 'everything')}
                        className="btn-outline"
                        style={{
                          color: 'var(--accent-red)',
                          borderColor: 'rgba(255, 59, 48, 0.2)',
                          background: 'rgba(255, 59, 48, 0.05)',
                          textAlign: 'left',
                          fontSize: '0.85rem',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.5rem',
                          width: '100%',
                          display: 'block'
                        }}
                      >
                        Delete Everything
                      </button>
                      
                      <button
                        onClick={() => handleDeleteOption(rec, 'audio')}
                        className="btn-outline"
                        disabled={rec.hasAudio === false}
                        style={{
                          textAlign: 'left',
                          fontSize: '0.85rem',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.5rem',
                          width: '100%',
                          display: 'block',
                          opacity: rec.hasAudio === false ? 0.4 : 1,
                          cursor: rec.hasAudio === false ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Delete Audio File Only
                      </button>
                      
                      <button
                        onClick={() => handleDeleteOption(rec, 'transcript')}
                        className="btn-outline"
                        disabled={rec.hasTranscript === false}
                        style={{
                          textAlign: 'left',
                          fontSize: '0.85rem',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.5rem',
                          width: '100%',
                          display: 'block',
                          opacity: rec.hasTranscript === false ? 0.4 : 1,
                          cursor: rec.hasTranscript === false ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Delete Transcript & Summary
                      </button>
                      
                      <div style={{ height: '1px', background: 'var(--card-border)', margin: '0.25rem 0' }}></div>
                      
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="btn-primary"
                        style={{
                          fontSize: '0.85rem',
                          padding: '0.5rem',
                          borderRadius: '0.5rem',
                          width: '100%',
                          display: 'block',
                          background: 'var(--card-border)',
                          color: 'var(--text-primary)'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      data-testid={`delete-btn-${rec.id}`}
                      onClick={() => setConfirmDeleteId(rec.id)}
                      style={{
                        background: 'rgba(255,59,48,0.1)',
                        border: 'none',
                        color: 'var(--accent-red)',
                        padding: '0.6rem',
                        borderRadius: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredRecordings.length > visibleCount && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button
              className="btn-outline"
              onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
              style={{ width: 'auto', padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}
            >
              Show More
            </button>
          </div>
        )}
      </BentoCard>
    </>
  );
}
