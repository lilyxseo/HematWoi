/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import SettingsPage from './SettingsPage';
import { DataProvider } from '../context/DataContext';
import { vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ supabase: {} }));

const store: Record<string, string> = {};
(global as any).localStorage = {
  getItem(k: string) { return store[k] || null; },
  setItem(k: string, v: string) { store[k] = String(v); },
  removeItem(k: string) { delete store[k]; },
  clear() { for (const k in store) delete store[k]; },
};

beforeEach(() => localStorage.clear());

const renderWithMode = (mode: 'online' | 'local') => {
  localStorage.setItem('hw:connectionMode', mode);
  return render(
    <MemoryRouter>
      <DataProvider initialMode={mode}>
        <SettingsPage />
      </DataProvider>
    </MemoryRouter>
  );
};

describe('SettingsPage data mode', () => {
  it('shows seed button in local mode', () => {
    renderWithMode('local');
    expect(screen.getByText(/Seed Dummy Data/i)).toBeInTheDocument();
  });
});
