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
 * WebdriverIO configuration for the UI end-to-end tests.
 *
 * Drives the real desktop app (debug build) through tauri-driver, which
 * forwards WebDriver to the platform's native driver: WebKitWebDriver on
 * Linux (package webkit2gtk-driver), msedgedriver on Windows. macOS has no
 * WebDriver for WKWebView, so these tests do not run there.
 * See https://v2.tauri.app/develop/tests/webdriver/
 *
 * Usage (Linux; virtual audio from e2e/ci/setup-audio-linux.sh):
 *
 *   cargo install tauri-driver --locked
 *   e2e/ci/setup-audio-linux.sh
 *   cd e2e/ui && npm ci
 *   xvfb-run -a npm test              # without a display
 *
 * Usage (Windows, elevated PowerShell; installs VB-CABLE, see the scripts):
 *
 *   cargo install tauri-driver --locked
 *   .\e2e\ci\setup-audio-windows.ps1
 *   $env:EPI_E2E_NATIVE_DRIVER = .\e2e\ci\setup-msedgedriver.ps1
 *   $env:EPI_E2E_INPUT_DEVICE = 'CABLE Output'
 *   cd e2e\ui; npm ci; npm test
 *
 * CI runs both in .github/workflows/e2e.yml (job ui-e2e). A failed test
 * leaves a screenshot in <work dir>/screenshots.
 *
 * Environment (all optional):
 *   EPI_E2E_SKIP_BUILD=1     use the existing src-tauri/target/debug/epi
 *                            instead of running `npm run tauri build -- --debug --no-bundle`
 *                            (`cargo build`/`cargo test` overwrite that binary with one
 *                            that loads the Vite dev server, so rebuild after them)
 *   EPI_E2E_APP              path of the app binary to test
 *   TAURI_DRIVER             path of tauri-driver (default: ~/.cargo/bin/tauri-driver)
 *   EPI_E2E_NATIVE_DRIVER    native driver passed to tauri-driver (--native-driver),
 *                            e.g. the msedgedriver.exe matching the WebView2 runtime
 *   EPI_E2E_INPUT_DEVICE     part of the input device name to record from
 *                            (default: the system default input)
 *   EPI_E2E_TONE_HZ          expected test tone (default 440)
 *   EPI_E2E_RECORD_SECS      recording length (default 5)
 *   EPI_E2E_UI_WORK_DIR      work directory (isolated home on Linux, logs)
 *   EPI_E2E_NO_ISOLATION=1   do not isolate HOME on Linux (see helpers/env.mjs)
 *   EPI_E2E_KEEP=1           keep the recording files and the isolated home
 *
 * The suite lives in its own package (e2e/ui/package.json) so that the
 * WebdriverIO dependency tree stays out of the app's package-lock.json.
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isolated, prepareAppEnv } from './helpers/env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const exe = process.platform === 'win32' ? '.exe' : '';

const application = process.env.EPI_E2E_APP
  || path.join(repoRoot, 'src-tauri', 'target', 'debug', `epi${exe}`);
const tauriDriverPath = process.env.TAURI_DRIVER
  || path.join(os.homedir(), '.cargo', 'bin', `tauri-driver${exe}`);

// Shared by the launcher and the worker processes (workers inherit the
// launcher's environment), so set it once here.
process.env.EPI_E2E_UI_WORK_DIR ||= path.join(os.tmpdir(), 'epi-e2e-ui');
const workDir = process.env.EPI_E2E_UI_WORK_DIR;

const DRIVER_PORT = 4444;

/** @type {import('node:child_process').ChildProcess | null} */
let tauriDriver = null;

/** Resolves once something accepts TCP connections on `port`, polling for at most `timeoutMs`. */
async function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const open = await new Promise((resolve) => {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false));
    });
    if (open) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`tauri-driver did not listen on port ${port} within ${timeoutMs} ms`);
}

function stopTauriDriver() {
  if (tauriDriver && tauriDriver.exitCode === null) tauriDriver.kill();
  tauriDriver = null;
}

