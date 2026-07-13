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

import { renderHook, act } from '@testing-library/react';
import { usePersistentState } from './usePersistentState';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('usePersistentState', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should return default value if localStorage is empty', () => {
    const { result } = renderHook(() => usePersistentState('test-key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('should initialize with string value from localStorage', () => {
    localStorage.setItem('test-key-str', 'stored-string');
    const { result } = renderHook(() => usePersistentState('test-key-str', 'default'));
    expect(result.current[0]).toBe('stored-string');
  });

  it('should initialize with number value from localStorage', () => {
    localStorage.setItem('test-key-num', '42');
    const { result } = renderHook(() => usePersistentState('test-key-num', 0));
    expect(result.current[0]).toBe(42);
  });

  it('should handle invalid number in localStorage', () => {
    localStorage.setItem('test-key-invalid-num', 'not-a-number');
    const { result } = renderHook(() => usePersistentState('test-key-invalid-num', 10));
    expect(result.current[0]).toBe(10);
  });

  it('should initialize with boolean value from localStorage', () => {
    localStorage.setItem('test-key-bool-true', 'true');
    const { result } = renderHook(() => usePersistentState('test-key-bool-true', false));
    expect(result.current[0]).toBe(true);

    localStorage.setItem('test-key-bool-false', 'false');
    const { result: result2 } = renderHook(() => usePersistentState('test-key-bool-false', true));
    expect(result2.current[0]).toBe(false);
  });

  it('should update state and localStorage', () => {
    const { result } = renderHook(() => usePersistentState<string>('test-key-update', 'initial'));
    
    act(() => {
      result.current[1]('updated-value');
    });

    expect(result.current[0]).toBe('updated-value');
    expect(localStorage.getItem('test-key-update')).toBe('updated-value');
  });

  it('should handle localStorage read errors gracefully', () => {
    const originalGetItem = localStorage.getItem;
    localStorage.getItem = vi.fn().mockImplementation(() => {
      throw new Error('Storage disabled');
    });
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => usePersistentState('test-key-err', 'fallback'));
    
    expect(result.current[0]).toBe('fallback');
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to read key "test-key-err" from localStorage:',
      expect.any(Error)
    );

    localStorage.getItem = originalGetItem;
    consoleSpy.mockRestore();
  });

  it('should handle localStorage write errors gracefully', () => {
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = vi.fn().mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => usePersistentState<string>('test-key-write-err', 'initial'));
    
    act(() => {
      result.current[1]('new-val');
    });

    expect(result.current[0]).toBe('new-val'); // state still updates
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to save key "test-key-write-err" to localStorage:',
      expect.any(Error)
    );

    localStorage.setItem = originalSetItem;
    consoleSpy.mockRestore();
  });
});
