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
 * Safely parses and formats an SQLite datetime string for presentation in the user's locale.
 * Replaces the space with 'T' and appends 'Z' if no timezone indicator exists to ensure consistent parsing.
 * 
 * @param timestamp - The raw timestamp string from the database (e.g. YYYY-MM-DD HH:MM:SS).
 * @param format - The output style (locale format or date-only format).
 * @returns The formatted date/time string, or 'N/A' if invalid.
 */
export function formatTimestamp(timestamp: string, format: 'locale' | 'dateOnly' = 'locale'): string {
  const cleanTs = String(timestamp || '');
  let isoStr = cleanTs.replace(' ', 'T');
  if (!isoStr.endsWith('Z') && !/\+\d{2}:\d{2}$/.test(isoStr) && !/-\d{2}:\d{2}$/.test(isoStr)) {
    isoStr += 'Z';
  }
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return 'N/A';
  return format === 'dateOnly' ? d.toLocaleDateString() : d.toLocaleString();
}

/**
 * Formats a duration in seconds into a MM:SS string.
 * 
 * @param totalSeconds - The duration in seconds.
 * @returns The formatted MM:SS string.
 */
export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

