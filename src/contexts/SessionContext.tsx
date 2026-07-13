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
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import { createContext, useRef, useContext, useState, useEffect, ReactNode } from 'react';
import { invoke, documentDir, join, BaseDirectory, exists } from '../lib/api';
import { sanitizeFilename } from '../utils/path';

export interface AudioDeviceSelection {
  name: string;
  is_input: boolean;
  is_output: boolean;
}

interface ActiveSessionContextType {
  isRecording: boolean;
  isRecordingTransitioning: boolean;
  recordingSeconds: number;
  startRecording: (label?: string) => Promise<void>;
  stopRecording: () => Promise<void>;
  recordingError: string | null;
  audioDevices: { name: string; is_input: boolean; is_output: boolean; is_default: boolean }[];
  refreshAudioDevices: () => Promise<void>;
  selectedAudioDevices: AudioDeviceSelection[];
  toggleAudioDevice: (device: AudioDeviceSelection) => void;
}

const ActiveSessionContext = createContext<ActiveSessionContextType | undefined>(undefined);

export function SessionProvider({ 
  children,
  onRecordingStopped,
  enableLogs,
}: { 
  children: ReactNode,
  onRecordingStopped: (savedPaths: string[], duration: number, label: string | null) => Promise<void>,
  enableLogs: boolean,
  
}) {
  const isRecordingRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingTransitioning, setIsRecordingTransitioning] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<any[]>([]);

  const [activeRecordingLabel, setActiveRecordingLabel] = useState<string | null>(null);

  const [selectedAudioDevices, setSelectedAudioDevices] = useState<AudioDeviceSelection[]>(() => {
    try {
      const stored = localStorage.getItem('epi_selected_audio_devices');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to read selected devices from localStorage", e);
    }
    return [];
  });

  const toggleAudioDevice = (device: AudioDeviceSelection) => {
    setSelectedAudioDevices(prev => {
      const exists = prev.find(d => d.name === device.name && d.is_input === device.is_input && d.is_output === device.is_output);
      let newState;
      if (exists) {
        newState = prev.filter(d => !(d.name === device.name && d.is_input === device.is_input && d.is_output === device.is_output));
      } else {
        newState = [...prev, device];
      }
      try {
        localStorage.setItem('epi_selected_audio_devices', JSON.stringify(newState));
      } catch (e) {
        console.warn("Failed to save audio devices to localStorage", e);
      }
      return newState;
    });
  };

  // Timer effect
  useEffect(() => {
    isRecordingRef.current = isRecording;
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const refreshAudioDevices = async () => {
    try {
      const devices = await invoke<any[]>('get_audio_devices');
      setAudioDevices(devices);
      // Auto-select "Default Audio Device" if no preference has been saved yet
      setSelectedAudioDevices(prev => {
        if (localStorage.getItem('epi_selected_audio_devices') === null) {
          let defaultInput = devices.find(d => d.is_input && d.name === "Default Audio Device");
          let defaultOutput = devices.find(d => d.is_output && d.name === "Default Audio Device");

          if (!defaultInput) defaultInput = devices.find(d => d.is_input && d.is_default);
          if (!defaultOutput) defaultOutput = devices.find(d => d.is_output && d.is_default);

          const defaults: AudioDeviceSelection[] = [];
          if (defaultInput) defaults.push({ name: defaultInput.name, is_input: defaultInput.is_input, is_output: defaultInput.is_output });
          if (defaultOutput) defaults.push({ name: defaultOutput.name, is_input: defaultOutput.is_output, is_output: defaultOutput.is_output });

          if (defaults.length > 0) {
            try {
              localStorage.setItem('epi_selected_audio_devices', JSON.stringify(defaults));
            } catch (e) {}
            return defaults;
          }
        } else if (prev.length > 0) {
          const validSaved = prev.filter(p => devices.some(d => d.name === p.name && d.is_input === p.is_input && d.is_output === p.is_output));
          if (validSaved.length !== prev.length) {
            try {
              localStorage.setItem('epi_selected_audio_devices', JSON.stringify(validSaved));
            } catch (e) {}
            return validSaved;
          }
        }
        return prev;
      });
    } catch (err: any) {
      console.error("Failed to get audio devices", err);
    }
  };

  useEffect(() => {
    refreshAudioDevices();
  }, []);

  const startRecording = async (label?: string) => {
    if (isRecordingTransitioning || isRecording) return;
    setIsRecordingTransitioning(true);
    try {
      setRecordingError(null);
      const docsDir = await documentDir();
      const epiDir = await join(docsDir, 'Epi Library');

      let baseName = label && label.trim().length > 0 ? label.trim() : "";
      if (!baseName) {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const MM = String(now.getMonth() + 1).padStart(2, '0');
        const YYYY = now.getFullYear();
        const HH = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        baseName = `${dd}_${MM}_${YYYY}_${HH}-${mm}-${ss}`;
      }

      baseName = sanitizeFilename(baseName);

      let outputFilename = `${baseName}.ogg`;
      let counter = 1;
      while (await exists(`Epi Library/Recordings/${outputFilename}`, { baseDir: BaseDirectory.Document })) {
        outputFilename = `${baseName} (${counter}).ogg`;
        counter++;
      }

      const outputPath = await join(epiDir, 'Recordings', outputFilename);
      const logPath = enableLogs ? await join(epiDir, 'Logs', `${outputFilename.replace('.ogg', '')}_ffmpeg.log`) : null;
      
      const deviceNames = selectedAudioDevices.length > 0 ? selectedAudioDevices : [];
      isRecordingRef.current = true;
      await invoke('start_recording', { outputPath, logPath, deviceNames });
      await invoke('set_tray_recording_state', { isRecording: true }).catch(err => console.warn("Tray icon update failed", err));
      setIsRecording(true);
      setActiveRecordingLabel(label && label.trim().length > 0 ? label.trim() : null);

    } catch (err: any) {
      isRecordingRef.current = false;
      setRecordingError(err.message || String(err));
    } finally {
      setIsRecordingTransitioning(false);
    }
  };

  const stopRecording = async () => {
    if (isRecordingTransitioning || !isRecording) return;
    setIsRecordingTransitioning(true);
    try {
      const duration = recordingSeconds;

      const savedPaths: string[] = await invoke('stop_recording');
      await invoke('set_tray_recording_state', { isRecording: false }).catch(err => console.warn("Tray icon update failed", err));
      setIsRecording(false);
      
      const label = savedPaths.length > 1 ? `Session ${new Date().toLocaleTimeString()}` : activeRecordingLabel;
      
      // Let the wrapper context save to DB and trigger transcription
      await onRecordingStopped(savedPaths, duration, label);

    } catch (err: any) {
      setRecordingError(err.message || String(err));
      setIsRecording(false);
    } finally {
      setIsRecordingTransitioning(false);
      isRecordingRef.current = false;
    }
  };

  const activeSessionValue = {
    isRecording, isRecordingTransitioning, recordingSeconds, startRecording, stopRecording, recordingError,
    audioDevices, refreshAudioDevices, selectedAudioDevices, toggleAudioDevice,
  };

  return (
    <ActiveSessionContext.Provider value={activeSessionValue}>
      {children}
    </ActiveSessionContext.Provider>
  );
}

export function useActiveSession() {
  const context = useContext(ActiveSessionContext);
  if (context === undefined) {
    throw new Error('useActiveSession must be used within a SessionProvider');
  }
  return context;
}
