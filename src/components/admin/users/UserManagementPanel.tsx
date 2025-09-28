import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useToast } from '../../../context/ToastContext.jsx';
import { supabase } from '../../../lib/supabase';
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  type AdminUserItem,
  type CreateUserPayload,
  type ListUsersResponse,
  type UpdateUserPayload,
} from '../../../lib/api/adminUsers';
import UserTable from './UserTable';
import UserFormModal from './UserFormModal';
import { Icon } from '../../icons';

type FilterState = {
  q: string;
  role: 'all' | 'admin' | 'user';
  status: 'all' | 'active' | 'inactive';
  order: 'created_at.desc' | 'created_at.asc' | 'last_sign_in_at.desc' | 'last_sign_in_at.asc';
};

type ConfirmState = {
  open: boolean;
  user: AdminUserItem | null;
  mode: 'soft' | 'hard';
  loading: boolean;
};

const INPUT_CLASS =
  'w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40';

const SELECT_CLASS = clsx(
  'rounded-xl border border-border/60 bg-background px-3 py-2 text-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40',
  'pr-10'
);

const ORDER_OPTIONS: Array<{ value: FilterState['order']; label: string }> = [
  { value: 'created_at.desc', label: 'Terbaru dibuat' },
  { value: 'created_at.asc', label: 'Terlama dibuat' },
  { value: 'last_sign_in_at.desc', label: 'Login terbaru' },
  { value: 'last_sign_in_at.asc', label: 'Login terlama' },
];

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="grid gap-3 rounded-2xl bg-muted/10 p-4 md:grid-cols-6">
          {Array.from({ length: 6 }).map((__, col) => (
            <div key={col} className="h-10 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      ))}
    </div>
  );
}

function ConfirmDialog({
  state,
  onClose,
  onConfirm,
  onModeChange,
}: {
  state: ConfirmState;
  onClose: () => void;
  onConfirm: () => void;
  onModeChange: (mode: 'soft' | 'hard') => void;
}) {
  if (!state.open || !state.user) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
          <h2 className="text-lg font-semibold">Hapus Pengguna</h2>
          <button
            type="button"
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted/40"
            onClick={onClose}
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>
        <div className="space-y-5 px-6 py-5 text-sm">
          <p>
            Anda yakin ingin menghapus pengguna <strong>{state.user.email || state.user.profile.username || state.user.id}</strong>?
          </p>
          <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input
                type="radio"
                name="delete-mode"
                value="soft"
                checked={state.mode === 'soft'}
                onChange={() => onModeChange('soft')}
                className="h-4 w-4"
                disabled={state.loading}
              />
              Nonaktifkan saja (soft delete)
            </label>
            <p className="pl-7 text-xs text-muted-foreground">User tetap ada tetapi tidak bisa login.</p>
            <label className="mt-4 flex items-center gap-3 text-sm font-medium text-destructive">
              <input
                type="radio"
                name="delete-mode"
                value="hard"
                checked={state.mode === 'hard'}
                onChange={() => onModeChange('hard')}
                className="h-4 w-4"
                disabled={state.loading}
              />
              Hapus permanen
            </label>
            <p className="pl-7 text-xs text-muted-foreground">Akun auth dan profil publik akan dihapus.</p>
          </div>
          <div className="flex flex-col-reverse gap-3 pt-2 md:flex-row md:justify-end">
            <button
              type="button"
              className="h-10 rounded-xl border border-border/60 px-4 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
              onClick={onClose}
              disabled={state.loading}
            >
              Batal
            </button>
            <button
              type="button"
              className="h-10 rounded-xl bg-destructive px-4 text-sm font-semibold text-white transition hover:bg-destructive/90 disabled:opacity-60"
              onClick={onConfirm}
              disabled={state.loading}
            >
              {state.loading ? 'Menghapus…' : state.mode === 'soft' ? 'Nonaktifkan' : 'Hapus permanen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UserManagementPanel({
  className,
}: {
  className?: string;
}) {
  const { addToast } = useToast();
  const [items, setItems] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    q: '',
    role: 'all',
    status: 'all',
    order: 'created_at.desc',
  });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [limit] = useState(20);
  const [meta, setMeta] = useState<Omit<ListUsersResponse, 'items'>>({
    total: 0,
    nextCursor: null,
    limit: 20,
  });
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [formState, setFormState] = useState<{ mode: 'create' | 'edit'; open: boolean; user: AdminUserItem | null; loading: boolean
 }>({
    mode: 'create',
    open: false,
    user: null,
    loading: false,
  });
  const [confirmState, setConfirmState] = useState<ConfirmState>({ open: false, user: null, mode: 'hard', loading: false });

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setSessionUserId(data.user?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handler = window.setTimeout(() => setDebouncedSearch(filters.q), 350);
    return () => window.clearTimeout(handler);
  }, [filters.q]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, filters.role, filters.status, filters.order]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await listUsers({
          q: debouncedSearch || undefined,
          role: filters.role,
          status: filters.status,
          limit,
          offset,
          order: filters.order,
        });
        if (!cancelled) {
          setItems(response.items);
          setMeta({ total: response.total, nextCursor: response.nextCursor, limit: response.limit });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal memuat pengguna';
        if (!cancelled) {
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, filters.role, filters.status, filters.order, offset, limit]);

  const totalPages = useMemo(() => {
    return meta.total && meta.limit ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;
  }, [meta.total, meta.limit]);

  const currentPage = useMemo(() => {
    return Math.floor((offset || 0) / (limit || 1)) + 1;
  }, [offset, limit]);

  const handleOpenCreate = () => {
    setFormState({ mode: 'create', open: true, user: null, loading: false });
  };

  const handleEdit = (user: AdminUserItem) => {
    setFormState({ mode: 'edit', open: true, user, loading: false });
  };

  const handleFormSubmit = async (payload: CreateUserPayload | UpdateUserPayload) => {
    setFormState((prev) => ({ ...prev, loading: true }));
    try {
      if (formState.mode === 'create') {
        await createUser(payload as CreateUserPayload);
        addToast('Pengguna berhasil dibuat', 'success');
      } else if (formState.user) {
        const updated = await updateUser(formState.user.id, payload as UpdateUserPayload);
        setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        addToast('Pengguna diperbarui', 'success');
      }
      setFormState((prev) => ({ ...prev, open: false }));
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operasi gagal';
      addToast(message, 'error');
    } finally {
      setFormState((prev) => ({ ...prev, loading: false }));
    }
  };

  const refresh = async () => {
    try {
      const response = await listUsers({
        q: debouncedSearch || undefined,
        role: filters.role,
        status: filters.status,
        limit,
        offset,
        order: filters.order,
      });
      setItems(response.items);
      setMeta({ total: response.total, nextCursor: response.nextCursor, limit: response.limit });
    } catch (err) {
      console.error('[admin] refresh users failed', err);
    }
  };

  const handleToggleActive = async (user: AdminUserItem, next: boolean) => {
    setPendingIds((prev) => [...prev, user.id]);
    const previous = user.profile.is_active;
    setItems((prev) =>
      prev.map((item) => (item.id === user.id ? { ...item, profile: { ...item.profile, is_active: next } } : item))
    );
    try {
      const updated = await updateUser(user.id, { profile: { is_active: next } });
      setItems((prev) => prev.map((item) => (item.id === user.id ? updated : item)));
      addToast(`Pengguna ${next ? 'diaktifkan' : 'dinonaktifkan'}`, 'success');
    } catch (err) {
      setItems((prev) =>
        prev.map((item) => (item.id === user.id ? { ...item, profile: { ...item.profile, is_active: previous } } : item))
      );
      const message = err instanceof Error ? err.message : 'Gagal memperbarui status';
      addToast(message, 'error');
    } finally {
      setPendingIds((prev) => prev.filter((id) => id !== user.id));
    }
  };

  const handleChangeRole = async (user: AdminUserItem, next: 'admin' | 'user') => {
    setPendingIds((prev) => [...prev, user.id]);
    const previous = user.profile.role;
    setItems((prev) => prev.map((item) => (item.id === user.id ? { ...item, profile: { ...item.profile, role: next } } : item)));
    try {
      const updated = await updateUser(user.id, { profile: { role: next } });
      setItems((prev) => prev.map((item) => (item.id === user.id ? updated : item)));
      addToast('Peran pengguna diperbarui', 'success');
    } catch (err) {
      setItems((prev) => prev.map((item) => (item.id === user.id ? { ...item, profile: { ...item.profile, role: previous } } : item)));
      const message = err instanceof Error ? err.message : 'Gagal memperbarui peran';
      addToast(message, 'error');
    } finally {
      setPendingIds((prev) => prev.filter((id) => id !== user.id));
    }
  };

  const handleDelete = (user: AdminUserItem) => {
    setConfirmState({ open: true, user, mode: 'hard', loading: false });
  };

  const confirmDeletion = async () => {
    if (!confirmState.user) return;
    setConfirmState((prev) => ({ ...prev, loading: true }));
    try {
      await deleteUser(confirmState.user.id, { mode: confirmState.mode });
      addToast(
        confirmState.mode === 'soft' ? 'Pengguna dinonaktifkan' : 'Pengguna dihapus permanen',
        'success'
      );
      setConfirmState({ open: false, user: null, mode: 'hard', loading: false });
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus pengguna';
      addToast(message, 'error');
      setConfirmState((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleCloseConfirm = () => {
    setConfirmState({ open: false, user: null, mode: 'hard', loading: false });
  };

  const handleConfirmModeChange = (mode: 'soft' | 'hard') => {
    setConfirmState((prev) => ({ ...prev, mode }));
  };

  return (
    <div className={clsx('space-y-8', className)}>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-xl font-semibold">Manajemen Pengguna</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Buat, kelola, dan nonaktifkan akun pengguna melalui Supabase Edge Functions yang aman.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
        >
          <Icon name="plus" className="h-4 w-4" />
          Tambah Pengguna
        </button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/10 p-4 md:grid-cols-5 md:p-6">
        <label className="md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cari</span>
          <input
            type="search"
            className={clsx(INPUT_CLASS, 'mt-1')}
            placeholder="Cari email, nama, atau username"
            value={filters.q}
            onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
          />
        </label>
        <label>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Peran</span>
          <select
            className={clsx(SELECT_CLASS, 'mt-1')}
            value={filters.role}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, role: event.target.value as FilterState['role'] }))
            }
          >
            <option value="all">Semua</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
        </label>
        <label>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
          <select
            className={clsx(SELECT_CLASS, 'mt-1')}
            value={filters.status}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, status: event.target.value as FilterState['status'] }))
            }
          >
            <option value="all">Semua</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </label>
        <label>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Urutkan</span>
          <select
            className={clsx(SELECT_CLASS, 'mt-1')}
            value={filters.order}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, order: event.target.value as FilterState['order'] }))
            }
          >
            {ORDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      ) : loading ? (
        <LoadingSkeleton />
      ) : (
        <UserTable
          items={items}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
          onChangeRole={handleChangeRole}
          pendingIds={pendingIds}
          sessionUserId={sessionUserId}
        />
      )}

      <div className="flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-4 text-sm text-muted-foreground md:flex-row">
        <div>
          Menampilkan {items.length} dari {meta.total} pengguna
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-xs font-medium transition hover:border-primary hover:text-primary disabled:opacity-60"
            onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
            disabled={offset === 0 || loading}
          >
            <Icon name="arrow-left" className="h-4 w-4" />
            Sebelumnya
          </button>
          <span>
            Halaman {currentPage} dari {totalPages}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-xs font-medium transition hover:border-primary hover:text-primary disabled:opacity-60"
            onClick={() => {
              if (meta.nextCursor != null) {
                setOffset(meta.nextCursor);
              } else if (currentPage < totalPages) {
                setOffset((prev) => prev + limit);
              }
            }}
            disabled={loading || (meta.nextCursor == null && currentPage >= totalPages)}
          >
            Selanjutnya
            <Icon name="arrow-right" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <UserFormModal
        mode={formState.mode}
        open={formState.open}
        onClose={() => setFormState((prev) => ({ ...prev, open: false }))}
        onSubmit={handleFormSubmit}
        loading={formState.loading}
        {...(formState.mode === 'edit' ? { initialData: formState.user } : {})}
      />

      <ConfirmDialog
        state={confirmState}
        onClose={handleCloseConfirm}
        onConfirm={confirmDeletion}
        onModeChange={handleConfirmModeChange}
      />
    </div>
  );
}
