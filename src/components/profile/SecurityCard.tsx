import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import type { SessionSummary } from '../../lib/api-profile';

const inputClassName =
  'h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt px-3 text-sm text-text placeholder:text-muted shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-70';

const labelClassName = 'text-sm font-medium text-muted';

type SecurityCardProps = {
  sessions: SessionSummary[];
  loadingPassword: boolean;
  disabled: boolean;
  onChangePassword: (payload: {
    current_password: string;
    new_password: string;
    sign_out_others: boolean;
  }) => Promise<void>;
  onRefreshSessions?: () => Promise<void>;
  onSignOutCurrent: () => Promise<void>;
  onSignOutAll: () => Promise<void>;
};

function strengthLabel(password: string): { label: string; tone: string } {
  if (!password) return { label: 'Belum diisi', tone: 'text-muted' };
  const score = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].reduce(
    (acc, pattern) => (pattern.test(password) ? acc + 1 : acc),
    0,
  );
  if (password.length >= 10 && score >= 3) return { label: 'Kuat', tone: 'text-success' };
  if (password.length >= 8 && score >= 2) return { label: 'Cukup', tone: 'text-warning' };
  return { label: 'Lemah', tone: 'text-danger' };
}

function formatDate(date?: string | null): string {
  if (!date) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(date));
  } catch {
    return date;
  }
}

function formatDevice(userAgent?: string | null): string {
  if (!userAgent) return 'Perangkat tidak dikenali';
  const lower = userAgent.toLowerCase();
  if (lower.includes('iphone')) return 'iPhone';
  if (lower.includes('ipad')) return 'iPad';
  if (lower.includes('android')) return 'Android';
  if (lower.includes('mac os')) return 'Mac';
  if (lower.includes('windows')) return 'Windows';
  if (lower.includes('linux')) return 'Linux';
  return 'Perangkat lain';
}

export default function SecurityCard({
  sessions,
  loadingPassword,
  disabled,
  onChangePassword,
  onRefreshSessions,
  onSignOutCurrent,
  onSignOutAll,
}: SecurityCardProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [success]);

  const strength = useMemo(() => strengthLabel(newPassword), [newPassword]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || loadingPassword) return;
    setError(null);
    setSuccess(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Lengkapi semua kolom kata sandi.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak sama.');
      return;
    }
    try {
      await onChangePassword({
        current_password: currentPassword,
        new_password: newPassword,
        sign_out_others: signOutOthers,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Kata sandi berhasil diperbarui.');
      if (onRefreshSessions) {
        await onRefreshSessions();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tidak dapat mengubah kata sandi.');
    }
  };

  return (
    <section className="rounded-3xl border border-border-subtle bg-surface shadow-sm" aria-labelledby="profile-security">
      <div className="p-4 md:p-6">
        <header className="mb-6 flex flex-col gap-1">
          <h2 id="profile-security" className="text-lg font-semibold text-primary">
            Keamanan
          </h2>
          <p className="text-sm text-muted">Perbarui kata sandi dan kelola sesi aktif.</p>
        </header>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label htmlFor="current_password" className={labelClassName}>
                Kata sandi saat ini
              </label>
              <input
                id="current_password"
                name="current_password"
                type="password"
                className={inputClassName}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                disabled={loadingPassword || disabled}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="new_password" className={labelClassName}>
                Kata sandi baru
              </label>
              <input
                id="new_password"
                name="new_password"
                type="password"
                className={inputClassName}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                disabled={loadingPassword || disabled}
                aria-describedby="password-strength"
              />
              <p id="password-strength" className={clsx('text-xs', strength.tone)} aria-live="polite">
                Kekuatan: {strength.label}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="confirm_password" className={labelClassName}>
                Konfirmasi kata sandi
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                className={inputClassName}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                disabled={loadingPassword || disabled}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border border-border-subtle bg-surface-alt text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                checked={signOutOthers}
                onChange={(event) => setSignOutOthers(event.target.checked)}
                disabled={loadingPassword || disabled}
              />
              Keluar dari sesi lain setelah kata sandi diganti
            </label>
            {error ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="text-sm text-success" role="status">
                {success}
              </p>
            ) : null}
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-primary/60 bg-primary/90 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loadingPassword || disabled}
              >
                {loadingPassword ? 'Menyimpan...' : 'Ubah kata sandi'}
              </button>
            </div>
          </form>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-primary">Sesi aktif & perangkat</h3>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border-subtle bg-surface px-3 text-xs font-semibold text-muted transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => onRefreshSessions && onRefreshSessions()}
                disabled={disabled}
              >
                Segarkan
              </button>
            </div>
            <div className="space-y-3">
              {sessions.map((session) => (
                <article
                  key={session.id}
                  className="flex flex-col gap-2 rounded-2xl border border-border-subtle bg-surface-alt/60 p-4 text-sm text-text shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="font-semibold">{formatDevice(session.userAgent)}</span>
                      <span className="text-xs text-muted">
                        Terakhir aktif: {formatDate(session.lastSignInAt)}
                      </span>
                    </div>
                    {session.isCurrent ? (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        Perangkat ini
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>Login: {formatDate(session.createdAt)}</span>
                    <span>Berakhir: {formatDate(session.expiresAt)}</span>
                  </div>
                </article>
              ))}
              {sessions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border-subtle/70 bg-surface-alt/60 p-6 text-center text-sm text-muted">
                  Tidak ada sesi aktif.
                </div>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface px-4 text-sm font-semibold text-text transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onSignOutCurrent}
                disabled={disabled}
              >
                Keluar dari perangkat ini
              </button>
              <button
                type="button"
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-2xl border border-danger/60 bg-danger/90 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onSignOutAll}
                disabled={disabled}
              >
                Keluar dari semua perangkat
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
