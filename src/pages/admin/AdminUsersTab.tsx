import { useEffect, useMemo, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext.jsx';
import {
  createUser,
  deleteUser,
  listUsers,
  updateUserProfile,
  type CreateUserInput,
  type ListUsersParams,
  type UpdateUserProfileInput,
  type UserProfileRecord,
  type UserRole,
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

type CreateUserFormState = {
  email: string;
  password: string;
  username: string;
  role: UserRole;
  is_active: boolean;
};

const INITIAL_CREATE_FORM: CreateUserFormState = {
  email: '',
  password: '',
  username: '',
  role: 'user',
  is_active: true,
};

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

function sortUsersByCreatedAt(list: UserProfileRecord[]): UserProfileRecord[] {
  return [...list].sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeA - timeB;
  });
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
  const [createForm, setCreateForm] = useState<CreateUserFormState>(() => ({ ...INITIAL_CREATE_FORM }));
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

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
  }, [debouncedSearch, filters.role, filters.status, reloadToken]);

  const activeAdminCount = useMemo(
    () => users.filter((user) => user.role === 'admin' && user.is_active).length,
    [users]
  );

  const isCreateValid = createForm.email.trim() !== '' && createForm.password.trim().length >= 6;

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

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creating) return;

    setCreateError(null);

    const payload: CreateUserInput = {
      email: createForm.email.trim(),
      password: createForm.password,
      username: createForm.username.trim() ? createForm.username.trim() : undefined,
      role: createForm.role,
      is_active: createForm.is_active,
    };

    if (!payload.email) {
      setCreateError('Email wajib diisi');
      return;
    }

    if (!payload.password || payload.password.length < 6) {
      setCreateError('Password minimal 6 karakter');
      return;
    }

    setCreating(true);
    try {
      const newUser = await createUser(payload);
      setUsers((prev) => sortUsersByCreatedAt([...prev.filter((item) => item.id !== newUser.id), newUser]));
      setCreateForm({ ...INITIAL_CREATE_FORM });
      setReloadToken((token) => token + 1);
      addToast('Pengguna berhasil dibuat', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal membuat pengguna';
      setCreateError(message);
      addToast(message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (user: UserProfileRecord) => {
    if (deletingId) return;
    if (user.id === sessionUserId) {
      addToast('Tidak dapat menghapus akun sendiri', 'error');
      return;
    }

    if (user.role === 'admin' && user.is_active && activeAdminCount <= 1) {
      addToast('Tidak dapat menghapus admin terakhir', 'error');
      return;
    }

    const confirmed = window.confirm(
      `Apakah Anda yakin ingin menghapus pengguna ${user.username || user.email || 'ini'}?`
    );
    if (!confirmed) return;

    setDeletingId(user.id);
    try {
      await deleteUser(user.id);
      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      setDrafts((prev) => {
        const { [user.id]: _omit, ...rest } = prev;
        return rest;
      });
      setReloadToken((token) => token + 1);
      addToast('Pengguna berhasil dihapus', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus pengguna';
      addToast(message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleResetCreate = () => {
    setCreateForm({ ...INITIAL_CREATE_FORM });
    setCreateError(null);
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
    const isOnlyActiveAdmin = user.role === 'admin' && user.is_active && activeAdminCount <= 1;
    const isDeleting = deletingId === user.id;
    const disableDelete = Boolean(deletingId) || isDeleting || isSelf || isOnlyActiveAdmin;

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
          <button
            type="button"
            onClick={() => handleDelete(user)}
            className="h-11 flex-1 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 text-sm font-medium text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
            disabled={disableDelete}
          >
            {isDeleting ? 'Menghapus…' : 'Hapus'}
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
              const isOnlyActiveAdmin = user.role === 'admin' && user.is_active && activeAdminCount <= 1;
              const isDeleting = deletingId === user.id;
              const disableDelete = Boolean(deletingId) || isDeleting || isSelf || isOnlyActiveAdmin;

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
                      <button
                        type="button"
                        onClick={() => handleDelete(user)}
                        className="h-11 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 text-sm font-medium text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
                        disabled={disableDelete}
                      >
                        {isDeleting ? 'Menghapus…' : 'Hapus'}
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

      <div className="rounded-2xl border border-border/60 bg-background p-4 shadow-sm md:p-6">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-semibold">Tambah Pengguna</h3>
            <p className="text-sm text-muted-foreground">
              Buat akun baru dengan peran dan status awal.
            </p>
          </div>
        </div>
        {createError ? (
          <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {createError}
          </div>
        ) : null}
        <form onSubmit={handleCreate} className="mt-4 grid gap-3 md:grid-cols-2">
          <label>
            <span className="text-xs font-semibold text-muted-foreground">Email</span>
            <input
              type="email"
              value={createForm.email}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, email: event.target.value }))
              }
              className={clsx(INPUT_CLASS, 'mt-1')}
              placeholder="contoh@email.com"
              autoComplete="off"
              required
              disabled={creating}
            />
          </label>
          <label>
            <span className="text-xs font-semibold text-muted-foreground">Password</span>
            <input
              type="password"
              value={createForm.password}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, password: event.target.value }))
              }
              className={clsx(INPUT_CLASS, 'mt-1')}
              placeholder="Minimal 6 karakter"
              minLength={6}
              required
              disabled={creating}
            />
          </label>
          <label>
            <span className="text-xs font-semibold text-muted-foreground">Username (opsional)</span>
            <input
              value={createForm.username}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, username: event.target.value }))
              }
              className={clsx(INPUT_CLASS, 'mt-1')}
              placeholder="Nama pengguna"
              autoComplete="off"
              disabled={creating}
            />
          </label>
          <label>
            <span className="text-xs font-semibold text-muted-foreground">Peran</span>
            <select
              value={createForm.role}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, role: event.target.value as UserRole }))
              }
              className={clsx(SELECT_CLASS, 'mt-1')}
              disabled={creating}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">Status</span>
            <div className="mt-1">
              <ToggleSwitch
                checked={createForm.is_active}
                onChange={(value) =>
                  setCreateForm((prev) => ({ ...prev, is_active: value }))
                }
                disabled={creating}
                label="Status aktif pengguna baru"
              />
            </div>
          </label>
          <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              className="h-11 rounded-2xl bg-primary px-6 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
              disabled={!isCreateValid || creating}
            >
              {creating ? 'Menyimpan…' : 'Buat Pengguna'}
            </button>
            <button
              type="button"
              onClick={handleResetCreate}
              className="h-11 rounded-2xl border border-border/60 px-6 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
              disabled={creating}
            >
              Reset
            </button>
          </div>
        </form>
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
