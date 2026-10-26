import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
vi.mock('../lib/supabase', async (importOriginal) => ({
  ...await importOriginal(),
  isSupabaseConfigured: false,
}));
import { ModeProvider, useMode } from './useMode';

it('uses local mode without cloud configuration while retaining the cloud preference', () => {
  localStorage.setItem('hw:connectionMode', 'online');
  const { result } = renderHook(() => useMode(), { wrapper: ModeProvider });
  expect(result.current.mode).toBe('local');
  act(() => result.current.toggle());
  expect(result.current.mode).toBe('local');
  expect(localStorage.getItem('hw:connectionMode')).toBe('online');
});
