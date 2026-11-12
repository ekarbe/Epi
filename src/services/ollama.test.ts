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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAvailableModels, summarizeTranscript, pullModel, deleteModel, OLLAMA_PULL_PROGRESS_EVENT } from './ollama';
import { invoke, listen } from '../lib/api';

vi.mock('../lib/api', () => ({
  invoke: vi.fn(),
  listen: vi.fn(),
  isTauri: true,
}));

describe('ollama service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAvailableModels', () => {
    it('returns empty array on fetch failure', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Network error'));
      const models = await getAvailableModels();
      expect(models).toEqual([]);
    });

    it('returns model names on success', async () => {
      vi.mocked(invoke).mockResolvedValue(['llama3', 'mistral']);

      const models = await getAvailableModels();
      expect(models).toEqual(['llama3', 'mistral']);
    });
  });

  describe('summarizeTranscript', () => {
    it('throws if transcript is empty', async () => {
      await expect(summarizeTranscript('', 'template'))
        .rejects.toThrow("Transcript content is empty.");
    });

    it('throws if promptTemplate is empty', async () => {
      await expect(summarizeTranscript('content', ''))
        .rejects.toThrow("Prompt template is empty.");
    });

    it('calls cloud provider', async () => {
      vi.mocked(invoke).mockResolvedValue('Cloud summary');
      const result = await summarizeTranscript('content', 'summary: {{transcript}}', 'http://url', 'llama3', 'openai', 'key');
      expect(result).toBe('Cloud summary');
      expect(invoke).toHaveBeenCalledWith('generate_cloud_summary', expect.objectContaining({
        provider: 'openai',
        transcript: 'content',
        promptTemplate: 'summary: {{transcript}}',
        apiKey: 'key',
        model: 'llama3'
      }));
    });

    it('handles local ollama success', async () => {
      vi.mocked(invoke).mockResolvedValue('Local summary');

      const result = await summarizeTranscript('content', 'summary: {{transcript}}', 'http://url', 'llama3', 'local');
      expect(result).toBe('Local summary');
      expect(invoke).toHaveBeenCalledWith('generate_local_summary', expect.objectContaining({
        ollamaUrl: 'http://url',
        model: 'llama3'
      }));
    });

    it('handles local ollama failure', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Model not found'));

      await expect(summarizeTranscript('content', 'summary: {{transcript}}'))
        .rejects.toThrow(/Model not found/);
    });
  });

  describe('pullModel', () => {
    it('invokes the backend and forwards progress for the requested model only', async () => {
      const unlisten = vi.fn();
      let handler: (event: { payload: any }) => void = () => {};
      vi.mocked(listen).mockImplementation(async (_event: string, cb: any) => {
        handler = cb;
        return unlisten;
      });
      vi.mocked(invoke).mockImplementation(async () => {
        handler({ payload: { model: 'llama3', percent: null, status: 'pulling manifest' } });
        handler({ payload: { model: 'llama3', percent: 40, status: 'pulling abc' } });
        handler({ payload: { model: 'mistral', percent: 90, status: 'pulling def' } });
        handler({ payload: { model: 'llama3', percent: 100, status: 'success' } });
        return undefined;
      });

      const onProgress = vi.fn();
      await pullModel('http://custom:1234', 'llama3', onProgress);

      expect(listen).toHaveBeenCalledWith(OLLAMA_PULL_PROGRESS_EVENT, expect.any(Function));
      expect(invoke).toHaveBeenCalledWith('pull_ollama_model', { ollamaUrl: 'http://custom:1234', modelName: 'llama3' });
      expect(onProgress.mock.calls).toEqual([[40], [100]]);
      expect(unlisten).toHaveBeenCalledTimes(1);
    });

    it('unlistens and rethrows when the backend fails', async () => {
      const unlisten = vi.fn();
      vi.mocked(listen).mockResolvedValue(unlisten);
      vi.mocked(invoke).mockRejectedValue('pull model manifest: file does not exist');

      await expect(pullModel('http://url', 'nope', vi.fn())).rejects.toBe('pull model manifest: file does not exist');
      expect(unlisten).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteModel', () => {
    it('invokes the backend delete command', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);
      await deleteModel('http://url', 'llama3');
      expect(invoke).toHaveBeenCalledWith('delete_ollama_model', { ollamaUrl: 'http://url', modelName: 'llama3' });
    });

    it('propagates backend errors', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('model not found'));
      await expect(deleteModel('http://url', 'ghost')).rejects.toThrow('model not found');
    });
  });
});
