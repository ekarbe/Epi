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

//! Small signal analysis helpers for the recording end-to-end tests.
//!
//! All functions work on mono `f32` samples in the range `-1.0..=1.0`.

use std::f32::consts::PI;

/// Root mean square level of `samples` (0.0 for an empty slice).
pub fn rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum: f64 = samples.iter().map(|&s| (s as f64) * (s as f64)).sum();
    (sum / samples.len() as f64).sqrt() as f32
}

/// Estimates the amplitude of the `freq` Hz component of `samples` with the
/// Goertzel algorithm.
///
/// A Hann window is applied to keep spectral leakage from neighbouring
/// frequencies low; the result is corrected for the window's gain, so a pure
/// sine of amplitude `a` at exactly `freq` yields roughly `a`.
pub fn goertzel_amplitude(samples: &[f32], sample_rate: f32, freq: f32) -> f32 {
    let n = samples.len();
    if n < 2 {
        return 0.0;
    }
    let omega = 2.0 * std::f64::consts::PI * freq as f64 / sample_rate as f64;
    let coeff = 2.0 * omega.cos();
    let (mut s1, mut s2) = (0.0f64, 0.0f64);
    let mut window_sum = 0.0f64;
    for (i, &x) in samples.iter().enumerate() {
        let w = 0.5 - 0.5 * (2.0 * std::f64::consts::PI * i as f64 / (n - 1) as f64).cos();
        window_sum += w;
        let s = x as f64 * w + coeff * s1 - s2;
        s2 = s1;
        s1 = s;
    }
    let power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
    (2.0 * power.max(0.0).sqrt() / window_sum) as f32
}

/// Returns the frequency (in Hz) with the strongest component in
/// `min_hz..=max_hz`.
///
/// A coarse 5 Hz scan runs on 200 ms segments (averaging their amplitudes),
/// whose Hann main lobe (+/- 10 Hz) is wide enough that a tone between two
/// scan points is not missed. The best candidate is then refined on the whole
/// signal with a step of one frequency bin (at most 0.5 Hz).
pub fn dominant_frequency(samples: &[f32], sample_rate: f32, min_hz: f32, max_hz: f32) -> f32 {
    let segment_len = ((sample_rate / 5.0) as usize).clamp(2, samples.len().max(2));
    let segments: Vec<&[f32]> = samples.chunks_exact(segment_len).collect();
    let coarse_amplitude = |f: f32| {
        if segments.is_empty() {
            return goertzel_amplitude(samples, sample_rate, f);
        }
        let sum: f32 = segments
            .iter()
            .map(|seg| goertzel_amplitude(seg, sample_rate, f))
            .sum();
        sum / segments.len() as f32
    };
    let scan = |from: f32, to: f32, step: f32, amplitude: &dyn Fn(f32) -> f32| {
        let mut best = (from, -1.0f32);
        let steps = ((to - from) / step).floor() as usize;
        for k in 0..=steps {
            let f = from + k as f32 * step;
            let amp = amplitude(f);
            if amp > best.1 {
                best = (f, amp);
            }
        }
        best.0
    };
    let coarse = scan(min_hz, max_hz, 5.0, &coarse_amplitude);
    let fine_step = (sample_rate / samples.len().max(1) as f32).clamp(0.05, 0.5);
    scan(
        (coarse - 5.0).max(min_hz),
        (coarse + 5.0).min(max_hz),
        fine_step,
        &|f| goertzel_amplitude(samples, sample_rate, f),
    )
}

/// How much of the signal's level is carried by the tone at `freq` Hz.
///
/// Compares the tone's amplitude (the best Goertzel amplitude within
/// +/- 0.5 Hz of `freq`, so a slightly off estimate does not matter) with the
/// amplitude a pure sine of the same RMS level would have. A clean tone yields
/// about 1.0; noise or other sound with only a trace of the tone yields much
/// less, and silence yields 0.0.
pub fn tone_share(samples: &[f32], sample_rate: f32, freq: f32) -> f32 {
    let level = rms(samples);
    if level <= 0.0 {
        return 0.0;
    }
    let amplitude = (-5..=5)
        .map(|k| goertzel_amplitude(samples, sample_rate, freq + k as f32 * 0.1))
        .fold(0.0f32, f32::max);
    amplitude / (level * std::f32::consts::SQRT_2)
}

