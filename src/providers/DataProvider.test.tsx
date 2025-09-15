/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { DataProvider, useRepo } from './DataProvider';
import { CloudRepo } from '../repo/CloudRepo';
import { LocalRepo } from '../repo/LocalRepo';

// simple localStorage polyfill
const memStore: Record<string, string> = {};
(global as any).localStorage = {
  getItem(k: string) { return memStore[k] || null; },
  setItem(k: string, v: string) { memStore[k] = String(v); },
  removeItem(k: string) { delete memStore[k]; },
  clear() { for (const k in memStore) delete memStore[k]; },
};

beforeEach(() => {
  (global as any).localStorage.clear();
});

describe('useRepo', () => {
  it('returns cloud repo by default', () => {
    const wrapper = ({ children }: any) => <DataProvider>{children}</DataProvider>;
    const { result } = renderHook(() => useRepo(), { wrapper });
    expect(result.current).toBeInstanceOf(CloudRepo);
  });

  it('returns local repo when initialMode is local', () => {
    const wrapper = ({ children }: any) => <DataProvider initialMode="local">{children}</DataProvider>;
    const { result } = renderHook(() => useRepo(), { wrapper });
    expect(result.current).toBeInstanceOf(LocalRepo);
  });

  it('does not call supabase in local mode', async () => {
    vi.resetModules();
    vi.mock('../lib/supabase', () => ({ supabase: { from: () => { throw new Error('called cloud'); } } }));
    const { DataProvider: MockProvider, useRepo: useMockRepo } = await import('./DataProvider');
    const wrapper = ({ children }: any) => <MockProvider initialMode="local">{children}</MockProvider>;
    const { result } = renderHook(() => useMockRepo(), { wrapper });
    await expect(result.current.goals.list()).resolves.toEqual([]);
  });
});
