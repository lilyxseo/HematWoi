import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Bell, CalendarCheck, CalendarClock, ListChecks } from 'lucide-react';
import type { NotificationsSettings } from '../../lib/api-profile';

interface NotificationsCardProps {
  value: NotificationsSettings;
  offline?: boolean;
  saving?: boolean;
  onSubmit: (next: NotificationsSettings) => Promise<void>;
}

const NOTIFICATION_ITEMS: Array<{
  key: keyof NotificationsSettings;
  title: string;
  description: string;
  icon: typeof Bell;
}> = [
  {
    key: 'weekly_summary',
    title: 'Ringkasan mingguan',
    description: 'Email rekap transaksi dan progres finansial setiap minggu.',
    icon: ListChecks,
  },
  {
    key: 'monthly_summary',
    title: 'Ringkasan bulanan',
    description: 'Laporan lengkap setiap akhir bulan untuk evaluasi keuangan.',
    icon: CalendarCheck,
  },
  {
    key: 'bill_due',
    title: 'Pengingat jatuh tempo langganan',
    description: 'Notifikasi ketika langganan atau tagihan akan jatuh tempo.',
    icon: CalendarClock,
  },
  {
    key: 'goal_reminder',
    title: 'Pengingat goal tabungan',
    description: 'Dorongan ringan untuk tetap konsisten mencapai tujuan finansial.',
    icon: Bell,
  },
];

export default function NotificationsCard({ value, offline = false, saving = false, onSubmit }: NotificationsCardProps) {
  const [form, setForm] = useState<NotificationsSettings>(value);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setForm(value);
  }, [value]);

  const handleToggle = (key: keyof NotificationsSettings) => {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
    setSuccess(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (offline) return;
    setError(null);
    setSuccess(null);
    try {
      await onSubmit(form);
      setSuccess('Preferensi notifikasi disimpan.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tidak bisa menyimpan notifikasi.';
      setError(message);
    }
  };

  return (
    <section className="rounded-3xl border border-border-subtle bg-surface shadow-sm">
      <form className="grid gap-6 p-4 md:p-6" onSubmit={handleSubmit}>
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-text">Notifikasi</h2>
          <p className="text-sm text-muted">Atur pengingat email dan push agar kamu selalu ter-update.</p>
        </header>

        <div className="grid grid-cols-1 gap-4">
          {NOTIFICATION_ITEMS.map(({ key, title, description, icon: Icon }) => (
            <label
              key={key}
              htmlFor={`notification-${key}`}
              className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition focus-within:ring-2 focus-within:ring-primary ${
                form[key] ? 'border-primary/70 bg-primary/5' : 'border-border-subtle bg-surface-alt hover:border-border-strong'
              }`}
            >
              <span className="mt-1 rounded-full bg-primary/10 p-2 text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="flex-1">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-text">{title}</span>
                  <input
                    id={`notification-${key}`}
                    type="checkbox"
                    checked={form[key]}
                    onChange={() => handleToggle(key)}
                    disabled={saving}
                    className="h-5 w-10 cursor-pointer appearance-none rounded-full border border-border-subtle bg-surface transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary checked:bg-primary"
                    role="switch"
                    aria-checked={form[key]}
                  />
                </span>
                <p className="text-xs text-muted">{description}</p>
              </span>
            </label>
          ))}
        </div>

        <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-alt p-4 text-sm text-muted">
          Ringkasan pengiriman: {form.weekly_summary ? 'Mingguan aktif' : 'Mingguan nonaktif'} ·{' '}
          {form.monthly_summary ? 'Bulanan aktif' : 'Bulanan nonaktif'} ·{' '}
          {form.bill_due ? 'Pengingat tagihan aktif' : 'Pengingat tagihan nonaktif'} ·{' '}
          {form.goal_reminder ? 'Reminder goal aktif' : 'Reminder goal nonaktif'}.
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
                Mode lokal aktif — hubungkan internet untuk menyimpan pengaturan.
              </p>
            ) : null}
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={offline || saving}
          >
            {saving ? 'Menyimpan…' : 'Simpan notifikasi'}
          </button>
        </footer>
      </form>
    </section>
  );
}
