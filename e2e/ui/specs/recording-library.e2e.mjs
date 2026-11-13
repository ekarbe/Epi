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
 * Records real sound through the Studio UI and manages the recording in the
 * Library: rename and delete, checked against the files on disk.
 *
 * Needs a virtual input device that plays a known tone (see e2e/ci/). The
 * tests build on each other (record -> rename -> delete) and share one app
 * session; a failed step skips the ones after it.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { $, browser } from '@wdio/globals';

import { analyseRecording } from '../helpers/audio.mjs';
import {
  acceptAlertIfOpen,
  libraryItem,
  openTab,
  parseSeconds,
  selectOnlyInputDevice,
  tid,
  waitForAppReady,
} from '../helpers/app.mjs';
import { libraryDir } from '../helpers/env.mjs';

const TONE_HZ = Number(process.env.EPI_E2E_TONE_HZ || 440);
const RECORD_SECS = Number(process.env.EPI_E2E_RECORD_SECS || 5);
/** Audio only flows once ffmpeg has opened its inputs, which the app does not wait for. */
const MAX_STARTUP_LOSS_SECS = 2.0;
/** Encoder padding and rounding. */
const MAX_EXCESS_SECS = 0.5;
/** Same thresholds as the backend E2E test (src-tauri/tests/recording_e2e.rs). */
const MIN_RMS = 0.01;
const MIN_LOUD_BLOCK_FRACTION = 0.8;
const FREQUENCY_TOLERANCE = 0.03;
const MIN_TONE_SHARE = 0.5;

/** Unique per run, so that a run never touches recordings it did not create. */
const PREFIX = 'epi-e2e-ui-';
const name = `${PREFIX}${Date.now()}`;
const renamed = `${name}-renamed`;
/**
 * Default input device per platform. On Linux cpal lists ALSA PCM plugins,
 * and the app maps "PulseAudio Sound Server" to PulseAudio's default source,
 * which e2e/ci/setup-audio-linux.sh makes the virtual microphone.
 */
const INPUT_DEVICE = process.env.EPI_E2E_INPUT_DEVICE
  || (process.platform === 'linux' ? 'PulseAudio Sound Server' : undefined);

const library = libraryDir(process.env.EPI_E2E_UI_WORK_DIR);
const recordingPath = (stem) => path.join(library, 'Recordings', `${stem}.ogg`);
const ffmpegLogPath = (stem) => path.join(library, 'Logs', `${stem}_ffmpeg.log`);

/** Removes every file this suite may have created in the library. */
function removeOwnFiles() {
  for (const sub of ['Recordings', 'Logs', 'Transcriptions', 'Summaries']) {
    const dir = path.join(library, sub);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (file.startsWith(name)) fs.rmSync(path.join(dir, file), { force: true });
    }
  }
}

