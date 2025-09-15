/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { getPrefs, setPrefs, resetPrefs, defaultPrefs } from './preferences';

beforeEach(() => {
  localStorage.clear();
});

describe('preferences storage', () => {
  it('persists and loads preferences', () => {
    setPrefs({ ...defaultPrefs, darkMode: true });
    const loaded = getPrefs();
    expect(loaded.darkMode).toBe(true);
  });

  it('resets to default', () => {
    setPrefs({ ...defaultPrefs, darkMode: true });
    resetPrefs();
    expect(getPrefs()).toEqual(defaultPrefs);
  });
});
