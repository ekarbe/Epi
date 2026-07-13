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
import { transcribeAudio } from './whisper';
import { invoke, readTextFile } from '../lib/api';

vi.mock('../lib/api', () => ({
  invoke: vi.fn(),
  readTextFile: vi.fn(),
}));

describe('whisper service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws on empty path', async () => {
    await expect(transcribeAudio('')).rejects.toThrow("Audio file path is empty.");
  });

  it('calls cloud provider when provider is not local', async () => {
    vi.mocked(invoke).mockResolvedValue('Cloud result');
    const result = await transcribeAudio('/path.ogg', 'base', 'auto', '', 0, 'openai', 'key');
    expect(result).toBe('Cloud result');
    expect(invoke).toHaveBeenCalledWith('transcribe_cloud', {
      provider: 'openai',
      audioPath: '/path.ogg',
      apiKey: 'key',
      model: 'base',
      language: 'auto',
      prompt: ''
    });
  });

  it('handles local whisperx success', async () => {
    vi.mocked(invoke).mockResolvedValue({
      success: true,
      code: 0,
      stdout: '',
      stderr: ''
    });

    const mockSegments = {
      segments: [
        { start: 0, end: 1, text: 'Hello', speaker: 'SPEAKER_00' },
        { start: 1, end: 2, text: 'World' }
      ]
    };

    vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(mockSegments));

    const result = await transcribeAudio('/test/Recordings/audio.ogg');
    expect(result).toBe('[SPEAKER_00] Hello\nWorld');
    
    // Check paths
    expect(invoke).toHaveBeenCalledWith('run_whisperx', expect.objectContaining({
      audioPath: '/test/Recordings/audio.ogg',
      outputDir: '/test/Transcriptions'
    }));
    expect(readTextFile).toHaveBeenCalledWith('/test/Transcriptions/audio.json');
  });

  it('handles local whisperx failure', async () => {
    vi.mocked(invoke).mockResolvedValue({
      success: false,
      code: 1,
      stdout: '',
      stderr: 'OutOfMemoryError'
    });

    await expect(transcribeAudio('/test/Recordings/audio.ogg'))
      .rejects.toThrow(/The AI engine ran out of memory/);
  });

  it('handles readTextFile failure', async () => {
    vi.mocked(invoke).mockResolvedValue({
      success: true,
      code: 0,
      stdout: '',
      stderr: ''
    });

    vi.mocked(readTextFile).mockRejectedValue(new Error('File not found'));

    await expect(transcribeAudio('/test/Recordings/audio.ogg'))
      .rejects.toThrow(/Failed to read transcript output at/);
  });
});
