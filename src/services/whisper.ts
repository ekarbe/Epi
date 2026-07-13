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

import { invoke, readTextFile } from '../lib/api';

/**
 * Options interface for WhisperX local/cloud run execution.
 */
export interface WhisperAdvancedOptions {
  device?: 'cpu' | 'cuda';
  computeType?: 'int8' | 'float16' | 'float32';
  batchSize?: number;
  diarize?: boolean;
  hfToken?: string;
  minSpeakers?: number;
  maxSpeakers?: number;
  noAlign?: boolean;
  logPath?: string;
}

/**
 * Tauri response structure returned by `run_whisperx`.
 */
interface WhisperXCommandResult {
  success: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Structure of a segment returned by the WhisperX transcription JSON.
 */
interface WhisperSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  words?: Array<{
    word: string;
    start?: number;
    end?: number;
    score?: number;
    speaker?: string;
  }>;
}

/**
 * Analyzes raw stderr from WhisperX and returns a user-friendly error message.
 */
function analyzeWhisperError(rawStderr: string): string {
  const lower = rawStderr.toLowerCase();
  
  if (lower.includes('cuda driver version is insufficient')) {
    return "Your graphics card driver is too old to run CUDA. Please update your NVIDIA drivers or switch to CPU in the Engine tab.";
  }
  if (lower.includes('outofmemoryerror') || lower.includes('cuda out of memory')) {
    return "The AI engine ran out of memory. Try reducing the batch size in the Engine tab.";
  }
  if (lower.includes('unauthenticated requests to the hf hub') || lower.includes('401 client error')) {
    return "Diarization failed because the HuggingFace token is invalid or missing. Please check your token in the Engine tab and ensure you have accepted the Pyannote model agreements on HuggingFace.";
  }
  if (lower.includes('no such file or directory') || lower.includes('not found')) {
    return "WhisperX executable or virtual environment not found. Please ensure WhisperX is installed properly in the Engine tab.";
  }
  
  return "An unexpected error occurred during transcription.";
}

/**
 * Transcribes an audio file into text using either a local WhisperX model or cloud APIs.
 * 
 * @param audioFilePath Absolute path to the source audio file.
 * @param model Model size/type (e.g. 'base', 'small', 'medium', 'large-v3').
 * @param language Target language ('auto' for auto-detection).
 * @param prompt Optional initial text prompt to guide transcription style.
 * @param temperature Temperature setting for sampling (0.0 for deterministic).
 * @param provider 'local' or name of a cloud service ('openai', 'assembly', 'google').
 * @param apiKey Required authorization key for cloud service providers.
 * @param advanced Additional advanced options (GPU compute type, speakers, diarization).
 * @returns A promise that resolves to the formatted transcript string.
 */
export async function transcribeAudio(
  audioFilePath: string, 
  model: string = 'base', 
  language: string = 'auto', 
  prompt: string = '', 
  temperature: number = 0,
  provider: string = 'local',
  apiKey: string = '',
  advanced: WhisperAdvancedOptions = {}
): Promise<string> {
  if (!audioFilePath || audioFilePath.trim() === '') {
    throw new Error("Audio file path is empty.");
  }

  try {
    if (provider !== 'local') {
      const result: string = await invoke('transcribe_cloud', {
        provider,
        audioPath: audioFilePath,
        apiKey,
        model,
        language,
        prompt
      });
      return result;
    }

    const lastSlash = Math.max(audioFilePath.lastIndexOf('/'), audioFilePath.lastIndexOf('\\'));
    const recordingDir = lastSlash !== -1 ? audioFilePath.substring(0, lastSlash) : '.';
    
    // Case-insensitive replace for 'Recordings' path structure
    const outputDir = recordingDir.replace(/[/\\]Recordings$/i, (match) => 
      match.replace(/Recordings/i, 'Transcriptions')
    );

    let output: WhisperXCommandResult;
    try {
      output = await invoke('run_whisperx', {
        audioPath: audioFilePath,
        outputDir: outputDir,
        model,
        language,
        initialPrompt: prompt,
        temperature: temperature,
        device: advanced.device || 'cpu',
        computeType: advanced.computeType || 'int8',
        batchSize: advanced.batchSize || 8,
        diarize: advanced.diarize || false,
        hfToken: advanced.hfToken || '',
        minSpeakers: advanced.minSpeakers || 1,
        maxSpeakers: advanced.maxSpeakers || 5,
        noAlign: advanced.noAlign || false,
        logPath: advanced.logPath || null
      });
    } catch (invokeErr) {
      const invokeErrStr = String(invokeErr);
      const friendlyMsg = analyzeWhisperError(invokeErrStr);
      throw new Error(`${friendlyMsg}\n__RAW_ERROR__\n${invokeErrStr}`);
    }

    if (!output.success) {
      const errorMsg = output.stderr || output.stdout || "Unknown error occurred";
      const friendlyMsg = analyzeWhisperError(errorMsg);
      throw new Error(`${friendlyMsg}\n__RAW_ERROR__\nWhisperX failed with code ${output.code}:\n${errorMsg}`);
    }

    const lastDot = audioFilePath.lastIndexOf('.');
    const baseName = lastDot !== -1 && lastDot > lastSlash ? audioFilePath.substring(lastSlash + 1, lastDot) : audioFilePath.substring(lastSlash + 1);
    const jsonPath = `${outputDir}/${baseName}.json`;
    
    let jsonContent: string;
    try {
      jsonContent = await readTextFile(jsonPath);
    } catch (fsErr) {
      const fsErrStr = fsErr instanceof Error ? fsErr.message : String(fsErr);
      throw new Error(`Failed to read transcript output at ${jsonPath}. WhisperX may have failed to write the file.\n__RAW_ERROR__\n${fsErrStr}`);
    }

    let parsed: { segments?: WhisperSegment[] };
    try {
      parsed = JSON.parse(jsonContent);
    } catch (parseErr) {
      const parseErrStr = parseErr instanceof Error ? parseErr.message : String(parseErr);
      throw new Error(`Failed to parse WhisperX output file. The file is corrupted.\n__RAW_ERROR__\n${parseErrStr}`);
    }

    if (!parsed || !parsed.segments || !Array.isArray(parsed.segments)) {
      throw new Error("Invalid WhisperX output format: segments not found.\n__RAW_ERROR__\nJSON output does not contain a valid 'segments' array.");
    }

    const transcript = parsed.segments.map((seg: WhisperSegment) => {
      if (seg.speaker) {
        return `[${seg.speaker}] ${(seg.text || '').trim()}`;
      } else {
        return (seg.text || '').trim();
      }
    }).join('\n');

    return transcript;
  } catch (err) {
    console.error("Transcription error:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw new Error(errorMessage || "An unknown transcription error occurred.");
  }
}
