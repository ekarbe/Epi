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
import { invoke, loadStore } from './api';
import { loadSecrets, migrateLegacySecrets, setSecret, getSecret } from './secrets';

vi.mock('./api', () => ({
  invoke: vi.fn(),
  loadStore: vi.fn(),
}));

/** Builds a fake tauri-plugin-store instance backed by a plain object. */
function fakeStore(initial: Record<string, any>) {
  const data = { ...initial };
  return {
    data,
    get: vi.fn(async (key: string) => data[key]),
    set: vi.fn(async (key: string, value: any) => { data[key] = value; }),
    delete: vi.fn(async (key: string) => { const had = key in data; delete data[key]; return had; }),
    save: vi.fn(async () => {}),
  };
}

/** Fake keyring: get_secret/set_secret operate on `keyring`. */
function useFakeKeyring(keyring: Record<string, string>, failSet = false) {
  vi.mocked(invoke).mockImplementation(async (cmd: string, args?: any) => {
    if (cmd === 'get_secret') return (keyring[args.name] ?? null) as any;
    if (cmd === 'set_secret') {
      if (failSet) throw 'The system keyring is not available';
      if (args.value) keyring[args.name] = args.value;
      else delete keyring[args.name];
      return undefined as any;
    }
    return undefined as any;
  });
}

describe('secrets', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(loadStore).mockReset();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('getSecret maps a missing secret to an empty string', async () => {
    useFakeKeyring({ openai: 'sk-1' });
    expect(await getSecret('openai')).toBe('sk-1');
    expect(await getSecret('google')).toBe('');
  });

  it('setSecret forwards name and value to the backend', async () => {
    useFakeKeyring({});
    await setSecret('anthropic', 'sk-ant');
    expect(invoke).toHaveBeenCalledWith('set_secret', { name: 'anthropic', value: 'sk-ant' });
  });

  it('loads API keys and the HF token from the keyring', async () => {
    useFakeKeyring({ openai: 'sk-1', assembly: 'aai', hf_token: 'hf_x' });
    vi.mocked(loadStore).mockResolvedValue(fakeStore({}) as any);

    const result = await loadSecrets();

    expect(result).toEqual({ apiKeys: { openai: 'sk-1', assembly: 'aai' }, hfToken: 'hf_x', migrationErrors: [] });
    for (const name of ['openai', 'anthropic', 'google', 'assembly', 'hf_token']) {
      expect(invoke).toHaveBeenCalledWith('get_secret', { name });
    }
  });

  it('keeps loading other secrets when one keyring read fails', async () => {
    vi.mocked(loadStore).mockResolvedValue(fakeStore({}) as any);
    vi.mocked(invoke).mockImplementation(async (cmd: string, args?: any) => {
      if (cmd === 'get_secret' && args.name === 'openai') throw 'keyring locked';
      if (cmd === 'get_secret' && args.name === 'google') return 'g-key' as any;
      return null as any;
    });

    const result = await loadSecrets();

    expect(result).toEqual({ apiKeys: { google: 'g-key' }, hfToken: '', migrationErrors: [] });
    expect(console.error).toHaveBeenCalled();
  });

  it('migrates plaintext secrets into the keyring and then removes them', async () => {
    const keyring: Record<string, string> = {};
    useFakeKeyring(keyring);
    const store = fakeStore({ api_keys: { openai: 'sk-old', google: '', anthropic: 'sk-ant-old' }, other: 1 });
    vi.mocked(loadStore).mockResolvedValue(store as any);
    localStorage.setItem('epi_whisperx_hf_token', 'hf_old');

    const result = await loadSecrets();

    expect(keyring).toEqual({ openai: 'sk-old', anthropic: 'sk-ant-old', hf_token: 'hf_old' });
    expect(store.delete).toHaveBeenCalledWith('api_keys');
    expect(store.save).toHaveBeenCalled();
    expect(store.data).toEqual({ other: 1 });
    expect(localStorage.getItem('epi_whisperx_hf_token')).toBeNull();
    expect(result).toEqual({ apiKeys: { openai: 'sk-old', anthropic: 'sk-ant-old' }, hfToken: 'hf_old', migrationErrors: [] });
  });

  it('keeps the plaintext copies when writing to the keyring fails', async () => {
    useFakeKeyring({}, true);
    const store = fakeStore({ api_keys: { openai: 'sk-old' } });
    vi.mocked(loadStore).mockResolvedValue(store as any);
    localStorage.setItem('epi_whisperx_hf_token', 'hf_old');

    const errors = await migrateLegacySecrets();

    expect(errors).toEqual([
      'Cloud API keys: The system keyring is not available',
      'Hugging Face token: The system keyring is not available',
    ]);
    expect(store.delete).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
    expect(store.data.api_keys).toEqual({ openai: 'sk-old' });
    expect(localStorage.getItem('epi_whisperx_hf_token')).toBe('hf_old');
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it('does not overwrite a newer keyring value with the stale plaintext copy', async () => {
    const keyring: Record<string, string> = { openai: 'sk-new', hf_token: 'hf_new' };
    useFakeKeyring(keyring);
    const store = fakeStore({ api_keys: { openai: 'sk-old', google: 'g-old' } });
    vi.mocked(loadStore).mockResolvedValue(store as any);
    localStorage.setItem('epi_whisperx_hf_token', 'hf_old');

    expect(await migrateLegacySecrets()).toEqual([]);

    expect(keyring).toEqual({ openai: 'sk-new', google: 'g-old', hf_token: 'hf_new' });
    expect(store.data.api_keys).toBeUndefined();
    expect(localStorage.getItem('epi_whisperx_hf_token')).toBeNull();
  });

  it('does nothing when there is nothing to migrate', async () => {
    useFakeKeyring({});
    const store = fakeStore({});
    vi.mocked(loadStore).mockResolvedValue(store as any);

    await migrateLegacySecrets();

    expect(invoke).not.toHaveBeenCalledWith('set_secret', expect.anything());
    expect(store.delete).not.toHaveBeenCalled();
  });

  it('removes an empty legacy HF token without writing it', async () => {
    useFakeKeyring({});
    vi.mocked(loadStore).mockResolvedValue(fakeStore({}) as any);
    localStorage.setItem('epi_whisperx_hf_token', '');

    await migrateLegacySecrets();

    expect(invoke).not.toHaveBeenCalledWith('set_secret', expect.anything());
    expect(localStorage.getItem('epi_whisperx_hf_token')).toBeNull();
  });
});
