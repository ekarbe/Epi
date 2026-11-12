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

/**
 * Environment of the app under test and the location of its library.
 *
 * Linux: the app gets a throw-away HOME with its own XDG directories, so the
 * library (~/Documents/Epi Library), the database (XDG config/data dirs) and
 * the WebView's localStorage never touch the developer's real data. The
 * `dirs` crate and Tauri resolve all of these from HOME / XDG_* variables and
 * ~/.config/user-dirs.dirs. Audio still reaches the user's PulseAudio daemon:
 * its socket and cookie are passed explicitly (PULSE_SERVER / PULSE_COOKIE),
 * and ~/.asoundrc (written by e2e/ci/setup-audio-linux.sh to route ALSA to
 * PulseAudio, which cpal needs to list devices) is copied over.
 *
 * Windows: Documents and AppData are Known Folders resolved through the shell
 * API, not environment variables, so they cannot be redirected without
 * changing the user's registry. The tests then use the real library and only
 * create (and finally remove) files whose names start with a unique prefix.
 *
 * Set EPI_E2E_NO_ISOLATION=1 to use the real home directory on Linux too.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Whether the app runs with an isolated home directory. */
export const isolated = process.platform === 'linux' && process.env.EPI_E2E_NO_ISOLATION !== '1';

/**
 * Returns the PulseAudio server address of the current user (e.g.
 * `unix:/run/user/1001/pulse/native`), or null if there is none.
 */
function pulseServer() {
  if (process.env.PULSE_SERVER) return process.env.PULSE_SERVER;
  try {
    const info = execFileSync('pactl', ['info'], { encoding: 'utf8' });
    const match = info.match(/^Server String:\s*(.+)$/m);
    if (!match) return null;
    const server = match[1].trim();
    return server.startsWith('/') ? `unix:${server}` : server;
  } catch {
    return null;
  }
}

/**
 * Creates the isolated home directory (Linux) and returns the environment for
 * tauri-driver, which passes it on to WebKitWebDriver and the app.
 *
 * @param {string} workDir Directory to create the home directory in.
 * @returns {NodeJS.ProcessEnv} The environment for the app.
 */
export function prepareAppEnv(workDir) {
  const env = { ...process.env };
  if (!isolated) return env;

  const realHome = os.homedir();
  const home = path.join(workDir, 'home');
  fs.rmSync(home, { recursive: true, force: true });
  const config = path.join(home, '.config');
  for (const dir of ['Documents', '.config', '.local/share', '.local/state', '.cache']) {
    fs.mkdirSync(path.join(home, dir), { recursive: true });
  }
  // $HOME stays literal: user-dirs.dirs expands it itself.
  fs.writeFileSync(path.join(config, 'user-dirs.dirs'), 'XDG_DOCUMENTS_DIR="$HOME/Documents"\n');

  const asoundrc = path.join(realHome, '.asoundrc');
  if (fs.existsSync(asoundrc)) fs.copyFileSync(asoundrc, path.join(home, '.asoundrc'));

  const server = pulseServer();
  if (server) env.PULSE_SERVER = server;
  const realConfig = process.env.XDG_CONFIG_HOME || path.join(realHome, '.config');
  const cookie = process.env.PULSE_COOKIE || path.join(realConfig, 'pulse', 'cookie');
  if (fs.existsSync(cookie)) env.PULSE_COOKIE = cookie;

  Object.assign(env, {
    HOME: home,
    XDG_CONFIG_HOME: config,
    XDG_DATA_HOME: path.join(home, '.local/share'),
    XDG_STATE_HOME: path.join(home, '.local/state'),
    XDG_CACHE_HOME: path.join(home, '.cache'),
  });
  return env;
}

/**
 * Returns the `Epi Library` directory the app under test uses.
 *
 * @param {string} workDir The directory passed to {@link prepareAppEnv}.
 * @returns {string} Absolute path of the library directory.
 */
export function libraryDir(workDir) {
  if (isolated) return path.join(workDir, 'home', 'Documents', 'Epi Library');
  if (process.platform === 'win32') {
    const docs = execFileSync(
      'powershell',
      ['-NoProfile', '-Command', "[Environment]::GetFolderPath('MyDocuments')"],
      { encoding: 'utf8' },
    ).trim();
    return path.join(docs, 'Epi Library');
  }
  // Non-isolated Linux. Like the `dirs` crate, honour user-dirs.dirs.
  const userDirs = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'user-dirs.dirs');
  let docs = path.join(os.homedir(), 'Documents');
  try {
    const match = fs.readFileSync(userDirs, 'utf8').match(/^XDG_DOCUMENTS_DIR="(.+)"$/m);
    if (match) docs = match[1].replace('$HOME', os.homedir());
  } catch {
    // No user-dirs.dirs: keep ~/Documents.
  }
  return path.join(docs, 'Epi Library');
}
