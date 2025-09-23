import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import type { ThemePreference, UserProfileRecord } from '../../lib/api-profile';

const inputClassName =
  'h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt px-3 text-sm text-text placeholder:text-muted shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-70';

const labelClassName = 'text-sm font-medium text-muted';

type PreferencesCardProps = {
  profile: UserProfileRecord;
  saving: boolean;
  disabled: boolean;
  onSave: (values: {
    theme: ThemePreference;
    locale: string;
    currency: string;
    date_format: string;
    timezone: string;
  }) => Promise<void>;
  onPreviewTheme: (theme: ThemePreference) => void;
};

const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Ikuti sistem' },
  { value: 'light', label: 'Terang' },
  { value: 'dark', label: 'Gelap' },
];

const localeOptions = [
  { value: 'id-ID', label: 'Indonesia' },
  { value: 'en-US', label: 'English (US)' },
];

const currencyOptions = [
  { value: 'IDR', label: 'Rupiah (IDR)' },
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'SGD', label: 'Singapore Dollar (SGD)' },
];

const dateFormatOptions = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
];

function getTimezones(): string[] {
  try {
    // @ts-ignore - Intl.supportedValuesOf might not exist in older browsers
    const list = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    if (Array.isArray(list) && list.length) return list as string[];
  } catch {
    // ignore
  }
  return [
    'Asia/Jakarta',
    'Asia/Makassar',
    'Asia/Jayapura',
    'Asia/Singapore',
    'Asia/Kuala_Lumpur',
    'Asia/Bangkok',
    'Asia/Tokyo',
    'Europe/London',
    'America/New_York',
    'Australia/Sydney',
  ];
}

export default function PreferencesCard({ profile, saving, disabled, onSave, onPreviewTheme }: PreferencesCardProps) {
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [locale, setLocale] = useState('id-ID');
  const [currency, setCurrency] = useState('IDR');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [timezone, setTimezone] = useState('Asia/Jakarta');
  const [query, setQuery] = useState('');

  useEffect(() => {
    setTheme(profile.theme);
    setLocale(profile.locale);
    setCurrency(profile.currency);
    setDateFormat(profile.date_format);
    setTimezone(profile.timezone);
  }, [profile.theme, profile.locale, profile.currency, profile.date_format, profile.timezone]);

  const timezoneOptions = useMemo(() => {
    const list = getTimezones();
    if (!query) return list;
    const q = query.toLowerCase();
    return list.filter((tz) => tz.toLowerCase().includes(q));
  }, [query]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || saving) return;
    await onSave({
      theme,
      locale,
      currency,
      date_format: dateFormat,
      timezone,
    });
  };

  const handleThemeClick = (value: ThemePreference) => {
    setTheme(value);
    onPreviewTheme(value);
  };

  return (
    <section className="rounded-3xl border border-border-subtle bg-surface shadow-sm" aria-labelledby="profile-preferences">
      <div className="p-4 md:p-6">
        <header className="mb-6 flex flex-col gap-1">
          <h2 id="profile-preferences" className="text-lg font-semibold text-primary">
            Preferensi
          </h2>
          <p className="text-sm text-muted">Atur tampilan, bahasa, dan format data sesuai kebutuhan.</p>
        </header>
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="md:col-span-2">
            <span className={clsx(labelClassName, 'mb-2 block')}>Tema</span>
            <div className="inline-flex rounded-2xl border border-border-subtle bg-surface-alt/50 p-1">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleThemeClick(option.value)}
                  className={clsx(
                    'min-h-[40px] rounded-2xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                    theme === option.value
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted hover:text-primary',
                  )}
                  aria-pressed={theme === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="locale" className={labelClassName}>
              Bahasa
            </label>
            <select
              id="locale"
              name="locale"
              className={inputClassName}
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
              disabled={saving || disabled}
            >
              {localeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="currency" className={labelClassName}>
              Mata uang
            </label>
            <select
              id="currency"
              name="currency"
              className={inputClassName}
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              disabled={saving || disabled}
            >
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="date_format" className={labelClassName}>
              Format tanggal
            </label>
            <select
              id="date_format"
              name="date_format"
              className={inputClassName}
              value={dateFormat}
              onChange={(event) => setDateFormat(event.target.value)}
              disabled={saving || disabled}
            >
              {dateFormatOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <label htmlFor="timezone" className={labelClassName}>
              Zona waktu
            </label>
            <div className="relative flex flex-col gap-2">
              <input
                id="timezone"
                name="timezone"
                type="text"
                className={inputClassName}
                value={timezone}
                onChange={(event) => {
                  setTimezone(event.target.value);
                  setQuery(event.target.value);
                }}
                placeholder="Cari zona waktu"
                disabled={saving || disabled}
                list="profile-timezones"
                autoComplete="off"
              />
              <datalist id="profile-timezones">
                {timezoneOptions.slice(0, 50).map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              <p className="text-xs text-muted">Mulai ketik nama kota atau zona waktu untuk memfilter.</p>
            </div>
          </div>

          <div className="md:col-span-2 flex items-center justify-end">
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-primary/60 bg-primary/90 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving || disabled}
            >
              {saving ? 'Menyimpan...' : 'Simpan preferensi'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
