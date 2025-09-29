import { useCallback, useMemo, useState } from 'react';
import { AlertCircle, Laptop, Loader2, LogOut, RefreshCcw, ShieldCheck } from 'lucide-react';
import type { PasswordChangePayload, SessionInfo } from '../../lib/api-profile';

interface SecurityCardProps {
  offline: boolean;
  sessions: SessionInfo[];
  loadingSessions: boolean;
  hasPassword: boolean;
  onRefreshSessions: () => Promise<void>;
  onSignOutSession: (sessionId?: string) => Promise<void>;
  onChangePassword: (payload: PasswordChangePayload) => Promise<void>;
  onCreatePassword: (newPassword: string) => Promise<void>;
}

type StrengthLevel = 'weak' | 'medium' | 'strong';

function labelForStrength(strength: StrengthLevel) {
  switch (strength) {
    case 'strong':
      return 'Kuat';
    case 'medium':
      return 'Cukup';
    default:
      return 'Lemah';
  }
}

function detectStrength(password: string): { score: number; label: StrengthLevel } {
  if (!password) {
    return { score: 0, label: 'weak' };
  }
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password) || /[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  if (score >= 3) {
    return { score: 3, label: 'strong' };
  }
  if (score === 2) {
    return { score: 2, label: 'medium' };
  }
  return { score: 1, label: 'weak' };
}

