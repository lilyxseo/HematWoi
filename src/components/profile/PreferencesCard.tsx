import { useEffect, useMemo, useState } from 'react';
import type { ComponentType, FormEvent } from 'react';
import { Laptop, Moon, Sun, Globe2 } from 'lucide-react';
import type { ThemePreference } from '../../lib/api-profile';

interface PreferencesValue {
  theme: ThemePreference;
  currency: string;
  locale: string;
  date_format: string;
  timezone: string;
}

interface PreferencesCardProps {
  value: PreferencesValue;
  timezones: string[];
  offline?: boolean;
  saving?: boolean;
  onPreviewTheme?: (theme: ThemePreference) => void;
  onSubmit: (next: PreferencesValue) => Promise<void>;
}

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: ComponentType<any> }> = [
  { value: 'system', label: 'System', icon: Laptop },
  { value: 'light', label: 'Terang', icon: Sun },
  { value: 'dark', label: 'Gelap', icon: Moon },
];

export default function PreferencesCard({
  value,
  timezones,
  offline = false,
  saving = false,
  onPreviewTheme,
  onSubmit,
}: PreferencesCardProps) {
  const [form, setForm] = useState<PreferencesValue>(value);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setForm(value);
  }, [value]);

  const sortedTimezones = useMemo(() => {
    return [...timezones].sort((a, b) => a.localeCompare(b));
  }, [timezones]);

  const handleThemeChange = (theme: ThemePreference) => {
    setForm((prev) => ({ ...prev, theme }));
    setSuccess(null);
    if (onPreviewTheme) {
      onPreviewTheme(theme);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (offline) return;
    setError(null);
    setSuccess(null);
    try {
      await onSubmit(form);
      setSuccess('Preferensi berhasil disimpan.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tidak bisa menyimpan preferensi.';
      setError(message);
    }
  };

  return (
    <section className="rounded-3xl border border-border-subtle bg-surface shadow-sm">
      <form className="grid gap-6 p-4 md:p-6" onSubmit={handleSubmit}>
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-text">Preferensi</h2>
          <p className="text-sm text-muted">Atur tampilan aplikasi, bahasa, dan zona waktu.</p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <fieldset className="space-y-3 md:col-span-2">
            <legend className="text-sm font-medium text-text">Tema</legend>
            <div className="grid grid-cols-3 gap-3">
              {THEME_OPTIONS.map(({ value: option, label, icon: Icon }) => {
                const active = form.theme === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleThemeChange(option)}
                    className={`flex h-12 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border-subtle bg-surface-alt text-text hover:border-border-strong'
                    }`}
                    aria-pressed={active}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted">Tema diterapkan langsung tanpa perlu memuat ulang.</p>
          </fieldset>

          <div className="grid gap-1">
            <label htmlFor="preferences-locale" className="text-sm font-medium text-text">
              Bahasa
            </label>
            <select
              id="preferences-locale"
              value={form.locale}
              onChange={(event) => setForm((prev) => ({ ...prev, locale: event.target.value }))}
              disabled={saving}
            >
              <option value="id-ID">Indonesia</option>
            </select>
            <p className="text-xs text-muted">Saat ini HematWoi mendukung Bahasa Indonesia.</p>
          </div>

          <div className="grid gap-1">
            <label htmlFor="preferences-currency" className="text-sm font-medium text-text">
              Mata uang utama
            </label>
            <select
              id="preferences-currency"
              value={form.currency}
              onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}
              disabled={saving}
            >
              <option value="IDR">Rupiah (IDR)</option>
            </select>
            <p className="text-xs text-muted">Dipakai untuk ringkasan dan grafik keuangan.</p>
          </div>

          <div className="grid gap-1">
            <label htmlFor="preferences-date-format" className="text-sm font-medium text-text">
              Format tanggal
            </label>
            <select
              id="preferences-date-format"
              value={form.date_format}
              onChange={(event) => setForm((prev) => ({ ...prev, date_format: event.target.value }))}
              disabled={saving}
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
            <p className="text-xs text-muted">Pengaturan ini mempengaruhi tampilan tanggal di seluruh aplikasi.</p>
          </div>

          <div className="grid gap-1">
            <label htmlFor="preferences-timezone" className="text-sm font-medium text-text">
              Zona waktu
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                <Globe2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <select
                id="preferences-timezone"
                value={form.timezone}
                onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
                className="pl-10"
                disabled={saving}
              >
                {sortedTimezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted">Gunakan zona waktu tempat kamu berada sekarang.</p>
          </div>
        </div>

        <footer className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1 text-sm">
            {error ? (
              <p className="text-danger" aria-live="assertive">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="text-success" aria-live="polite">
                {success}
              </p>
            ) : null}
            {offline ? (
              <p className="text-xs text-muted" aria-live="polite">
                Mode lokal aktif — hubungkan internet untuk menyimpan preferensi.
              </p>
            ) : null}
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={offline || saving}
          >
            {saving ? 'Menyimpan…' : 'Simpan preferensi'}
          </button>
        </footer>
      </form>
    </section>
  );
}
