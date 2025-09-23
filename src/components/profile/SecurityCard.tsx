import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Clock, LogOut, MonitorCog, ShieldCheck } from 'lucide-react';
import type { SessionInfo } from '../../lib/api-profile';

interface SecurityCardProps {
  sessions: SessionInfo[];
  offline?: boolean;
  loadingSessions?: boolean;
  changingPassword?: boolean;
  onRefreshSessions?: () => Promise<void>;
  onChangePassword: (payload: {
    current_password: string;
    new_password: string;
    signOutOthers: boolean;
  }) => Promise<void>;
  onSignOut: (scope: 'current' | 'others' | 'all') => Promise<void>;
}

type PasswordFeedback = {
  level: 'weak' | 'medium' | 'strong';
  label: string;
};

function evaluatePassword(password: string): PasswordFeedback {
  const trimmed = password.trim();
  if (!trimmed) return { level: 'weak', label: 'Masukkan kata sandi baru.' };
  let score = 0;
  if (trimmed.length >= 6) score += 1;
  if (trimmed.length >= 10) score += 1;
  if (/[A-Z]/.test(trimmed) && /[a-z]/.test(trimmed)) score += 1;
  if (/[0-9]/.test(trimmed)) score += 1;
  if (/[^A-Za-z0-9]/.test(trimmed)) score += 1;

  if (score <= 2) return { level: 'weak', label: 'Kekuatan: lemah' };
  if (score <= 3) return { level: 'medium', label: 'Kekuatan: cukup' };
  return { level: 'strong', label: 'Kekuatan: kuat' };
}

