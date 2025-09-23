import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Loader2, MonitorSmartphone, Moon, Sun } from 'lucide-react';
import type { ThemePreference } from '../../lib/api-profile';

const inputStyles =
  'h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt px-3 text-sm text-text-primary shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60';

const labelStyles = 'text-sm font-medium text-text-primary';
const helperTextStyles = 'text-xs text-text-muted';

type PreferencesCardProps = {
  theme: ThemePreference;
  locale: string;
  currency: string;
  dateFormat: string;
  timezone: string;
  pending: boolean;
  disabled?: boolean;
  onPreviewTheme: (theme: ThemePreference) => void;
  onSave: (payload: {
    theme: ThemePreference;
    locale: string;
    currency: string;
    date_format: string;
    timezone: string;
  }) => Promise<void>;
};

type ThemeOption = {
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
};

const themeOptions: ThemeOption[] = [
  { value: 'system', label: 'Sistem', icon: MonitorSmartphone },
  { value: 'light', label: 'Terang', icon: Sun },
  { value: 'dark', label: 'Gelap', icon: Moon },
];

function getTimezones(): string[] {
  if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
    try {
      // @ts-expect-error: supportedValuesOf tidak tersedia di semua runtime
      const values: string[] = Intl.supportedValuesOf('timeZone');
      return values;
    } catch {
      return ['Asia/Jakarta'];
    }
  }
  return ['Asia/Jakarta'];
}

const timezoneOptions = getTimezones();

export default function PreferencesCard({
  theme,
  locale,
  currency,
  dateFormat,
  timezone,
  pending,
  disabled = false,
  onPreviewTheme,
  onSave,
}: PreferencesCardProps) {
  const [themeValue, setThemeValue] = useState<ThemePreference>(theme);
  const [localeValue, setLocaleValue] = useState(locale);
  const [currencyValue, setCurrencyValue] = useState(currency);
  const [dateFormatValue, setDateFormatValue] = useState(dateFormat);
  const [timezoneValue, setTimezoneValue] = useState(timezone);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setThemeValue(theme);
  }, [theme]);

  useEffect(() => {
    setLocaleValue(locale);
  }, [locale]);

  useEffect(() => {
    setCurrencyValue(currency);
  }, [currency]);

  useEffect(() => {
    setDateFormatValue(dateFormat);
  }, [dateFormat]);

  useEffect(() => {
    setTimezoneValue(timezone);
  }, [timezone]);

  const timezoneGroups = useMemo(() => {
    return timezoneOptions.reduce<Record<string, string[]>>((acc, zone) => {
      const [region] = zone.split('/');
      if (!acc[region]) acc[region] = [];
      acc[region]?.push(zone);
      return acc;
    }, {});
  }, []);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || pending || saving) return;
    setError(null);
    setSaving(true);
    try {
      await onSave({
        theme: themeValue,
        locale: localeValue,
        currency: currencyValue.toUpperCase(),
        date_format: dateFormatValue,
        timezone: timezoneValue,
      });
    } catch (err) {
      setError((err as Error).message ?? 'Tidak dapat menyimpan preferensi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="preferences-settings-heading" className="rounded-3xl border border-border-subtle bg-surface p-4 shadow-sm md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 id="preferences-settings-heading" className="text-lg font-semibold text-text-primary">
            Preferensi
          </h2>
          <p className="text-sm text-text-muted">Kustomisasi tampilan dan format sesuai kebutuhan.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <fieldset className="col-span-2" aria-labelledby="theme-options-label">
          <legend id="theme-options-label" className={labelStyles}>
            Tema Aplikasi
          </legend>
          <div className="mt-2 flex flex-wrap gap-2" role="tablist">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = themeValue === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setThemeValue(option.value);
                    onPreviewTheme(option.value);
                  }}
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring-primary ${
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border-subtle bg-surface-alt text-text-primary hover:bg-surface-alt/70'
                  } ${disabled || pending ? 'cursor-not-allowed opacity-60' : ''}`}
                  disabled={disabled || pending}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className={`${helperTextStyles} mt-2`}>Perubahan tema terlihat langsung tanpa perlu menyimpan.</p>
        </fieldset>

        <div className="col-span-1">
          <label htmlFor="language" className={labelStyles}>
            Bahasa
          </label>
          <select
            id="language"
            value={localeValue}
            onChange={(event) => setLocaleValue(event.target.value)}
            className={inputStyles}
            disabled={disabled || pending || saving}
          >
            <option value="id-ID">Indonesia</option>
          </select>
          <p className={helperTextStyles}>Saat ini dukungan bahasa fokus pada Indonesia.</p>
        </div>

        <div className="col-span-1">
          <label htmlFor="currency" className={labelStyles}>
            Mata Uang
          </label>
          <select
            id="currency"
            value={currencyValue}
            onChange={(event) => setCurrencyValue(event.target.value)}
            className={inputStyles}
            disabled={disabled || pending || saving}
          >
            <option value="IDR">Rupiah (IDR)</option>
            <option value="USD">Dollar AS (USD)</option>
            <option value="EUR">Euro (EUR)</option>
            <option value="JPY">Yen Jepang (JPY)</option>
          </select>
          <p className={helperTextStyles}>Mata uang default: Rupiah. Pilih jika kamu butuh format lain.</p>
        </div>

        <div className="col-span-1">
          <label htmlFor="date-format" className={labelStyles}>
            Format Tanggal
          </label>
          <select
            id="date-format"
            value={dateFormatValue}
            onChange={(event) => setDateFormatValue(event.target.value)}
            className={inputStyles}
            disabled={disabled || pending || saving}
          >
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
          <p className={helperTextStyles}>Tentukan bagaimana tanggal ditampilkan dalam aplikasi.</p>
        </div>

        <div className="col-span-1">
          <label htmlFor="timezone" className={labelStyles}>
            Zona Waktu
          </label>
          <select
            id="timezone"
            value={timezoneValue}
            onChange={(event) => setTimezoneValue(event.target.value)}
            className="h-44 w-full rounded-2xl border border-border-subtle bg-surface-alt px-3 py-2 text-sm text-text-primary shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled || pending || saving}
            size={6}
          >
            {Object.entries(timezoneGroups).map(([region, zones]) => (
              <optgroup key={region} label={region}>
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className={helperTextStyles}>Pilih zona waktu utama aktivitas kamu.</p>
        </div>

        {error && (
          <div className="col-span-2 rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert" aria-live="polite">
            {error}
          </div>
        )}

        <div className="col-span-2 flex justify-end">
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled || pending || saving}
          >
            {(pending || saving) && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Simpan Preferensi
          </button>
        </div>
      </form>
    </section>
  );
}
