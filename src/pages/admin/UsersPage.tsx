import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import UserTable, { UserTablePagination } from '../../components/admin/users/UserTable';
import UserFormModal, {
  CreateUserFormValues,
  UpdateUserFormValues,
} from '../../components/admin/users/UserFormModal';
import {
  AdminUserItem,
  AdminUsersApiError,
  CreateAdminUserPayload,
  DeleteAdminUserOptions,
  ListUsersParams,
  UpdateAdminUserPayload,
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  updateAdminUser,
} from '../../lib/api/adminUsers.ts';
import { useToast } from '../../context/ToastContext.jsx';
import { supabase } from '../../lib/supabase.js';
import Modal from '../../components/Modal.jsx';

type FilterState = {
  q: string;
  role: 'all' | 'admin' | 'user';
  status: 'all' | 'active' | 'inactive';
  order: `${'created_at' | 'last_sign_in_at' | 'email'}.${'asc' | 'desc'}`;
};

type DeleteState = {
  user: AdminUserItem;
  mode: 'hard' | 'soft';
};

const INPUT_CLASS =
  'h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary';
const SELECT_CLASS = clsx(INPUT_CLASS, 'pr-10');

const ORDER_OPTIONS: Array<{ label: string; value: FilterState['order'] }> = [
  { label: 'Dibuat terbaru', value: 'created_at.desc' },
  { label: 'Dibuat terlama', value: 'created_at.asc' },
  { label: 'Last sign-in terbaru', value: 'last_sign_in_at.desc' },
  { label: 'Last sign-in terlama', value: 'last_sign_in_at.asc' },
  { label: 'Email A-Z', value: 'email.asc' },
  { label: 'Email Z-A', value: 'email.desc' },
];

function buildListParams(
  filters: FilterState,
  pagination: { limit: number; offset: number },
  debouncedQuery: string
): ListUsersParams {
  return {
    q: debouncedQuery || undefined,
    role: filters.role,
    status: filters.status,
    order: filters.order,
    limit: pagination.limit,
    offset: pagination.offset,
  };
}

