import { useCallback, useEffect, useMemo, useState } from 'react';
import Page from '../../layout/Page.jsx';
import PageHeader from '../../layout/PageHeader.jsx';
import Section from '../../layout/Section.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import type {
  AdminUserItem,
  ListUsersResult,
  CreateUserPayload,
  UpdateUserPayload,
} from '../../lib/api/adminUsers';
import { createUser, deleteUser, listUsers, updateUser } from '../../lib/api/adminUsers';
import UserTable from '../../components/admin/users/UserTable';
import UserFormModal from '../../components/admin/users/UserFormModal';
import DeleteUserDialog from '../../components/admin/users/DeleteUserDialog';

const DEFAULT_LIMIT = 20;

type FiltersState = {
  q: string;
  role: 'all' | 'admin' | 'user';
  status: 'all' | 'active' | 'inactive';
  order: 'created_at.desc' | 'created_at.asc' | 'last_sign_in_at.desc';
};

const INITIAL_FILTERS: FiltersState = {
  q: '',
  role: 'all',
  status: 'all',
  order: 'created_at.desc',
};

type DeleteMode = 'soft' | 'hard';

type ModalMode = 'create' | 'edit';

type FormSubmitPayload = (CreateUserPayload & UpdateUserPayload);

export default function UsersPage() {
  const { addToast } = useToast();
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<ListUsersResult['pagination'] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null);
  const [forcePassword, setForcePassword] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 400);
    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [searchInput]);

  useEffect(() => {
    setFilters((prev) => {
      if (prev.q === debouncedSearch) return prev;
      return { ...prev, q: debouncedSearch };
    });
  }, [debouncedSearch]);

  const queryParams = useMemo(() => {
    return {
      q: filters.q || undefined,
      role: filters.role === 'all' ? undefined : filters.role,
      status: filters.status === 'all' ? undefined : filters.status,
      order: filters.order,
      limit: DEFAULT_LIMIT,
    } as const;
  }, [filters]);

  const loadUsers = useCallback(
    async (cursor?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const result = await listUsers({ ...queryParams, cursor: cursor ?? undefined });
        setUsers(result.items);
        setPagination(result.pagination);
      } catch (err) {
        console.error('Failed to load admin users', err);
        setUsers([]);
        setPagination(null);
        setError(err instanceof Error ? err.message : 'Gagal memuat daftar pengguna');
      } finally {
        setLoading(false);
      }
    },
    [queryParams]
  );

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleOpenCreate = () => {
    setModalMode('create');
    setSelectedUser(null);
    setForcePassword(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (user: AdminUserItem, withPassword = false) => {
    setModalMode('edit');
    setSelectedUser(user);
    setForcePassword(withPassword);
    setModalOpen(true);
  };

  const handleSubmitForm = async (payload: FormSubmitPayload) => {
    setModalSubmitting(true);
    try {
      if (modalMode === 'create') {
        await createUser(payload);
        addToast('Pengguna berhasil dibuat', 'success');
        setModalOpen(false);
        await loadUsers();
      } else if (selectedUser) {
        const updated = await updateUser(selectedUser.id, payload);
        setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setSelectedUser(updated);
        addToast('Pengguna berhasil diperbarui', 'success');
        setModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to submit admin user form', err);
      addToast(err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan pengguna', 'error');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleToggleActive = async (user: AdminUserItem, next: boolean) => {
    setTogglingUserId(user.id);
    setUsers((prev) =>
      prev.map((item) => (item.id === user.id ? { ...item, profile: { ...item.profile, is_active: next } } : item))
    );
    try {
      await updateUser(user.id, { profile: { is_active: next } });
      addToast(next ? 'Pengguna diaktifkan' : 'Pengguna dinonaktifkan', 'success');
    } catch (err) {
      addToast('Gagal memperbarui status pengguna', 'error');
      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id ? { ...item, profile: { ...item.profile, is_active: !next } } : item
        )
      );
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleDeleteRequest = (user: AdminUserItem) => {
    setSelectedUser(user);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async (mode: DeleteMode) => {
    if (!selectedUser) return;
    setDeleting(true);
    try {
      await deleteUser(selectedUser.id, { mode });
      addToast(mode === 'hard' ? 'Pengguna dihapus permanen' : 'Pengguna dinonaktifkan', 'success');
      setDeleteOpen(false);
      await loadUsers();
    } catch (err) {
      console.error('Failed to delete admin user', err);
      addToast(err instanceof Error ? err.message : 'Gagal menghapus pengguna', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleFilterChange = <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const canNext = Boolean(pagination?.nextCursor) && !loading;
  const canPrev = Boolean(pagination?.prevCursor) && !loading;

  return (
    <Page>
      <PageHeader
        title="Kelola Pengguna"
        description="Tambah, edit, dan kelola hak akses pengguna HematWoi."
      >
        <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>
          Tambah Pengguna
        </button>
      </PageHeader>

      <Section first>
        <div className="flex flex-col gap-4 rounded-3xl border border-border-subtle bg-surface p-5">
          <div className="grid gap-3 sm:grid-cols-4 sm:items-end">
            <div className="sm:col-span-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-text">Cari pengguna</span>
                <input
                  type="search"
                  className="input"
                  placeholder="Cari email, nama, atau username"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
              </label>
            </div>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-text">Role</span>
              <select
                className="input"
                value={filters.role}
                onChange={(event) => handleFilterChange('role', event.target.value as FiltersState['role'])}
              >
                <option value="all">Semua role</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-text">Status</span>
              <select
                className="input"
                value={filters.status}
                onChange={(event) => handleFilterChange('status', event.target.value as FiltersState['status'])}
              >
                <option value="all">Semua status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Tidak aktif</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm sm:col-span-2">
              <span className="font-medium text-text">Urutkan</span>
              <select
                className="input"
                value={filters.order}
                onChange={(event) => handleFilterChange('order', event.target.value as FiltersState['order'])}
              >
                <option value="created_at.desc">Terbaru dibuat</option>
                <option value="created_at.asc">Terlama dibuat</option>
                <option value="last_sign_in_at.desc">Login terbaru</option>
              </select>
            </label>
          </div>
          {error ? (
            <div className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : null}
        </div>
      </Section>

      <Section>
        <UserTable
          users={users}
          loading={loading}
          pagination={pagination ?? undefined}
          onEdit={(user) => handleOpenEdit(user, false)}
          onRequestPasswordReset={(user) => handleOpenEdit(user, true)}
          onToggleActive={handleToggleActive}
          onDelete={handleDeleteRequest}
          onNextPage={() => (pagination?.nextCursor ? loadUsers(pagination.nextCursor) : undefined)}
          onPrevPage={() => (pagination?.prevCursor ? loadUsers(pagination.prevCursor) : undefined)}
          canNext={canNext}
          canPrev={canPrev}
          togglingUserId={togglingUserId}
        />
      </Section>

      <UserFormModal
        open={modalOpen}
        mode={modalMode}
        user={selectedUser}
        forcePassword={forcePassword}
        submitting={modalSubmitting}
        onClose={() => {
          setModalOpen(false);
          setForcePassword(false);
        }}
        onSubmit={handleSubmitForm}
      />

      <DeleteUserDialog
        open={deleteOpen}
        user={selectedUser}
        deleting={deleting}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </Page>
  );
}
