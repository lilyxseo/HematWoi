import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext.jsx';
import {
  listUsers,
  updateUserProfile,
  type ListUsersParams,
  type UpdateUserProfileInput,
  type UserProfileRecord,
} from '../../lib/adminApi';
import { Icon } from '../../components/icons';

const INPUT_CLASS =
  'h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary';

const SELECT_CLASS = clsx(INPUT_CLASS, 'pr-10');

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

type UserDraftMap = Record<string, UpdateUserProfileInput>;

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
      className={clsx(
        'flex h-11 w-20 items-center justify-between rounded-2xl border border-border/60 px-2 text-xs font-semibold transition',
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-primary'
      )}
    >
      <span className={clsx('rounded-xl px-2 py-1', checked ? 'bg-primary text-white' : 'text-muted-foreground')}>
        Aktif
      </span>
      <span className={clsx('rounded-xl px-2 py-1', !checked ? 'bg-destructive/20 text-destructive' : 'text-muted-foreground')}>
        Off
      </span>
    </button>
  );
}

function Avatar({ user }: { user: UserProfileRecord }) {
  const label = user.username || user.email || user.id;
  const initial = (label ?? '?').trim().charAt(0).toUpperCase() || 'U';
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
      {initial}
    </div>
  );
}

export default function AdminUsersTab() {
  const { addToast } = useToast();
  const [users, setUsers] = useState<UserProfileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ search: string; role: 'all' | 'user' | 'admin'; status: 'all' | 'active' | 'inactive' }>(
    { search: '', role: 'all', status: 'all' }
  );
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [drafts, setDrafts] = useState<UserDraftMap>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadSession = async () => {
      const { data } = await supabase.auth.getUser();
      if (mounted) {
        setSessionUserId(data.user?.id ?? null);
      }
    };
    void loadSession();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);
    return () => window.clearTimeout(handler);
  }, [filters.search]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: ListUsersParams = {
          query: debouncedSearch || undefined,
          role: filters.role,
          status: filters.status,
        };
        const data = await listUsers(params);
        if (mounted) {
          setUsers(data);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal memuat pengguna';
        if (mounted) {
          setError(message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    void load();
  }, [debouncedSearch, filters.role, filters.status]);

  const activeAdminCount = useMemo(
    () => users.filter((user) => user.role === 'admin' && user.is_active).length,
    [users]
  );

  const updateDraft = (id: string, patch: UpdateUserProfileInput) => {
    setDrafts((prev) => {
      const current = prev[id] ?? {};
      const next = { ...current, ...patch };
      const user = users.find((item) => item.id === id);
      if (!user) return prev;
      const role = next.role ?? user.role;
      const isActive =
        typeof next.is_active === 'boolean' ? next.is_active : user.is_active;
      const dirty = role !== user.role || isActive !== user.is_active;
      if (!dirty) {
        const { [id]: _omit, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const handleSave = async (user: UserProfileRecord) => {
    const draft = drafts[user.id];
    if (!draft) return;

    const payload: UpdateUserProfileInput = {};
    if (draft.role && draft.role !== user.role) {
      payload.role = draft.role;
    }
    if (typeof draft.is_active === 'boolean' && draft.is_active !== user.is_active) {
      payload.is_active = draft.is_active;
    }

    if (!payload.role && typeof payload.is_active !== 'boolean') {
      return;
    }

    setSavingId(user.id);
    try {
      const updated = await updateUserProfile(user.id, payload);
      setUsers((prev) => prev.map((item) => (item.id === user.id ? updated : item)));
      setDrafts((prev) => {
        const { [user.id]: _omit, ...rest } = prev;
        return rest;
      });
      addToast('Profil pengguna diperbarui', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memperbarui pengguna';
      addToast(message, 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleUndo = (id: string) => {
    setDrafts((prev) => {
      const { [id]: _omit, ...rest } = prev;
      return rest;
    });
  };

  const renderSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="grid gap-3 rounded-2xl bg-muted/20 p-4 md:grid-cols-6">
          {Array.from({ length: 6 }).map((__, col) => (
            <div key={col} className="h-11 animate-pulse rounded-2xl bg-muted/40" />
          ))}
        </div>
      ))}
    </div>
  );

  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 p-10 text-center">
      <Icon name="user" className="h-10 w-10 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium text-muted-foreground">
        Tidak ada pengguna ditemukan. Coba ubah filter pencarian.
      </p>
    </div>
  );

  const renderUserCard = (user: UserProfileRecord) => {
    const draft = drafts[user.id];
    const role = draft?.role ?? user.role;
    const isActive = typeof draft?.is_active === 'boolean' ? draft.is_active : user.is_active;
    const isDirty = Boolean(draft);
    const isSelf = sessionUserId === user.id;
    const disableSelf = isSelf && user.role === 'admin' && user.is_active && activeAdminCount <= 1;

    return (
      <div key={user.id} className="rounded-2xl border border-border/60 bg-background p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <Avatar user={user} />
          <div className="flex-1 space-y-1">
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{user.username || 'Tanpa nama'}</span>
              <span className="text-xs text-muted-foreground">{user.email || '—'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>{dateFormatter.format(new Date(user.created_at ?? Date.now()))}</span>
              <span>•</span>
              <span>ID: {user.id.slice(0, 8)}…</span>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          <label className="text-sm font-semibold text-muted-foreground">
            Peran
            <select
              value={role}
              onChange={(event) => updateDraft(user.id, { role: event.target.value as 'admin' | 'user' })}
              className={clsx(SELECT_CLASS, 'mt-1')}
              disabled={disableSelf}
            >
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-muted-foreground">
            Status
            <div className="mt-1">
              <ToggleSwitch
                checked={isActive}
                onChange={(value) => updateDraft(user.id, { is_active: value })}
                disabled={disableSelf}
                label="Status aktif"
              />
            </div>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleSave(user)}
            className="h-11 flex-1 rounded-2xl bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
            disabled={!isDirty || savingId === user.id || disableSelf}
          >
            Simpan
          </button>
          <button
            type="button"
            onClick={() => handleUndo(user.id)}
            className="h-11 flex-1 rounded-2xl border border-border/60 px-4 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
            disabled={!isDirty || savingId === user.id}
          >
            Batalkan
          </button>
        </div>
      </div>
    );
  };

  const renderDesktopTable = () => (
    <div className="hidden md:block">
      <div className="overflow-hidden rounded-2xl border border-border/60">
        <table className="min-w-full divide-y divide-border/60 text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Pengguna</th>
              <th className="px-4 py-3 text-left font-semibold">Peran</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Dibuat</th>
              <th className="px-4 py-3 text-left font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {users.map((user) => {
              const draft = drafts[user.id];
              const role = draft?.role ?? user.role;
              const isActive =
                typeof draft?.is_active === 'boolean' ? draft.is_active : user.is_active;
              const isDirty = Boolean(draft);
              const isSelf = sessionUserId === user.id;
              const disableSelf = isSelf && user.role === 'admin' && user.is_active && activeAdminCount <= 1;

              return (
                <tr key={user.id} className="odd:bg-muted/10">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar user={user} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{user.username || 'Tanpa nama'}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={role}
                      onChange={(event) => updateDraft(user.id, { role: event.target.value as 'admin' | 'user' })}
                      className={SELECT_CLASS}
                      disabled={disableSelf}
                    >
                      <option value="admin">Admin</option>
                      <option value="user">User</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <ToggleSwitch
                      checked={isActive}
                      onChange={(value) => updateDraft(user.id, { is_active: value })}
                      disabled={disableSelf}
                      label="Status aktif"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {user.created_at ? dateFormatter.format(new Date(user.created_at)) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSave(user)}
                        className="h-11 rounded-2xl bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
                        disabled={!isDirty || savingId === user.id || disableSelf}
                      >
                        Simpan
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUndo(user.id)}
                        className="h-11 rounded-2xl border border-border/60 px-4 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
                        disabled={!isDirty || savingId === user.id}
                      >
                        Batalkan
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Pengguna</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Lihat dan kelola peran pengguna. Ubah role dan status aktif dengan aman.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/10 p-4 md:grid-cols-4 md:p-6">
        <label className="md:col-span-2">
          <span className="text-xs font-semibold text-muted-foreground">Cari</span>
          <input
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            className={clsx(INPUT_CLASS, 'mt-1')}
            placeholder="Cari username atau email"
          />
        </label>
        <label>
          <span className="text-xs font-semibold text-muted-foreground">Peran</span>
          <select
            value={filters.role}
            onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value as 'all' | 'admin' | 'user' }))}
            className={clsx(SELECT_CLASS, 'mt-1')}
          >
            <option value="all">Semua</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
        </label>
        <label>
          <span className="text-xs font-semibold text-muted-foreground">Status</span>
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, status: event.target.value as 'all' | 'active' | 'inactive' }))
            }
            className={clsx(SELECT_CLASS, 'mt-1')}
          >
            <option value="all">Semua</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </label>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        renderSkeleton()
      ) : users.length === 0 ? (
        renderEmpty()
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {users.map((user) => renderUserCard(user))}
          </div>
          {renderDesktopTable()}
        </>
      )}
    </div>
  );
}
