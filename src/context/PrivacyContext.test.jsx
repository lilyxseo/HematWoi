import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PrivacyProvider, usePrivacyMode } from './PrivacyContext';

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove('hw-privacy-mode');
});

it('keeps privacy controls working when browser storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
  const { result } = renderHook(() => usePrivacyMode(), { wrapper: PrivacyProvider });
  expect(result.current.isPrivacyMode).toBe(false);
  act(() => result.current.togglePrivacyMode());
  expect(result.current.isPrivacyMode).toBe(true);
  expect(document.documentElement.classList.contains('hw-privacy-mode')).toBe(true);
});
