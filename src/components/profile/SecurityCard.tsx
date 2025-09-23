import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { Loader2, LogOut, ShieldCheck } from 'lucide-react';
import type { SessionInfo } from '../../lib/api-profile';

const inputStyles =
  'h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt px-3 text-sm text-text-primary shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60';

const labelStyles = 'text-sm font-medium text-text-primary';
const helperTextStyles = 'text-xs text-text-muted';

type SecurityCardProps = {
  email: string;
  sessions: SessionInfo[];
  pending: boolean;
  disabled?: boolean;
  onChangePassword: (payload: {
    current_password: string;
    new_password: string;
    confirm_password: string;
    signOutOthers: boolean;
  }) => Promise<void>;
  onSignOutCurrent: () => Promise<void>;
  onSignOutOthers: () => Promise<void>;
};

type StrengthLevel = 'weak' | 'medium' | 'strong';

type SessionDescriptor = SessionInfo & { deviceName: string; lastSeenLabel: string };

function describeStrength(password: string): StrengthLevel {
  if (!password || password.length < 6) return 'weak';
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  if (password.length >= 12 && hasNumber && hasSymbol && hasUpper) {
    return 'strong';
  }
  if (password.length >= 8 && hasNumber && (hasSymbol || hasUpper)) {
    return 'medium';
  }
  return 'weak';
}

function formatLastSeen(value: string | null): string {
  if (!value) return 'Tidak diketahui';
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return value;
  }
}

function parseDeviceName(userAgent: string | null): string {
  if (!userAgent) return 'Perangkat tidak dikenal';
  const agent = userAgent.toLowerCase();
  if (agent.includes('iphone')) return 'iPhone';
  if (agent.includes('ipad')) return 'iPad';
  if (agent.includes('android')) return 'Android';
  if (agent.includes('mac os')) return 'Mac';
  if (agent.includes('windows')) return 'Windows';
  if (agent.includes('linux')) return 'Linux';
  return 'Perangkat ini';
}

export default function SecurityCard({
  email,
  sessions,
  pending,
  disabled = false,
  onChangePassword,
  onSignOutCurrent,
  onSignOutOthers,
}: SecurityCardProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const strength = describeStrength(newPassword);

  const sessionList = useMemo<SessionDescriptor[]>(
    () =>
      (sessions || []).map((session) => ({
        ...session,
        deviceName: parseDeviceName(session.userAgent),
        lastSeenLabel: formatLastSeen(session.lastSeenAt),
      })),
    [sessions]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || pending || submitting) return;
    setError(null);
    if (!currentPassword || !newPassword) {
      setError('Lengkapi kata sandi saat ini dan baru.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    setSubmitting(true);
    try {
      await onChangePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
        signOutOthers,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError((err as Error).message ?? 'Tidak dapat mengubah kata sandi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="security-settings-heading" className="rounded-3xl border border-border-subtle bg-surface p-4 shadow-sm md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 id="security-settings-heading" className="text-lg font-semibold text-text-primary">
            Keamanan Akun
          </h2>
          <p className="text-sm text-text-muted">Kelola kata sandi dan sesi perangkat aktif.</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-border-subtle bg-surface-alt px-3 py-2 text-xs text-text-muted">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>{email}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="col-span-2 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="current-password" className={labelStyles}>
              Kata Sandi Saat Ini
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              className={inputStyles}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={disabled || pending || submitting}
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor="new-password" className={labelStyles}>
              Kata Sandi Baru
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              className={inputStyles}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={disabled || pending || submitting}
              aria-describedby="password-strength"
              aria-required="true"
            />
            <p id="password-strength" className={helperTextStyles} aria-live="polite">
              {strength === 'strong' && 'Kuat'}
              {strength === 'medium' && 'Cukup kuat'}
              {strength === 'weak' && 'Masih lemah'}
            </p>
          </div>
          <div>
            <label htmlFor="confirm-password" className={labelStyles}>
              Konfirmasi Kata Sandi Baru
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              className={inputStyles}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={disabled || pending || submitting}
              aria-required="true"
              aria-invalid={Boolean(confirmPassword) && confirmPassword !== newPassword}
            />
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border-subtle text-primary focus:ring-ring-primary"
                checked={signOutOthers}
                onChange={(event) => setSignOutOthers(event.target.checked)}
                disabled={disabled || pending || submitting}
              />
              Keluar dari perangkat lain setelah ganti kata sandi
            </label>
            <p className={helperTextStyles}>Kami akan mempertahankan sesi di perangkat ini.</p>
          </div>
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
            disabled={disabled || pending || submitting}
          >
            {(pending || submitting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Ubah Kata Sandi
          </button>
        </div>
      </form>

      <div className="mt-8 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">Sesi Aktif</h3>
          <button
            type="button"
            onClick={() => onSignOutOthers()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface-alt px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-alt/70 focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled || pending}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Keluar dari Semua Perangkat
          </button>
        </div>
        <ul className="space-y-3" role="list">
          {sessionList.map((session) => (
            <li
              key={session.id}
              className="flex flex-col gap-2 rounded-2xl border border-border-subtle bg-surface-alt/50 p-4 text-sm text-text-primary shadow-sm md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-semibold">{session.deviceName}</p>
                <p className="text-xs text-text-muted">Terakhir aktif: {session.lastSeenLabel}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-muted">{session.isCurrent ? 'Perangkat ini' : 'Perangkat lain'}</span>
                <button
                  type="button"
                  onClick={() => (session.isCurrent ? onSignOutCurrent() : onSignOutOthers())}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-border-subtle px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={disabled || pending}
                >
                  Keluar
                </button>
              </div>
            </li>
          ))}
          {sessionList.length === 0 && (
            <li className="rounded-2xl border border-border-subtle bg-surface-alt/50 p-4 text-sm text-text-muted">
              Tidak ada sesi aktif.
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
