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
 * Strips the extension from a filename to get the base name.
 * 
 * @param filename - The filename to strip.
 * @returns The base name without the extension.
 */
export function getBaseName(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "");
}

/**
 * Sanitizes a filename by replacing characters forbidden on major OS platforms with underscores.
 * 
 * @param name - The input filename.
 * @returns The sanitized filename string.
 */
export function sanitizeFilename(name: string): string {
  return name.trim().replace(/[<>:"/\\|?*]/g, '_');
}