/// Fraction of consecutive `block_len`-sample blocks whose RMS level reaches
/// `threshold` (0.0 if there is no complete block).
pub fn fraction_of_blocks_above(samples: &[f32], block_len: usize, threshold: f32) -> f32 {
    let blocks: Vec<&[f32]> = samples.chunks_exact(block_len.max(1)).collect();
    if blocks.is_empty() {
        return 0.0;
    }
    let loud = blocks.iter().filter(|b| rms(b) >= threshold).count();
    loud as f32 / blocks.len() as f32
}

#[cfg(test)]
mod tests {
    use super::*;

    const SR: f32 = 16_000.0;

    fn sine(freq: f32, amplitude: f32, secs: f32) -> Vec<f32> {
        (0..(SR * secs) as usize)
            .map(|i| amplitude * (2.0 * PI * freq * i as f32 / SR).sin())
            .collect()
    }

    /// Deterministic pseudo-random noise in `-amplitude..amplitude`.
    fn noise(len: usize, amplitude: f32) -> Vec<f32> {
        let mut state: u32 = 0x1234_5678;
        (0..len)
            .map(|_| {
                state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
                amplitude * ((state >> 8) as f32 / (1u32 << 24) as f32 * 2.0 - 1.0)
            })
            .collect()
    }

    #[test]
    fn rms_of_sine_and_silence() {
        assert_eq!(rms(&[]), 0.0);
        assert_eq!(rms(&[0.0; 1000]), 0.0);
        let r = rms(&sine(440.0, 0.5, 1.0));
        assert!((r - 0.5 / 2f32.sqrt()).abs() < 1e-3, "rms = {}", r);
    }

    #[test]
    fn goertzel_measures_amplitude_of_present_tone_only() {
        let s = sine(440.0, 0.5, 1.0);
        let at_tone = goertzel_amplitude(&s, SR, 440.0);
        assert!((at_tone - 0.5).abs() < 0.02, "amplitude = {}", at_tone);
        let elsewhere = goertzel_amplitude(&s, SR, 1000.0);
        assert!(elsewhere < 0.005, "leakage = {}", elsewhere);
        assert_eq!(goertzel_amplitude(&[0.3], SR, 440.0), 0.0);
    }

    #[test]
    fn dominant_frequency_finds_tones() {
        for freq in [220.0, 440.0, 1000.0, 3137.0] {
            let f = dominant_frequency(&sine(freq, 0.3, 1.0), SR, 50.0, 4000.0);
            assert!(
                (f - freq).abs() / freq < 0.01,
                "expected {}, got {}",
                freq,
                f
            );
        }
    }

    #[test]
    fn dominant_frequency_survives_noise_and_weaker_tones() {
        let tone = sine(440.0, 0.3, 1.0);
        let hum = sine(50.0, 0.05, 1.0);
        let n = noise(tone.len(), 0.1);
        let mixed: Vec<f32> = (0..tone.len()).map(|i| tone[i] + hum[i] + n[i]).collect();
        let f = dominant_frequency(&mixed, SR, 40.0, 4000.0);
        assert!((f - 440.0).abs() < 4.0, "got {}", f);
    }

    #[test]
    fn tone_share_separates_clean_tone_from_noise() {
        let tone = sine(440.0, 0.5, 1.0);
        let share = tone_share(&tone, SR, 440.3);
        assert!(share > 0.9, "clean tone share = {}", share);

        // Loud noise with a weak 440 Hz tone: the tone is still the dominant
        // frequency, but it carries only a small part of the signal.
        let weak = sine(440.0, 0.1, 1.0);
        let n = noise(weak.len(), 0.5);
        let mixed: Vec<f32> = (0..weak.len()).map(|i| weak[i] + n[i]).collect();
        let share = tone_share(&mixed, SR, 440.0);
        assert!(share < 0.5, "noisy share = {}", share);

        assert_eq!(tone_share(&[0.0; 1600], SR, 440.0), 0.0);
    }

    #[test]
    fn fraction_of_blocks_detects_dropouts() {
        let mut s = sine(440.0, 0.5, 1.0);
        assert_eq!(fraction_of_blocks_above(&s, 1600, 0.1), 1.0);
        // Silence the second half.
        let half = s.len() / 2;
        s[half..].iter_mut().for_each(|x| *x = 0.0);
        assert!((fraction_of_blocks_above(&s, 1600, 0.1) - 0.5).abs() < 1e-6);
        assert_eq!(fraction_of_blocks_above(&s[..10], 1600, 0.1), 0.0);
    }
}
