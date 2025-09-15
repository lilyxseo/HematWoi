/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

import SettingsPage from './SettingsPage';
import { DataProvider } from '../context/DataContext';

// ---- Mocks ----
vi.mock('../lib/supabase', () => ({ supabase: {} }));

// localStorage (gunakan bawaan jsdom, tapi pastikan bersih sebelum test)
beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    // Fallback polyfill kalau environment tidak punya localStorage
    const store: Record<string, string> = {};
    // @ts-expect-error: test polyfill
    globalThis.localStorage = {
      getItem(k: string) { return k in store ? store[k] : null; },
      setItem(k: string, v: string) { store[k] = String(v); },
      removeItem(k: string) { delete store[k]; },
      clear() { for (const k in store) delete store[k]; },
    };
  }
});

afterEach(() => {
  cleanup();
});

// ---- Utils ----
const renderWithMode = (mode: 'cloud' | 'local') => {
  localStorage.setItem('hw:mode', mode);
  return render(
    <MemoryRouter>
      <DataProvider initialMode={mode}>
        <SettingsPage />
      </DataProvider>
    </MemoryRouter>
  );
};

// ---- Tests ----
describe('SettingsPage — Data Mode', () => {
  it('menampilkan tombol "Seed Dummy Data" saat mode Local', () => {
    renderWithMode('local');
    expect(screen.getByText(/Seed Dummy Data/i)).toBeInTheDocument();
  });

  it('tidak menampilkan tombol "Seed Dummy Data" saat mode Cloud', () => {
    renderWithMode('cloud');
    expect(screen.queryByText(/Seed Dummy Data/i)).not.toBeInTheDocument();
  });
});
