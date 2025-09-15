/* @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import SettingsPage from './SettingsPage';
import { DataProvider } from '../context/DataContext';

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

afterEach(() => {
  cleanup();
});

describe('SettingsPage data mode', () => {
  it('shows seed button in local mode', () => {
    renderWithMode('local');
    expect(screen.getByText(/Seed Dummy Data/i)).toBeInTheDocument();
  });

  it('hides seed button in cloud mode', () => {
    renderWithMode('cloud');
    expect(screen.queryByText(/Seed Dummy Data/i)).toBeNull();
  });
});
