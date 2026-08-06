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

import { invoke, isTauri } from '../lib/api';





/**
 * Advanced configuration parameters for Ollama summarization.
 */
export interface OllamaAdvancedOptions {
  system?: string;
  temperature?: number;
  num_ctx?: number;
  num_predict?: number;
  top_p?: number;
  top_k?: number;
  timeoutMs?: number;
  logPath?: string;
}

/**
 * Fetches the list of available model names from the local Ollama instance.
 * 
 * @param ollamaUrl The base URL of the Ollama server.
 * @returns A promise that resolves to an array of model names, or empty if request fails.
 */
export async function getAvailableModels(ollamaUrl: string = 'http://localhost:11434'): Promise<string[]> {
  if (!isTauri) {
    return ['llama3', 'mistral'];
  }
  try {
    const models: string[] = await invoke('get_local_models', { ollamaUrl });
    return models;
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error("Failed to fetch ollama models:", errMessage);
    return [];
  }
}

/**
 * Generates a summary for a transcript using either local Ollama or a cloud provider.
 * 
 * @param transcript The transcription text to summarize.
 * @param promptTemplate Template string containing `{{transcript}}`.
 * @param ollamaUrl Base URL of local Ollama (only used if provider is 'local').
 * @param ollamaModel The model name to run (local or cloud).
 * @param provider 'local' or the name of a cloud provider (e.g. 'openai', 'anthropic', 'google').
 * @param apiKey API key required for cloud providers.
 * @param advanced Additional LLM parameters (e.g. system prompt, temperature, context size, timeoutMs).
 * @returns A promise that resolves to the generated summary text.
 */
export async function summarizeTranscript(
  transcript: string,
  promptTemplate: string,
  ollamaUrl: string = 'http://localhost:11434',
  ollamaModel: string = 'llama3',
  provider: string = 'local',
  apiKey: string = '',
  advanced: OllamaAdvancedOptions = {}
): Promise<string> {
  if (!isTauri) {
    return await invoke('generate_cloud_summary', { transcript });
  }

  if (!transcript || transcript.trim() === '') {
    throw new Error("Transcript content is empty.");
  }
  if (!promptTemplate || promptTemplate.trim() === '') {
    throw new Error("Prompt template is empty.");
  }
  
  try {
    if (provider !== 'local') {
      const result: string = await invoke('generate_cloud_summary', {
        provider,
        transcript,
        promptTemplate: advanced.system ? advanced.system + '\n\n' + promptTemplate : promptTemplate,
        apiKey,
        model: ollamaModel,
      });
      return result;
    }

    const result: string = await invoke('generate_local_summary', {
      ollamaUrl,
      model: ollamaModel,
      transcript,
      promptTemplate,
      system: advanced.system || '',
      temperature: advanced.temperature,
      numCtx: advanced.num_ctx,
      numPredict: advanced.num_predict,
      topP: advanced.top_p,
      topK: advanced.top_k,
      timeoutMs: advanced.timeoutMs || 300000,
      logPath: advanced.logPath || null
    });
    return result;
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    if (provider === 'local') {
      throw new Error(`Failed to connect to Ollama: ${errMessage}`);
    } else {
      throw new Error(`Summarization Error: ${errMessage}`);
    }
  }
}
