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

import { invoke } from '../../lib/api';

let initPromise: Promise<void> | null = null;

/**
 * Opens the metadata database in the Rust backend (`db_init`), which creates
 * the file and applies pending schema migrations. Concurrent and repeated
 * calls share one request; a failed attempt can be retried.
 *
 * @throws The backend's error message if the database cannot be opened.
 */
export async function initDb(): Promise<void> {
  if (!initPromise) {
    initPromise = invoke<void>('db_init').catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}
