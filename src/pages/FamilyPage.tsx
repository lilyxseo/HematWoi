import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../layout/PageHeader';
import { useHousehold } from '../context/HouseholdContext';
import { useToast } from '../context/ToastContext';
import {
  inviteByUsername,
  leaveHousehold,
  listMembers,
  removeMember,
  updateMemberRole,
  type HouseholdMember,
  type HouseholdRole,
} from '../lib/householdApi';

const ROLE_OPTIONS: Array<{ value: HouseholdRole; label: string; description: string }> = [
  { value: 'owner', label: 'Owner', description: 'Semua hak & kelola household' },
  { value: 'editor', label: 'Editor', description: 'Baca & ubah data keuangan' },
  { value: 'viewer', label: 'Viewer', description: 'Hanya baca data keuangan' },
];

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function validateUsername(value: string) {
  const normalized = normalizeUsername(value);
  if (!normalized) return 'Username wajib diisi.';
  if (normalized.length < 3 || normalized.length > 20) {
    return 'Username harus 3-20 karakter.';
  }
  if (!/^[_a-z0-9]+$/.test(normalized)) {
    return 'Gunakan huruf kecil, angka, atau underscore.';
  }
  return null;
}

function StatusBadge({ status }: { status: HouseholdMember['status'] }) {
  if (status === 'accepted') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
        Accepted
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden="true" />
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/40 bg-slate-500/15 px-2.5 py-1 text-xs font-medium text-slate-300">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" aria-hidden="true" />
      {status ?? 'Unknown'}
    </span>
  );
}

function RoleSelect({
  value,
  disabled,
  onChange,
}: {
  value: HouseholdRole;
  disabled?: boolean;
  onChange: (next: HouseholdRole) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as HouseholdRole)}
      disabled={disabled}
      className="w-full min-w-[140px] rounded-xl border border-border/70 bg-surface-1 px-2.5 py-2 text-sm text-text shadow-sm transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {ROLE_OPTIONS.map((role) => (
        <option key={role.value} value={role.value}>
          {role.label}
        </option>
      ))}
    </select>
  );
}

function InviteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
      strokeWidth="1.75"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 5v14" strokeLinecap="round" />
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
      strokeWidth="1.75"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M4 7h16" strokeLinecap="round" />
      <path d="M10 11v6" strokeLinecap="round" />
      <path d="M14 11v6" strokeLinecap="round" />
      <path d="M6 7l1 12h10l1-12" strokeLinejoin="round" />
      <path d="M9 7V5h6v2" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
      strokeWidth="1.75"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M4 20h4l10.5-10.5a2.121 2.121 0 0 0-3-3L5 17v3z" strokeLinejoin="round" />
      <path d="M13.5 6.5l3 3" strokeLinecap="round" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
      strokeWidth="1.75"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M4 17h16" strokeLinecap="round" />
      <path d="M5 17l1-9 5 4 5-4 3 9" strokeLinejoin="round" />
    </svg>
  );
}

const MEMBERS_QUERY_KEY = 'household-members';

