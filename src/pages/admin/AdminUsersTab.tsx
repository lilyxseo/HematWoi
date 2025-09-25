import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Save, ShieldAlert, Undo2 } from 'lucide-react';
import clsx from 'clsx';
import { useToast } from '../../context/ToastContext.jsx';
import {
  ListUsersOptions,
  UserProfileRecord,
  UserRole,
  listUsers,
  updateUserProfile,
} from '../../lib/adminApi';
import { supabase } from '../../lib/supabase';
import { Icon } from '../../components/icons';

type RoleFilter = 'all' | UserRole;
type StatusFilter = 'all' | 'active' | 'inactive';

type UserDraft = {
  role: UserRole;
  is_active: boolean;
};

type DraftMap = Record<string, UserDraft>;

type FilterState = {
  q: string;
  role: RoleFilter;
  status: StatusFilter;
};

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        'h-11 w-full rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground shadow-sm ring-2 ring-transparent transition focus:border-transparent focus:outline-none focus:ring-primary',
        props.className
      )}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        'h-11 w-full rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground shadow-sm ring-2 ring-transparent transition focus:border-transparent focus:outline-none focus:ring-primary',
        props.className
      )}
    />
  );
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      disabled={disabled}
      className={clsx(
        'relative inline-flex h-6 w-11 items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60',
        checked ? 'bg-primary' : 'bg-border'
      )}
    >
      <span className="sr-only">{label}</span>
      <span
        className={clsx(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
          checked ? 'translate-x-5' : 'translate-x-1'
        )}
      />
    </button>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-border/40 last:border-b-0">
      {Array.from({ length: 6 }).map((_, index) => (
        <td key={index} className="p-4">
          <div className="h-9 rounded-xl bg-border/60" />
        </td>
      ))}
    </tr>
  );
}

function formatDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function initialsForUser(user: UserProfileRecord): string {
  if (user.username) {
    const parts = user.username.split(' ');
    const letters = parts
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase())
      .join('');
    if (letters) return letters.slice(0, 2);
  }
  if (user.email) return user.email[0]?.toUpperCase() ?? 'U';
  return 'U';
}

