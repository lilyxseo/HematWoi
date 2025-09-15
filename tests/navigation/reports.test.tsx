import '@testing-library/jest-dom/vitest';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AppShell from '../../src/layout/AppShell';
import { flags } from '../../src/featureFlags';

function renderWithRouter(initialPath: string = '/') {
  let current = initialPath;
  function LocationTracker() {
    const loc = useLocation();
    current = loc.pathname;
    return null;
    }
  const user = userEvent.setup();
  const utils = render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LocationTracker />
      <AppShell />
    </MemoryRouter>
  );
  return { user, getPath: () => current, ...utils };
}

describe('Reports navigation', () => {
  beforeEach(() => {
    flags.reports = true;
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] || null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
  });

  afterEach(() => cleanup());

  it('terdapat link "Reports" di Sidebar', () => {
    renderWithRouter();
    expect(screen.getByRole('link', { name: /Reports/i })).toBeInTheDocument();
  });

  it('klik link → route berubah ke /reports & komponen halaman render', async () => {
    const { user, getPath } = renderWithRouter();
    localStorage.setItem('session', 'yes');
    await user.click(screen.getByRole('link', { name: /Reports/i }));
    expect(getPath()).toBe('/reports');
    expect(
      await screen.findByRole('heading', { name: /Reports/i })
    ).toBeInTheDocument();
  });

  it('breadcrumb menampilkan trail yang sesuai', async () => {
    const { user, getPath } = renderWithRouter();
    localStorage.setItem('session', 'yes');
    await user.click(screen.getByRole('link', { name: /Reports/i }));
    expect(getPath()).toBe('/reports');
    const navs = screen.getAllByLabelText('Breadcrumb');
    expect(navs[0]).toHaveTextContent('Home / Reports');
  });

  it('tersembunyi bila featureFlag dimatikan', () => {
    flags.reports = false;
    renderWithRouter();
    expect(screen.queryByRole('link', { name: /Reports/i })).toBeNull();
    flags.reports = true; // reset
  });

  it('dialihkan ke /auth bila protected & belum login', () => {
    const { getPath } = renderWithRouter('/reports');
    expect(getPath()).toBe('/auth');
  });
});
