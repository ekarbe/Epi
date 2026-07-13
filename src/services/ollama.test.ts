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
import { getAvailableModels, summarizeTranscript } from './ollama';
import { invoke } from '../lib/api';

vi.mock('../lib/api', () => ({
  invoke: vi.fn(),
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
});
