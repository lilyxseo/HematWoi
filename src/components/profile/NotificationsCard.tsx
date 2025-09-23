import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import type { NotificationSettings } from '../../lib/api-profile';

const labelStyles = 'text-sm font-medium text-text-primary';
const helperTextStyles = 'text-xs text-text-muted';

type NotificationsCardProps = {
  settings: NotificationSettings;
  pending: boolean;
  disabled?: boolean;
  onSave: (settings: NotificationSettings) => Promise<void>;
};

type ToggleItem = {
  key: keyof NotificationSettings;
  title: string;
  description: string;
};

const toggles: ToggleItem[] = [
  {
    key: 'weekly_summary',
    title: 'Ringkasan Mingguan',
    description: 'Dapatkan rangkuman finansial setiap minggu ke email kamu.',
  },
  {
    key: 'monthly_summary',
    title: 'Ringkasan Bulanan',
    description: 'Laporan ringkas setiap akhir bulan.',
  },
  {
    key: 'bill_due',
    title: 'Pengingat Tagihan',
    description: 'Kami akan mengingatkan sebelum langganan jatuh tempo.',
  },
  {
    key: 'goal_reminder',
    title: 'Reminder Goals',
    description: 'Dorongan ringan agar target finansialmu tetap on track.',
  },
];

export default function NotificationsCard({ settings, pending, disabled = false, onSave }: NotificationsCardProps) {
  const [state, setState] = useState<NotificationSettings>(settings);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setState(settings);
  }, [settings]);

  const toggleValue = (key: keyof NotificationSettings) => {
    setState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || pending || saving) return;
    setError(null);
    setSaving(true);
    try {
      await onSave(state);
    } catch (err) {
      setError((err as Error).message ?? 'Tidak bisa menyimpan notifikasi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="notification-settings-heading" className="rounded-3xl border border-border-subtle bg-surface p-4 shadow-sm md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 id="notification-settings-heading" className="text-lg font-semibold text-text-primary">
            Notifikasi
          </h2>
          <p className="text-sm text-text-muted">Atur notifikasi email dan pengingat penting.</p>
        </div>
        <BellRing className="h-6 w-6 text-primary" aria-hidden="true" />
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <ul className="space-y-3" role="list">
          {toggles.map((item) => {
            const active = state[item.key];
            return (
              <li
                key={item.key}
                className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-alt/60 p-4 shadow-sm md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{item.title}</h3>
                  <p className={helperTextStyles}>{item.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={active}
                  onClick={() => toggleValue(item.key)}
                  className={`inline-flex h-11 w-24 items-center rounded-full border px-1 transition focus:outline-none focus:ring-2 focus:ring-ring-primary ${
                    active
                      ? 'border-primary bg-primary/20 justify-end text-primary'
                      : 'border-border-subtle bg-surface text-text-muted justify-start'
                  } ${disabled || pending ? 'cursor-not-allowed opacity-60' : ''}`}
                  disabled={disabled || pending}
                >
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-sm transition ${active ? 'translate-x-0' : ''}`}>
                    <span className="sr-only">{active ? 'Aktif' : 'Nonaktif'}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="rounded-2xl border border-border-subtle bg-surface-alt/70 p-4 text-sm text-text-muted">
          <h3 className="text-sm font-semibold text-text-primary">Ringkasan jadwal</h3>
          <p className="mt-1 text-xs text-text-muted">
            Mingguan dikirim setiap Senin pukul 07:00 WIB, sedangkan bulanan dikirim di hari pertama bulan berikutnya.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert" aria-live="polite">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled || pending || saving}
          >
            {(pending || saving) && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Simpan Notifikasi
          </button>
        </div>
      </form>
    </section>
  );
}