export default function UsersPage() {
  const { addToast } = useToast();
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    q: '',
    role: 'all',
    status: 'all',
    order: 'created_at.desc',
  });
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [pagination, setPagination] = useState<{ limit: number; offset: number }>({ limit: 20, offset: 0 });
  const [pageMeta, setPageMeta] = useState<UserTablePagination | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null);
  const [forcePasswordReset, setForcePasswordReset] = useState(false);
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) {
        setCurrentAdminId(data.user?.id ?? null);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(filters.q.trim());
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [filters.q]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildListParams(filters, pagination, debouncedQuery);
      const response = await listAdminUsers(params);
      setUsers(response.items);
      setPageMeta({
        limit: response.limit,
        offset: response.offset,
        total: response.total,
        nextCursor: response.nextCursor,
        previousCursor: response.previousCursor,
      });
    } catch (err) {
      const message = err instanceof AdminUsersApiError ? err.message : 'Gagal memuat daftar pengguna';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination, debouncedQuery]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const resetPagination = useCallback(() => {
    setPagination((prev) => ({ ...prev, offset: 0 }));
  }, []);

  const handleFilterChange = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    resetPagination();
  };

  const handleNavigate = (offset: number) => {
    setPagination((prev) => ({ ...prev, offset }));
  };

  const refresh = useCallback(async () => {
    await loadUsers();
  }, [loadUsers]);

  const openCreateModal = () => {
    setFormMode('create');
    setSelectedUser(null);
    setForcePasswordReset(false);
    setShowForm(true);
  };

  const openEditModal = (user: AdminUserItem, forceReset = false) => {
    setFormMode('edit');
    setSelectedUser(user);
    setForcePasswordReset(forceReset);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setSelectedUser(null);
    setForcePasswordReset(false);
  };

  const handleCreateSubmit = async (values: CreateUserFormValues) => {
    setFormSubmitting(true);
    try {
      await createAdminUser(values as CreateAdminUserPayload);
      addToast('Pengguna berhasil dibuat', 'success');
      closeForm();
      await refresh();
    } catch (err) {
      const message = err instanceof AdminUsersApiError ? err.message : 'Gagal membuat pengguna baru';
      addToast(message, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleUpdateSubmit = async (values: UpdateUserFormValues) => {
    if (!selectedUser) return;
    setFormSubmitting(true);
    try {
      const updated = await updateAdminUser(selectedUser.id, values as UpdateAdminUserPayload);
      setUsers((prev) => prev.map((user) => (user.id === updated.id ? updated : user)));
      addToast('Perubahan pengguna disimpan', 'success');
      closeForm();
    } catch (err) {
      const message = err instanceof AdminUsersApiError ? err.message : 'Gagal memperbarui pengguna';
      addToast(message, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleFormSubmit = (values: CreateUserFormValues | UpdateUserFormValues) => {
    if (formMode === 'create') {
      void handleCreateSubmit(values as CreateUserFormValues);
    } else {
      void handleUpdateSubmit(values as UpdateUserFormValues);
    }
  };

  const handleToggleActive = async (user: AdminUserItem, nextState: boolean) => {
    const previousState = user.profile.is_active;
    setUsers((prev) =>
      prev.map((item) =>
        item.id === user.id ? { ...item, profile: { ...item.profile, is_active: nextState } } : item
      )
    );
    setTogglingId(user.id);
    try {
      const updated = await updateAdminUser(user.id, { profile: { is_active: nextState } });
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      addToast('Status pengguna diperbarui', 'success');
    } catch (err) {
      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id ? { ...item, profile: { ...item.profile, is_active: previousState } } : item
        )
      );
      const message = err instanceof AdminUsersApiError ? err.message : 'Gagal memperbarui status pengguna';
      addToast(message, 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = (user: AdminUserItem) => {
    setDeleteState({ user, mode: 'hard' });
  };

  const confirmDelete = async () => {
    if (!deleteState) return;
    const { user, mode } = deleteState;
    setDeletingId(user.id);
    try {
      const options: DeleteAdminUserOptions = { mode };
      const result = await deleteAdminUser(user.id, options);
      if (result.mode === 'soft') {
        if (result.user) {
          setUsers((prev) => prev.map((item) => (item.id === user.id ? result.user! : item)));
        } else {
          await refresh();
        }
        addToast('Pengguna dinonaktifkan', 'success');
      } else {
        setUsers((prev) => prev.filter((item) => item.id !== user.id));
        addToast('Pengguna dihapus', 'success');
      }
      setDeleteState(null);
    } catch (err) {
      const message = err instanceof AdminUsersApiError ? err.message : 'Gagal menghapus pengguna';
      addToast(message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const cancelDelete = () => {
    setDeleteState(null);
  };

  const disableToggleIds = useMemo(() => {
    return new Set<string>();
  }, []);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Dashboard / Admin / Users</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Kelola Pengguna</h1>
            <p className="text-sm text-muted-foreground">
              Lihat, cari, dan kelola akun pengguna secara aman menggunakan Edge Function.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="h-11 rounded-2xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            Tambah Pengguna
          </button>
        </div>
      </header>

      <section className="grid gap-3 rounded-2xl border border-border/60 bg-muted/10 p-4 md:grid-cols-5 md:p-6">
        <label className="md:col-span-2">
          <span className="text-xs font-semibold text-muted-foreground">Cari</span>
          <input
            value={filters.q}
            onChange={(event) => handleFilterChange('q', event.target.value)}
            className={clsx(INPUT_CLASS, 'mt-1')}
            placeholder="Cari email, nama, atau username"
          />
        </label>
        <label>
          <span className="text-xs font-semibold text-muted-foreground">Peran</span>
          <select
            value={filters.role}
            onChange={(event) => handleFilterChange('role', event.target.value as FilterState['role'])}
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
            onChange={(event) => handleFilterChange('status', event.target.value as FilterState['status'])}
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
            value={filters.order}
            onChange={(event) => handleFilterChange('order', event.target.value as FilterState['order'])}
            className={clsx(SELECT_CLASS, 'mt-1')}
          >
            {ORDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <UserTable
        items={users}
        loading={loading}
        error={error}
        pagination={pageMeta}
        currentAdminId={currentAdminId}
        togglingId={togglingId}
        deletingId={deletingId}
        disableToggleIds={disableToggleIds}
        onRetry={() => void loadUsers()}
        onToggleActive={handleToggleActive}
        onEdit={(user) => openEditModal(user)}
        onResetPassword={(user) => openEditModal(user, true)}
        onDelete={handleDelete}
        onNavigate={handleNavigate}
      />

      <UserFormModal
        open={showForm}
        mode={formMode}
        initialUser={selectedUser ?? undefined}
        submitting={formSubmitting}
        forcePasswordReset={forcePasswordReset}
        onClose={closeForm}
        onSubmit={handleFormSubmit}
      />

      <Modal open={deleteState != null} title="Konfirmasi penghapusan" onClose={cancelDelete}>
        {deleteState ? (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Anda akan {deleteState.mode === 'hard' ? 'menghapus permanen' : 'menonaktifkan'} akun{' '}
              <span className="font-semibold text-foreground">{deleteState.user.email}</span>. Pilih mode penghapusan dan
              konfirmasi aksi ini.
            </p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="delete-mode"
                  value="soft"
                  checked={deleteState.mode === 'soft'}
                  onChange={() => setDeleteState((prev) => (prev ? { ...prev, mode: 'soft' } : prev))}
                />
                Nonaktifkan akun (soft delete)
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="delete-mode"
                  value="hard"
                  checked={deleteState.mode === 'hard'}
                  onChange={() => setDeleteState((prev) => (prev ? { ...prev, mode: 'hard' } : prev))}
                />
                Hapus permanen akun dan profil (hard delete)
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={cancelDelete}
                className="h-11 rounded-2xl border border-border px-4 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="h-11 rounded-2xl border border-destructive/40 px-4 text-sm font-semibold text-destructive transition hover:border-destructive hover:bg-destructive/10"
                disabled={deletingId === deleteState.user.id}
              >
                {deleteState.mode === 'hard' ? 'Hapus' : 'Nonaktifkan'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
