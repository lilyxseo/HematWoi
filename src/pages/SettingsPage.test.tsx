/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import SettingsPage from './SettingsPage';
import { DataProvider } from '../context/DataContext';

const renderWithMode = (mode: 'cloud' | 'local') =>
  render(
    <DataProvider initialMode={mode}>
      <SettingsPage />
    </DataProvider>
  );

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
