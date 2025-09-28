import { useCallback, useEffect, useMemo, useState } from 'react';
import { Filter, Loader2, Plus, RefreshCcw, Search } from 'lucide-react';
import UserTable from '../../components/admin/users/UserTable';
import UserFormModal, { type UserFormValues } from '../../components/admin/users/UserFormModal';
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  type AdminUserItem,
  type ListUsersParams,
  updateAdminUser,
} from '../../lib/api/adminUsers';
import { useToast } from '../../context/ToastContext.jsx';
import AdminGuard from '../../components/AdminGuard';

const LIMIT_OPTIONS = [10, 20, 50];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua status' },
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
] as const;

const ROLE_OPTIONS = [
  { value: 'all', label: 'Semua peran' },
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
] as const;

function UsersContent() {
  const { addToast } = useToast();
  const [items, setItems] = useState<AdminUserItem[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<Required<Pick<ListUsersParams, 'role' | 'status' | 'order' | 'page' | 'limit'>>>(
    {
      role: 'all',
      status: 'all',
      order: 'created_at.desc',
      page: 1,
      limit: 20,
    }
  );
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    has_more: false,
    next_cursor: null as string | null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listAdminUsers({
        role: filters.role,
        status: filters.status,
        order: filters.order,
        page: filters.page,
        limit: filters.limit,
        q: debouncedSearch || undefined,
      });
      setItems(response.items);
      setPagination(response.pagination);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat pengguna';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filters.limit, filters.order, filters.page, filters.role, filters.status, debouncedSearch]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleOpenCreate = () => {
    setFormMode('create');
    setSelectedUser(null);
    setShowForm(true);
  };

  const handleOpenEdit = (user: AdminUserItem) => {
    setFormMode('edit');
    setSelectedUser(user);
    setShowForm(true);
  };

  const handleSubmitForm = async (values: UserFormValues) => {
    setFormSubmitting(true);
    try {
      if (formMode === 'create') {
        const payload = {
          email: values.email.trim(),
          password: values.password,
          profile: {
            role: values.role,
            is_active: values.is_active,
            full_name: values.full_name || undefined,
            username: values.username || undefined,
            avatar_url: values.avatar_url || undefined,
            locale: values.locale || undefined,
            timezone: values.timezone || undefined,
            theme: values.theme,
          },
          sendEmailInvite: values.sendEmailInvite,
        };
        const created = await createAdminUser(payload);
        setItems((prev) => [created, ...prev]);
        setPagination((prev) => ({ ...prev, total: prev.total + 1 }));
        addToast('Pengguna berhasil dibuat', 'success');
      } else if (selectedUser) {
        const payload = {
          email: values.email.trim(),
          profile: {
            role: values.role,
            is_active: values.is_active,
            full_name: values.full_name || undefined,
            username: values.username || undefined,
            avatar_url: values.avatar_url || undefined,
            locale: values.locale || undefined,
            timezone: values.timezone || undefined,
            theme: values.theme,
          },
        } as const;

        const updated = await updateAdminUser(selectedUser.id, {
          ...payload,
          password: values.password ? values.password : undefined,
        });
        setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        addToast('Pengguna berhasil diperbarui', 'success');
      }
      setShowForm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operasi gagal';
      addToast(message, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleActive = async (user: AdminUserItem, nextValue: boolean) => {
    const previous = items;
    setItems((prev) =>
      prev.map((item) =>
        item.id === user.id ? { ...item, profile: { ...item.profile, is_active: nextValue } } : item
      )
    );

    try {
      const updated = await updateAdminUser(user.id, { profile: { is_active: nextValue } });
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      addToast(`Pengguna ${nextValue ? 'diaktifkan' : 'dinonaktifkan'}`, 'success');
    } catch (err) {
      setItems(previous);
      const message = err instanceof Error ? err.message : 'Gagal memperbarui status pengguna';
      addToast(message, 'error');
    }
  };

  const handleDelete = async (user: AdminUserItem) => {
    const proceed = window.confirm(`Anda yakin ingin menghapus atau menonaktifkan ${user.email}?`);
    if (!proceed) return;

    const hardDelete = window.confirm(
      'Pilih OK untuk hapus permanen. Pilih Cancel untuk menonaktifkan saja (soft delete).'
    );
    const mode: 'hard' | 'soft' = hardDelete ? 'hard' : 'soft';
    try {
      await deleteAdminUser(user.id, mode);
      if (mode === 'soft') {
        setItems((prev) =>
          prev.map((item) =>
            item.id === user.id ? { ...item, profile: { ...item.profile, is_active: false } } : item
          )
        );
        addToast('Pengguna dinonaktifkan', 'success');
      } else {
        setItems((prev) => prev.filter((item) => item.id !== user.id));
        setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
        addToast('Pengguna berhasil dihapus', 'success');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus pengguna';
      addToast(message, 'error');
    }
  };

  const handleResetPassword = async (user: AdminUserItem) => {
    const newPassword = window.prompt(`Masukkan password baru untuk ${user.email} (minimal 8 karakter)`, '');
    if (newPassword == null) return;
    if (newPassword.length < 8) {
      addToast('Password minimal 8 karakter', 'error');
      return;
    }
    try {
      const updated = await updateAdminUser(user.id, { password: newPassword });
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      addToast('Password berhasil diperbarui', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengatur ulang password';
      addToast(message, 'error');
    }
  };

  const handleChangeFilter = (patch: Partial<typeof filters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      const shouldResetPage =
        patch.page === undefined && (patch.role !== undefined || patch.status !== undefined || patch.limit !== undefined);
      if (shouldResetPage) {
        next.page = 1;
      }
      return next;
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadUsers();
      addToast('Data pengguna diperbarui', 'success');
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : 'Gagal memuat ulang data';
      addToast(message, 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const toolbarSubtitle = useMemo(() => {
    if (loading) return 'Memuat pengguna…';
    if (error) return error;
    if (!items.length) return 'Tidak ada pengguna yang cocok';
    return `${items.length} pengguna ditampilkan`;
  }, [loading, error, items.length]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Manajemen Pengguna</h1>
          <p className="text-sm text-muted-foreground">Kelola akses pengguna aplikasi HematWoi.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border/60 bg-background px-4 text-sm font-semibold text-muted-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Muat ulang
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Tambah Pengguna
          </button>
        </div>
      </header>

      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <label className="flex flex-1 items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Cari berdasarkan email, nama, atau username"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setFilters((prev) => ({ ...prev, page: 1 }));
              }}
              className="h-10 flex-1 bg-transparent text-sm focus:outline-none"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filters.role}
                onChange={(event) => handleChangeFilter({ role: event.target.value as typeof filters.role, page: 1 })}
                className="bg-transparent text-sm focus:outline-none"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm">
              <select
                value={filters.status}
                onChange={(event) => handleChangeFilter({ status: event.target.value as typeof filters.status, page: 1 })}
                className="bg-transparent text-sm focus:outline-none"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm">
              <select
                value={filters.limit}
                onChange={(event) => handleChangeFilter({ limit: Number(event.target.value), page: 1 })}
                className="bg-transparent text-sm focus:outline-none"
              >
                {LIMIT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option} / halaman
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs font-medium text-muted-foreground">{toolbarSubtitle}</div>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <UserTable
        items={items}
        loading={loading}
        onToggleActive={handleToggleActive}
        onDelete={handleDelete}
        onEdit={handleOpenEdit}
        onResetPassword={handleResetPassword}
      />

      <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
        <div>
          Halaman {pagination.page} • Menampilkan {items.length} dari {pagination.total} pengguna
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleChangeFilter({ page: Math.max(1, pagination.page - 1) })}
            disabled={pagination.page <= 1 || loading}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-border/60 px-3 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Sebelumnya
          </button>
          <button
            type="button"
            onClick={() => {
              if (pagination.has_more || (pagination.total && pagination.page * pagination.limit < pagination.total)) {
                handleChangeFilter({ page: pagination.page + 1 });
              }
            }}
            disabled={!pagination.has_more && pagination.page * pagination.limit >= pagination.total}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-border/60 px-3 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Berikutnya
          </button>
        </div>
      </div>

      <UserFormModal
        open={showForm}
        mode={formMode}
        initialUser={selectedUser ?? undefined}
        onClose={() => setShowForm(false)}
        onSubmit={handleSubmitForm}
        loading={formSubmitting}
      />
    </div>
  );
}

export default function UsersPage() {
  return (
    <AdminGuard>
      <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-background px-4 pb-16 pt-10 text-foreground md:px-8">
        <div className="mx-auto max-w-6xl">
          <UsersContent />
        </div>
      </div>
    </AdminGuard>
  );
}
