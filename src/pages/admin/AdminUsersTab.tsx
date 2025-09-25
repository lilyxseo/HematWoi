import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { supabase } from '../../lib/supabase';
import {
  listUsers,
  updateUserProfile,
  type ListUsersParams,
  type UserProfileRecord,
  type UserRole,
} from '../../lib/adminApi';
import { cardClass, inputClass, primaryButton, selectClass, subtleButton, ToggleSwitch } from './adminShared';

const roleFilters: Array<{ value: ListUsersParams['role']; label: string }> = [
  { value: 'all', label: 'Semua role' },
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
];

const statusFilters: Array<{ value: ListUsersParams['active']; label: string }> = [
  { value: 'all', label: 'Semua status' },
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
];

type EditState = Record<string, { role: UserRole; is_active: boolean }>;

type ToolbarState = {
  q: string;
  role: ListUsersParams['role'];
  active: ListUsersParams['active'];
};

const toolbarSelectClass = `${selectClass} text-sm`;

function SkeletonRow() {
  return (
    <div className="grid animate-pulse gap-4 rounded-2xl border border-border/40 bg-muted/40 p-4 md:grid-cols-[160px,1.4fr,140px,120px,140px] md:items-center">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-9 rounded-xl bg-border/60" />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
      <div className="font-semibold">Gagal memuat pengguna</div>
      <div>{message}</div>
      <div>
        <button type="button" className={subtleButton} onClick={onRetry}>
          Coba lagi
        </button>
      </div>
    </div>
  );
}

function Avatar({ user }: { user: UserProfileRecord }) {
  const label = user.username || user.email || 'User';
  const initial = label.trim().charAt(0).toUpperCase() || 'U';
  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
        {initial}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{user.username ?? user.email ?? 'Pengguna'}</span>
        {user.email && <span className="text-xs text-muted-foreground">{user.email}</span>}
      </div>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch (error) {
    console.error(error);
    return value;
  }
}