export default function AdminUsersTab() {
  const { addToast } = useToast();
  const [users, setUsers] = useState<UserProfileRecord[]>([]);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [filters, setFilters] = useState<FilterState>({ q: '', role: 'all', status: 'all' });
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setCurrentUserId(data.user?.id ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(filters.q.trim());
    }, 300);
    return () => clearTimeout(timeout);
  }, [filters.q]);

  const loadUsers = useCallback(async (options: ListUsersOptions) => {
    setLoading(true);
    setError('');
    try {
      const data = await listUsers(options);
      setUsers(data);
      const nextDrafts: DraftMap = {};
      data.forEach((user) => {
        nextDrafts[user.id] = { role: user.role, is_active: user.is_active };
      });
      setDrafts(nextDrafts);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tidak dapat memuat pengguna';
      setError(message);
      addToast('Gagal memuat daftar pengguna', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    const options: ListUsersOptions = {
      q: debouncedQuery || undefined,
      role: filters.role !== 'all' ? filters.role : undefined,
      active: filters.status !== 'all' ? filters.status : undefined,
    };
    void loadUsers(options);
  }, [debouncedQuery, filters.role, filters.status, loadUsers]);

  const activeAdmins = useMemo(
    () => users.filter((user) => user.role === 'admin' && user.is_active),
    [users]
  );

  const isLastActiveAdmin = (user: UserProfileRecord, draft?: UserDraft) => {
    if (activeAdmins.length !== 1) return false;
    const currentAdmin = activeAdmins[0];
    if (currentAdmin.id !== user.id) return false;
    if (currentUserId && currentUserId !== user.id) return false;
    const next = draft ?? drafts[user.id];
    if (!next) return false;
    return next.role !== 'admin' || !next.is_active;
  };

  const handleDraftChange = (id: string, patch: Partial<UserDraft>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const handleSave = async (user: UserProfileRecord) => {
    const draft = drafts[user.id];
    if (!draft) return;
    if (isLastActiveAdmin(user, draft)) {
      addToast('Tidak boleh menonaktifkan admin terakhir.', 'error');
      return;
    }
    if (draft.role === user.role && draft.is_active === user.is_active) {
      addToast('Tidak ada perubahan untuk disimpan.', 'info');
      return;
    }

    setSavingId(user.id);
    try {
      const updated = await updateUserProfile(user.id, {
        role: draft.role,
        is_active: draft.is_active,
      });
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setDrafts((prev) => ({ ...prev, [updated.id]: { role: updated.role, is_active: updated.is_active } }));
      addToast('Pengguna berhasil diperbarui', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal memperbarui pengguna.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleResetRow = (user: UserProfileRecord) => {
    setDrafts((prev) => ({ ...prev, [user.id]: { role: user.role, is_active: user.is_active } }));
  };

  const handleRefresh = async () => {
    const options: ListUsersOptions = {
      q: debouncedQuery || undefined,
      role: filters.role !== 'all' ? filters.role : undefined,
      active: filters.status !== 'all' ? filters.status : undefined,
    };
    await loadUsers(options);
    addToast('Daftar pengguna diperbarui', 'success');
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Pengguna</h2>
            <p className="text-sm text-muted-foreground">
              Kelola role dan status aktif akun user_profiles.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border/60 px-4 text-sm font-medium text-foreground transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
            Refresh
          </button>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Cari username atau email"
            value={filters.q}
            onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
          />
          <Select
            value={filters.role}
            onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value as RoleFilter }))}
          >
            <option value="all">Semua role</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </Select>
          <Select
            value={filters.status}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, status: event.target.value as StatusFilter }))
            }
          >
            <option value="all">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </Select>
          <div className="hidden lg:block" />
        </div>
        {error ? (
          <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full table-fixed">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="w-16 p-4">User</th>
                <th className="p-4">Informasi</th>
                <th className="w-32 p-4">Role</th>
                <th className="w-28 p-4">Aktif</th>
                <th className="w-40 p-4">Dibuat</th>
                <th className="w-40 p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => <SkeletonRow key={index} />)
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="users" className="h-8 w-8 text-muted-foreground/70" />
                      <span>Tidak ada pengguna ditemukan.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const draft = drafts[user.id];
                  const hasChanges =
                    draft && (draft.role !== user.role || draft.is_active !== user.is_active);
                  const disableActions =
                    savingId === user.id || (draft && isLastActiveAdmin(user, draft));

                  return (
                    <tr key={user.id} className="bg-background odd:bg-muted/20">
                      <td className="p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
                          {initialsForUser(user)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{user.username ?? 'Tanpa nama'}</p>
                          <p className="text-xs text-muted-foreground">{user.email ?? '—'}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <Select
                          value={draft?.role ?? user.role}
                          onChange={(event) =>
                            handleDraftChange(user.id, { role: event.target.value as UserRole })
                          }
                          disabled={disableActions}
                          aria-label={`Role untuk ${user.username ?? user.email ?? 'pengguna'}`}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </Select>
                        {draft && isLastActiveAdmin(user, draft) ? (
                          <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-600">
                            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> Admin terakhir
                          </p>
                        ) : null}
                      </td>
                      <td className="p-4">
                        <Switch
                          checked={draft?.is_active ?? user.is_active}
                          onChange={(value) => handleDraftChange(user.id, { is_active: value })}
                          disabled={disableActions}
                          label={`Status aktif ${user.username ?? user.email ?? 'pengguna'}`}
                        />
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{formatDate(user.created_at)}</td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleResetRow(user)}
                            disabled={!hasChanges || savingId === user.id}
                            className="inline-flex h-9 items-center gap-2 rounded-xl border border-border/60 px-3 text-xs font-medium text-foreground transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Undo2 className="h-4 w-4" aria-hidden="true" />
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSave(user)}
                            disabled={!hasChanges || savingId === user.id}
                            className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <Save className="h-4 w-4" aria-hidden="true" />
                            )}
                            Simpan
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
