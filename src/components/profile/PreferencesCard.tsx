import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  IconAlertCircle as AlertCircle,
  IconWorld as Globe2,
  IconLanguage as Languages,
  IconLoader2 as Loader2,
  IconMoonStars as MoonStar,
  IconSun as SunMedium
} from '@tabler/icons-react';
import type { ThemeMode, UserProfile } from '../../lib/api-profile';

interface PreferencesCardProps {
  profile: UserProfile | null;
  offline: boolean;
  saving: boolean;
  onSave: (payload: {
    theme?: ThemeMode;
    currency?: string;
    locale?: string;
    date_format?: string;
    timezone?: string;
  }) => Promise<void>;
  onPreviewTheme: (theme: ThemeMode) => void;
}

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; icon: ReactNode }> = [
  { value: 'system', label: 'Sistem', icon: <Globe2 className="h-4 w-4" aria-hidden="true" /> },
  { value: 'light', label: 'Terang', icon: <SunMedium className="h-4 w-4" aria-hidden="true" /> },
  { value: 'dark', label: 'Gelap', icon: <MoonStar className="h-4 w-4" aria-hidden="true" /> },
];

const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
const CURRENCIES = ['IDR', 'USD', 'EUR'];
const LOCALES = [
  { value: 'id-ID', label: 'Indonesia' },
  { value: 'en-US', label: 'English (US)' },
];

function getTimezoneOptions() {
  if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
    try {
      const tz = (Intl as any).supportedValuesOf('timeZone');
      if (Array.isArray(tz) && tz.length > 0) {
        return tz as string[];
      }
    } catch {
      // ignore
    }
  }
  return [
    'Asia/Jakarta',
    'Asia/Makassar',
    'Asia/Jayapura',
    'Asia/Singapore',
    'Asia/Bangkok',
    'Asia/Tokyo',
    'Europe/London',
    'America/New_York',
  ];
}

const TIMEZONE_OPTIONS = getTimezoneOptions();

export default function PreferencesCard({
  profile,
  offline,
  saving,
  onSave,
  onPreviewTheme,
}: PreferencesCardProps) {
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [currency, setCurrency] = useState('IDR');
  const [locale, setLocale] = useState('id-ID');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [timezone, setTimezone] = useState('Asia/Jakarta');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile) return;
    setTheme(profile.theme ?? 'system');
    setCurrency(profile.currency ?? 'IDR');
    setLocale(profile.locale ?? 'id-ID');
    setDateFormat(profile.date_format ?? 'DD/MM/YYYY');
    setTimezone(profile.timezone ?? 'Asia/Jakarta');
  }, [profile]);

  const hasChanges = useMemo(() => {
    if (!profile) return false;
    return (
      theme !== (profile.theme ?? 'system') ||
      currency !== (profile.currency ?? 'IDR') ||
      locale !== (profile.locale ?? 'id-ID') ||
      dateFormat !== (profile.date_format ?? 'DD/MM/YYYY') ||
      timezone !== (profile.timezone ?? 'Asia/Jakarta')
    );
  }, [theme, currency, locale, dateFormat, timezone, profile]);

  const handleThemeChange = useCallback(
    (value: ThemeMode) => {
      setTheme(value);
      onPreviewTheme(value);
    },
    [onPreviewTheme],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!hasChanges || offline) return;
      setError('');
      try {
        await onSave({
          theme,
          currency: currency.trim(),
          locale,
          date_format: dateFormat,
          timezone: timezone.trim() || 'Asia/Jakarta',
        });
      } catch (error) {
        setError(
          error instanceof Error ? error.message : 'Tidak bisa menyimpan preferensi saat ini.',
        );
      }
    },
    [hasChanges, offline, onSave, theme, currency, locale, dateFormat, timezone],
  );

  return (
    <section
      aria-labelledby="profile-preferences-heading"
      className="rounded-3xl border border-border-subtle bg-surface p-4 shadow-sm md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="profile-preferences-heading" className="text-lg font-semibold text-foreground">
          Preferensi
        </h2>
        <p className="text-sm text-muted">Sesuaikan tampilan aplikasi sesuai gaya kamu.</p>
      </div>
      <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <fieldset className="col-span-1 md:col-span-2">
          <legend className="text-sm font-medium text-foreground">Tema aplikasi</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-pressed={theme === option.value}
                onClick={() => handleThemeChange(option.value)}
                disabled={offline}
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60 ${
                  theme === option.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border-subtle bg-surface-alt/60 text-foreground hover:border-primary/50'
                }`}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-1">
          <label htmlFor="profile-locale" className="text-sm font-medium text-foreground">
            Bahasa
          </label>
          <div className="relative">
            <Languages className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <select
              id="profile-locale"
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
              disabled={offline || saving}
              className="h-11 w-full appearance-none rounded-2xl border border-border-subtle bg-surface-alt/70 pl-10 pr-8 text-sm text-foreground shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {LOCALES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="profile-currency" className="text-sm font-medium text-foreground">
            Mata uang utama
          </label>
          <select
            id="profile-currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            disabled={offline || saving}
            className="h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt/70 px-3 text-sm text-foreground shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {CURRENCIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="profile-date-format" className="text-sm font-medium text-foreground">
            Format tanggal
          </label>
          <select
            id="profile-date-format"
            value={dateFormat}
            onChange={(event) => setDateFormat(event.target.value)}
            disabled={offline || saving}
            className="h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt/70 px-3 text-sm text-foreground shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {DATE_FORMATS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <label htmlFor="profile-timezone" className="text-sm font-medium text-foreground">
            Zona waktu
          </label>
          <div className="relative">
            <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              list="profile-timezone-options"
              id="profile-timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              disabled={offline || saving}
              className="h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt/70 pl-10 pr-3 text-sm text-foreground shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            />
            <datalist id="profile-timezone-options">
              {TIMEZONE_OPTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
          <p className="text-xs text-muted">
            Ketik untuk mencari zona waktu. Kami menyarankan mengikuti zona domisili.
          </p>
        </div>
        {error ? (
          <p className="col-span-1 md:col-span-2 flex items-center gap-2 text-sm text-danger" aria-live="assertive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            {error}
          </p>
        ) : null}
        <div className="col-span-1 md:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={!hasChanges || saving || offline}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Simpan preferensi
          </button>
        </div>
      </form>
    </section>
  );
}
