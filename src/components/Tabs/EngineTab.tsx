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
import { HardDrive, Cpu, Trash2, RefreshCw, Eye, EyeOff, Edit3 } from 'lucide-react';
import { useLibrarySettings } from '../../contexts/LibrarySettingsContext';
import { useEffect, useState, useRef } from 'react';
import { getStats, getRecordingsOlderThan30Days, deleteRecordingDb, getAutomations, createAutomation, deleteAutomation, Automation, getPrompts, createPrompt, updatePrompt, deletePrompt, PromptTemplate } from '../../services/db';
import { getAvailableModels } from '../../services/ollama';
import { invoke } from '../../lib/api';

/**
 * List of local WhisperX models supported by the application.
 */
const WHISPER_MODELS = ['tiny', 'base', 'small', 'medium', 'large-v2', 'large-v3'];

/**
 * Formats a byte size into a human-readable string.
 * Extracted outside the component to prevent re-instantiation on every render.
 */
const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

interface SettingInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onSave: (v: string) => void;
}

/**
 * A generic text/string setting input that manages its own local state.
 * Commits changes to the global context state only on blur or when the Enter key is pressed.
 * This prevents massive, sluggish application re-renders on every keystroke.
 */
function SettingInput({ value, onSave, type = 'text', ...props }: SettingInputProps) {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  const handleBlur = () => {
    if (localVal !== value) {
      onSave(localVal);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
  };

  return (
    <input
      type={type}
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

interface PasswordSettingInputProps extends Omit<SettingInputProps, 'type'> {}

/**
 * An API key/password setting input that supports toggleable visibility (Eye/EyeOff icons).
 * Commits changes on blur or Enter, ensuring credentials aren't written to disk/store continuously.
 */
function PasswordSettingInput({ value, onSave, ...props }: PasswordSettingInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
      <SettingInput
        type={show ? 'text' : 'password'}
        value={value}
        onSave={onSave}
        style={{ paddingRight: '2.5rem', width: '100%' }}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        style={{
          position: 'absolute',
          right: '0.75rem',
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
        title={show ? 'Hide Secret' : 'Show Secret'}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

interface SettingNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onSave: (v: number) => void;
}

/**
 * A numeric setting input that handles local state, validates input, and updates context on blur/Enter.
 */
function SettingNumberInput({ value, onSave, min, max, step, ...props }: SettingNumberInputProps) {
  const [localVal, setLocalVal] = useState<string>(String(value));

  useEffect(() => {
    setLocalVal(String(value));
  }, [value]);

  const handleBlur = () => {
    let parsed = parseFloat(localVal);
    if (!isNaN(parsed)) {
      if (min !== undefined && parsed < Number(min)) {
        parsed = Number(min);
      }
      if (max !== undefined && parsed > Number(max)) {
        parsed = Number(max);
      }
      if (parsed !== value) {
        onSave(parsed);
        setLocalVal(String(parsed));
      } else {
        setLocalVal(String(value));
      }
    } else {
      setLocalVal(String(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
  };

  return (
    <input
      type="number"
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      min={min}
      max={max}
      step={step}
      {...props}
    />
  );
}

interface SettingTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onSave: (v: string) => void;
}

/**
 * A textarea configuration component that updates state on blur.
 */
function SettingTextarea({ value, onSave, ...props }: SettingTextareaProps) {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  const handleBlur = () => {
    if (localVal !== value) {
      onSave(localVal);
    }
  };

  return (
    <textarea
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={handleBlur}
      {...props}
    />
  );
}

interface SettingRangeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onSave: (v: number) => void;
  min: number;
  max: number;
  step: number;
  labelPrefix: string;
}

/**
 * A range/slider input that displays real-time dragging values in its label,
 * but only commits changes (saving to context/store) when mouse or touch action is released.
 */
function SettingRangeInput({ value, onSave, min, max, step, labelPrefix, ...props }: SettingRangeInputProps) {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalVal(parseFloat(e.target.value));
  };

  const handleCommit = () => {
    if (localVal !== value) {
      onSave(localVal);
    }
  };

  return (
    <div className="form-group" style={{ flex: '1 1 45%' }}>
      <label className="form-label">{labelPrefix}: {localVal}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={localVal}
        onChange={handleChange}
        onMouseUp={handleCommit}
        onTouchEnd={handleCommit}
        style={{ width: '100%' }}
        {...props}
      />
    </div>
  );
}

/**
 * The primary tab view representing settings, engine setups, models downloads,
 * cleanups, automation configuration, and system parameters management.
 */
export function EngineTab() {
  const { 
    ollamaUrl, setOllamaUrl, ollamaModel, setOllamaModel,
    whisperXInstalled, installingWhisperX, whisperXLogs, installWhisperX, uninstallWhisperX,
    whisperXModel, setWhisperXModel, whisperXLanguage, setWhisperXLanguage,
    whisperXPrompt, setWhisperXPrompt, whisperXTemperature, setWhisperXTemperature,
    transcriptionProvider, setTranscriptionProvider, apiKeys, setApiKey,
    llmProvider, setLlmProvider, autoTranscribe, setAutoTranscribe,
    whisperXDevice, setWhisperXDevice, whisperXComputeType, setWhisperXComputeType,
    whisperXBatchSize, setWhisperXBatchSize, whisperXDiarize, setWhisperXDiarize,
    ffmpegStatus, installingFfmpeg, ffmpegLogs, installFfmpeg, uninstallFfmpeg,
    whisperXHfToken, setWhisperXHfToken, whisperXMinSpeakers, setWhisperXMinSpeakers,
    whisperXMaxSpeakers, setWhisperXMaxSpeakers,
    openaiTranscriptionModel, setOpenaiTranscriptionModel,
    googleTranscriptionModel, setGoogleTranscriptionModel,
    assemblyTranscriptionModel, setAssemblyTranscriptionModel,
    openaiLlmModel, setOpenaiLlmModel,
    anthropicLlmModel, setAnthropicLlmModel,
    googleLlmModel, setGoogleLlmModel,
    ollamaTemperature, setOllamaTemperature,
    ollamaNumCtx, setOllamaNumCtx,
    ollamaTopP, setOllamaTopP,
    ollamaTopK, setOllamaTopK,
    ollamaSystemPrompt, setOllamaSystemPrompt,
    intelligenceContextDepth, setIntelligenceContextDepth,
    intelligenceContextFormat, setIntelligenceContextFormat,
    enableLogs, setEnableLogs,
    activeRecordingId,
    loadRecordingIntoAnalysis,
  } = useLibrarySettings();

  const [stats, setStats] = useState({ recordingsCount: 0, transcriptsCount: 0 });
  const [availableOllamaModels, setAvailableOllamaModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [cpuOnlyInstall, setCpuOnlyInstall] = useState(false);
  const [downloadedWhisperModels, setDownloadedWhisperModels] = useState<string[]>([]);
  const [downloadingWhisperModel, setDownloadingWhisperModel] = useState<string | null>(null);
  interface StorageBreakdown {
    recordings: number;
    transcriptions: number;
    summaries: number;
    logs: number;
    total: number;
  }
  const [storageBreakdown, setStorageBreakdown] = useState<StorageBreakdown>({ recordings: 0, transcriptions: 0, summaries: 0, logs: 0, total: 0 });
  const [whisperModelError, setWhisperModelError] = useState<string | null>(null);

  const [confirmationModal, setConfirmationModal] = useState<{
    title: string;
    message: string;
    actionLabel: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const [alertModal, setAlertModal] = useState<{
    title: string;
    message: string;
    isError?: boolean;
  } | null>(null);

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [showAutomationForm, setShowAutomationForm] = useState(false);
  const [newAutoName, setNewAutoName] = useState('');
  const [newAutoTime, setNewAutoTime] = useState('02:00');
  const [newAutoTimerange, setNewAutoTimerange] = useState(24);
  const [newAutoAction, setNewAutoAction] = useState('summarize');

  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [showPromptForm, setShowPromptForm] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<number | null>(null);
  const [promptTitle, setPromptTitle] = useState('');
  const [promptText, setPromptText] = useState('');

  const promptFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showPromptForm && promptFormRef.current) {
      setTimeout(() => {
        promptFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }, [showPromptForm, editingPromptId]);

  const refreshPrompts = () => {
    getPrompts().then(setPrompts).catch(console.error);
  };

  const handleSavePrompt = async () => {
    if (!promptTitle.trim() || !promptText.trim()) return;
    try {
      if (editingPromptId) {
        await updatePrompt(editingPromptId, promptTitle, promptText);
      } else {
        await createPrompt(promptTitle, promptText);
      }
      setPromptTitle('');
      setPromptText('');
      setEditingPromptId(null);
      setShowPromptForm(false);
      refreshPrompts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePrompt = async (id: number) => {
    setConfirmationModal({
      title: "Delete Template",
      message: "Are you sure you want to delete this prompt template?",
      actionLabel: "Delete",
      isDestructive: true,
      onConfirm: async () => {
        setConfirmationModal(null);
        try {
          await deletePrompt(id);
          refreshPrompts();
        } catch (err) {
          console.error(err);
          setAlertModal({ title: "Error", message: "Failed to delete template.", isError: true });
        }
      }
    });
  };

  const refreshAutomations = () => {
    getAutomations().then(setAutomations).catch(console.error);
  };

  const handleCreateAutomation = async () => {
    if (!newAutoName.trim()) return;
    try {
      await createAutomation(newAutoName, newAutoTime, newAutoTimerange, newAutoAction);
      setNewAutoName('');
      setShowAutomationForm(false);
      refreshAutomations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAutomation = async (id: number) => {
    try {
      await deleteAutomation(id);
      refreshAutomations();
    } catch (err) {
      console.error(err);
    }
  };

  const refreshWhisperModels = () => {
    invoke<string[]>('get_downloaded_models').then(setDownloadedWhisperModels).catch(console.error);
  };

  const refreshLibrarySize = () => {
    invoke<StorageBreakdown>('get_storage_breakdown').then(setStorageBreakdown).catch(console.error);
  };

  const handleDownloadWhisperModel = async (modelName: string) => {
    setDownloadingWhisperModel(modelName);
    setWhisperModelError(null);
    try {
      await invoke('download_model', { model: modelName });
      refreshWhisperModels();
    } catch (err: any) {
      console.error('Failed to download Whisper model:', err);
      setWhisperModelError(`Failed to download ${modelName}: ${err.message || String(err)}`);
    } finally {
      setDownloadingWhisperModel(null);
    }
  };

  const handleDeleteWhisperModel = async (modelName: string) => {
    setWhisperModelError(null);
    try {
      await invoke('delete_model', { model: modelName });
      refreshWhisperModels();
      if (whisperXModel === modelName) {
        setWhisperXModel('base'); // fallback to base
      }
    } catch (err: any) {
      console.error('Failed to delete Whisper model:', err);
      setWhisperModelError(`Failed to delete ${modelName}: ${err.message || String(err)}`);
    }
  };

  const handleCleanup = async () => {
    try {
      const oldRecs = await getRecordingsOlderThan30Days();
      if (oldRecs.length === 0) {
        setAlertModal({ title: "Clean Up", message: "No recordings older than 30 days found." });
        return;
      }
      
      setConfirmationModal({
        title: "Confirm Cleanup",
        message: `Found ${oldRecs.length} recordings older than 30 days. Are you sure you want to clean them up? This cannot be undone.`,
        actionLabel: "Delete Recordings",
        isDestructive: true,
        onConfirm: async () => {
          setConfirmationModal(null);
          try {
            for (const rec of oldRecs) {
              // 1. Delete DB record
              await deleteRecordingDb(rec.id);
              
              if (activeRecordingId === rec.id) {
                await loadRecordingIntoAnalysis(null);
              }
              
              // 2. Delete files on disk using atomic Rust command
              await invoke('delete_recording_files', { filename: rec.filename });
            }
            getStats().then(setStats).catch(console.error);
            refreshLibrarySize();
          } catch (err) {
            console.error("Failed to run cleanup:", err);
            setAlertModal({ title: "Cleanup Error", message: "Error running cleanup. Please check logs.", isError: true });
          }
        }
      });
    } catch (err) {
      console.error("Failed to fetch old recordings:", err);
      setAlertModal({ title: "Error", message: "Failed to find old recordings.", isError: true });
    }
  };

  const refreshModels = () => {
    setIsFetchingModels(true);
    getAvailableModels(ollamaUrl).then(models => {
      setAvailableOllamaModels(models);
      if (models.length > 0 && !models.includes(ollamaModel)) {
        setOllamaModel(models[0]);
      }
    }).catch(console.error).finally(() => setIsFetchingModels(false));
  };

  useEffect(() => {
    getStats().then(setStats).catch(console.error);
    refreshModels();
    refreshLibrarySize();
    refreshAutomations();
    refreshPrompts();
    if (whisperXInstalled) refreshWhisperModels();

    invoke<boolean>('check_cuda_support')
      .then(hasCuda => setCpuOnlyInstall(!hasCuda))
      .catch(() => setCpuOnlyInstall(true));
  }, [ollamaUrl, whisperXInstalled]);

  return (
    <>
      <BentoCard className="ai-engine-card" style={{ gridColumn: 'span 12' }}>
        <div className="card-title">
          <Cpu />
          AI Engine Stack
        </div>

        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', background: 'var(--card-bg-solid)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--card-border)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            <input 
              type="checkbox" 
              checked={enableLogs} 
              onChange={e => setEnableLogs(e.target.checked)} 
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <strong>Enable Application & Subprocess Logging</strong>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Saves logs for FFmpeg, WhisperX, LLMs, and general app events to the Logs folder.</span>
            </div>
          </label>
        </div>

        <div id="ffmpeg-section" style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>FFmpeg Audio Engine</h3>
            {ffmpegStatus === 'global' ? (
              <span className="badge green" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>GLOBALLY INSTALLED</span>
            ) : ffmpegStatus === 'local' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button 
                  onClick={() => setConfirmationModal({
                    title: 'Confirm Uninstall',
                    message: "If you uninstall FFmpeg you won't be able to record audio anymore. Do you really want to uninstall?",
                    actionLabel: 'Uninstall FFmpeg',
                    isDestructive: true,
                    onConfirm: () => { uninstallFfmpeg(); setConfirmationModal(null); }
                  })} 
                  className="btn-outline" 
                  style={{ padding: '0.1rem 0.5rem', fontSize: '0.7rem', color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
                >
                  Uninstall
                </button>
                <span className="badge green" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>LOCALLY INSTALLED</span>
              </div>
            ) : installingFfmpeg ? (
              <span className="badge" style={{ background: 'rgba(255, 149, 0, 0.2)', color: 'var(--accent-amber)', fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>INSTALLING</span>
            ) : (
              <span className="badge" style={{ background: 'rgba(255, 69, 58, 0.2)', color: 'var(--accent-red)', fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>MISSING</span>
            )}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 1rem 0', lineHeight: '1.4' }}>
            FFmpeg is required to record and process audio. {ffmpegStatus === 'missing' && "Without it, recording will fail."}
          </p>
          {ffmpegStatus === 'missing' && !installingFfmpeg && (
            <div style={{ background: 'var(--card-bg-solid)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--card-border)' }}>
              <button className="btn-primary" onClick={installFfmpeg} style={{ width: '100%', fontSize: '0.9rem', padding: '0.5rem' }}>
                Download & Install FFmpeg (1-3 mins)
              </button>
            </div>
          )}

          {(installingFfmpeg || (ffmpegStatus === 'missing' && ffmpegLogs.length > 0)) && (
            <div style={{ background: 'var(--card-bg-solid)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--card-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {installingFfmpeg && (
                     <span className="spinner" style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(0, 122, 255, 0.2)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                  )}
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {installingFfmpeg ? 'Installing FFmpeg (~1-3 mins)...' : ffmpegLogs.some(l => l.includes('FAILED') || l.includes('ERR:')) ? 'Installation Failed' : 'Installation Incomplete'}
                  </span>
                </div>
                <button className="btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={(e) => {
                  const nextSibling = e.currentTarget.parentElement?.nextElementSibling as HTMLElement;
                  if (nextSibling) {
                    nextSibling.style.display = nextSibling.style.display === 'none' ? 'flex' : 'none';
                  }
                }}>
                  Toggle Logs
                </button>
              </div>
              <div style={{ display: 'none', background: '#111', color: '#4af626', fontFamily: 'monospace', fontSize: '0.7rem', padding: '0.5rem', borderRadius: '0.5rem', height: '150px', overflowY: 'auto', flexDirection: 'column-reverse', marginTop: '1rem' }}>
                <div>
                  {ffmpegLogs.slice(-50).map((log, i) => <div key={i} style={{ color: log.startsWith('INSTALLATION FAILED') || log.startsWith('ERR:') ? '#ff4a4a' : 'inherit' }}>{log}</div>)}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Transcription Engine</h3>
          </div>
          
          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              <input 
                type="checkbox" 
                checked={autoTranscribe} 
                onChange={e => setAutoTranscribe(e.target.checked)} 
              />
              Auto-Transcribe after recording
            </label>
          </div>

          <div className="segmented-control" style={{ marginBottom: '1.5rem' }}>
            {['local', 'openai', 'assembly', 'google'].map(p => (
              <button 
                key={p} 
                className={`segment-btn ${transcriptionProvider === p ? 'active' : ''}`} 
                onClick={() => setTranscriptionProvider(p)}
              >
                {p === 'local' ? 'WhisperX (Local)' : p === 'openai' ? 'OpenAI Whisper' : p === 'assembly' ? 'AssemblyAI' : 'Google AI Studio'}
              </button>
            ))}
          </div>
          
          <div className="cloud-provider-card">
            {transcriptionProvider === 'local' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>WhisperX (Local)</h4>
                  {whisperXInstalled ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button 
                        onClick={() => setConfirmationModal({
                          title: 'Confirm Uninstall',
                          message: "If you uninstall WhisperX you won't be able to use local transcription anymore. Do you really want to uninstall?",
                          actionLabel: 'Uninstall WhisperX',
                          isDestructive: true,
                          onConfirm: () => { uninstallWhisperX(); setConfirmationModal(null); }
                        })} 
                        className="btn-outline" 
                        style={{ padding: '0.1rem 0.5rem', fontSize: '0.7rem', color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
                      >
                        Uninstall
                      </button>
                      <span className="badge green">READY</span>
                    </div>
                  ) : installingWhisperX ? (
                    <span className="badge" style={{ background: 'rgba(255, 149, 0, 0.2)', color: 'var(--accent-amber)' }}>INSTALLING</span>
                  ) : null}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 1rem 0', lineHeight: '1.4' }}>
                  Super fast, highly accurate, runs locally on CPU or GPU.
                </p>
                
                {whisperXInstalled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <div className="form-group">
                      <label className="form-label">Model Manager</label>
                      {whisperModelError && (
                        <div style={{ color: 'var(--accent-red)', fontSize: '0.8rem', marginBottom: '0.5rem', padding: '0.4rem', background: 'rgba(255, 69, 58, 0.1)', borderRadius: '4px', border: '1px solid rgba(255, 69, 58, 0.2)' }}>
                          {whisperModelError}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--card-border)', borderRadius: '0.5rem', padding: '0.5rem' }}>
                        {WHISPER_MODELS.map((m) => {
                          const isDownloaded = downloadedWhisperModels.includes(m);
                          const isDownloading = downloadingWhisperModel === m;
                          const isSelected = whisperXModel === m;
                          return (
                            <div key={m} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem', background: isSelected ? 'rgba(0,122,255,0.1)' : 'transparent', borderRadius: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input 
                                  type="radio" 
                                  checked={isSelected} 
                                  onChange={() => isDownloaded && setWhisperXModel(m)}
                                  disabled={!isDownloaded}
                                  style={{ margin: 0 }}
                                />
                                <span style={{ fontSize: '0.85rem', color: isDownloaded ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{m}</span>
                              </div>
                              <div>
                                {isDownloading ? (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--accent-amber)' }}>Downloading...</span>
                                ) : isDownloaded ? (
                                  <button onClick={() => handleDeleteWhisperModel(m)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}>Delete</button>
                                ) : (
                                  <button onClick={() => handleDownloadWhisperModel(m)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Download</button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Language</label>
                      <select className="config-input" value={whisperXLanguage} onChange={(e) => setWhisperXLanguage(e.target.value)}>
                        <option value="auto">Auto-Detect</option>
                        <option value="en">English</option>
                        <option value="de">German</option>
                        <option value="fr">French</option>
                        <option value="es">Spanish</option>
                      </select>
                    </div>

                    <div style={{ padding: '1rem', background: 'var(--card-bg-solid)', borderRadius: '0.5rem', border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <h5 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Advanced Settings</h5>
                      
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label className="form-label">Device</label>
                          <select className="config-input" value={whisperXDevice} onChange={(e) => setWhisperXDevice(e.target.value)}>
                            <option value="cpu">CPU</option>
                            <option value="cuda">GPU (CUDA)</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label className="form-label">Compute Type</label>
                          <select className="config-input" value={whisperXComputeType} onChange={(e) => setWhisperXComputeType(e.target.value)}>
                            <option value="int8">int8 (Fast)</option>
                            <option value="float16">float16 (Accurate)</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Batch Size</label>
                        <SettingNumberInput className="config-input" value={whisperXBatchSize} onSave={setWhisperXBatchSize} min={1} max={128} />
                      </div>

                      <div className="form-group">
                        <label className="form-label">HuggingFace Token</label>
                        <PasswordSettingInput className="config-input" placeholder="hf_..." value={whisperXHfToken} onSave={setWhisperXHfToken} />
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>Required for Pyannote diarization model access.</p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: whisperXHfToken ? 1 : 0.6, marginTop: '0.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.85rem' }}>Enable Diarization (Speaker ID)</span>
                          {!whisperXHfToken && <span style={{ fontSize: '0.75rem', color: 'var(--accent-amber)', marginTop: '0.2rem' }}>Token required</span>}
                        </div>
                        <label className="toggle-switch">
                          <input 
                            type="checkbox" 
                            checked={whisperXDiarize && !!whisperXHfToken} 
                            disabled={!whisperXHfToken} 
                            onChange={(e) => setWhisperXDiarize(e.target.checked)} 
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>

                      {whisperXDiarize && !!whisperXHfToken && (
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Min Speakers</label>
                            <SettingNumberInput className="config-input" value={whisperXMinSpeakers} onSave={setWhisperXMinSpeakers} min={1} max={100} />
                          </div>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Max Speakers</label>
                            <SettingNumberInput className="config-input" value={whisperXMaxSpeakers} onSave={setWhisperXMaxSpeakers} min={1} max={100} />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Initial Prompt (Optional context)</label>
                      <SettingInput className="config-input" placeholder="E.g. Technical terms, names..." value={whisperXPrompt} onSave={setWhisperXPrompt} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Temperature (0 - 1.0)</label>
                      <SettingInput type="number" min="0" max="1" step="0.1" className="config-input" value={whisperXTemperature} onSave={setWhisperXTemperature} />
                    </div>
                  </div>
                )}
                
                {!whisperXInstalled && !installingWhisperX && (
                  <div style={{ marginTop: 'auto' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--card-border)' }}>
                      <input 
                        type="checkbox" 
                        checked={cpuOnlyInstall} 
                        onChange={e => setCpuOnlyInstall(e.target.checked)} 
                        style={{ marginTop: '0.2rem' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>CPU-Only Installation (Saves ~3.8GB of disk space)</strong>
                        <span>Check this if you use an AMD GPU, integrated graphics, or macOS. PyTorch with CUDA is massive and unnecessary if you lack an NVIDIA GPU.</span>
                      </div>
                    </label>
                    <button className="btn-primary" onClick={() => installWhisperX(cpuOnlyInstall)} style={{ width: '100%', fontSize: '0.9rem', padding: '0.5rem' }}>
                      Install Engine ({cpuOnlyInstall ? '~1.8GB' : '~5.6GB'}, ~3-10 mins)
                    </button>
                  </div>
                )}
                
                {(installingWhisperX || (!whisperXInstalled && whisperXLogs.length > 0)) && (
                  <div style={{ marginTop: '1rem', background: 'var(--card-bg-solid)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--card-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {installingWhisperX && (
                           <span className="spinner" style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(0, 122, 255, 0.2)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                        )}
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {installingWhisperX ? 'Installing WhisperX Environment (~3-10 mins)...' : whisperXLogs.some(l => l.includes('FAILED') || l.includes('ERR:')) ? 'Installation Failed' : 'Installation Incomplete'}
                        </span>
                      </div>
                      <button className="btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={(e) => {
                        const nextSibling = e.currentTarget.parentElement?.nextElementSibling as HTMLElement;
                        if (nextSibling) {
                          nextSibling.style.display = nextSibling.style.display === 'none' ? 'flex' : 'none';
                        }
                      }}>
                        Toggle Logs
                      </button>
                    </div>
                    <div style={{ display: 'none', background: '#111', color: '#4af626', fontFamily: 'monospace', fontSize: '0.7rem', padding: '0.5rem', borderRadius: '0.5rem', height: '150px', overflowY: 'auto', flexDirection: 'column-reverse', marginTop: '1rem' }}>
                      <div>
                        {whisperXLogs.slice(-50).map((log, i) => <div key={i} style={{ color: log.startsWith('INSTALLATION FAILED') || log.startsWith('ERR:') ? '#ff4a4a' : 'inherit' }}>{log}</div>)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {transcriptionProvider !== 'local' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>
                    {transcriptionProvider === 'openai' ? 'OpenAI Whisper API' : transcriptionProvider === 'assembly' ? 'AssemblyAI' : 'Google AI Studio'}
                  </h4>
                  <span className="badge purple">CLOUD</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 1rem 0', lineHeight: '1.4' }}>
                  Cloud based APIs provide fast response times but require an internet connection and API key.
                </p>

                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <PasswordSettingInput 
                    className="config-input" 
                    placeholder="Enter your API Key..." 
                    value={apiKeys[transcriptionProvider] || ''} 
                    onSave={(val) => setApiKey(transcriptionProvider, val)} 
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Model (Optional)</label>
                  <SettingInput 
                    className="config-input" 
                    placeholder={transcriptionProvider === 'openai' ? 'whisper-1' : transcriptionProvider === 'google' ? 'gemini-2.5-flash' : 'Default'} 
                    value={
                      transcriptionProvider === 'openai' ? openaiTranscriptionModel :
                      transcriptionProvider === 'google' ? googleTranscriptionModel :
                      assemblyTranscriptionModel
                    } 
                    onSave={(val) => {
                      if (transcriptionProvider === 'openai') setOpenaiTranscriptionModel(val);
                      else if (transcriptionProvider === 'google') setGoogleTranscriptionModel(val);
                      else setAssemblyTranscriptionModel(val);
                    }} 
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Language Code (Optional)</label>
                  <SettingInput 
                    className="config-input" 
                    placeholder="e.g. en, fr, de" 
                    value={whisperXLanguage === 'auto' ? '' : whisperXLanguage} 
                    onSave={(val) => setWhisperXLanguage(val || 'auto')} 
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 style={{ margin: '0 0 1rem 0' }}>Summarization LLM</h3>
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-start' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Intelligence Context Depth</label>
              <SettingNumberInput 
                className="config-input"
                value={intelligenceContextDepth} 
                onSave={setIntelligenceContextDepth} 
                min={0} 
                max={20} 
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>Number of related recordings to pull per tag. Set to 0 to disable.</p>
            </div>
            
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Context Format</label>
              <select className="config-input" value={intelligenceContextFormat} onChange={(e) => setIntelligenceContextFormat(e.target.value)}>
                <option value="summaries">Summaries (Recommended)</option>
                <option value="transcripts">Full Transcripts</option>
              </select>
            </div>
          </div>

          <div className="segmented-control" style={{ marginBottom: '1.5rem' }}>
            {['local', 'openai', 'anthropic', 'google'].map(p => (
              <button 
                key={p} 
                className={`segment-btn ${llmProvider === p ? 'active' : ''}`} 
                onClick={() => setLlmProvider(p)}
              >
                {p === 'local' ? 'Ollama (Local)' : p === 'openai' ? 'OpenAI GPT' : p === 'anthropic' ? 'Anthropic Claude' : 'Google AI Studio'}
              </button>
            ))}
          </div>

          <div className="cloud-provider-card">
            {llmProvider === 'local' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0 }}>Ollama Connection</h4>
                  <span className="badge green">LOCAL</span>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Endpoint URL</label>
                  <SettingInput 
                    type="url" 
                    className="config-input"
                    value={ollamaUrl} 
                    onSave={setOllamaUrl} 
                  />
                </div>


                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label className="form-label" style={{ margin: 0 }}>Default Model</label>
                    <button 
                      onClick={refreshModels} 
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem' }}
                      disabled={isFetchingModels}
                    >
                      <RefreshCw size={12} className={isFetchingModels ? 'spin' : ''} />
                      Refresh
                    </button>
                  </div>
                  <select className="config-input" value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} disabled={availableOllamaModels.length === 0}>
                    {availableOllamaModels.length === 0 ? (
                      <option value="">No models found locally</option>
                    ) : (
                      availableOllamaModels.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))
                    )}
                  </select>
                </div>
                <div style={{ padding: '1rem', background: 'var(--card-bg-solid)', borderRadius: '0.5rem', border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h5 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Advanced Settings</h5>
                  
                  <div className="form-group">
                    <label className="form-label">System Prompt (Optional override)</label>
                    <SettingTextarea className="config-input" rows={2} value={ollamaSystemPrompt} onSave={setOllamaSystemPrompt} />
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <SettingRangeInput
                      min={0}
                      max={1}
                      step={0.1}
                      value={ollamaTemperature}
                      onSave={setOllamaTemperature}
                      labelPrefix="Temperature"
                    />
                    <SettingRangeInput
                      min={0}
                      max={1}
                      step={0.05}
                      value={ollamaTopP}
                      onSave={setOllamaTopP}
                      labelPrefix="Top P"
                    />
                    <div className="form-group" style={{ flex: '1 1 45%' }}>
                      <label className="form-label">Top K</label>
                      <SettingNumberInput className="config-input" value={ollamaTopK} onSave={setOllamaTopK} min={1} max={500} />
                    </div>
                    <div className="form-group" style={{ flex: '1 1 45%' }}>
                      <label className="form-label">Context Window (num_ctx)</label>
                      <SettingNumberInput className="config-input" value={ollamaNumCtx} onSave={setOllamaNumCtx} min={512} max={131072} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0 }}>{llmProvider === 'openai' ? 'OpenAI Platform' : llmProvider === 'anthropic' ? 'Anthropic Console' : 'Google AI Studio'}</h4>
                  <span className="badge" style={{ background: 'rgba(0,122,255,0.2)', color: 'var(--accent-blue)' }}>CLOUD API</span>
                </div>
                
                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <PasswordSettingInput 
                    className="config-input" 
                    placeholder="Enter your API key..." 
                    value={apiKeys[llmProvider] || ''} 
                    onSave={(val) => setApiKey(llmProvider, val)} 
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Model (Optional)</label>
                  <SettingInput 
                    className="config-input" 
                    placeholder={llmProvider === 'openai' ? 'gpt-4o-mini' : llmProvider === 'anthropic' ? 'claude-haiku-4-5' : 'gemini-2.5-flash'} 
                    value={
                      llmProvider === 'openai' ? openaiLlmModel :
                      llmProvider === 'anthropic' ? anthropicLlmModel :
                      googleLlmModel
                    } 
                    onSave={(val) => {
                      if (llmProvider === 'openai') setOpenaiLlmModel(val);
                      else if (llmProvider === 'anthropic') setAnthropicLlmModel(val);
                      else setGoogleLlmModel(val);
                    }} 
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </BentoCard>

      {confirmationModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header" style={{ color: confirmationModal.isDestructive ? 'var(--accent-red)' : 'var(--text-primary)' }}>
              {confirmationModal.title}
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                {confirmationModal.message}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmationModal(null)}>
                Cancel
              </button>
              <button className="btn-primary" style={{ background: confirmationModal.isDestructive ? 'var(--accent-red)' : 'var(--accent-blue)', border: 'none', color: '#fff' }} onClick={confirmationModal.onConfirm}>
                {confirmationModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {alertModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header" style={{ color: alertModal.isError ? 'var(--accent-red)' : 'var(--text-primary)' }}>
              {alertModal.title}
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                {alertModal.message}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setAlertModal(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <BentoCard className="automation-card" style={{ gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.8rem', margin: 0 }}>Automation & Groups</h2>
          <button 
            className="btn-primary" 
            style={{ width: 'auto', background: 'white', color: 'black' }}
            onClick={() => setShowAutomationForm(!showAutomationForm)}
          >
            {showAutomationForm ? 'Cancel' : 'New Rule'}
          </button>
        </div>

        {showAutomationForm && (
          <div style={{ background: 'var(--card-bg-solid)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--card-border)', marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 1rem 0' }}>Create New Automation Rule</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Rule Name</label>
                <input type="text" className="config-input" value={newAutoName} onChange={e => setNewAutoName(e.target.value)} placeholder="e.g. Daily Standup Summary" />
              </div>
              <div className="form-group">
                <label className="form-label">Trigger Time (HH:MM)</label>
                <input type="time" className="config-input" value={newAutoTime} onChange={e => setNewAutoTime(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Time Range (Last X hours)</label>
                <input type="number" className="config-input" min={1} value={newAutoTimerange} onChange={e => setNewAutoTimerange(parseInt(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Action</label>
                <select className="config-input" value={newAutoAction} onChange={e => setNewAutoAction(e.target.value)}>
                  <option value="summarize">Summarize</option>
                  <option value="transcribe">Transcribe</option>
                </select>
              </div>
            </div>
            <button className="btn-primary" onClick={handleCreateAutomation}>Save Rule</button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {automations.map((rule) => (
            <div key={rule.id} style={{ background: 'var(--card-bg-solid)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--card-border)', position: 'relative' }}>
              <button 
                onClick={() => handleDeleteAutomation(rule.id)}
                style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <Trash2 size={16} />
              </button>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{rule.name}</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                Runs every day at {rule.triggerTime} for recordings from the last {rule.timerangeHours} hours.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.3rem 0.6rem', borderRadius: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Last {rule.timerangeHours}h</span>
                <span style={{ background: 'rgba(0,122,255,0.1)', color: 'var(--accent-blue)', padding: '0.3rem 0.6rem', borderRadius: '0.4rem', fontSize: '0.8rem' }}>Action: {rule.action}</span>
              </div>
            </div>
          ))}
          {automations.length === 0 && !showAutomationForm && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No automation rules configured.</div>
          )}
        </div>
      </BentoCard>

      <BentoCard className="prompts-card" style={{ gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.8rem', margin: 0 }}>Prompt Templates</h2>
          <button 
            className="btn-primary" 
            style={{ width: 'auto', background: 'white', color: 'black' }}
            onClick={() => {
              setEditingPromptId(null);
              setPromptTitle('');
              setPromptText('');
              setShowPromptForm(!showPromptForm);
            }}
          >
            {showPromptForm ? 'Cancel' : 'New Template'}
          </button>
        </div>

        {showPromptForm && (
          <div ref={promptFormRef} style={{ background: 'var(--card-bg-solid)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--card-border)', marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 1rem 0' }}>{editingPromptId ? 'Edit Template' : 'Create New Template'}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Template Title</label>
                <input type="text" className="config-input" value={promptTitle} onChange={e => setPromptTitle(e.target.value)} placeholder="e.g. Detailed Meeting Notes" />
              </div>
              <div className="form-group">
                <label className="form-label">Template Text (Use {'{{transcript}}'} as placeholder)</label>
                <textarea 
                  className="config-input" 
                  value={promptText} 
                  onChange={e => setPromptText(e.target.value)} 
                  placeholder="Please provide detailed meeting notes for:\n\n{{transcript}}"
                  style={{ minHeight: '150px', resize: 'vertical' }}
                />
              </div>
            </div>
            <button className="btn-primary" onClick={handleSavePrompt}>Save Template</button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {prompts.map((p) => (
            <div key={p.id} style={{ background: 'var(--card-bg-solid)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--card-border)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => {
                    setEditingPromptId(p.id);
                    setPromptTitle(p.title);
                    setPromptText(p.templateText);
                    setShowPromptForm(true);
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <Edit3 size={16} />
                </button>
                <button 
                  onClick={() => handleDeletePrompt(p.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{p.title}</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0', lineHeight: '1.4', whiteSpace: 'pre-wrap', maxHeight: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.templateText}
              </p>
            </div>
          ))}
          {prompts.length === 0 && !showPromptForm && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No prompt templates configured.</div>
          )}
        </div>
      </BentoCard>

      <BentoCard className="storage-card" style={{ gridColumn: 'span 12' }}>
        <div className="card-title">
          <HardDrive style={{ color: 'var(--accent-amber)' }} />
          Storage
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '2rem 0' }}>
          <h2 style={{ fontSize: '2.5rem', margin: '0 0 0.5rem 0' }}>{formatSize(storageBreakdown.total)}</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Used Space</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-amber)' }}></div>
              Recordings (Audio)
            </div>
            <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)' }}>
              <span>{stats.recordingsCount} files</span>
              <span style={{ width: '60px', textAlign: 'right' }}>{formatSize(storageBreakdown.recordings)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-blue)' }}></div>
              Transcriptions
            </div>
            <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)' }}>
              <span>{stats.transcriptsCount} files</span>
              <span style={{ width: '60px', textAlign: 'right' }}>{formatSize(storageBreakdown.transcriptions)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34C759' }}></div>
              Summaries
            </div>
            <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)' }}>
              <span style={{ width: '60px', textAlign: 'right' }}>{formatSize(storageBreakdown.summaries)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--text-secondary)' }}></div>
              Logs
            </div>
            <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)' }}>
              <span style={{ width: '60px', textAlign: 'right' }}>{formatSize(storageBreakdown.logs)}</span>
            </div>
          </div>
        </div>

        <button 
          className="btn-outline" 
          onClick={handleCleanup}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', borderColor: 'rgba(255, 59, 48, 0.3)' }}
        >
          <Trash2 size={18} style={{ color: 'var(--accent-red)' }} />
          <span style={{ color: 'var(--text-primary)' }}>Clean Up Old Audios (&gt;30d)</span>
        </button>

        <button 
          className="btn-outline" 
          onClick={() => {
            setConfirmationModal({
              title: "Clean All Logs",
              message: "Are you sure you want to clean up all logs?",
              actionLabel: "Clean Logs",
              isDestructive: true,
              onConfirm: async () => {
                setConfirmationModal(null);
                try {
                  await invoke('delete_all_logs');
                  refreshLibrarySize();
                } catch (err) {
                  console.error(err);
                  setAlertModal({ title: "Error", message: "Failed to clean logs.", isError: true });
                }
              }
            });
          }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', borderColor: 'rgba(255, 149, 0, 0.3)', marginTop: '0.75rem' }}
        >
          <Trash2 size={18} style={{ color: 'var(--accent-amber)' }} />
          <span style={{ color: 'var(--text-primary)' }}>Clean All Logs</span>
        </button>
      </BentoCard>
    </>
  );
}
