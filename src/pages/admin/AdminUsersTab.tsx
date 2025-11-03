import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext.jsx';
import {
  listUsers,
  updateUserProfile,
  loginAsUser,
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

type EditFormState = {
  username: string;
  email: string;
  password: string;
};

type EditUserDialogProps = {
  open: boolean;
  user: UserProfileRecord | null;
  form: EditFormState;
  onChange: (patch: Partial<EditFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
};

function EditUserDialog({ open, user, form, onChange, onClose, onSubmit, busy, error }: EditUserDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, busy]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLInputElement>('input[name="username"]')?.focus();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open || !user) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-user-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-border/60 bg-background shadow-xl"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="flex h-full flex-col"
        >
          <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4">
            <h3 id="edit-user-title" className="text-lg font-semibold text-foreground">
              Ubah informasi pengguna
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
            >
              Tutup
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
            <label className="flex flex-col gap-1">
              <span className="font-semibold text-muted-foreground">Username</span>
              <input
                name="username"
                value={form.username}
                onChange={(event) => onChange({ username: event.target.value })}
                className={INPUT_CLASS}
                placeholder="Nama pengguna"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-semibold text-muted-foreground">Email</span>
              <input
                name="email"
                type="email"
                required
                value={form.email}
                onChange={(event) => onChange({ email: event.target.value })}
                className={INPUT_CLASS}
                placeholder="alamat@email.com"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-semibold text-muted-foreground">Password baru</span>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={(event) => onChange({ password: event.target.value })}
                className={INPUT_CLASS}
                placeholder="Kosongkan jika tidak diganti"
              />
            </label>
            <p className="text-xs text-muted-foreground">Kosongkan password untuk mempertahankan password saat ini.</p>
            {error ? (
              <p className="text-sm font-medium text-destructive" aria-live="assertive">
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-border/60 bg-muted/20 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-2xl border border-border/60 px-4 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={busy}
              className="h-11 rounded-2xl bg-primary px-5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? 'Menyimpan…' : 'Simpan perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
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
  const [editingUser, setEditingUser] = useState<UserProfileRecord | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({ username: '', email: '', password: '' });
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const closeEditDialog = useCallback(() => {
    setEditingUser(null);
    setEditForm({ username: '', email: '', password: '' });
    setEditError(null);
  }, []);

  const openEditDialog = useCallback((user: UserProfileRecord) => {
    setEditingUser(user);
    setEditForm({
      username: user.username ?? '',
      email: user.email ?? '',
      password: '',
    });
    setEditError(null);
  }, []);

  const handleEditChange = useCallback((patch: Partial<EditFormState>) => {
    setEditForm((prev) => ({ ...prev, ...patch }));
    setEditError(null);
  }, []);

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

  const handleEditSubmit = async () => {
    if (!editingUser) return;

    const trimmedEmail = editForm.email.trim();
    if (!trimmedEmail) {
      setEditError('Email wajib diisi');
      return;
    }

    const trimmedUsername = editForm.username.trim();
    const payload: UpdateUserProfileInput = {};

    const normalizedUsername = trimmedUsername ? trimmedUsername : null;
    if (normalizedUsername !== (editingUser.username ?? null)) {
      payload.username = normalizedUsername;
    }

    if (trimmedEmail !== (editingUser.email ?? '')) {
      payload.email = trimmedEmail;
    }

    const trimmedPassword = editForm.password.trim();
    if (trimmedPassword) {
      payload.password = trimmedPassword;
    }

    if (Object.keys(payload).length === 0) {
      setEditError('Tidak ada perubahan untuk disimpan');
      return;
    }

    setEditBusy(true);
    setEditError(null);
    try {
      const updated = await updateUserProfile(editingUser.id, payload);
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      addToast('Informasi pengguna diperbarui', 'success');
      closeEditDialog();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memperbarui informasi pengguna';
      setEditError(message);
    } finally {
      setEditBusy(false);
    }
  };

  const handleImpersonate = async (user: UserProfileRecord) => {
    if (!user.email) {
      addToast('Pengguna tidak memiliki email untuk login', 'error');
      return;
    }

    setImpersonatingId(user.id);
    try {
      await loginAsUser(user.email);
      addToast(`Berhasil login sebagai ${user.username || user.email}`, 'success');
      window.location.replace('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal login sebagai pengguna';
      addToast(message, 'error');
    } finally {
      setImpersonatingId(null);
    }
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
    const isImpersonating = impersonatingId === user.id;

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
            onClick={() => openEditDialog(user)}
            className="h-11 flex-1 rounded-2xl border border-border/60 px-4 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            Edit info
          </button>
          <button
            type="button"
            onClick={() => handleImpersonate(user)}
            className="h-11 flex-1 rounded-2xl bg-muted px-4 text-sm font-medium text-foreground transition hover:bg-muted/80 disabled:opacity-50"
            disabled={isImpersonating || !user.email}
          >
            {isImpersonating ? 'Masuk…' : 'Login sebagai'}
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
              const isImpersonating = impersonatingId === user.id;

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
                        onClick={() => openEditDialog(user)}
                        className="h-11 rounded-2xl border border-border/60 px-4 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                      >
                        Edit info
                      </button>
                      <button
                        type="button"
                        onClick={() => handleImpersonate(user)}
                        className="h-11 rounded-2xl bg-muted px-4 text-sm font-medium text-foreground transition hover:bg-muted/80 disabled:opacity-50"
                        disabled={isImpersonating || !user.email}
                      >
                        {isImpersonating ? 'Masuk…' : 'Login sebagai'}
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
      <EditUserDialog
        open={Boolean(editingUser)}
        user={editingUser}
        form={editForm}
        onChange={handleEditChange}
        onClose={closeEditDialog}
        onSubmit={handleEditSubmit}
        busy={editBusy}
        error={editError}
      />
    </div>
  );
}

