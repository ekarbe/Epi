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
 * Audio analysis for the UI E2E tests.
 *
 * Decodes a recording with ffmpeg/ffprobe from PATH (the app itself records
 * through ffmpeg, so it is always installed where these tests run) and
 * measures what the backend E2E test measures in Rust
 * (src-tauri/tests/support/audio_analysis.rs): length, RMS level, dominant
 * frequency and the share of the signal carried by the expected tone.
 */

import { execFileSync } from 'node:child_process';

/** Sample rate recordings are decoded at for analysis (the app records 16 kHz mono). */
export const ANALYSIS_RATE = 16000;

/**
 * Returns the duration of a media file in seconds, as reported by ffprobe.
 *
 * @param {string} file Path of the media file.
 * @returns {number} Duration in seconds.
 */
export function probeDuration(file) {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file],
    { encoding: 'utf8' },
  );
  const secs = Number.parseFloat(out.trim());
  if (!Number.isFinite(secs)) throw new Error(`ffprobe returned no duration for ${file}: ${out}`);
  return secs;
}

/**
 * Decodes a media file to mono float samples in -1..1 at {@link ANALYSIS_RATE}.
 *
 * @param {string} file Path of the media file.
 * @returns {Float32Array} The decoded samples.
 */
export function decodeMono(file) {
  const pcm = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(ANALYSIS_RATE), '-f', 's16le', '-acodec', 'pcm_s16le', '-'],
    { maxBuffer: 256 * 1024 * 1024 },
  );
  const count = Math.floor(pcm.length / 2);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i++) samples[i] = pcm.readInt16LE(i * 2) / 32768;
  return samples;
}

/**
 * Root mean square level of `samples` (0..1; a full-scale sine is about 0.707).
 *
 * @param {Float32Array} samples Mono samples.
 * @returns {number} The RMS level.
 */
export function rms(samples) {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}

/**
 * Amplitude of the `freq` component in `samples`, computed with the Goertzel
 * algorithm (a single DFT bin). For a pure sine of amplitude A at `freq` the
 * result is about A.
 *
 * @param {Float32Array} samples Mono samples.
 * @param {number} rate Sample rate in Hz.
 * @param {number} freq Frequency to measure in Hz.
 * @returns {number} The amplitude of that frequency.
 */
export function goertzelAmplitude(samples, rate, freq) {
  const n = samples.length;
  if (n === 0) return 0;
  const coeff = 2 * Math.cos((2 * Math.PI * freq) / rate);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    const s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
  return (2 * Math.sqrt(Math.max(power, 0))) / n;
}

/**
 * Finds the strongest frequency between `minHz` and `maxHz` by scanning
 * Goertzel bins in `stepHz` steps.
 *
 * @param {Float32Array} samples Mono samples (one second is plenty).
 * @param {number} rate Sample rate in Hz.
 * @param {number} [minHz=50] Lowest frequency to consider.
 * @param {number} [maxHz=4000] Highest frequency to consider.
 * @param {number} [stepHz=1] Scan step.
 * @returns {number} The dominant frequency in Hz.
 */
export function dominantFrequency(samples, rate, minHz = 50, maxHz = 4000, stepHz = 1) {
  let best = minHz;
  let bestAmp = -1;
  for (let f = minHz; f <= maxHz; f += stepHz) {
    const amp = goertzelAmplitude(samples, rate, f);
    if (amp > bestAmp) {
      bestAmp = amp;
      best = f;
    }
  }
  return best;
}

/**
 * Fraction of consecutive `blockLen`-sample blocks whose RMS level reaches
 * `threshold` (0 if there is no complete block).
 *
 * @param {Float32Array} samples Mono samples.
 * @param {number} blockLen Block length in samples.
 * @param {number} threshold Minimum RMS level of a loud block.
 * @returns {number} The fraction of loud blocks, 0..1.
 */
export function fractionOfBlocksAbove(samples, blockLen, threshold) {
  const count = Math.floor(samples.length / blockLen);
  if (count === 0) return 0;
  let loud = 0;
  for (let i = 0; i < count; i++) {
    if (rms(samples.subarray(i * blockLen, (i + 1) * blockLen)) >= threshold) loud++;
  }
  return loud / count;
}

/**
 * Analyses a recording: its length, the share of quarter-second blocks
 * that reach `minRms` (dropouts and silent stretches lower it) and, on a
 * one-second window from the middle (away from encoder start-up and
 * fade-out), the level, dominant frequency and tone share.
 *
 * The tone share is the tone's amplitude relative to the amplitude a pure
 * sine with the window's RMS level would have (RMS * sqrt(2)): about 1.0 for
 * a clean tone, far lower for noise or other sound with a trace of the tone.
 *
 * Like the backend test, the first half second and the last quarter second
 * are left out of the block count, where devices and the encoder settle.
 *
 * @param {string} file Path of the recording.
 * @param {number} toneHz Expected tone frequency.
 * @param {number} minRms Level a block must reach to count as loud.
 * @returns {{ durationSecs: number, decodedSecs: number, rms: number, loudBlocks: number, windowRms: number, dominantHz: number, toneShare: number }}
 */
export function analyseRecording(file, toneHz, minRms) {
  const durationSecs = probeDuration(file);
  const samples = decodeMono(file);
  const decodedSecs = samples.length / ANALYSIS_RATE;
  const windowLen = Math.min(ANALYSIS_RATE, samples.length);
  const start = Math.max(0, Math.floor((samples.length - windowLen) / 2));
  const window = samples.subarray(start, start + windowLen);
  const windowRms = rms(window);
  const body = samples.subarray(
    Math.min(ANALYSIS_RATE / 2, samples.length),
    Math.max(0, samples.length - ANALYSIS_RATE / 4),
  );
  const toneAmp = goertzelAmplitude(window, ANALYSIS_RATE, toneHz);
  return {
    durationSecs,
    decodedSecs,
    rms: rms(samples),
    loudBlocks: fractionOfBlocksAbove(body, ANALYSIS_RATE / 4, minRms),
    windowRms,
    dominantHz: dominantFrequency(window, ANALYSIS_RATE),
    toneShare: windowRms > 0 ? toneAmp / (windowRms * Math.SQRT2) : 0,
  };
}
