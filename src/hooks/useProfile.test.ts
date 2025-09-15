/* @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import useProfile from './useProfile';

describe('useProfile', () => {
  it('updates name and bio successfully', async () => {
    const repo = {
      profile: {
        get: async () => ({ name: 'Old', bio: 'x' }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const { result } = renderHook(() => useProfile(repo));
    await act(async () => {
      const ok = await result.current.updateProfile({ name: 'New', bio: 'y' });
      expect(ok).toBe(true);
    });
    expect(repo.profile.update).toHaveBeenCalledWith({ name: 'New', bio: 'y' });
  });

  it('handles update error', async () => {
    const repo = {
      profile: {
        get: async () => ({}),
        update: vi.fn().mockRejectedValue(new Error('fail')),
      },
    };
    const { result } = renderHook(() => useProfile(repo));
    await act(async () => {
      const ok = await result.current.updateProfile({ name: 'x' });
      expect(ok).toBe(false);
    });
  });
});
