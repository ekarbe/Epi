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

import { describe, it, expect } from 'vitest';
import { formatTimestamp, formatTime } from './date';

describe('date utils', () => {
  describe('formatTimestamp', () => {
    it('returns N/A for invalid date', () => {
      expect(formatTimestamp('invalid')).toBe('N/A');
      expect(formatTimestamp('')).toBe('N/A');
    });

    it('formats valid sqlite timestamp with Z appended', () => {
      const ts = '2026-07-08 12:00:00';
      const formatted = formatTimestamp(ts);
      expect(formatted).not.toBe('N/A');
      expect(typeof formatted).toBe('string');
    });

    it('formats dateOnly', () => {
      const ts = '2026-07-08 12:00:00';
      const formatted = formatTimestamp(ts, 'dateOnly');
      expect(formatted).not.toBe('N/A');
      expect(typeof formatted).toBe('string');
    });

    it('handles timestamps with timezone', () => {
      const ts = '2026-07-08T12:00:00+02:00';
      const formatted = formatTimestamp(ts);
      expect(formatted).not.toBe('N/A');
    });
  });

  describe('formatTime', () => {
    it('formats seconds into MM:SS', () => {
      expect(formatTime(0)).toBe('00:00');
      expect(formatTime(59)).toBe('00:59');
      expect(formatTime(60)).toBe('01:00');
      expect(formatTime(125)).toBe('02:05');
      expect(formatTime(3600)).toBe('60:00');
    });
  });
});