function formatDate(value: string | null) {
  if (!value) return 'Tidak diketahui';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function SecurityCard({
  sessions,
  offline = false,
  loadingSessions = false,
  changingPassword = false,
  onRefreshSessions,
  onChangePassword,
  onSignOut,
}: SecurityCardProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [signOutStatus, setSignOutStatus] = useState<'current' | 'others' | 'all' | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const passwordFeedback = useMemo(() => evaluatePassword(newPassword), [newPassword]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (offline) return;
    setFormError(null);
    setFormSuccess(null);
    if (!newPassword || newPassword.trim().length < 6) {
      setFormError('Kata sandi baru minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('Konfirmasi kata sandi belum sama.');
      return;
    }
    try {
      await onChangePassword({
        current_password: currentPassword,
        new_password: newPassword,
        signOutOthers,
      });
      setFormSuccess('Kata sandi berhasil diperbarui.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Tidak bisa mengubah kata sandi. Coba lagi.';
      setFormError(message);
    }
  };

  const handleSignOut = async (scope: 'current' | 'others' | 'all') => {
    setSignOutError(null);
    setSignOutStatus(scope);
    try {
      await onSignOut(scope);
      if (scope === 'others' && onRefreshSessions) {
        await onRefreshSessions();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Tidak bisa mengakhiri sesi. Coba lagi.';
      setSignOutError(message);
    } finally {
      setSignOutStatus(null);
    }
  };

  return (
    <section className="rounded-3xl border border-border-subtle bg-surface shadow-sm">
      <div className="grid gap-6 p-4 md:p-6">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-text" id="security-section-title">
            Keamanan
          </h2>
          <p className="text-sm text-muted">Kelola kata sandi dan sesi perangkat yang terhubung.</p>
        </header>

        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSubmit} noValidate>
          <div className="md:col-span-2 space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Ubah kata sandi
            </h3>
            <p className="text-xs text-muted">
              Gunakan kata sandi unik untuk menjaga keamanan akun. Kamu bisa keluar dari perangkat lain setelah berhasil mengubah kata sandi.
            </p>
          </div>

          <div className="grid gap-1">
            <label htmlFor="security-current-password" className="text-sm font-medium text-text">
              Kata sandi saat ini
            </label>
            <input
              id="security-current-password"
              name="current_password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={changingPassword}
            />
          </div>

          <div className="grid gap-1">
            <label htmlFor="security-new-password" className="text-sm font-medium text-text">
              Kata sandi baru
            </label>
            <input
              id="security-new-password"
              name="new_password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={changingPassword}
              aria-describedby="security-password-hint"
            />
            <p
              id="security-password-hint"
              className={`text-xs ${
                passwordFeedback.level === 'strong'
                  ? 'text-success'
                  : passwordFeedback.level === 'weak'
                    ? 'text-danger'
                    : 'text-warning'
              }`}
              aria-live="polite"
            >
              {passwordFeedback.label}
            </p>
          </div>

          <div className="grid gap-1">
            <label htmlFor="security-confirm-password" className="text-sm font-medium text-text">
              Konfirmasi kata sandi
            </label>
            <input
              id="security-confirm-password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={changingPassword}
              aria-invalid={Boolean(confirmPassword) && confirmPassword !== newPassword}
            />
          </div>

          <div className="flex items-center gap-2 md:col-span-2">
            <input
              id="security-signout-others"
              type="checkbox"
              checked={signOutOthers}
              onChange={(event) => setSignOutOthers(event.target.checked)}
              disabled={changingPassword}
              className="h-5 w-5 rounded border-border-subtle text-primary focus:ring-2 focus:ring-primary"
            />
            <label htmlFor="security-signout-others" className="text-sm text-text">
              Keluar dari semua perangkat lain setelah kata sandi berubah
            </label>
          </div>

          <div className="md:col-span-2 flex flex-col gap-2">
            {formError ? (
              <p className="text-sm text-danger" aria-live="assertive">
                {formError}
              </p>
            ) : null}
            {formSuccess ? (
              <p className="text-sm text-success" aria-live="polite">
                {formSuccess}
              </p>
            ) : null}
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
              disabled={offline || changingPassword}
            >
              {changingPassword ? <MonitorCog className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Simpan kata sandi
            </button>
            {offline ? (
              <p className="text-xs text-muted" aria-live="polite">
                Mode lokal aktif — sambungkan internet untuk mengubah kata sandi.
              </p>
            ) : null}
          </div>
        </form>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
                <LogOut className="h-4 w-4" aria-hidden="true" /> Sesi & perangkat aktif
              </h3>
              <p className="text-xs text-muted">
                Pantau perangkat yang terhubung dan akhiri sesi yang tidak dikenali.
              </p>
            </div>
            {onRefreshSessions ? (
              <button
                type="button"
                onClick={() => {
                  if (onRefreshSessions) {
                    void onRefreshSessions();
                  }
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-border-subtle px-3 py-1 text-xs font-medium text-text hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                disabled={loadingSessions}
              >
                {loadingSessions ? (
                  <MonitorCog className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Clock className="h-4 w-4" aria-hidden="true" />
                )}
                Segarkan
              </button>
            ) : null}
          </div>

          <div className="grid gap-3" role="list">
            {sessions.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border-subtle bg-surface-alt p-4 text-sm text-muted">
                Tidak ada sesi aktif yang terdeteksi.
              </p>
            ) : (
              sessions.map((session) => (
                <article
                  key={session.id}
                  role="listitem"
                  className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-alt p-4 shadow-sm transition hover:border-border-strong"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text">
                          {session.deviceLabel}
                          {session.current ? ' · Perangkat ini' : ''}
                        </p>
                        <p className="text-xs text-muted">
                          Login terakhir: {formatDate(session.lastSignInAt)}
                        </p>
                      </div>
                      {session.current ? (
                        <span className="rounded-full border border-success/60 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                          Aktif
                        </span>
                      ) : null}
                    </div>
                    <dl className="grid grid-cols-1 gap-1 text-xs text-muted sm:grid-cols-2">
                      <div>
                        <dt className="font-medium text-text">Dibuat</dt>
                        <dd>{formatDate(session.createdAt)}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-text">Kedaluwarsa</dt>
                        <dd>{formatDate(session.expiresAt)}</dd>
                      </div>
                      {session.ipAddress ? (
                        <div>
                          <dt className="font-medium text-text">Alamat IP</dt>
                          <dd>{session.ipAddress}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {session.current ? (
                      <button
                        type="button"
                        onClick={() => handleSignOut('current')}
                        className="inline-flex items-center gap-2 rounded-2xl border border-border-subtle px-3 py-1 text-xs font-medium text-text transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={signOutStatus !== null || offline}
                      >
                        {signOutStatus === 'current' ? (
                          <MonitorCog className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        Keluar dari perangkat ini
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSignOut('others')}
                        className="inline-flex items-center gap-2 rounded-2xl border border-border-subtle px-3 py-1 text-xs font-medium text-text transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={signOutStatus !== null || offline}
                      >
                        {signOutStatus === 'others' ? (
                          <MonitorCog className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        Keluar dari perangkat ini
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => handleSignOut('all')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border-subtle px-4 py-2 text-sm font-medium text-text transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={signOutStatus !== null || offline}
            >
              {signOutStatus === 'all' ? (
                <MonitorCog className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="h-4 w-4" aria-hidden="true" />
              )}
              Keluar dari semua sesi
            </button>
            {signOutError ? (
              <p className="text-xs text-danger" aria-live="assertive">
                {signOutError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
