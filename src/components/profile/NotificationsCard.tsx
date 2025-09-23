import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BellRing, CalendarClock, Check, Loader2, MailCheck, RefreshCw } from 'lucide-react';
import type { ProfileNotifications } from '../../lib/api-profile';

interface NotificationsCardProps {
  notifications: ProfileNotifications | null;
  offline: boolean;
  saving: boolean;
  onSave: (payload: Partial<ProfileNotifications>) => Promise<void>;
}

type ToggleKey = keyof ProfileNotifications;

type ToggleConfig = {
  key: ToggleKey;
  title: string;
  description: string;
  icon: ReactNode;
};

const TOGGLE_CONFIGS: ToggleConfig[] = [
  {
    key: 'weekly_summary',
    title: 'Ringkasan mingguan',
    description: 'Ringkasan performa finansial setiap minggu.',
    icon: <MailCheck className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: 'monthly_summary',
    title: 'Ringkasan bulanan',
    description: 'Laporan lengkap setiap akhir bulan.',
    icon: <MailCheck className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: 'bill_due',
    title: 'Pengingat tagihan',
    description: 'Notifikasi sebelum langganan jatuh tempo.',
    icon: <CalendarClock className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: 'goal_reminder',
    title: 'Reminder goals',
    description: 'Dorongan lembut agar target finansial tidak kendor.',
    icon: <BellRing className="h-4 w-4" aria-hidden="true" />,
  },
];

function SwitchButton({
  active,
  label,
  icon,
  disabled,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-10 w-18 flex-shrink-0 items-center rounded-full border px-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60 ${
        active ? 'border-primary bg-primary' : 'border-border-subtle bg-surface'
      }`}
    >
      <span className="sr-only">{label}</span>
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
          active ? 'translate-x-8 text-primary' : 'translate-x-0 text-muted'
        }`}
      >
        {active ? <Check className="h-4 w-4" aria-hidden="true" /> : icon}
      </span>
    </button>
  );
}

export default function NotificationsCard({ notifications, offline, saving, onSave }: NotificationsCardProps) {
  const [localState, setLocalState] = useState<ProfileNotifications>({
    weekly_summary: true,
    monthly_summary: false,
    bill_due: true,
    goal_reminder: true,
  });
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!notifications) return;
    setLocalState(notifications);
    setDirty(false);
    setError('');
  }, [notifications]);

  const summaryText = useMemo(() => {
    const active = TOGGLE_CONFIGS.filter((toggle) => localState[toggle.key]);
    if (active.length === 0) return 'Tidak ada notifikasi aktif.';
    const labels = active.map((item) => item.title.toLowerCase());
    return `Aktif: ${labels.join(', ')}.`;
  }, [localState]);

  const handleToggle = useCallback(
    (key: ToggleKey) => {
      if (offline) return;
      setLocalState((prev) => ({ ...prev, [key]: !prev[key] }));
      setDirty(true);
    },
    [offline],
  );

  const handleSave = useCallback(async () => {
    if (!dirty || offline) return;
    setError('');
    try {
      await onSave(localState);
      setDirty(false);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Tidak bisa memperbarui notifikasi saat ini.',
      );
    }
  }, [dirty, offline, onSave, localState]);

  return (
    <section
      aria-labelledby="profile-notifications-heading"
      className="rounded-3xl border border-border-subtle bg-surface p-4 shadow-sm md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="profile-notifications-heading" className="text-lg font-semibold text-foreground">
          Notifikasi
        </h2>
        <p className="text-sm text-muted">Kontrol email ringkasan dan pengingat penting.</p>
      </div>
      <div className="mt-6 space-y-4">
        <div className="rounded-3xl border border-border-subtle bg-surface-alt/60 p-4 text-sm text-muted">
          <div className="flex items-center gap-2 text-foreground">
            <BellRing className="h-4 w-4" aria-hidden="true" />
            Jadwal ringkasan
          </div>
          <p className="mt-2 text-xs text-muted" aria-live="polite">
            {summaryText}
          </p>
        </div>
        <ul className="space-y-4">
          {TOGGLE_CONFIGS.map((toggle) => (
            <li key={toggle.key} className="flex flex-col gap-3 rounded-3xl border border-border-subtle bg-surface-alt/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 text-left">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-surface text-muted">
                  {toggle.icon}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{toggle.title}</p>
                  <p className="text-xs text-muted">{toggle.description}</p>
                </div>
              </div>
              <SwitchButton
                active={localState[toggle.key]}
                label={toggle.title}
                icon={toggle.icon}
                disabled={offline || saving}
                onClick={() => handleToggle(toggle.key)}
              />
            </li>
          ))}
        </ul>
        {error ? <p className="text-sm text-danger" aria-live="assertive">{error}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setLocalState(notifications ?? localState);
              setDirty(false);
              setError('');
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border-subtle bg-surface px-3 text-xs font-semibold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Reset
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!dirty || offline || saving}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Simpan notifikasi
          </button>
        </div>
      </div>
    </section>
  );
}
