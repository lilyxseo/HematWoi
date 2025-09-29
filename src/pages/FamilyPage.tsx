import { FormEvent, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useHousehold } from '../context/HouseholdContext';
import { useToast } from '../context/ToastContext';

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Pemilik' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
] as const;

type RoleValue = (typeof ROLE_OPTIONS)[number]['value'];

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

function IconPlus({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
      strokeWidth={1.75}
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
      strokeWidth={1.75}
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 11c1.657 0 3-1.79 3-4s-1.343-4-3-4-3 1.79-3 4 1.343 4 3 4Zm-8 0c1.657 0 3-1.79 3-4S9.657 3 8 3 5 4.79 5 7s1.343 4 3 4Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 21v-1a5 5 0 0 1 5-5h0a5 5 0 0 1 5 5v1m3 0v-1c0-1.657 1.79-3 4-3h0c2.21 0 4 1.343 4 3v1"
      />
    </svg>
  );
}

function IconCrown({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
      strokeWidth={1.75}
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m3 9 3 3 3-6 3 6 3-6 3 6 3-3v12H3z" />
    </svg>
  );
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
      strokeWidth={1.75}
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3 4.5 6v6c0 5.25 3.75 8.4 7.5 9 3.75-.6 7.5-3.75 7.5-9V6L12 3Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12.25 11 14l3.5-4" />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
      strokeWidth={1.75}
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 7h14M10 3h4a1 1 0 0 1 1 1v2H9V4a1 1 0 0 1 1-1Zm9 4-1 13a1 1 0 0 1-1 .9H8a1 1 0 0 1-1-.9L6 7m5 4v6m4-6v6" />
    </svg>
  );
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
      strokeWidth={1.75}
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4 17 4 4 13-13-4-4L4 17Zm0 0v4h4"
      />
    </svg>
  );
}

function formatStatus(status: string) {
  if (status === 'accepted') return 'Aktif';
  if (status === 'pending') return 'Menunggu';
  return status;
}

function validateUsername(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 20) {
    return 'Username harus 3-20 karakter.';
  }
  if (!/^[a-z0-9_]+$/.test(trimmed)) {
    return 'Gunakan huruf kecil, angka, atau underscore.';
  }
  return null;
}

