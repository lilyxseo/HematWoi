import { useEffect, useState } from 'react';
import type { NotificationSettings } from '../../lib/api-profile';

const toggleBase =
  'relative inline-flex h-6 w-11 items-center rounded-full border border-border-subtle bg-surface-alt transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-60';

function Toggle({
  id,
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
  description: string;
}) {
  const descriptionId = `${id}-description`;
  return (
    <label htmlFor={id} className="flex items-start justify-between gap-4 rounded-2xl border border-border-subtle bg-surface-alt/60 p-4 shadow-sm">
      <div className="space-y-1">
        <span className="block text-sm font-semibold text-primary">{label}</span>
        <p id={descriptionId} className="text-xs text-muted">
          {description}
        </p>
      </div>
      <span className="flex items-center gap-3">
        <span className="text-xs text-muted" aria-hidden="true">
          {checked ? 'Aktif' : 'Nonaktif'}
        </span>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-describedby={descriptionId}
          onClick={() => onChange(!checked)}
          className={`${toggleBase} ${checked ? 'bg-primary/80' : ''}`}
          disabled={disabled}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`}
          />
        </button>
      </span>
    </label>
  );
}

type NotificationsCardProps = {
  value: NotificationSettings;
  saving: boolean;
  disabled: boolean;
  onSave: (value: NotificationSettings) => Promise<void>;
};

export default function NotificationsCard({ value, saving, disabled, onSave }: NotificationsCardProps) {
  const [state, setState] = useState<NotificationSettings>(value);

  useEffect(() => {
    setState(value);
  }, [value.weekly_summary, value.monthly_summary, value.bill_due, value.goal_reminder]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || saving) return;
    await onSave(state);
  };

  return (
    <section className="rounded-3xl border border-border-subtle bg-surface shadow-sm" aria-labelledby="profile-notifications">
      <div className="p-4 md:p-6">
        <header className="mb-6 flex flex-col gap-1">
          <h2 id="profile-notifications" className="text-lg font-semibold text-primary">
            Notifikasi
          </h2>
          <p className="text-sm text-muted">Kelola ringkasan email dan pengingat penting.</p>
        </header>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Toggle
              id="weekly_summary"
              checked={state.weekly_summary}
              onChange={(checked) => setState((prev) => ({ ...prev, weekly_summary: checked }))
              disabled={disabled}
              label="Ringkasan mingguan"
              description="Dapatkan email ringkasan setiap minggu tentang pengeluaran dan pemasukan."
            />
            <Toggle
              id="monthly_summary"
              checked={state.monthly_summary}
              onChange={(checked) => setState((prev) => ({ ...prev, monthly_summary: checked }))
              disabled={disabled}
              label="Ringkasan bulanan"
              description="Satu email setiap akhir bulan dengan analisis mendalam."
            />
            <Toggle
              id="bill_due"
              checked={state.bill_due}
              onChange={(checked) => setState((prev) => ({ ...prev, bill_due: checked }))
              disabled={disabled}
              label="Pengingat jatuh tempo langganan"
              description="Pengingat sebelum langganan kamu ditagihkan."
            />
            <Toggle
              id="goal_reminder"
              checked={state.goal_reminder}
              onChange={(checked) => setState((prev) => ({ ...prev, goal_reminder: checked }))
              disabled={disabled}
              label="Reminder goals"
              description="Suntikan motivasi untuk tetap konsisten mengejar target keuangan."
            />
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface-alt/60 p-4 text-xs text-muted">
            <p className="font-semibold text-primary">Ringkasan jadwal</p>
            <ul className="mt-2 space-y-1">
              <li>
                • Email mingguan dikirim setiap Senin pukul 08.00 WIB jika ringkasan mingguan aktif.
              </li>
              <li>
                • Email bulanan dikirim tanggal 1 pukul 09.00 WIB dengan laporan lengkap.
              </li>
              <li>
                • Pengingat langganan terkirim 3 hari sebelum jatuh tempo.
              </li>
              <li>
                • Reminder goals dikirim setiap Jumat pukul 18.00 WIB.
              </li>
            </ul>
          </div>
          <div className="flex items-center justify-end">
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-primary/60 bg-primary/90 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving || disabled}
            >
              {saving ? 'Menyimpan...' : 'Simpan notifikasi'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
