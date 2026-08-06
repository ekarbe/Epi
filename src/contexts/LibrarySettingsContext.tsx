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

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo } from 'react';
import { usePersistentState } from './usePersistentState';
import { 
  invoke, 
  listen, 
  documentDir, join, BaseDirectory,
  writeTextFile, exists, readDir, loadStore
} from '../lib/api';
import { transcribeAudio } from '../services/whisper';
import { summarizeTranscript } from '../services/ollama';
import { initDb, saveRecording, saveTranscript, saveSummary, getTranscriptForRecording, getSummaryForTranscript, getRawRecordingById, getLibraryRecordings, LibraryRecording, updateTranscript, updateSummary, ensureDefaultPrompts, getTags, getGlossary } from '../services/db';
import { getBaseName } from '../utils/path';

export const getTranscriptionProviderName = (provider: string) => {
  if (provider === 'local') return 'WhisperX';
  if (provider === 'openai') return 'OpenAI Whisper';
  if (provider === 'google') return 'Google AI Studio';
  if (provider === 'assembly') return 'AssemblyAI';
  return 'WhisperX';
};

export const getLlmProviderName = (provider: string) => {
  if (provider === 'local') return 'Ollama';
  if (provider === 'openai') return 'OpenAI GPT';
  if (provider === 'google') return 'Google AI Studio';
  if (provider === 'anthropic') return 'Anthropic Claude';
  return 'Ollama';
};



export interface LibrarySettingsContextType {
  isDark: boolean;
  setIsDark: (val: boolean) => void;
  dbReady: boolean;
  dbError: string | null;
  activeTab: 'studio' | 'analysis' | 'engine' | 'library';
  setActiveTab: (tab: 'studio' | 'analysis' | 'engine' | 'library') => void;
  recordings: LibraryRecording[];
  refreshLibrary: () => Promise<void>;
  ollamaUrl: string;
  setOllamaUrl: (url: string) => void;
  ollamaModel: string;
  setOllamaModel: (model: string) => void;
  autoTranscribe: boolean;
  setAutoTranscribe: (v: boolean) => void;
  namingSchema: string;
  setNamingSchema: (v: string) => void;
  enableLogs: boolean;
  setEnableLogs: (v: boolean) => void;
  llmProvider: string;
  setLlmProvider: (provider: string) => void;
  whisperXInstalled: boolean;
  whisperXBinaryPath: string | null;
  installingWhisperX: boolean;
  whisperXLogs: string[];
  installWhisperX: (cpuOnly: boolean) => Promise<void>;
  uninstallWhisperX: () => Promise<void>;
  
  ffmpegStatus: string;
  installingFfmpeg: boolean;
  ffmpegLogs: string[];
  installFfmpeg: () => Promise<void>;
  uninstallFfmpeg: () => Promise<void>;
  whisperXModel: string;
  setWhisperXModel: (model: string) => void;
  whisperXLanguage: string;
  setWhisperXLanguage: (lang: string) => void;
  whisperXPrompt: string;
  setWhisperXPrompt: (prompt: string) => void;
  whisperXTemperature: string;
  setWhisperXTemperature: (temp: string) => void;
  openaiTranscriptionModel: string; setOpenaiTranscriptionModel: (m: string) => void;
  assemblyTranscriptionModel: string; setAssemblyTranscriptionModel: (m: string) => void;
  googleTranscriptionModel: string; setGoogleTranscriptionModel: (m: string) => void;
  openaiLlmModel: string; setOpenaiLlmModel: (m: string) => void;
  anthropicLlmModel: string; setAnthropicLlmModel: (m: string) => void;
  googleLlmModel: string; setGoogleLlmModel: (m: string) => void;
  whisperXDevice: string; setWhisperXDevice: (v: string) => void;
  whisperXComputeType: string; setWhisperXComputeType: (v: string) => void;
  whisperXBatchSize: number; setWhisperXBatchSize: (v: number) => void;
  whisperXDiarize: boolean; setWhisperXDiarize: (v: boolean) => void;
  whisperXHfToken: string; setWhisperXHfToken: (v: string) => void;
  whisperXMinSpeakers: number; setWhisperXMinSpeakers: (v: number) => void;
  whisperXMaxSpeakers: number; setWhisperXMaxSpeakers: (v: number) => void;
  ollamaTemperature: number; setOllamaTemperature: (v: number) => void;
  ollamaNumCtx: number; setOllamaNumCtx: (v: number) => void;
  ollamaNumPredict: number; setOllamaNumPredict: (v: number) => void;
  ollamaTopP: number; setOllamaTopP: (v: number) => void;
  ollamaTopK: number; setOllamaTopK: (v: number) => void;
  ollamaSystemPrompt: string; setOllamaSystemPrompt: (v: string) => void;
  intelligenceContextDepth: number; setIntelligenceContextDepth: (v: number) => void;
  intelligenceContextFormat: string; setIntelligenceContextFormat: (v: string) => void;
  transcriptionProvider: string; setTranscriptionProvider: (provider: string) => void;
  apiKeys: Record<string, string>; setApiKey: (provider: string, key: string) => void;
  loadRecordingIntoAnalysis: (recordingId: number | null) => Promise<void>;
  triggerTranscription: (recordingId: number, filename: string) => Promise<void>;
  pendingLanguagePrompt: { filePath: string; recordingId: number; detectedLanguage: string } | null;
  setPendingLanguagePrompt: (prompt: { filePath: string; recordingId: number; detectedLanguage: string } | null) => void;
  handleRetryTranscription: (recordingId: number, filePath: string, language: string, noAlign: boolean) => Promise<void>;
  handleCancelLanguagePrompt: () => void;
  handleTranscription: (filePath: string, recId: number, forcedLanguage?: string, noAlignFallback?: boolean) => Promise<void>;

