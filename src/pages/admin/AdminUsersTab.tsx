import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext.jsx';
import {
  impersonateUser,
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
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'created_at' | 'username' | 'role' | 'status'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [bulkAction, setBulkAction] = useState<'activate' | 'deactivate' | 'make-admin' | 'make-user' | 'export' | ''>('');
  const [bulkLoading, setBulkLoading] = useState(false);

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
    setPage(1);
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

  useEffect(() => {
    setSelectedIds(new Set());
  }, [debouncedSearch, filters.role, filters.status]);

  const activeAdminCount = useMemo(
    () => users.filter((user) => user.role === 'admin' && user.is_active).length,
    [users]
  );

  const processedUsers = useMemo(() => {
    const sorted = [...users].sort((a, b) => {
      const direction = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'username') {
        return direction * (a.username ?? a.email ?? '').localeCompare(b.username ?? b.email ?? '');
      }
      if (sortBy === 'role') {
        return direction * a.role.localeCompare(b.role);
      }
      if (sortBy === 'status') {
        const statusA = a.is_active ? 1 : 0;
        const statusB = b.is_active ? 1 : 0;
        return direction * (statusA - statusB);
      }
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return direction * (timeA - timeB);
    });
    return sorted;
  }, [users, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processedUsers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageUsers = processedUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    const next = new Set(selectedIds);
    pageUsers.forEach((user) => next.add(user.id));
    setSelectedIds(next);
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleBulkApply = async () => {
    if (!bulkAction || selectedIds.size === 0 || bulkLoading) return;
    if (bulkAction === 'export') {
      const selected = users.filter((user) => selectedIds.has(user.id));
      const header = ['id', 'username', 'email', 'role', 'status', 'created_at'];
      const rows = selected.map((user) => [
        user.id,
        user.username ?? '',
        user.email ?? '',
        user.role,
        user.is_active ? 'active' : 'inactive',
        user.created_at ?? '',
      ]);
      const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      addToast('CSV pengguna berhasil diunduh', 'success');
      return;
    }

    setBulkLoading(true);
    try {
      const updates: UpdateUserProfileInput = {};
      if (bulkAction === 'activate') updates.is_active = true;
      if (bulkAction === 'deactivate') updates.is_active = false;
      if (bulkAction === 'make-admin') updates.role = 'admin';
      if (bulkAction === 'make-user') updates.role = 'user';

      const targets = users.filter((user) => selectedIds.has(user.id));
      const results = await Promise.allSettled(
        targets.map((user) => updateUserProfile(user.id, updates))
      );
      const success = results.filter((result) => result.status === 'fulfilled') as PromiseFulfilledResult<UserProfileRecord>[];
      const failures = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[];

      if (success.length > 0) {
        setUsers((prev) =>
          prev.map((user) => success.find((item) => item.value.id === user.id)?.value ?? user)
        );
        addToast(`Berhasil memperbarui ${success.length} pengguna`, 'success');
        setSelectedIds(new Set());
      }
      if (failures.length > 0) {
        addToast(`${failures.length} pengguna gagal diperbarui`, 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memperbarui pengguna';
      addToast(message, 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const updateDraft = (id: string, patch: UpdateUserProfileInput) => {
    setDrafts((prev) => {
      const current = prev[id] ?? {};
      const next: UpdateUserProfileInput = { ...current, ...patch };

      if ('password' in patch && (!patch.password || patch.password.length === 0)) {
        delete next.password;
      }

      const user = users.find((item) => item.id === id);
      if (!user) return prev;

      const role = next.role ?? user.role;
      const isActive =
        typeof next.is_active === 'boolean' ? next.is_active : user.is_active;
      const nextUsername = Object.prototype.hasOwnProperty.call(next, 'username')
        ? next.username ?? ''
        : user.username ?? '';
      const nextEmail = Object.prototype.hasOwnProperty.call(next, 'email')
        ? next.email ?? ''
        : user.email ?? '';
      const currentUsername = user.username ?? '';
      const currentEmail = user.email ?? '';
      const hasPassword = typeof next.password === 'string' && next.password.length > 0;

      const dirty =
        role !== user.role ||
        isActive !== user.is_active ||
        nextUsername !== currentUsername ||
        nextEmail !== currentEmail ||
        hasPassword;

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

    if (Object.prototype.hasOwnProperty.call(draft, 'username')) {
      const nextUsername = draft.username ?? '';
      const currentUsername = user.username ?? '';
      if (nextUsername !== currentUsername) {
        payload.username = nextUsername.trim() ? nextUsername.trim() : null;
      }
    }

    if (Object.prototype.hasOwnProperty.call(draft, 'email')) {
      const nextEmail = draft.email ?? '';
      const currentEmail = user.email ?? '';
      if (nextEmail !== currentEmail) {
        const trimmed = nextEmail.trim();
        payload.email = trimmed ? trimmed : null;
      }
    }

    if (draft.password) {
      const trimmedPassword = draft.password.trim();
      if (trimmedPassword.length < 6) {
        addToast('Password minimal 6 karakter', 'error');
        return;
      }
      payload.password = trimmedPassword;
    }

    if (Object.keys(payload).length === 0) {
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

  const handleLoginAsUser = async (user: UserProfileRecord) => {
    if (!user.email) {
      addToast('Pengguna belum memiliki email sehingga tidak dapat login.', 'error');
      return;
    }

    setImpersonatingId(user.id);
    try {
      await impersonateUser(user.email);
      addToast('Berhasil login sebagai pengguna. Mengalihkan...', 'success');
      window.location.href = '/';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal login sebagai pengguna';
      addToast(message, 'error');
    } finally {
      setImpersonatingId(null);
    }
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
      <div
        key={user.id}
        className={clsx(
          'rounded-2xl border border-border/60 bg-background p-4 shadow-sm transition',
          isDirty ? 'border-primary/50 bg-primary/5' : 'hover:border-primary/40'
        )}
      >
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-2 h-4 w-4 rounded border-border/60 text-primary focus:ring-primary"
            checked={selectedIds.has(user.id)}
            onChange={(event) => toggleSelectOne(user.id, event.target.checked)}
            aria-label={`Pilih ${user.username || user.email || 'pengguna'}`}
          />
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
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={clsx(
                  'rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide',
                  role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted/40 text-muted-foreground'
                )}
              >
                {role}
              </span>
              <span
                className={clsx(
                  'rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide',
                  isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                )}
              >
                {isActive ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          <label className="text-sm font-semibold text-muted-foreground">
            Username
            <input
              value={draft?.username ?? user.username ?? ''}
              onChange={(event) => updateDraft(user.id, { username: event.target.value })}
              className={clsx(INPUT_CLASS, 'mt-1')}
              placeholder="Masukkan username"
              autoComplete="off"
            />
          </label>
          <label className="text-sm font-semibold text-muted-foreground">
            Email
            <input
              value={draft?.email ?? user.email ?? ''}
              onChange={(event) => updateDraft(user.id, { email: event.target.value })}
              className={clsx(INPUT_CLASS, 'mt-1')}
              placeholder="Masukkan email"
              type="email"
              autoComplete="off"
            />
          </label>
          <label className="text-sm font-semibold text-muted-foreground">
            Password baru
            <input
              value={draft?.password ?? ''}
              onChange={(event) => updateDraft(user.id, { password: event.target.value })}
              className={clsx(INPUT_CLASS, 'mt-1')}
              placeholder="Minimal 6 karakter"
              type="password"
              autoComplete="new-password"
            />
          </label>
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
            onClick={() => handleLoginAsUser(user)}
            className="h-11 flex-1 rounded-2xl border border-primary/60 px-4 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:opacity-50"
            disabled={!user.email || impersonatingId === user.id}
          >
            {impersonatingId === user.id ? 'Masuk...' : 'Login sebagai user'}
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
              <th className="px-4 py-3 text-left font-semibold">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border/60 text-primary focus:ring-primary"
                  checked={pageUsers.length > 0 && pageUsers.every((user) => selectedIds.has(user.id))}
                  onChange={(event) => toggleSelectAll(event.target.checked)}
                  aria-label="Pilih semua pengguna"
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold">Pengguna</th>
              <th className="px-4 py-3 text-left font-semibold">Informasi Akun</th>
              <th className="px-4 py-3 text-left font-semibold">Peran</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Dibuat</th>
              <th className="px-4 py-3 text-left font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {pageUsers.map((user) => {
              const draft = drafts[user.id];
              const role = draft?.role ?? user.role;
              const isActive =
                typeof draft?.is_active === 'boolean' ? draft.is_active : user.is_active;
              const isDirty = Boolean(draft);
              const isSelf = sessionUserId === user.id;
              const disableSelf = isSelf && user.role === 'admin' && user.is_active && activeAdminCount <= 1;

              return (
                <tr key={user.id} className={clsx('odd:bg-muted/10', isDirty && 'bg-primary/5')}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border/60 text-primary focus:ring-primary"
                      checked={selectedIds.has(user.id)}
                      onChange={(event) => toggleSelectOne(user.id, event.target.checked)}
                      aria-label={`Pilih ${user.username || user.email || 'pengguna'}`}
                    />
                  </td>
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
                    <div className="grid gap-3">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Username
                        <input
                          value={draft?.username ?? user.username ?? ''}
                          onChange={(event) => updateDraft(user.id, { username: event.target.value })}
                          className={clsx(INPUT_CLASS, 'mt-1')}
                          placeholder="Username"
                          autoComplete="off"
                        />
                      </label>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Email
                        <input
                          value={draft?.email ?? user.email ?? ''}
                          onChange={(event) => updateDraft(user.id, { email: event.target.value })}
                          className={clsx(INPUT_CLASS, 'mt-1')}
                          placeholder="Email"
                          type="email"
                          autoComplete="off"
                        />
                      </label>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Password baru
                        <input
                          value={draft?.password ?? ''}
                          onChange={(event) => updateDraft(user.id, { password: event.target.value })}
                          className={clsx(INPUT_CLASS, 'mt-1')}
                          placeholder="Minimal 6 karakter"
                          type="password"
                          autoComplete="new-password"
                        />
                      </label>
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
                    <div className="flex items-center gap-2">
                      <ToggleSwitch
                        checked={isActive}
                        onChange={(value) => updateDraft(user.id, { is_active: value })}
                        disabled={disableSelf}
                        label="Status aktif"
                      />
                      <span
                        className={clsx(
                          'rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide',
                          isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                        )}
                      >
                        {isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
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
                        onClick={() => handleLoginAsUser(user)}
                        className="h-11 rounded-2xl border border-primary/60 px-4 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:opacity-50"
                        disabled={!user.email || impersonatingId === user.id}
                      >
                        {impersonatingId === user.id ? 'Masuk...' : 'Login sebagai user'}
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
          Kelola akun pengguna: perbarui username, email, password, atur role dan status aktif, serta masuk sebagai pengguna untuk membantu mereka.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/10 p-4 md:grid-cols-6 md:p-6">
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
        <label>
          <span className="text-xs font-semibold text-muted-foreground">Urutkan</span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            className={clsx(SELECT_CLASS, 'mt-1')}
          >
            <option value="created_at">Tanggal Dibuat</option>
            <option value="username">Nama</option>
            <option value="role">Peran</option>
            <option value="status">Status</option>
          </select>
        </label>
        <label>
          <span className="text-xs font-semibold text-muted-foreground">Arah</span>
          <select
            value={sortDir}
            onChange={(event) => setSortDir(event.target.value as 'asc' | 'desc')}
            className={clsx(SELECT_CLASS, 'mt-1')}
          >
            <option value="desc">Terbaru</option>
            <option value="asc">Terlama</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background p-4 shadow-sm">
        <div className="text-sm text-muted-foreground">
          {selectedIds.size > 0 ? (
            <span>{selectedIds.size} pengguna dipilih</span>
          ) : (
            <span>Pilih pengguna untuk aksi massal</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={bulkAction}
            onChange={(event) => setBulkAction(event.target.value as typeof bulkAction)}
            className={clsx(SELECT_CLASS, 'h-10 w-44')}
          >
            <option value="">Aksi Massal</option>
            <option value="activate">Aktifkan</option>
            <option value="deactivate">Nonaktifkan</option>
            <option value="make-admin">Jadikan Admin</option>
            <option value="make-user">Jadikan User</option>
            <option value="export">Export CSV</option>
          </select>
          <button
            type="button"
            onClick={handleBulkApply}
            className="h-10 rounded-2xl bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
            disabled={!bulkAction || selectedIds.size === 0 || bulkLoading}
          >
            Terapkan
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        renderSkeleton()
      ) : processedUsers.length === 0 ? (
        renderEmpty()
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {pageUsers.map((user) => renderUserCard(user))}
          </div>
          {renderDesktopTable()}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
            <span>
              Menampilkan {pageUsers.length} dari {processedUsers.length} pengguna
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className={clsx(SELECT_CLASS, 'h-9 w-24')}
              >
                {[10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size} / halaman
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="h-9 rounded-2xl border border-border/60 px-3 text-sm font-medium transition hover:border-primary hover:text-primary disabled:opacity-50"
                  disabled={currentPage <= 1}
                >
                  Sebelumnya
                </button>
                <span>
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  className="h-9 rounded-2xl border border-border/60 px-3 text-sm font-medium transition hover:border-primary hover:text-primary disabled:opacity-50"
                  disabled={currentPage >= totalPages}
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
