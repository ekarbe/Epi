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
 * UI helpers for driving the Epi app through WebdriverIO. Elements are found
 * by their `data-testid` attributes.
 */

import { $, $$, browser } from '@wdio/globals';

/** CSS selector for a `data-testid`. */
export const tid = (id) => `[data-testid="${id}"]`;

/**
 * Accepts a native alert/confirm dialog if one is open and returns its text.
 * An open dialog blocks every other WebDriver command.
 *
 * @returns {Promise<string | null>} The dialog's text, or null if none was open.
 */
export async function acceptAlertIfOpen() {
  try {
    const text = await browser.getAlertText();
    await browser.acceptAlert();
    return text;
  } catch {
    return null;
  }
}

/**
 * Waits until the app has started and its database is ready, then gets
 * first-run UI out of the way: a native alert (e.g. about the system
 * keyring) or the WhisperX language prompt modal.
 */
export async function waitForAppReady() {
  try {
    await browser.waitUntil(
      async () => {
        const alert = await acceptAlertIfOpen();
        if (alert) console.log(`[e2e] Dismissed alert: ${alert}`);
        return (await $(tid('tab-studio')).isExisting()) && !(await $('.loading-state').isExisting());
      },
      { timeout: 60000, interval: 250, timeoutMsg: 'The app did not finish starting within 60 s' },
    );
  } catch (err) {
    // A binary built by plain `cargo build`/`cargo test` (without Tauri's
    // custom-protocol feature) loads the Vite dev server instead of the
    // bundled frontend and shows an empty page.
    const url = await browser.getUrl().catch(() => 'unknown');
    throw new Error(`${err.message} (page URL: ${url}; if it is the dev server, rebuild the app `
      + 'with `npm run tauri build -- --debug --no-bundle` or run without EPI_E2E_SKIP_BUILD)');
  }

  const modal = await $('.modal-overlay');
  if (await modal.isExisting()) {
    console.log('[e2e] Closing the language prompt modal');
    await modal.$('button=Cancel').click();
    await modal.waitForExist({ reverse: true });
  }
}

/**
 * Switches to a tab of the navigation bar.
 *
 * @param {'studio' | 'analysis' | 'library' | 'engine'} name Tab to open.
 */
export async function openTab(name) {
  const tab = await $(tid(`tab-${name}`));
  await tab.click();
  await browser.waitUntil(async () => (await tab.getAttribute('class')).includes('active'), {
    timeoutMsg: `Tab ${name} did not become active`,
  });
}

/**
 * Sets the checkbox inside a device option to `checked` (by clicking its
 * label, which is what a user does).
 */
async function setOption(option, checked) {
  const box = await option.$('input[type="checkbox"]');
  if ((await box.isSelected()) !== checked) {
    await option.click();
    await browser.waitUntil(async () => (await box.isSelected()) === checked, {
      timeoutMsg: `Device option did not become ${checked ? 'checked' : 'unchecked'}`,
    });
  }
}

/**
 * Selects exactly one input device in the Studio and no output device.
 *
 * @param {string | undefined} wanted Device name, or a part of it
 *   (case-insensitive). Without it, the device marked as default is selected.
 * @returns {Promise<string>} The full name of the selected device.
 */
export async function selectOnlyInputDevice(wanted) {
  const inputsBtn = await $(tid('select-inputs-btn'));
  await inputsBtn.click();
  await $(tid('input-device-option')).waitForExist({ timeoutMsg: 'No input devices are listed' });
  const options = await $$(tid('input-device-option'));
  const devices = [];
  for (const option of options) {
    devices.push({
      option,
      name: await option.getAttribute('data-device-name'),
      isDefault: (await option.getAttribute('data-default')) === 'true',
    });
  }
  console.log(`[e2e] Input devices: ${JSON.stringify(devices.map((d) => `${d.name}${d.isDefault ? ' (default)' : ''}`))}`);

  const target = wanted
    ? devices.find((d) => d.name === wanted)
      || devices.find((d) => d.name.toLowerCase().includes(wanted.toLowerCase()))
    : devices.find((d) => d.isDefault) || devices[0];
  if (!target) throw new Error(`No input device matches ${JSON.stringify(wanted)}`);

  for (const d of devices) await setOption(d.option, d === target);
  await inputsBtn.click();

  // System audio capture would add a second file per recording.
  const outputsBtn = await $(tid('select-outputs-btn'));
  await outputsBtn.click();
  for (const option of await $$(tid('output-device-option'))) await setOption(option, false);
  await outputsBtn.click();

  console.log(`[e2e] Recording from input ${JSON.stringify(target.name)}`);
  return target.name;
}

/**
 * Returns the Library row of the recording `filename`, waiting until it is
 * listed (or, with `reverse`, until it is gone).
 *
 * @param {string} filename File name of the recording (with `.ogg`).
 * @param {{ reverse?: boolean, timeout?: number }} [opts]
 */
export async function libraryItem(filename, { reverse = false, timeout = 15000 } = {}) {
  const item = await $(`${tid('library-item')}[data-filename="${filename}"]`);
  await item.waitForExist({
    reverse,
    timeout,
    timeoutMsg: `Library row of ${filename} ${reverse ? 'is still listed' : 'did not appear'}`,
  });
  return item;
}

/** Parses a duration label such as `5s`. */
export function parseSeconds(text) {
  const match = String(text).match(/(\d+)\s*s/);
  if (!match) throw new Error(`Not a duration: ${JSON.stringify(text)}`);
  return Number.parseInt(match[1], 10);
}