  activeRecordingId: number | null;
  activeTranscriptId: number | null;
  activeTranscript: string | null;
  isTranscribing: boolean;
  transcribingIds: number[];
  transcriptionError: string | null;
  diarized: boolean;
  updateActiveTranscript: (text: string) => Promise<void>;
  activeSummary: string | null;
  isSummarizing: boolean;
  summarizingRecIds: number[];
  summaryError: string | null;
  generateSummary: (promptTemplate: string, relatedRecordingsContext?: string) => Promise<void>;
  updateActiveSummary: (text: string) => Promise<void>;
  addTranscribingId: (id: number) => void;
  removeTranscribingId: (id: number) => void;
  addSummarizingRecId: (id: number) => void;
  removeSummarizingRecId: (id: number) => void;
}


const LibrarySettingsContext = createContext<LibrarySettingsContextType | undefined>(undefined);


export function LibrarySettingsProvider({ children }: { children: ReactNode }) {

  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('epi_theme') !== 'light';
  });
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    // Apply theme
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('epi_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    initDb()
      .then(async () => {
        setDbReady(true);
        try {
          await ensureDefaultPrompts();
        } catch (err) {
          console.warn("Failed to ensure default prompts:", err);
        }
      })
      .catch((err: any) => {
        console.error(err);
        setDbError(err.message || String(err));
      });
  }, []);

  const [activeTab, setActiveTab] = useState<'studio' | 'analysis' | 'engine' | 'library'>('studio');
  const [recordings, setRecordings] = useState<LibraryRecording[]>([]);
    
  

  /**
   * Refreshes the local memory list of recordings by fetching them from the database
   * and verifying physical WAV file existence on disk in a single batch (O(1) IPC calls).
   * 
   * @sideEffects
   * * Queries the database for all recordings.
   * * Reads the library's physical WAV folder contents.
   * * Updates the `recordings` state.
   */
  const refreshLibrary = async () => {
    try {
      const rawRecs = await getLibraryRecordings();
      const recordingsDir = 'Epi Library/Recordings';
      const existingFiles = new Set<string>();
      
      try {
        const dirExists = await exists(recordingsDir, { baseDir: BaseDirectory.Document });
        if (dirExists) {
          const entries = await readDir(recordingsDir, { baseDir: BaseDirectory.Document });
          for (const entry of entries) {
            if (entry.isFile) {
              existingFiles.add(entry.name);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to read recordings directory during refresh:', err);
      }

      const checkedRecs = rawRecs.map((rec) => ({
        ...rec,
        hasAudio: existingFiles.has(rec.filename),
      }));
      setRecordings(checkedRecs);
    } catch (err) {
      console.error('Failed to refresh library:', err);
    }
  };

  /**
   * Scans the physical library Recordings folder and imports any new files
   * into the database, using Set-based lookup to avoid O(N^2) DB checks.
   * 
   * @sideEffects
   * * Reads physical folder directory.
   * * Inserts newly discovered records into the database.
   * * Triggers refreshLibrary() to update UI state.
   */
    // @ts-ignore
  const performSync = async () => {
    try {
      const recordingsDir = 'Epi Library/Recordings';
      const dirExists = await exists(recordingsDir, { baseDir: BaseDirectory.Document });
      if (!dirExists) return;

      const entries = await readDir(recordingsDir, { baseDir: BaseDirectory.Document });
      const wavFiles = entries
        .filter((entry: any) => entry.isFile && entry.name.toLowerCase().endsWith('.ogg'))
        .map((entry: any) => entry.name);

      const dbRecs = await getLibraryRecordings();
      const dbFilenames = new Set(dbRecs.map(r => r.filename));

      // Find files on disk that are NOT in the database
      const missingWavs = wavFiles.filter((name: string) => !dbFilenames.has(name));

      if (missingWavs.length > 0) {
        console.log(`[Sync] Found ${missingWavs.length} new files on disk:`, missingWavs);
        for (const filename of missingWavs) {
          try {
            // Re-verify that the file hasn't been inserted by a previous step or run
            if (dbFilenames.has(filename)) {
              continue;
            }

            // Get duration and modified date using the new Rust command
            const metadata: any = await invoke('get_wav_metadata', { path: `Recordings/${filename}` });
            
            // Format label from filename by stripping extension
            const label = getBaseName(filename);
            
            await saveRecording(filename, metadata.duration, label, metadata.modified);
            dbFilenames.add(filename); // Track that we added it to prevent duplicate inserts
            console.log(`[Sync] Imported ${filename} (duration: ${metadata.duration}s, modified: ${metadata.modified})`);
          } catch (err) {
            console.error(`[Sync] Failed to import ${filename}:`, err);
          }
        }
      }

      await refreshLibrary();
    } catch (err) {
      console.error('[Sync] Error syncing library with disk:', err);
    }
  };

    const [activeRecordingId, setActiveRecordingId] = useState<number | null>(null);
  const [activeTranscriptId, setActiveTranscriptId] = useState<number | null>(null);

  const activeRecordingIdRef = useRef<number | null>(null);
  const activeTranscriptIdRef = useRef<number | null>(null);

  useEffect(() => {
    activeRecordingIdRef.current = activeRecordingId;
  }, [activeRecordingId]);

  useEffect(() => {
    activeTranscriptIdRef.current = activeTranscriptId;
  }, [activeTranscriptId]);

  const [activeTranscript, setActiveTranscript] = useState<string | null>(null);
  const [diarized, setDiarized] = useState(false);

  const [transcribingIds, setTranscribingIds] = useState<number[]>([]);
  const [transcriptionErrors, setTranscriptionErrors] = useState<Record<number, string | null>>({});
  const [pendingLanguagePrompts, setPendingLanguagePrompts] = useState<Array<{ filePath: string; recordingId: number; detectedLanguage: string }>>([]);
  const pendingLanguagePrompt = pendingLanguagePrompts[0] || null;
  const setPendingLanguagePrompt = (prompt: { filePath: string; recordingId: number; detectedLanguage: string } | null) => {
    if (prompt === null) {
      setPendingLanguagePrompts(prev => prev.slice(1));
    } else {
      setPendingLanguagePrompts(prev => [...prev, prompt]);
    }
  };

  const isTranscribing = activeRecordingId !== null && transcribingIds.includes(activeRecordingId);
  const transcriptionError = activeRecordingId !== null ? (transcriptionErrors[activeRecordingId] || null) : null;

  const [activeSummary, setActiveSummary] = useState<string | null>(null);
  const [summarizingIds, setSummarizingIds] = useState<number[]>([]);
  const [summarizingRecIds, setSummarizingRecIds] = useState<number[]>([]);
  const [summaryErrors, setSummaryErrors] = useState<Record<number, string | null>>({});

  const isSummarizing = activeTranscriptId !== null && summarizingIds.includes(activeTranscriptId);
  const summaryError = activeTranscriptId !== null ? (summaryErrors[activeTranscriptId] || null) : null;

  // Configuration settings using persistent state
  const [ollamaUrl, setOllamaUrl] = usePersistentState<string>('epi_ollama_url', 'http://localhost:11434');
  const [ollamaModel, setOllamaModel] = usePersistentState<string>('epi_ollama_model', 'llama3');
  const [llmProvider, setLlmProvider] = usePersistentState<string>('epi_llm_provider', 'local');

  const [whisperXInstalled, setWhisperXInstalled] = useState(false);
  const [whisperXBinaryPath, setWhisperXBinaryPath] = useState<string | null>(null);
  const [installingWhisperX, setInstallingWhisperX] = useState(false);
  const [whisperXLogs, setWhisperXLogs] = useState<string[]>([]);
  
  const [ffmpegStatus, setFfmpegStatus] = useState<string>('checking');
  const [installingFfmpeg, setInstallingFfmpeg] = useState(false);
  const [ffmpegLogs, setFfmpegLogs] = useState<string[]>([]);

  const [whisperXModel, setWhisperXModel] = usePersistentState<string>('epi_whisperx_model', 'tiny');
  const [whisperXLanguage, setWhisperXLanguage] = usePersistentState<string>('epi_whisperx_language', 'auto');
  const [whisperXPrompt, setWhisperXPrompt] = usePersistentState<string>('epi_whisperx_prompt', '');
  const [whisperXTemperature, setWhisperXTemperature] = usePersistentState<string>('epi_whisperx_temperature', '0');


  const [openaiTranscriptionModel, setOpenaiTranscriptionModel] = usePersistentState<string>('epi_openai_transcription_model', 'whisper-1');
  const [assemblyTranscriptionModel, setAssemblyTranscriptionModel] = usePersistentState<string>('epi_assembly_transcription_model', 'universal-3-pro');
  const [googleTranscriptionModel, setGoogleTranscriptionModel] = usePersistentState<string>('epi_google_transcription_model', 'gemini-2.5-flash');

  const [openaiLlmModel, setOpenaiLlmModel] = usePersistentState<string>('epi_openai_llm_model', 'gpt-4o-mini');
  const [anthropicLlmModel, setAnthropicLlmModel] = usePersistentState<string>('epi_anthropic_llm_model', 'claude-haiku-4-5');
  const [googleLlmModel, setGoogleLlmModel] = usePersistentState<string>('epi_google_llm_model', 'gemini-2.5-flash');

  const [whisperXDevice, setWhisperXDevice] = usePersistentState<string>('epi_whisperx_device', 'cpu');
  const [whisperXComputeType, setWhisperXComputeType] = usePersistentState<string>('epi_whisperx_compute_type', 'int8');
  const [whisperXBatchSize, setWhisperXBatchSize] = usePersistentState<number>('epi_whisperx_batch_size', 8);
  const [whisperXDiarize, setWhisperXDiarize] = usePersistentState<boolean>('epi_whisperx_diarize', false);
  const [whisperXHfToken, setWhisperXHfToken] = usePersistentState<string>('epi_whisperx_hf_token', '');
  const [whisperXMinSpeakers, setWhisperXMinSpeakers] = usePersistentState<number>('epi_whisperx_min_speakers', 1);
  const [whisperXMaxSpeakers, setWhisperXMaxSpeakers] = usePersistentState<number>('epi_whisperx_max_speakers', 5);

  const [ollamaTemperature, setOllamaTemperature] = usePersistentState<number>('epi_ollama_temperature', 0.1);
  const [ollamaNumCtx, setOllamaNumCtx] = usePersistentState<number>('epi_ollama_num_ctx', 4096);
  const [ollamaNumPredict, setOllamaNumPredict] = usePersistentState<number>('epi_ollama_num_predict', -1);
  const [ollamaTopP, setOllamaTopP] = usePersistentState<number>('epi_ollama_top_p', 0.9);
  const [ollamaTopK, setOllamaTopK] = usePersistentState<number>('epi_ollama_top_k', 10);
  const [ollamaSystemPrompt, setOllamaSystemPrompt] = usePersistentState<string>('epi_ollama_system_prompt', '');

  const [intelligenceContextDepth, setIntelligenceContextDepth] = usePersistentState<number>('epi_intelligence_context_depth', 5);
  const [intelligenceContextFormat, setIntelligenceContextFormat] = usePersistentState<string>('epi_intelligence_context_format', 'summaries');

  const [transcriptionProvider, setTranscriptionProvider] = usePersistentState<string>('epi_transcription_provider', 'local');
  const [autoTranscribe, setAutoTranscribe] = usePersistentState<boolean>('epi_auto_transcribe', false);
  const [namingSchema, setNamingSchema] = usePersistentState<string>('epi_naming_schema', '{title}_{YYYY}{MM}{DD}_{counter}');
  const [enableLogs, setEnableLogs] = usePersistentState<boolean>('epi_enable_logs', true);

  const [apiKeys, setApiKeysState] = useState<Record<string, string>>({});

  const originalConsoleRef = useRef({
    log: console.log,
    warn: console.warn,
    error: console.error
  });

  useEffect(() => {
    if (enableLogs) {
      const safeStringify = (obj: any) => {
        try {
          if (obj instanceof Error) return obj.toString() + (obj.stack ? '\\n' + obj.stack : '');
          return JSON.stringify(obj);
        } catch (e) {
          return '[Unserializable Object]';
        }
      };
      
      console.log = (...args) => {
        originalConsoleRef.current.log(...args);
        invoke('append_app_log', { log: `[LOG] ${args.map(a => typeof a === 'object' ? safeStringify(a) : String(a)).join(' ')}` }).catch(() => {});
      };
      console.warn = (...args) => {
        originalConsoleRef.current.warn(...args);
        invoke('append_app_log', { log: `[WARN] ${args.map(a => typeof a === 'object' ? safeStringify(a) : String(a)).join(' ')}` }).catch(() => {});
      };
      console.error = (...args) => {
        originalConsoleRef.current.error(...args);
        invoke('append_app_log', { log: `[ERROR] ${args.map(a => typeof a === 'object' ? safeStringify(a) : String(a)).join(' ')}` }).catch(() => {});
      };
    } else {
      console.log = originalConsoleRef.current.log;
      console.warn = originalConsoleRef.current.warn;
      console.error = originalConsoleRef.current.error;
    }
    return () => {
      console.log = originalConsoleRef.current.log;
      console.warn = originalConsoleRef.current.warn;
      console.error = originalConsoleRef.current.error;
    };
  }, [enableLogs]);

  useEffect(() => {
    loadStore('settings.json')
      .then((store: any) => {
        store.get('api_keys')
          .then((keys: any) => {
            if (keys) setApiKeysState(keys);
          })
          .catch((err: any) => console.error("Failed to retrieve api_keys from store:", err));
      })
      .catch((err: any) => console.error("Failed to load settings.json store:", err));
  }, []);

  const setApiKey = (provider: string, key: string) => {
    const cleanKey = String(key || '').trim();
    setApiKeysState(prev => {
      const next = { ...prev, [provider]: cleanKey };
      loadStore('settings.json')
        .then((store: any) => {
          store.set('api_keys', next)
            .then(() => store.save())
            .catch((err: any) => console.error("Failed to save store:", err));
        })
        .catch((err: any) => console.error("Failed to load store for writing:", err));
      return next;
    });
  };


  
  const checkWhisperXStatus = async () => {
    try {
      const status: { installed: boolean; binary_path: string | null } = await invoke('check_whisperx_status');
      setWhisperXInstalled(status.installed);
      setWhisperXBinaryPath(status.binary_path);
    } catch (e) {
      console.error("Failed to check WhisperX status:", e);
    }
  };

  const checkFfmpeg = async () => {
    try {
      const status = await invoke<string>('check_ffmpeg_installation');
      setFfmpegStatus(status);
    } catch (e) {
      console.error(e);
      setFfmpegStatus('missing');
    }
  };

  const installFfmpeg = async () => {
    setInstallingFfmpeg(true);
    setFfmpegLogs([]);
    try {
      await invoke('install_ffmpeg');
      await checkFfmpeg();
    } catch (e) {
      console.error(e);
      alert('Failed to install FFmpeg: ' + e);
    } finally {
      setInstallingFfmpeg(false);
    }
  };

  const uninstallFfmpeg = async () => {
    try {
      await invoke('uninstall_ffmpeg');
      await checkFfmpeg();
    } catch (e) {
      console.error(e);
      alert('Failed to uninstall FFmpeg: ' + e);
    }
  };

  useEffect(() => {
    checkWhisperXStatus();
    checkFfmpeg();

    const unlistenInstall = listen<string>('whisperx-install-log', (event) => {
      setWhisperXLogs(prev => [...prev, event.payload]);
    });

    const unlistenFfmpegInstall = listen<string>('ffmpeg-install-log', (event) => {
      setFfmpegLogs(prev => [...prev, event.payload]);
    });

    return () => {
      unlistenInstall.then(f => f());
      unlistenFfmpegInstall.then(f => f());
    };
  }, []);

  const installWhisperX = async (cpuOnly: boolean) => {
    setInstallingWhisperX(true);
    setWhisperXLogs([]);
    try {
      await invoke('install_whisperx', { cpuOnly });
      await checkWhisperXStatus();
    } catch (err: any) {
      setWhisperXLogs(prev => [...prev, `INSTALLATION FAILED: ${err}`]);
    } finally {
      setInstallingWhisperX(false);
    }
  };

  const uninstallWhisperX = async () => {
    try {
      await invoke('uninstall_whisperx');
      await checkWhisperXStatus();
    } catch (e) {
      console.error(e);
      alert('Failed to uninstall WhisperX: ' + e);
    }
  };




  const handleTranscription = async (
    filePath: string, 
    recId: number, 
    forcedLanguage?: string, 
    noAlignFallback?: boolean
  ) => {
    setTranscribingIds(prev => [...prev, recId]);
    setTranscriptionErrors(prev => ({ ...prev, [recId]: null }));
    try {
      let activeModel = whisperXModel;
      if (transcriptionProvider === 'openai') activeModel = openaiTranscriptionModel;
      else if (transcriptionProvider === 'assembly') activeModel = assemblyTranscriptionModel;
      else if (transcriptionProvider === 'google') activeModel = googleTranscriptionModel;

      let minSpeakers = whisperXMinSpeakers;
      let maxSpeakers = whisperXMaxSpeakers;
      if (minSpeakers > maxSpeakers) {
        // Self-heal range inversion to prevent Pyannote crashes
        const temp = minSpeakers;
        minSpeakers = maxSpeakers;
        maxSpeakers = temp;
      }

      const tempParsed = parseFloat(whisperXTemperature);
      const finalTemp = isNaN(tempParsed) ? 0.0 : tempParsed;

      let logPath: string | undefined;
      if (enableLogs) {
        const baseName = getBaseName(filePath);
        logPath = await join(await documentDir(), 'Epi Library', 'Logs', `${baseName}_whisperx.log`);
      }
      
      let initialPrompt = whisperXPrompt;
      const allGlossaryTerms = await getGlossary();
      const glossaryTermString = allGlossaryTerms.map(t => t.term.trim()).join(', ');
      
      if (glossaryTermString !== '') {
        initialPrompt = initialPrompt ? `${initialPrompt}, ${glossaryTermString}` : glossaryTermString;
      }

      const result = await transcribeAudio(
        filePath, 
        activeModel, 
        forcedLanguage !== undefined ? forcedLanguage : whisperXLanguage, 
        initialPrompt, 
        finalTemp,
        transcriptionProvider,
        apiKeys[transcriptionProvider] || '',
        {
          device: whisperXDevice as 'cpu' | 'cuda',
          computeType: whisperXComputeType as 'int8' | 'float16' | 'float32',
          batchSize: whisperXBatchSize,
          diarize: whisperXDiarize,
          hfToken: whisperXHfToken,
          minSpeakers,
          maxSpeakers,
          noAlign: noAlignFallback || false,
          logPath
        }
      );
      
      // Save to DB
      const transcriptId = await saveTranscript(recId, result);
      
      // Save to File
      try {
        const recording = await getRawRecordingById(recId);
        if (recording) {
          // Assumes dirs are created by migration/init routine

          const baseName = getBaseName(recording.filename);
          
          // Save the .txt transcript
          await writeTextFile(`Epi Library/Transcriptions/${baseName}_transcript.txt`, result, { baseDir: BaseDirectory.Document });
          
          // If cloud provider, also save a basic .json representation so the user has it
          if (transcriptionProvider !== 'local') {
            const jsonRepresentation = {
              segments: [
                { text: result, start: 0.0, end: 0.0 }
              ],
              word_segments: []
            };
            await writeTextFile(`Epi Library/Transcriptions/${baseName}.json`, JSON.stringify(jsonRepresentation, null, 2), { baseDir: BaseDirectory.Document });
          }
        }
      } catch (err) {
        console.error("Failed to write transcript file", err);
      }

      if (activeRecordingIdRef.current === recId) {
        setActiveTranscript(result);
        setDiarized(result.includes(']')); // basic heuristics
        setActiveTranscriptId(transcriptId);
      }
    } catch (err: any) {
      const errMsg = err.message || String(err);
      if (errMsg.includes("No default align-model for language") || errMsg.includes("align-model")) {
        const match = errMsg.match(/No default align-model for language:\s*([a-zA-Z\-]+)/);
        const detected = match ? match[1] : 'unknown';
        setPendingLanguagePrompt({
          filePath,
          recordingId: recId,
          detectedLanguage: detected
        });
      } else {
        setTranscriptionErrors(prev => ({ ...prev, [recId]: errMsg }));
      }
    } finally {
      setTranscribingIds(prev => prev.filter(id => id !== recId));
      refreshLibrary();
    }
  };

  const generateSummary = async (promptTemplate: string, relatedRecordingsContext: string = '') => {
    if (!activeTranscript || !activeTranscriptId) return;
    const tId = activeTranscriptId;
    const transcriptText = activeTranscript;
    const recId = activeRecordingId;
    
    setSummarizingIds(prev => [...prev, tId]);
    if (recId) {
      setSummarizingRecIds(prev => [...prev, recId]);
    }
    setSummaryErrors(prev => ({ ...prev, [tId]: null }));
    try {
      let activeModel = ollamaModel;
      if (llmProvider === 'openai') activeModel = openaiLlmModel;
      else if (llmProvider === 'anthropic') activeModel = anthropicLlmModel;
      else if (llmProvider === 'google') activeModel = googleLlmModel;

      let logPath: string | undefined;
      let recording: any;
      let activeTags: string[] = [];
      if (recId) {
        recording = await getRawRecordingById(recId);
        if (recording) {
          try {
            activeTags = JSON.parse(recording.tags || '[]');
          } catch (e) { }
          if (enableLogs) {
            const baseName = getBaseName(recording.filename);
            logPath = await join(await documentDir(), 'Epi Library', 'Logs', `${baseName}_llm.log`);
          }
        }
      }

      let meetingContextStr = '';
      if (activeTags.length > 0) {
        const allTags = await getTags();
        const activeTagContexts = allTags.filter(t => activeTags.includes(t.name) && t.context.trim() !== '');
        meetingContextStr = activeTagContexts.map(t => `${t.name}: ${t.context}`).join('\n');
      }

      const allGlossaryTerms = await getGlossary();
      const glossaryWithMeanings = allGlossaryTerms.filter(t => t.meaning.trim() !== '');
      const glossaryStr = glossaryWithMeanings.map(t => `${t.term}: ${t.meaning}`).join('\n');

      let finalTranscript = transcriptText;
      let finalSystemPrompt = ollamaSystemPrompt;

      if (glossaryStr !== '' || meetingContextStr !== '') {
        finalTranscript = `<BACKGROUND_CONTEXT>
${glossaryStr ? `Glossary Terms:\n${glossaryStr}\n` : ''}${meetingContextStr ? `Meeting Context:\n${meetingContextStr}\n` : ''}</BACKGROUND_CONTEXT>

<TRANSCRIPT>
${transcriptText}
</TRANSCRIPT>`;

        const instruction = "CRITICAL INSTRUCTION: Use the <BACKGROUND_CONTEXT> ONLY to understand acronyms, spellings, and relationships. DO NOT include facts from the background context in your summary unless they were explicitly spoken about in the <TRANSCRIPT>.";
        finalSystemPrompt = finalSystemPrompt ? `${finalSystemPrompt}\n\n${instruction}` : instruction;
      }

      // First pass: Summarize the current transcript using the user's template
      let sum = await summarizeTranscript(finalTranscript, promptTemplate, ollamaUrl, activeModel, llmProvider, apiKeys[llmProvider] || '', {
        temperature: ollamaTemperature,
        num_ctx: ollamaNumCtx,
        num_predict: ollamaNumPredict,
        top_p: ollamaTopP,
        top_k: ollamaTopK,
        system: finalSystemPrompt,
        logPath
      });

      // Second pass (Reduce): If related context exists, perform a second integration pass
      if (relatedRecordingsContext !== '') {
        const secondPassTemplate = `You are an AI assistant. Here is a baseline analysis of a recent recording:

--- BASE ANALYSIS ---
{{transcript}}

Here is context from previous related recordings:

--- RELATED CONTEXT ---
${relatedRecordingsContext}

Please enrich and update the baseline analysis by integrating relevant facts, comparisons, or historical context from the related recordings. Do not remove any information from the baseline analysis; only add or compare. Output the fully updated analysis directly without meta-commentary.`;

        // The "transcript" passed in the second pass is actually the first pass summary
        sum = await summarizeTranscript(sum, secondPassTemplate, ollamaUrl, activeModel, llmProvider, apiKeys[llmProvider] || '', {
          temperature: ollamaTemperature,
          num_ctx: ollamaNumCtx, // Might need to increase this in reality, but sticking to user settings
          num_predict: ollamaNumPredict,
          top_p: ollamaTopP,
          top_k: ollamaTopK,
          system: "CRITICAL INSTRUCTION: Follow the user's prompt strictly to integrate the related recordings context with the base summary.",
          logPath: logPath ? logPath.replace('.log', '_pass2.log') : undefined
        });
      }

      
      // Save to DB
      await saveSummary(tId, sum);
      
      // Save to File
      try {
        if (recording) {
          const baseName = getBaseName(recording.filename);
          
          await writeTextFile(`Epi Library/Summaries/${baseName}_summary.md`, sum, { baseDir: BaseDirectory.Document });
        }
      } catch (err: any) {
        console.error("Failed to write summary file", err);
      }

      if (activeTranscriptIdRef.current === tId) {
        setActiveSummary(sum);
      }
    } catch (err: any) {
      const errMsg = err.message || String(err);
      setSummaryErrors(prev => ({ ...prev, [tId]: errMsg }));
    } finally {
      setSummarizingIds(prev => prev.filter(id => id !== tId));
      if (recId) {
        setSummarizingRecIds(prev => prev.filter(id => id !== recId));
      }
      refreshLibrary();
    }
  };


  const addTranscribingId = (id: number) => setTranscribingIds(prev => [...prev, id]);
  const removeTranscribingId = (id: number) => setTranscribingIds(prev => prev.filter(x => x !== id));
  const addSummarizingRecId = (id: number) => setSummarizingRecIds(prev => [...prev, id]);
  const removeSummarizingRecId = (id: number) => setSummarizingRecIds(prev => prev.filter(x => x !== id));

  /**
   * Loads transcript and summary database data for the active recording.
   * Leverages a reference-based check (`activeRecordingIdRef`) to guard against
   * asynchronous race conditions when the user clicks between recordings quickly.
   * 
   * @param recordingId - The ID of the target recording to load.
   * 
   * @sideEffects
   * * Sets activeRecordingId, activeTranscriptId, activeTranscript, activeSummary, and diarized states.
   */
  const loadRecordingIntoAnalysis = async (recordingId: number | null) => {
    activeRecordingIdRef.current = recordingId;
    setActiveRecordingId(recordingId);
    
    if (recordingId === null) {
      setActiveTranscriptId(null);
      setActiveTranscript(null);
      setActiveSummary(null);
      setDiarized(false);
      return;
    }
    
    try {
      // Fetch transcript
      const t = await getTranscriptForRecording(recordingId);
      // Guard check: if activeRecordingIdRef changed while we were fetching from SQLite,
      // abort immediately to prevent stale data overwrites.
      if (activeRecordingIdRef.current !== recordingId) return;
      
      if (t) {
        setActiveTranscriptId(t.id);
        setActiveTranscript(t.textContent);
        setDiarized(t.textContent.includes(']'));
        
        // Fetch summary
        const s = await getSummaryForTranscript(t.id);
        if (activeRecordingIdRef.current !== recordingId) return;
        setActiveSummary(s ? s.summaryText : null);
      } else {
        setActiveTranscriptId(null);
        setActiveTranscript(null);
        setActiveSummary(null);
        setDiarized(false);
      }
    } catch (err: any) {
      console.error("Failed to load recording analysis data:", err);
      alert(`Failed to load recording details: ${err.message || String(err)}`);
    }
  };


  const triggerTranscription = async (recordingId: number, filename: string) => {
    await loadRecordingIntoAnalysis(recordingId);
    const docsDir = await documentDir();
    const filePath = await join(docsDir, 'Epi Library', 'Recordings', filename);
    await handleTranscription(filePath, recordingId);
  };

  const handleRetryTranscription = async (recordingId: number, filePath: string, language: string, noAlign: boolean) => {
    setPendingLanguagePrompt(null);
    await handleTranscription(filePath, recordingId, language, noAlign);
  };

  const handleCancelLanguagePrompt = () => {
    if (pendingLanguagePrompt) {
      const { recordingId } = pendingLanguagePrompt;
      setTranscriptionErrors(prev => ({ 
        ...prev, 
        [recordingId]: "Transcription cancelled. Alignment model missing." 
      }));
      setPendingLanguagePrompt(null);
    }
  };

  const updateActiveTranscript = async (text: string) => {
    if (!activeTranscriptId) return;
    try {
      await updateTranscript(activeTranscriptId, text);
      setActiveTranscript(text);

      // Sync with local text file
      if (activeRecordingId) {
        const recording = await getRawRecordingById(activeRecordingId);
        if (recording) {
          const baseName = getBaseName(recording.filename);
          await writeTextFile(`Epi Library/Transcriptions/${baseName}_transcript.txt`, text, { baseDir: BaseDirectory.Document });
        }
      }
    } catch (err: any) {
      console.error("Failed to update active transcript:", err);
      throw new Error(`Failed to save transcript: ${err.message || String(err)}`);
    }
  };

  const updateActiveSummary = async (text: string) => {
    if (!activeTranscriptId) return;
    try {
      const existing = await getSummaryForTranscript(activeTranscriptId);
      if (existing) {
        await updateSummary(existing.id, text);
      } else {
        await saveSummary(activeTranscriptId, text);
      }
      setActiveSummary(text);

      // Sync with local Markdown file
      if (activeRecordingId) {
        const recording = await getRawRecordingById(activeRecordingId);
        if (recording) {
          const baseName = getBaseName(recording.filename);
          await writeTextFile(`Epi Library/Summaries/${baseName}_summary.md`, text, { baseDir: BaseDirectory.Document });
        }
      }
    } catch (err: any) {
      console.error("Failed to update active summary:", err);
      throw new Error(`Failed to save summary: ${err.message || String(err)}`);
    }
  };

  const librarySettingsValue = useMemo<LibrarySettingsContextType>(() => ({
    isDark, setIsDark, dbReady, dbError,
    activeTab, setActiveTab,
    recordings, refreshLibrary,
    llmProvider, setLlmProvider,
    ollamaUrl, setOllamaUrl, ollamaModel, setOllamaModel,
    whisperXInstalled, whisperXBinaryPath, installingWhisperX, whisperXLogs, installWhisperX,
    uninstallWhisperX,
    ffmpegStatus, installingFfmpeg, ffmpegLogs, installFfmpeg,
    uninstallFfmpeg,
    whisperXModel, setWhisperXModel, whisperXLanguage, setWhisperXLanguage,
    whisperXPrompt, setWhisperXPrompt, whisperXTemperature, setWhisperXTemperature,
    loadRecordingIntoAnalysis, triggerTranscription,
    autoTranscribe, setAutoTranscribe, enableLogs, setEnableLogs,
    namingSchema, setNamingSchema,
    pendingLanguagePrompt, setPendingLanguagePrompt,
    handleRetryTranscription, handleCancelLanguagePrompt, handleTranscription,
    openaiTranscriptionModel, setOpenaiTranscriptionModel,
    assemblyTranscriptionModel, setAssemblyTranscriptionModel,
    googleTranscriptionModel, setGoogleTranscriptionModel,
    openaiLlmModel, setOpenaiLlmModel,
    anthropicLlmModel, setAnthropicLlmModel,
    googleLlmModel, setGoogleLlmModel,
    whisperXDevice, setWhisperXDevice,
    whisperXComputeType, setWhisperXComputeType,
    whisperXBatchSize, setWhisperXBatchSize,
    whisperXDiarize, setWhisperXDiarize,
    whisperXHfToken, setWhisperXHfToken,
    whisperXMinSpeakers, setWhisperXMinSpeakers,
    whisperXMaxSpeakers, setWhisperXMaxSpeakers,
    ollamaTemperature, setOllamaTemperature,
    ollamaNumCtx, setOllamaNumCtx,
    ollamaNumPredict, setOllamaNumPredict,
    ollamaTopP, setOllamaTopP,
    ollamaTopK, setOllamaTopK,
    ollamaSystemPrompt, setOllamaSystemPrompt,
    intelligenceContextDepth, setIntelligenceContextDepth,
    intelligenceContextFormat, setIntelligenceContextFormat,
    transcriptionProvider, setTranscriptionProvider, apiKeys, setApiKey,
    activeRecordingId, activeTranscriptId,
    activeTranscript, isTranscribing, transcribingIds, transcriptionError, diarized,
    updateActiveTranscript,
    activeSummary, isSummarizing, summarizingRecIds, summaryError, generateSummary,
    updateActiveSummary,
    addTranscribingId, removeTranscribingId, addSummarizingRecId, removeSummarizingRecId
  }), [
    isDark, dbReady, dbError,
    activeTab, recordings, refreshLibrary, llmProvider, ollamaUrl, ollamaModel,
    whisperXInstalled, whisperXBinaryPath, installingWhisperX, whisperXLogs,
    ffmpegStatus, installingFfmpeg, ffmpegLogs,
    whisperXModel, whisperXLanguage, whisperXPrompt, whisperXTemperature,
    pendingLanguagePrompt, openaiTranscriptionModel, assemblyTranscriptionModel,
    googleTranscriptionModel, openaiLlmModel, anthropicLlmModel, googleLlmModel,
    whisperXDevice, whisperXComputeType, whisperXBatchSize, whisperXDiarize,
    whisperXHfToken, whisperXMinSpeakers, whisperXMaxSpeakers,
    ollamaTemperature, ollamaNumCtx, ollamaNumPredict, ollamaTopP, ollamaTopK, ollamaSystemPrompt,
    intelligenceContextDepth, intelligenceContextFormat,
    transcriptionProvider, apiKeys,
    activeRecordingId, activeTranscriptId, activeTranscript, isTranscribing, transcribingIds,
    transcriptionError, diarized, activeSummary, isSummarizing, summarizingRecIds,
    summaryError, namingSchema
  ]);

  return (
    <LibrarySettingsContext.Provider value={librarySettingsValue}>
      {children}
    </LibrarySettingsContext.Provider>
  );

}

export function useLibrarySettings() {
  const context = useContext(LibrarySettingsContext);
  if (context === undefined) {
    throw new Error('useLibrarySettings must be used within an AppProvider');
  }
  return context;
}