export default function FamilyPage() {
  const {
    members,
    memberCount,
    householdId,
    householdName,
    loading,
    error,
    invite,
    updateRole,
    remove,
    leave,
    destroy,
    isOwner,
    isEditor,
  } = useHousehold();
  const { addToast } = useToast();
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<RoleValue>('viewer');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  const canInvite = Boolean(householdId) && isOwner;
  const canManageRoles = isOwner;
  const canRemoveMembers = isOwner;
  const canLeave = Boolean(householdId) && !isOwner;

  const acceptedMembers = useMemo(() => members.filter((member) => member.status === 'accepted'), [members]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canInvite) return;
    const validationMessage = validateUsername(username);
    if (validationMessage) {
      setUsernameError(validationMessage);
      return;
    }
    setUsernameError(null);
    setSubmitState('loading');
    try {
      const status = await invite({ username: username.trim().toLowerCase(), role });
      setSubmitState('success');
      setUsername('');
      setRole('viewer');
      addToast({
        id: 'invite-success',
        type: 'success',
        message:
          status === 'accepted'
            ? 'Undangan berhasil. Anggota langsung bergabung.'
            : 'Undangan dikirim. Menunggu pengguna membuat username tersebut.',
      });
    } catch (submitError) {
      setSubmitState('error');
      const message =
        submitError instanceof Error ? submitError.message : 'Gagal mengirim undangan. Coba lagi.';
      addToast({ id: 'invite-error', type: 'error', message });
    } finally {
      setTimeout(() => setSubmitState('idle'), 1200);
    }
  };

  const handleRoleChange = async (memberId: string, nextRole: RoleValue) => {
    if (!canManageRoles) return;
    try {
      await updateRole(memberId, nextRole);
      addToast({ id: `role-${memberId}`, type: 'success', message: 'Peran anggota diperbarui.' });
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : 'Gagal memperbarui peran. Coba lagi.';
      addToast({ id: `role-error-${memberId}`, type: 'error', message });
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!canRemoveMembers) return;
    try {
      await remove(memberId);
      addToast({ id: `remove-${memberId}`, type: 'success', message: 'Anggota dihapus.' });
    } catch (removeError) {
      const message =
        removeError instanceof Error ? removeError.message : 'Gagal menghapus anggota. Coba lagi.';
      addToast({ id: `remove-error-${memberId}`, type: 'error', message });
    }
  };

  const handleLeave = async () => {
    if (!canLeave) return;
    try {
      await leave();
      addToast({ id: 'leave-household', type: 'success', message: 'Berhasil keluar dari household.' });
    } catch (leaveError) {
      const message =
        leaveError instanceof Error ? leaveError.message : 'Gagal keluar household. Coba lagi.';
      addToast({ id: 'leave-household-error', type: 'error', message });
    }
  };

  const handleDeleteHousehold = async () => {
    if (!isOwner || !householdId) return;
    const confirmed = window.confirm('Hapus household ini? Semua anggota akan diputus.');
    if (!confirmed) return;
    try {
      await destroy();
      addToast({ id: 'delete-household', type: 'success', message: 'Household dihapus.' });
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : 'Gagal menghapus household. Coba lagi.';
      addToast({ id: 'delete-household-error', type: 'error', message });
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Keluarga</h1>
            <span className="inline-flex items-center rounded-full border border-brand/50 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
              Household Aktif
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Kelola anggota yang dapat berbagi data keuanganmu. Undang anggota baru menggunakan username mereka.
          </p>
        </div>
        {canLeave && (
          <button
            type="button"
            onClick={handleLeave}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-surface-2 px-4 text-sm font-semibold text-text transition hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
          >
            Keluar Household
          </button>
        )}
      </header>

      <section className="grid gap-6 rounded-3xl border border-border/60 bg-surface-1 p-6 shadow-sm sm:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted">Nama household</p>
              <p className="text-lg font-semibold text-text">{householdName ?? 'Tanpa nama'}</p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-2 px-4 py-2 text-sm text-muted">
              <IconUsers className="h-5 w-5" />
              <span>{memberCount} anggota</span>
            </div>
          </div>
          <div className="rounded-3xl border border-dashed border-border/60 bg-surface-2 p-5">
            <div className="flex items-center gap-3">
              <IconPlus className="h-5 w-5 text-accent" />
              <h2 className="text-base font-semibold text-text">Undang via Username</h2>
            </div>
            <p className="mt-2 text-sm text-muted">
              Masukkan username HematWoi (huruf kecil, angka, underscore) untuk mengundang anggota baru.
            </p>
            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label htmlFor="invite-username" className="text-sm font-medium text-text">
                  Username
                </label>
                <input
                  id="invite-username"
                  type="text"
                  inputMode="latin"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-11 w-full rounded-2xl border-0 bg-surface-1 px-4 text-sm text-text shadow-inner ring-2 ring-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value.toLowerCase());
                    if (usernameError) {
                      setUsernameError(null);
                    }
                  }}
                  disabled={!canInvite || submitState === 'loading'}
                  aria-invalid={Boolean(usernameError)}
                  aria-describedby={usernameError ? 'invite-username-error' : undefined}
                  placeholder="contoh: hematwoi_user"
                />
                {usernameError && (
                  <p id="invite-username-error" className="text-sm text-danger">
                    {usernameError}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium text-text">Peran</span>
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map((option) => {
                    const active = role === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={clsx(
                          'inline-flex min-h-[44px] min-w-[88px] items-center justify-center rounded-2xl border px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]',
                          active
                            ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--accent)]'
                            : 'border-border bg-surface-1 text-muted hover:border-[color:var(--accent)]/60 hover:text-text',
                        )}
                        onClick={() => setRole(option.value)}
                        disabled={!canInvite || submitState === 'loading'}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                type="submit"
                className="inline-flex min-h-[44px] min-w-[120px] items-center justify-center gap-2 rounded-2xl bg-[color:var(--accent)] px-5 text-sm font-semibold text-white shadow transition hover:bg-[color:var(--accent)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1"
                disabled={!canInvite || submitState === 'loading'}
                aria-disabled={!canInvite || submitState === 'loading'}
              >
                <IconPlus className="h-4 w-4" />
                Undang
              </button>
              {!canInvite && (
                <p className="text-sm text-muted">
                  Hanya pemilik household yang dapat mengirim undangan.
                </p>
              )}
            </form>
          </div>
        </div>
        <aside className="space-y-4 rounded-3xl border border-border/60 bg-surface-2 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Status Household</h3>
          <dl className="grid gap-3 text-sm text-muted">
            <div className="flex items-center justify-between">
              <dt>Anggota aktif</dt>
              <dd className="font-semibold text-text">{acceptedMembers.length}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Undangan pending</dt>
              <dd className="font-semibold text-text">{memberCount - acceptedMembers.length}</dd>
            </div>
          </dl>
          {isOwner && (
            <button
              type="button"
              onClick={handleDeleteHousehold}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-danger/30 bg-danger/10 text-sm font-semibold text-danger transition hover:border-danger/50 hover:bg-danger/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
            >
              <IconTrash className="h-4 w-4" /> Hapus Household
            </button>
          )}
        </aside>
      </section>

      <section className="rounded-3xl border border-border/60 bg-surface-1 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text">Anggota</h2>
            <p className="text-sm text-muted">Kelola peran dan status anggota household.</p>
          </div>
        </div>
        {loading ? (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 w-full animate-pulse rounded-2xl bg-border/50" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-border/60 bg-surface-2 p-6 text-center text-sm text-muted">
            Belum ada anggota lain. Undang anggota via username.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-border/60 text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">Username</th>
                  <th className="px-3 py-2">Peran</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {members.map((member) => {
                  const roleLabel = ROLE_OPTIONS.find((item) => item.value === member.role)?.label ?? member.role;
                  return (
                    <tr key={member.id} className="transition hover:bg-surface-2">
                      <td className="px-3 py-3 font-medium text-text">{member.username ?? 'Belum tersedia'}</td>
                      <td className="px-3 py-3">
                        {canManageRoles ? (
                          <div className="relative inline-flex items-center">
                            <select
                              className="h-10 rounded-2xl border border-border bg-surface-1 px-3 pr-9 text-sm text-text focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
                              value={member.role}
                              onChange={(event) => handleRoleChange(member.id, event.target.value as RoleValue)}
                              disabled={!isOwner || member.status !== 'accepted'}
                              aria-label={`Ubah peran ${member.username ?? 'anggota'}`}
                            >
                              {ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <span className="pointer-events-none absolute right-3 text-muted">▾</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-text">
                            {member.role === 'owner' ? <IconCrown className="h-4 w-4" /> : <IconShield className="h-4 w-4" />}
                            {roleLabel}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted">{formatStatus(member.status)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {canManageRoles && member.status === 'accepted' && (
                            <button
                              type="button"
                              onClick={() => handleRoleChange(member.id, member.role)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-surface-1 text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                              aria-label={`Segarkan peran ${member.username ?? 'anggota'}`}
                            >
                              <IconPencil className="h-4 w-4" />
                            </button>
                          )}
                          {canRemoveMembers && member.role !== 'owner' && (
                            <button
                              type="button"
                              onClick={() => handleRemove(member.id)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-danger/40 bg-danger/10 text-danger transition hover:border-danger/60 hover:bg-danger/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
                              aria-label={`Hapus ${member.username ?? 'anggota'}`}
                            >
                              <IconTrash className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {error && (
          <div className="mt-6 rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
            {error.message}
          </div>
        )}
      </section>
    </div>
  );
}
