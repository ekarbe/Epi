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

import { useState } from 'react';

/**
 * Custom hook to synchronize React state with localStorage safely.
 * Handles errors and edge cases when reading/writing to localStorage.
 */
export function usePersistentState<T extends string | number | boolean>(key: string, defaultValue: T): [T, (val: T) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        if (typeof defaultValue === 'number') {
          const parsed = parseFloat(stored);
          return (isNaN(parsed) ? defaultValue : parsed) as T;
        }
        if (typeof defaultValue === 'boolean') return (stored === 'true') as T;
        return stored as T;
      }
    } catch (err) {
      console.warn(`Failed to read key "${key}" from localStorage:`, err);
    }
    return defaultValue;
  });

  const setPersistentState = (val: T) => {
    try {
      setState(val);
      localStorage.setItem(key, String(val));
    } catch (err) {
      console.error(`Failed to save key "${key}" to localStorage:`, err);
    }
  };

  return [state, setPersistentState];
}