export const config = {
  runner: 'local',
  hostname: '127.0.0.1',
  port: DRIVER_PORT,
  specs: ['./specs/**/*.e2e.mjs'],
  maxInstances: 1,
  capabilities: [{
    maxInstances: 1,
    'tauri:options': { application },
    // WebKitWebDriver and tauri-driver only speak classic WebDriver; without
    // this, WebdriverIO 9 asks for a BiDi session (webSocketUrl).
    'wdio:enforceWebDriverClassic': true,
  }],
  logLevel: 'warn',
  outputDir: path.join(workDir, 'wdio-logs'),
  bail: 0,
  waitforTimeout: 15000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 0,
  reporters: ['spec'],
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    // Covers app start-up, a 5 s recording and its analysis.
    timeout: 120000,
  },

  /** Builds the debug app once before any session starts (unless skipped). */
  onPrepare() {
    fs.mkdirSync(workDir, { recursive: true });
    if (process.env.EPI_E2E_SKIP_BUILD === '1' || process.env.EPI_E2E_APP) {
      console.log(`[e2e] Using existing app binary ${application}`);
    } else {
      console.log('[e2e] Building the debug app (npm run tauri build -- --debug --no-bundle)');
      const result = spawnSync('npm', ['run', 'tauri', 'build', '--', '--debug', '--no-bundle'], {
        cwd: repoRoot,
        stdio: 'inherit',
        // npm is npm.cmd on Windows, which needs a shell.
        shell: process.platform === 'win32',
      });
      if (result.status !== 0) throw new Error(`Building the app failed (exit code ${result.status})`);
    }
    if (!fs.existsSync(application)) throw new Error(`App binary not found: ${application}`);
  },

  /** Starts tauri-driver with the app's (isolated) environment and waits until it listens. */
  async beforeSession() {
    const args = ['--port', String(DRIVER_PORT)];
    if (process.env.EPI_E2E_NATIVE_DRIVER) args.push('--native-driver', process.env.EPI_E2E_NATIVE_DRIVER);
    const env = prepareAppEnv(workDir);
    if (process.platform === 'linux') {
      // Same switches the app sets for itself in src-tauri/src/main.rs; set
      // here too so WebKit sees them from process start under Xvfb.
      env.WEBKIT_DISABLE_DMABUF_RENDERER ||= '1';
      env.WEBKIT_DISABLE_COMPOSITING_MODE ||= '1';
    }
    tauriDriver = spawn(tauriDriverPath, args, { env, stdio: [null, process.stdout, process.stderr] });
    tauriDriver.once('error', (err) => console.error(`[e2e] Could not start tauri-driver (${tauriDriverPath}):`, err));
    await waitForPort(DRIVER_PORT, 15000);
  },

  /**
   * Saves a screenshot of the app window after a failed test to
   * `<work dir>/screenshots` (uploaded by the CI workflow). Best effort: an
   * open native dialog or a crashed app makes the screenshot fail.
   */
  async afterTest(test, _context, { passed }) {
    if (passed) return;
    const dir = path.join(workDir, 'screenshots');
    const file = path.join(dir, `${test.title.replace(/[^\w.-]+/g, '_')}.png`);
    try {
      fs.mkdirSync(dir, { recursive: true });
      await browser.saveScreenshot(file);
      console.log(`[e2e] Screenshot of the failure: ${file}`);
    } catch (err) {
      console.log(`[e2e] Could not save a screenshot: ${err.message}`);
    }
  },

  afterSession() {
    stopTauriDriver();
  },

  /** Removes the isolated home directory (Linux) unless EPI_E2E_KEEP=1. */
  onComplete() {
    if (isolated && process.env.EPI_E2E_KEEP !== '1') {
      fs.rmSync(path.join(workDir, 'home'), { recursive: true, force: true });
    }
  },
};

// Do not leave tauri-driver running if the worker exits without afterSession.
process.once('exit', stopTauriDriver);
