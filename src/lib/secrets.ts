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

import { invoke, loadStore } from './api';

/**
 * Cloud provider ids whose API keys are kept in the OS keyring.
 * Must match `ALLOWED_SECRETS` in `src-tauri/src/secrets.rs`.
 */
export const API_KEY_PROVIDERS = ['openai', 'anthropic', 'google', 'assembly'] as const;

/** Keyring name of the Hugging Face token used for WhisperX diarization. */
export const HF_TOKEN_SECRET = 'hf_token';

/** Former plaintext locations, only read for the one-time migration. */
export const LEGACY_SETTINGS_FILE = 'settings.json';
export const LEGACY_API_KEYS_STORE_KEY = 'api_keys';
export const LEGACY_HF_TOKEN_STORAGE_KEY = 'epi_whisperx_hf_token';

/** Reads a secret from the OS keyring; resolves to '' when none is stored. */
export async function getSecret(name: string): Promise<string> {
  const value = await invoke<string | null>('get_secret', { name });
  return value ?? '';
}

/** Writes a secret to the OS keyring. An empty value deletes it. */
export async function setSecret(name: string, value: string): Promise<void> {
  await invoke('set_secret', { name, value });
}

/**
 * Writes a migrated plaintext secret to the OS keyring unless the keyring
 * already holds a value for it. A value already in the keyring is newer (it
 * was saved after an earlier, failed migration attempt) and must not be
 * overwritten by the stale plaintext copy.
 */
async function migrateSecret(name: string, value: string): Promise<void> {
  if (await getSecret(name)) return;
  await setSecret(name, value);
}

/**
 * Moves secrets from their former plaintext locations into the OS keyring:
 * `api_keys` in `settings.json` (tauri-plugin-store) and the Hugging Face
 * token in localStorage. The plaintext copy is removed only after every
 * keyring write for it succeeded, so a failed migration is retried on the
 * next start instead of losing the secret.
 *
 * @returns One message per location that could not be migrated (empty on success).
 */
export async function migrateLegacySecrets(): Promise<string[]> {
  const errors: string[] = [];
  try {
    const store = await loadStore(LEGACY_SETTINGS_FILE);
    const legacy = await store.get(LEGACY_API_KEYS_STORE_KEY);
    if (legacy && typeof legacy === 'object') {
      for (const provider of API_KEY_PROVIDERS) {
        const value = (legacy as Record<string, unknown>)[provider];
        if (typeof value === 'string' && value.trim()) {
          await migrateSecret(provider, value);
        }
      }
      await store.delete(LEGACY_API_KEYS_STORE_KEY);
      await store.save();
    }
  } catch (err: any) {
    console.error('Failed to migrate API keys from settings.json to the system keyring:', err);
    errors.push(`Cloud API keys: ${err?.message || String(err)}`);
  }

  try {
    const token = localStorage.getItem(LEGACY_HF_TOKEN_STORAGE_KEY);
    if (token !== null) {
      if (token.trim()) {
        await migrateSecret(HF_TOKEN_SECRET, token);
      }
      localStorage.removeItem(LEGACY_HF_TOKEN_STORAGE_KEY);
    }
  } catch (err: any) {
    console.error('Failed to migrate the Hugging Face token to the system keyring:', err);
    errors.push(`Hugging Face token: ${err?.message || String(err)}`);
  }
  return errors;
}

/**
 * Runs the legacy migration and then loads all API keys and the Hugging Face
 * token from the OS keyring. Secrets that cannot be read are reported via
 * console.error and left empty; migration failures are returned in
 * `migrationErrors` so the caller can tell the user.
 */
export async function loadSecrets(): Promise<{ apiKeys: Record<string, string>; hfToken: string; migrationErrors: string[] }> {
  const migrationErrors = await migrateLegacySecrets();

  const names = [...API_KEY_PROVIDERS, HF_TOKEN_SECRET];
  const results = await Promise.allSettled(names.map(name => getSecret(name)));
  const apiKeys: Record<string, string> = {};
  let hfToken = '';
  results.forEach((result, i) => {
    const name = names[i];
    if (result.status === 'rejected') {
      console.error(`Failed to read "${name}" from the system keyring:`, result.reason);
      return;
    }
    if (name === HF_TOKEN_SECRET) {
      hfToken = result.value;
    } else if (result.value) {
      apiKeys[name] = result.value;
    }
  });
  return { apiKeys, hfToken, migrationErrors };
}