export default function AdminUsersTab() {
  const { addToast } = useToast();
  const [users, setUsers] = useState<UserProfileRecord[]>([]);
  const [edits, setEdits] = useState<EditState>({});
  const [toolbar, setToolbar] = useState<ToolbarState>({ q: '', role: 'all', active: 'all' });
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!mounted) return;
      if (authError) {
        console.error(authError);
        return;
      }
      setCurrentUserId(data.user?.id ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(toolbar.q.trim());
    }, 350);
    return () => clearTimeout(handler);
  }, [toolbar.q]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listUsers({
        q: debouncedQuery || undefined,
        role: toolbar.role,
        active: toolbar.active,
      });
      setUsers(data);
      setEdits({});
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, toolbar.role, toolbar.active]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const activeAdmins = useMemo(
    () => users.filter((user) => user.role === 'admin' && user.is_active).length,
    [users]
  );

  const getDraft = (user: UserProfileRecord) => edits[user.id] ?? { role: user.role, is_active: user.is_active };

  const isDirty = (user: UserProfileRecord) => {
    const draft = edits[user.id];
    if (!draft) return false;
    return draft.role !== user.role || draft.is_active !== user.is_active;
  };

  const handleRoleChange = (user: UserProfileRecord, value: UserRole) => {
    setEdits((prev) => ({
      ...prev,
      [user.id]: {
        role: value,
        is_active: prev[user.id]?.is_active ?? user.is_active,
      },
    }));
  };

  const handleActiveChange = (user: UserProfileRecord, value: boolean) => {
    setEdits((prev) => ({
      ...prev,
      [user.id]: {
        role: prev[user.id]?.role ?? user.role,
        is_active: value,
      },
    }));
  };

  const handleUndo = (user: UserProfileRecord) => {
    setEdits((prev) => {
      if (!prev[user.id]) return prev;
      const next = { ...prev };
      delete next[user.id];
      return next;
    });
  };

  const handleSave = async (user: UserProfileRecord) => {
    const draft = edits[user.id];
    if (!draft) return;
    const payload: Partial<{ role: UserRole; is_active: boolean }> = {};
    if (draft.role !== user.role) {
      payload.role = draft.role;
    }
    if (draft.is_active !== user.is_active) {
      payload.is_active = draft.is_active;
    }
    if (Object.keys(payload).length === 0) {
      handleUndo(user);
      return;
    }

    setSavingId(user.id);
    try {
      const updated = await updateUserProfile(user.id, payload);
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEdits((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
      addToast('Profil pengguna diperbarui', 'success');
    } catch (err) {
      console.error(err);
      addToast(err instanceof Error ? err.message : 'Gagal memperbarui pengguna', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleToolbarChange = <Key extends keyof ToolbarState>(key: Key, value: ToolbarState[Key]) => {
    setToolbar((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <section className={cardClass}>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Pengguna</h2>
          <p className="text-sm text-muted-foreground">
            Pantau dan kelola role serta status aktif pengguna aplikasi.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:items-center lg:gap-3">
          <input
            className={inputClass}
            value={toolbar.q}
            onChange={(event) => handleToolbarChange('q', event.target.value)}
            placeholder="Cari username atau email"
            aria-label="Cari pengguna"
          />
          <select
            className={toolbarSelectClass}
            value={toolbar.role ?? 'all'}
            onChange={(event) => handleToolbarChange('role', event.target.value as ToolbarState['role'])}
            aria-label="Filter role"
          >
            {roleFilters.map((option) => (
              <option key={option.value ?? 'all'} value={option.value ?? 'all'}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className={toolbarSelectClass}
            value={toolbar.active ?? 'all'}
            onChange={(event) =>
              handleToolbarChange('active', event.target.value as ToolbarState['active'])
            }
            aria-label="Filter status"
          >
            {statusFilters.map((option) => (
              <option key={option.value ?? 'all'} value={option.value ?? 'all'}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="button" className={subtleButton} onClick={() => void fetchUsers()}>
            Muat ulang
          </button>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void fetchUsers()} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonRow key={index} />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/50 bg-muted/20 p-10 text-center text-sm text-muted-foreground">
          <div className="text-3xl">🔍</div>
          <p>Tidak ada pengguna yang cocok dengan filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="hidden text-xs font-semibold uppercase text-muted-foreground md:grid md:grid-cols-[160px,1.4fr,140px,120px,140px] md:items-center md:gap-4">
            <div>Pengguna</div>
            <div>Role</div>
            <div>Status</div>
            <div>Dibuat</div>
            <div className="text-right">Aksi</div>
          </div>
          {users.map((user) => {
            const draft = getDraft(user);
            const dirty = isDirty(user);
            const isCurrentUser = user.id === currentUserId;
            const disableSelf = isCurrentUser && user.role === 'admin' && activeAdmins <= 1;
            return (
              <div
                key={user.id}
                className="grid gap-4 rounded-2xl border border-border/40 bg-background/70 p-4 md:grid-cols-[160px,1.4fr,140px,120px,140px] md:items-center"
              >
                <div className="md:col-span-1">
                  <Avatar user={user} />
                </div>
                <div>
                  <select
                    className={selectClass}
                    value={draft.role}
                    disabled={savingId === user.id || disableSelf}
                    onChange={(event) => handleRoleChange(user, event.target.value as UserRole)}
                    aria-label={`Ubah role ${user.username ?? user.email ?? 'pengguna'}`}
                  >
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                  </select>
                  {disableSelf && (
                    <p className="mt-1 text-xs text-destructive">
                      Tidak bisa mengubah role admin terakhir.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <ToggleSwitch
                    checked={draft.is_active}
                    disabled={savingId === user.id || disableSelf}
                    label={`Ubah status ${user.username ?? user.email ?? 'pengguna'}`}
                    onChange={(value) => handleActiveChange(user, value)}
                  />
                  <span className={`text-xs font-medium ${draft.is_active ? 'text-emerald-600' : 'text-destructive'}`}>
                    {draft.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">{formatDate(user.created_at)}</div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    className={subtleButton}
                    onClick={() => handleUndo(user)}
                    disabled={!dirty || savingId === user.id}
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    className={primaryButton}
                    onClick={() => void handleSave(user)}
                    disabled={!dirty || savingId === user.id}
                  >
                    Simpan
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