export default function SecurityCard({
  offline,
  sessions,
  loadingSessions,
  hasPassword,
  onRefreshSessions,
  onSignOutSession,
  onChangePassword,
  onCreatePassword,
}: SecurityCardProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signOutOther, setSignOutOther] = useState(true);
  const [changing, setChanging] = useState(false);
  const [formError, setFormError] = useState('');
  const [sessionMessage, setSessionMessage] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [sessionBusy, setSessionBusy] = useState(false);

  const strength = useMemo(() => detectStrength(newPassword), [newPassword]);

  const disabledChange = useMemo(() => {
    if (!newPassword || !confirmPassword) return true;
    if (newPassword !== confirmPassword) return true;
    if (hasPassword && !currentPassword) return true;
    return offline;
  }, [currentPassword, newPassword, confirmPassword, offline, hasPassword]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (disabledChange) return;
      setChanging(true);
      setFormError('');
      try {
        if (hasPassword) {
          await onChangePassword({
            current_password: currentPassword,
            new_password: newPassword,
            sign_out_other: signOutOther,
          });
          setCurrentPassword('');
        } else {
          await onCreatePassword(newPassword);
        }
        setNewPassword('');
        setConfirmPassword('');
      } catch (error) {
        setFormError(
          error instanceof Error
            ? error.message
            : hasPassword
              ? 'Tidak bisa mengganti password saat ini.'
              : 'Tidak bisa membuat password saat ini.',
        );
      } finally {
        setChanging(false);
      }
    },
    [
      disabledChange,
      hasPassword,
      onChangePassword,
      currentPassword,
      newPassword,
      signOutOther,
      onCreatePassword,
    ],
  );

  const handleRefreshSessions = useCallback(async () => {
    setSessionError('');
    setSessionMessage('');
    setSessionBusy(true);
    try {
      await onRefreshSessions();
      setSessionMessage('Daftar sesi diperbarui.');
    } catch (error) {
      setSessionError(
        error instanceof Error ? error.message : 'Tidak bisa memuat sesi saat ini.',
      );
    } finally {
      setSessionBusy(false);
    }
  }, [onRefreshSessions]);

  const handleSignOut = useCallback(
    async (sessionId?: string) => {
      setSessionError('');
      setSessionMessage('');
      setSessionBusy(true);
      try {
        await onSignOutSession(sessionId);
        setSessionMessage('Sesi berhasil ditutup.');
      } catch (error) {
        setSessionError(
          error instanceof Error ? error.message : 'Tidak bisa keluar dari sesi tersebut.',
        );
      } finally {
        setSessionBusy(false);
      }
    },
    [onSignOutSession],
  );

  return (
    <section
      aria-labelledby="profile-security-heading"
      className="rounded-3xl border border-border-subtle bg-surface p-4 shadow-sm md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="profile-security-heading" className="text-lg font-semibold text-foreground">
          Keamanan
        </h2>
        <p className="text-sm text-muted">
          Atur password, kontrol sesi aktif, dan pastikan akun tetap aman.
        </p>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {hasPassword ? (
            <div className="space-y-1">
              <label htmlFor="profile-current-password" className="text-sm font-medium text-foreground">
                Password saat ini
              </label>
              <input
                id="profile-current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={changing || offline}
                className="h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt/70 px-3 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          ) : (
            <p className="rounded-2xl bg-surface-alt/60 p-3 text-xs text-muted">
              Kamu belum memiliki password. Buat password untuk bisa masuk tanpa akun Google atau
              GitHub.
            </p>
          )}
          <div className="space-y-1">
            <label htmlFor="profile-new-password" className="text-sm font-medium text-foreground">
              Password baru
            </label>
            <input
              id="profile-new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={changing || offline}
              aria-describedby="password-strength"
              className="h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt/70 px-3 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="mt-2 space-y-2" id="password-strength" aria-live="polite">
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-alt">
                <div
                  className={
                    strength.label === 'strong'
                      ? 'h-full bg-success'
                      : strength.label === 'medium'
                        ? 'h-full bg-warning'
                        : 'h-full bg-danger'
                  }
                  style={{ width: `${Math.min(strength.score * 33.33, 100)}%` }}
                />
              </div>
              <p className="flex items-center gap-2 text-xs text-muted">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Kekuatan: <span className="font-semibold text-foreground">{labelForStrength(strength.label)}</span>
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="profile-confirm-password" className="text-sm font-medium text-foreground">
              Konfirmasi password baru
            </label>
            <input
              id="profile-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={changing || offline}
              aria-invalid={Boolean(confirmPassword) && confirmPassword !== newPassword}
              className="h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt/70 px-3 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            />
            {confirmPassword && confirmPassword !== newPassword ? (
              <p className="text-xs text-danger" aria-live="assertive">
                Konfirmasi password belum cocok.
              </p>
            ) : null}
          </div>
          {hasPassword ? (
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={signOutOther}
                onChange={(event) => setSignOutOther(event.target.checked)}
                disabled={changing || offline}
                className="h-4 w-4 rounded border-border-subtle text-primary focus:outline-none focus:ring-2 focus:ring-ring-primary"
              />
              Keluar dari sesi lain setelah ganti password
            </label>
          ) : null}
          {formError ? (
            <p className="flex items-center gap-2 text-sm text-danger" aria-live="assertive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={disabledChange || changing}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {changing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {hasPassword ? 'Ubah password' : 'Buat password'}
            </button>
          </div>
        </form>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Sesi & perangkat aktif</h3>
              <p className="text-xs text-muted">Kelola perangkat yang terhubung ke akunmu.</p>
            </div>
            <button
              type="button"
              onClick={() => void handleRefreshSessions()}
              disabled={loadingSessions || sessionBusy || offline}
              className="inline-flex h-9 items-center justify-center rounded-full border border-border-subtle bg-surface px-3 text-xs font-semibold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Segarkan
            </button>
          </div>
          <ul className="space-y-3">
            {sessions.length === 0 ? (
              <li className="rounded-2xl border border-border-subtle bg-surface-alt/50 p-4 text-sm text-muted">
                Tidak ada sesi aktif ditemukan.
              </li>
            ) : (
              sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-alt/60 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface text-muted">
                      <Laptop className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="flex-1 space-y-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{session.label}</span>
                        {session.current ? (
                          <span className="inline-flex items-center rounded-full bg-success/20 px-2 py-0.5 text-[11px] font-semibold text-success">
                            Perangkat ini
                          </span>
                        ) : null}
                      </div>
                      {session.user_agent ? (
                        <p className="text-xs text-muted" aria-label="User agent">
                          {session.user_agent}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted">
                        Terakhir masuk:{' '}
                        {session.last_sign_in_at
                          ? new Date(session.last_sign_in_at).toLocaleString()
                          : 'Tidak diketahui'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => void handleSignOut(session.id)}
                      disabled={sessionBusy || offline}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-border-subtle bg-surface px-4 font-semibold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                      {session.current ? 'Keluar dari perangkat ini' : 'Keluar dari perangkat tersebut'}
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
          <div className="flex flex-col gap-2 text-xs" aria-live="polite">
            {sessionMessage ? <span className="text-success">{sessionMessage}</span> : null}
            {sessionError ? (
              <span className="flex items-center gap-1 text-danger">
                <AlertCircle className="h-3 w-3" aria-hidden="true" /> {sessionError}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={sessionBusy || offline}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-danger/70 bg-danger/10 px-6 text-sm font-semibold text-danger shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sessionBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Keluar dari semua perangkat
          </button>
        </div>
      </div>
    </section>
  );
}