export default function FamilyPage() {
  const {
    householdId,
    householdName,
    role,
    members: initialMembers,
    refresh: refreshHousehold,
    currentUserId,
  } = useHousehold();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [inviteRole, setInviteRole] = useState<HouseholdRole>('viewer');
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const canManage = role === 'owner';

  const membersQuery = useQuery<HouseholdMember[]>({
    queryKey: [MEMBERS_QUERY_KEY, householdId],
    queryFn: () => listMembers(householdId ?? ''),
    enabled: Boolean(householdId),
    initialData: initialMembers,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!householdId) throw new Error('Household belum tersedia.');
      const errorMessage = validateUsername(username);
      if (errorMessage) {
        setUsernameError(errorMessage);
        throw new Error(errorMessage);
      }
      setUsernameError(null);
      const normalized = normalizeUsername(username);
      await inviteByUsername(householdId, normalized, inviteRole);
    },
    onSuccess: () => {
      setUsername('');
      setInviteRole('viewer');
      addToast('Undangan terkirim.', 'success');
      void queryClient.invalidateQueries({ queryKey: [MEMBERS_QUERY_KEY, householdId] });
      refreshHousehold();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Gagal mengundang anggota.';
      addToast(message, 'error');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role: nextRole }: { id: string; role: HouseholdRole }) => {
      await updateMemberRole(id, nextRole);
    },
    onSuccess: () => {
      addToast('Peran anggota diperbarui.', 'success');
      void queryClient.invalidateQueries({ queryKey: [MEMBERS_QUERY_KEY, householdId] });
      refreshHousehold();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Gagal memperbarui peran.';
      addToast(message, 'error');
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      await removeMember(memberId);
    },
    onSuccess: () => {
      addToast('Anggota dihapus.', 'success');
      void queryClient.invalidateQueries({ queryKey: [MEMBERS_QUERY_KEY, householdId] });
      refreshHousehold();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Gagal menghapus anggota.';
      addToast(message, 'error');
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      await leaveHousehold(householdId ?? undefined);
    },
    onSuccess: () => {
      addToast('Kamu keluar dari household.', 'info');
      setTimeout(() => {
        refreshHousehold();
        void queryClient.invalidateQueries({ queryKey: [MEMBERS_QUERY_KEY, householdId] });
      }, 150);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Gagal keluar dari household.';
      addToast(message, 'error');
    },
  });

  const members = membersQuery.data ?? [];
  const isLoadingMembers = membersQuery.isLoading || membersQuery.isFetching;

  const acceptedCount = useMemo(
    () => members.filter((member) => member.status === 'accepted').length,
    [members],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) return;
    inviteMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Keluarga"
        description="Kelola anggota household dan undangan berbagi data."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(0,420px)]">
        <section className="rounded-3xl border border-border/70 bg-surface-1 p-6 shadow-lg shadow-background/30">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                Household Aktif
              </p>
              <h2 className="mt-1 text-2xl font-bold text-text">
                {householdName ?? 'Belum ada household'}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {acceptedCount} anggota aktif • peran kamu: {role ?? 'N/A'}
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              {canManage ? (
                <p className="text-xs text-muted">
                  Kamu dapat mengundang anggota baru dan mengubah peran.
                </p>
              ) : (
                <p className="text-xs text-muted">
                  Hubungi owner untuk mengelola anggota household.
                </p>
              )}
              <button
                type="button"
                onClick={() => inviteMutation.reset()}
                className="inline-flex items-center gap-2 rounded-2xl border border-brand/50 bg-brand/15 px-4 py-2 text-sm font-semibold text-brand transition hover:border-brand/60 hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                disabled={!canManage}
              >
                <InviteIcon />
                Undang Anggota
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <label htmlFor="invite-username" className="block text-xs font-semibold uppercase tracking-wide text-muted">
                  Username
                </label>
                <input
                  id="invite-username"
                  name="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="contoh: hematfam"
                  className="mt-1 h-11 w-full rounded-2xl border-0 bg-surface-2 px-4 text-sm text-text ring-2 ring-slate-800 transition focus:ring-[var(--accent)]"
                  autoComplete="off"
                  inputMode="text"
                  pattern="[_a-z0-9]+"
                  disabled={!canManage || inviteMutation.isPending}
                />
                {usernameError && (
                  <p className="mt-1 text-xs text-danger">{usernameError}</p>
                )}
              </div>
              <div className="sm:w-48">
                <label htmlFor="invite-role" className="block text-xs font-semibold uppercase tracking-wide text-muted">
                  Peran
                </label>
                <div className="mt-1 rounded-2xl bg-surface-2 ring-2 ring-slate-800 focus-within:ring-[var(--accent)]">
                  <select
                    id="invite-role"
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value as HouseholdRole)}
                    className="h-11 w-full rounded-2xl bg-transparent px-4 text-sm text-text focus:outline-none"
                    disabled={!canManage || inviteMutation.isPending}
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted">
                Username bersifat unik & tidak peka huruf besar kecil. Undangan akan otomatis aktif saat username tersedia.
              </p>
              <button
                type="submit"
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand px-5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canManage || inviteMutation.isPending}
              >
                <InviteIcon />
                {inviteMutation.isPending ? 'Mengundang…' : 'Undang'}
              </button>
            </div>
          </form>
        </section>

        <aside className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-surface-1 p-6 shadow-lg shadow-background/30">
          <h3 className="text-base font-semibold text-text">Info Peran</h3>
          <ul className="space-y-3 text-sm text-muted">
            {ROLE_OPTIONS.map((option) => (
              <li key={option.value} className="flex items-start gap-2">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-surface-2 text-xs font-semibold text-text">
                  {option.value === 'owner' ? <CrownIcon /> : option.label.charAt(0)}
                </span>
                <div>
                  <p className="font-semibold text-text">{option.label}</p>
                  <p>{option.description}</p>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => leaveMutation.mutate()}
            className="mt-auto inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-surface-2 px-4 py-2 text-sm font-semibold text-danger transition hover:border-danger/60 hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            disabled={leaveMutation.isPending}
          >
            <TrashIcon /> Keluar Household
          </button>
        </aside>
      </div>

      <section className="overflow-hidden rounded-3xl border border-border/70 bg-surface-1 shadow-lg shadow-background/30">
        <div className="border-b border-border/60 bg-surface-2 px-6 py-4">
          <h3 className="text-base font-semibold text-text">Daftar Anggota</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60 text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-6 py-3 text-left">Username</th>
                <th scope="col" className="px-6 py-3 text-left">Peran</th>
                <th scope="col" className="px-6 py-3 text-left">Status</th>
                <th scope="col" className="px-6 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoadingMembers && (
                <tr>
                  <td className="px-6 py-5" colSpan={4}>
                    <div className="flex items-center gap-3 text-muted">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-muted" />
                      Memuat anggota…
                    </div>
                  </td>
                </tr>
              )}
              {!isLoadingMembers && members.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-center text-muted" colSpan={4}>
                    Belum ada anggota. Undang anggota via username di atas.
                  </td>
                </tr>
              )}
              {!isLoadingMembers &&
                members.map((member) => {
                  const isSelf = Boolean(member.userId && currentUserId && member.userId === currentUserId);
                  const disableRoleChange = !canManage || member.status !== 'accepted' || isSelf;
                  const allowRemove = canManage && !isSelf;
                  return (
                    <tr key={member.id} className="transition hover:bg-surface-2/60">
                      <td className="px-6 py-4 font-medium text-text">
                        {member.username ?? '• Pending username'}
                      </td>
                      <td className="px-6 py-4">
                        <RoleSelect
                          value={member.role}
                          disabled={disableRoleChange}
                          onChange={(nextRole) => {
                            if (nextRole === member.role) return;
                            updateRoleMutation.mutate({ id: member.id, role: nextRole });
                          }}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={member.status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="inline-flex h-9 items-center gap-1 rounded-2xl border border-border/70 px-3 text-xs font-semibold text-muted transition hover:border-border hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            disabled
                          >
                            <PencilIcon />
                            Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() => removeMutation.mutate(member.id)}
                            className="inline-flex h-9 items-center gap-1 rounded-2xl border border-border/70 px-3 text-xs font-semibold text-danger transition hover:border-danger/60 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={!allowRemove}
                            aria-label="Hapus anggota"
                          >
                            <TrashIcon /> Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