describe('Recording and the Library', function () {
  let failed = false;
  let recordingId = null;
  /** File name stem the app chose (the label goes through the naming schema). */
  let stem = null;

  before(async function () {
    console.log(`[e2e] Library: ${library}`);
    await waitForAppReady();
    await openTab('studio');
  });

  beforeEach(function () {
    if (failed) this.skip();
  });

  afterEach(async function () {
    if (this.currentTest.state === 'failed') {
      failed = true;
      const alert = await acceptAlertIfOpen();
      if (alert) console.log(`[e2e] Alert at failure: ${alert}`);
    }
  });

  after(function () {
    if (process.env.EPI_E2E_KEEP !== '1') removeOwnFiles();
  });

  it('records the test tone from the virtual input device', async function () {
    const autoTranscribe = await $(tid('auto-transcribe-checkbox'));
    if (await autoTranscribe.isSelected()) await autoTranscribe.click();

    await selectOnlyInputDevice(INPUT_DEVICE);
    await $(tid('recording-label-input')).setValue(name);

    const recordBtn = await $(tid('record-btn'));
    const timer = await $(tid('recording-timer'));
    const started = Date.now();
    await recordBtn.click();
    await browser.waitUntil(
      async () => {
        const error = await $(tid('recording-error'));
        if (await error.isExisting()) throw new Error(`Recording failed: ${await error.getText()}`);
        return (await recordBtn.getAttribute('class')).includes('recording');
      },
      { timeout: 20000, timeoutMsg: 'Recording did not start' },
    );

    // Record for RECORD_SECS by the app's own timer and by the wall clock.
    await browser.waitUntil(
      async () => {
        const [m, s] = (await timer.getText()).split(':').map(Number);
        return m * 60 + s >= RECORD_SECS && Date.now() - started >= RECORD_SECS * 1000;
      },
      { timeout: (RECORD_SECS + 15) * 1000, interval: 200, timeoutMsg: 'Recording timer did not advance' },
    );

    await recordBtn.click();
    await browser.waitUntil(
      async () => !(await recordBtn.getAttribute('class')).includes('recording') && (await recordBtn.isEnabled()),
      { timeout: 30000, timeoutMsg: 'Recording did not stop' },
    );
    const wallSecs = (Date.now() - started) / 1000;
    const error = await $(tid('recording-error'));
    if (await error.isExisting()) throw new Error(`Stopping failed: ${await error.getText()}`);

    // Studio: listed under recent recordings with a plausible duration. The
    // label is the {title} of the naming schema, so the name starts with it.
    const recent = await $(`${tid('recent-recording')}[data-filename^="${name}"]`);
    await recent.waitForExist({ timeoutMsg: 'Recording is not listed under recent recordings' });
    stem = (await recent.getAttribute('data-filename')).replace(/\.ogg$/, '');
    console.log(`[e2e] Recorded ${stem}.ogg`);
    const recentSecs = parseSeconds(await recent.$(tid('recent-recording-duration')).getText());
    assert.ok(
      recentSecs >= RECORD_SECS && recentSecs <= Math.ceil(wallSecs) + 1,
      `Studio shows ${recentSecs}s for a ${RECORD_SECS}s recording (wall clock ${wallSecs.toFixed(1)}s)`,
    );

    // On disk: the file has the expected length and carries the tone.
    const file = recordingPath(stem);
    assert.ok(fs.existsSync(file), `${file} does not exist`);
    assert.equal(fs.readFileSync(file).subarray(0, 4).toString('latin1'), 'OggS', `${file} is not an Ogg file`);
    const a = analyseRecording(file, TONE_HZ, MIN_RMS);
    console.log(`[e2e] ${path.basename(file)}: ${JSON.stringify({ ...a, wallSecs })}`);
    assert.ok(
      a.durationSecs >= RECORD_SECS - MAX_STARTUP_LOSS_SECS && a.durationSecs <= wallSecs + MAX_EXCESS_SECS,
      `Recording is ${a.durationSecs.toFixed(2)}s long, expected ${RECORD_SECS - MAX_STARTUP_LOSS_SECS}..${(wallSecs + MAX_EXCESS_SECS).toFixed(2)}s`,
    );
    assert.ok(a.rms >= MIN_RMS, `Recording is silent (RMS ${a.rms.toFixed(5)} < ${MIN_RMS})`);
    assert.ok(
      a.loudBlocks >= MIN_LOUD_BLOCK_FRACTION,
      `Only ${(a.loudBlocks * 100).toFixed(0)}% of the recording reaches the level, expected ${MIN_LOUD_BLOCK_FRACTION * 100}% (dropouts?)`,
    );
    assert.ok(
      Math.abs(a.dominantHz - TONE_HZ) <= TONE_HZ * FREQUENCY_TOLERANCE,
      `Dominant frequency is ${a.dominantHz} Hz, expected ${TONE_HZ} Hz`,
    );
    assert.ok(a.toneShare >= MIN_TONE_SHARE, `The tone carries only ${a.toneShare.toFixed(2)} of the signal`);

    // Library: listed with the same duration. The search keeps the row on the
    // first page even if the library already holds other recordings.
    await openTab('library');
    await $(tid('library-search')).setValue(name);
    const item = await libraryItem(`${stem}.ogg`);
    recordingId = await item.getAttribute('data-recording-id');
    assert.equal(await item.$(tid('library-item-title')).getText(), stem);
    assert.equal(parseSeconds(await item.$(tid('library-item-duration')).getText()), recentSecs);
  });

  it('renames the recording and its files on disk', async function () {
    const hadLog = fs.existsSync(ffmpegLogPath(stem));
    const item = await libraryItem(`${stem}.ogg`);
    await item.$(tid(`edit-btn-${recordingId}`)).click();
    const input = await item.$(tid('rename-input'));
    await input.waitForDisplayed();
    // clearValue() does not reach React's onChange, so a re-render between
    // clearing and typing restores the old name; retry until the field holds
    // exactly the new name.
    await browser.waitUntil(async () => {
      await input.clearValue();
      await input.addValue(renamed);
      return (await input.getValue()) === renamed;
    }, { timeoutMsg: 'Rename field does not hold the new name' });
    await item.$(tid('save-rename-btn')).click();

    const renamedItem = await libraryItem(`${renamed}.ogg`);
    await libraryItem(`${stem}.ogg`, { reverse: true });
    assert.equal(await renamedItem.$(tid('library-item-title')).getText(), renamed);
    assert.equal(await renamedItem.getAttribute('data-recording-id'), recordingId);

    assert.ok(fs.existsSync(recordingPath(renamed)), 'Renamed recording file does not exist');
    assert.ok(!fs.existsSync(recordingPath(stem)), 'Old recording file still exists');
    if (hadLog) {
      assert.ok(fs.existsSync(ffmpegLogPath(renamed)), 'ffmpeg log was not renamed');
      assert.ok(!fs.existsSync(ffmpegLogPath(stem)), 'Old ffmpeg log still exists');
    }
  });

  it('deletes the recording with all its files', async function () {
    const item = await libraryItem(`${renamed}.ogg`);
    await item.$(tid(`delete-btn-${recordingId}`)).click();
    const options = await item.$(tid('delete-options'));
    await options.waitForDisplayed();
    await options.$(tid('delete-everything-btn')).click();

    await libraryItem(`${renamed}.ogg`, { reverse: true });
    assert.ok(!fs.existsSync(recordingPath(renamed)), 'Recording file still exists');
    assert.ok(!fs.existsSync(ffmpegLogPath(renamed)), 'ffmpeg log still exists');

    // Still gone after the Library reloads from the database.
    await openTab('studio');
    await openTab('library');
    await $(tid('library-search')).setValue(name);
    await libraryItem(`${renamed}.ogg`, { reverse: true, timeout: 5000 });
  });
});
