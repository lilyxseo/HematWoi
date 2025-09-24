import type { ReactNode } from 'react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  createUserProfile,
  deleteRoute,
  getAppDescription,
  listRoutes,
  listUsers,
  setAppDescription,
  updateUserProfile,
  upsertRoute,
  type RouteAccessRecord,
  type UserProfileRecord,
} from '../lib/adminApi';
import { useToast } from '../context/ToastContext.jsx';

type TabKey = 'access' | 'users' | 'settings' | 'audit';

type RouteDraft = RouteAccessRecord;

type UserDraft = UserProfileRecord;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'access', label: 'Access Control' },
  { key: 'users', label: 'Users' },
  { key: 'settings', label: 'App Settings' },
  { key: 'audit', label: 'Audit Log' },
];

const ACCESS_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
] as const;

function Switch({
  checked,
  onChange,
  id,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  id?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-6 w-11 items-center rounded-full transition',
        checked ? 'bg-brand' : 'bg-border'
      )}
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span
        className={clsx(
          'inline-block h-5 w-5 transform rounded-full bg-white transition',
          checked ? 'translate-x-5' : 'translate-x-1'
        )}
      />
    </button>
  );
}

function SectionCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-1/70 p-6 ring-2 ring-border/40 shadow-sm">{children}</div>
  );
}

function SkeletonTable({ rows = 4, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <div key={colIndex} className="h-11 animate-pulse rounded-xl bg-border/50" />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('access');

  const [routes, setRoutes] = useState<RouteAccessRecord[]>([]);
  const [routeDrafts, setRouteDrafts] = useState<RouteDraft[]>([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [routeSavingId, setRouteSavingId] = useState<string | null>(null);

  const [users, setUsers] = useState<UserProfileRecord[]>([]);
  const [userDrafts, setUserDrafts] = useState<UserDraft[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSavingId, setUserSavingId] = useState<string | null>(null);

  const [newRoute, setNewRoute] = useState({
    route: '',
    access_level: 'public' as RouteAccessRecord['access_level'],
    is_enabled: true,
  });

  const [newUser, setNewUser] = useState({
    id: '',
    username: '',
    role: 'user' as UserProfileRecord['role'],
    is_active: true,
  });

  const [description, setDescription] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [descriptionLoading, setDescriptionLoading] = useState(true);
  const [savingDescription, setSavingDescription] = useState(false);

  const loadRoutes = useCallback(async () => {
    setRoutesLoading(true);
    try {
      const data = await listRoutes();
      setRoutes(data);
      setRouteDrafts(data.map((item) => ({ ...item })));
    } catch (error) {
      addToast('Gagal memuat daftar route', 'error');
    } finally {
      setRoutesLoading(false);
    }
  }, [addToast]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
      setUserDrafts(data.map((item) => ({ ...item })));
    } catch (error) {
      addToast('Gagal memuat daftar pengguna', 'error');
    } finally {
      setUsersLoading(false);
    }
  }, [addToast]);

  const loadDescription = useCallback(async () => {
    setDescriptionLoading(true);
    try {
      const text = await getAppDescription();
      setDescription(text);
      setDescriptionDraft(text);
    } catch (error) {
      addToast('Gagal memuat deskripsi aplikasi', 'error');
    } finally {
      setDescriptionLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadRoutes();
    void loadUsers();
    void loadDescription();
  }, [loadRoutes, loadUsers, loadDescription]);

  const handleRouteChange = (
    id: string,
    field: 'route' | 'access_level' | 'is_enabled',
    value: string | boolean
  ) => {
    setRouteDrafts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleUserChange = (
    id: string,
    field: 'role' | 'is_active',
    value: string | boolean
  ) => {
    setUserDrafts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSaveRoute = async (draft: RouteDraft) => {
    const trimmedRoute = draft.route.trim();
    if (!trimmedRoute) {
      addToast('Route tidak boleh kosong', 'error');
      return;
    }

    if (!ACCESS_OPTIONS.some((option) => option.value === draft.access_level)) {
      addToast('Level akses tidak valid', 'error');
      return;
    }

    setRouteSavingId(draft.id);
    try {
      const saved = await upsertRoute({
        id: draft.id,
        route: trimmedRoute,
        access_level: draft.access_level,
        is_enabled: draft.is_enabled,
      });
      setRoutes((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        const updated = exists
          ? prev.map((item) => (item.id === saved.id ? saved : item))
          : [...prev, saved];
        return [...updated].sort((a, b) => a.route.localeCompare(b.route));
      });
      setRouteDrafts((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        const updated = exists
          ? prev.map((item) => (item.id === saved.id ? saved : item))
          : [...prev, saved];
        return [...updated].sort((a, b) => a.route.localeCompare(b.route));
      });
      addToast('Route berhasil disimpan', 'success');
    } catch (error) {
      addToast('Gagal menyimpan route', 'error');
    } finally {
      setRouteSavingId(null);
    }
  };

  const handleDeleteRoute = async (draft: RouteDraft) => {
    if (!draft.id) return;
    const confirmDelete = window.confirm(`Hapus route ${draft.route}?`);
    if (!confirmDelete) return;
    setRouteSavingId(draft.id);
    try {
      await deleteRoute(draft.id);
      setRoutes((prev) => prev.filter((item) => item.id !== draft.id));
      setRouteDrafts((prev) => prev.filter((item) => item.id !== draft.id));
      addToast('Route berhasil dihapus', 'success');
    } catch (error) {
      addToast('Gagal menghapus route', 'error');
    } finally {
      setRouteSavingId(null);
    }
  };

  const handleAddRoute = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedRoute = newRoute.route.trim();
    if (!trimmedRoute) {
      addToast('Route baru wajib diisi', 'error');
      return;
    }

    if (!ACCESS_OPTIONS.some((option) => option.value === newRoute.access_level)) {
      addToast('Level akses tidak valid', 'error');
      return;
    }

    if (routes.some((item) => item.route === trimmedRoute)) {
      addToast('Route sudah terdaftar', 'error');
      return;
    }

    if (routeDrafts.some((item) => item.route === trimmedRoute)) {
      addToast('Route sudah ada dalam daftar', 'error');
      return;
    }

    setRouteSavingId('new');
    try {
      const saved = await upsertRoute({
        route: trimmedRoute,
        access_level: newRoute.access_level,
        is_enabled: newRoute.is_enabled,
      });
      setRoutes((prev) => [...prev, saved].sort((a, b) => a.route.localeCompare(b.route)));
      setRouteDrafts((prev) => [...prev, saved].sort((a, b) => a.route.localeCompare(b.route)));
      setNewRoute({ route: '', access_level: 'public', is_enabled: true });
      addToast('Route baru berhasil ditambahkan', 'success');
    } catch (error) {
      addToast('Gagal menambahkan route baru', 'error');
    } finally {
      setRouteSavingId(null);
    }
  };

  const handleSaveUser = async (draft: UserDraft) => {
    if (!draft.id) {
      addToast('ID pengguna tidak ditemukan', 'error');
      return;
    }

    if (draft.role !== 'user' && draft.role !== 'admin') {
      addToast('Role pengguna harus user atau admin', 'error');
      return;
    }

    setUserSavingId(draft.id);
    try {
      const saved = await updateUserProfile(draft.id, {
        role: draft.role,
        is_active: draft.is_active,
      });
      setUsers((prev) => prev.map((item) => (item.id === saved.id ? saved : item)));
      setUserDrafts((prev) => prev.map((item) => (item.id === saved.id ? saved : item)));
      addToast('Profil pengguna diperbarui', 'success');
    } catch (error) {
      addToast('Gagal memperbarui profil pengguna', 'error');
    } finally {
      setUserSavingId(null);
    }
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = newUser.id.trim();
    const username = newUser.username.trim() || undefined;
    const role = newUser.role;

    if (role !== 'user' && role !== 'admin') {
      addToast('Role pengguna harus user atau admin', 'error');
      return;
    }

    if (!id) {
      addToast('ID pengguna wajib diisi', 'error');
      return;
    }

    setUserSavingId('new');
    try {
      const created = await createUserProfile({
        id,
        username,
        role,
        is_active: newUser.is_active,
      });
      setUsers((prev) => [...prev, created]);
      setUserDrafts((prev) => [...prev, created]);
      setNewUser({ id: '', username: '', role: 'user', is_active: true });
      addToast('Profil pengguna berhasil dibuat', 'success');
    } catch (error) {
      addToast('Gagal membuat profil pengguna', 'error');
    } finally {
      setUserSavingId(null);
    }
  };

  const handleSaveDescription = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingDescription(true);
    try {
      const text = descriptionDraft.trim();
      await setAppDescription(text);
      setDescription(text);
      addToast('Deskripsi aplikasi tersimpan', 'success');
    } catch (error) {
      addToast('Gagal menyimpan deskripsi aplikasi', 'error');
    } finally {
      setSavingDescription(false);
    }
  };

  const auditEntries = useMemo(() => {
    const resolveTime = (value: string | null) => {
      if (!value) return 0;
      const parsed = Date.parse(String(value));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const routeEntries = routes.map((item) => ({
      id: `route-${item.id}`,
      type: 'Access Control',
      name: item.route,
      timestamp: item.updated_at ?? item.created_at ?? null,
      detail: `${item.access_level.toUpperCase()} • ${item.is_enabled ? 'Aktif' : 'Nonaktif'}`,
    }));
    const userEntries = users.map((item) => ({
      id: `user-${item.id}`,
      type: 'User',
      name: item.username || item.email || item.id,
      timestamp: item.updated_at ?? item.created_at ?? null,
      detail: `${item.role === 'admin' ? 'Admin' : 'User'} • ${item.is_active ? 'Aktif' : 'Nonaktif'}`,
    }));
    const all = [...routeEntries, ...userEntries];
    all.sort((a, b) => {
      const aTime = resolveTime(a.timestamp);
      const bTime = resolveTime(b.timestamp);
      return bTime - aTime;
    });
    return all.slice(0, 10);
  }, [routes, users]);

  const hasAuditTimestamp = auditEntries.some((entry) => entry.timestamp);

  const renderAccessControl = () => (
    <SectionCard>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Daftar Route</h2>
          <p className="text-sm text-muted-foreground">
            Kelola hak akses setiap route aplikasi.
          </p>
        </div>
        {routesLoading ? (
          <SkeletonTable rows={4} columns={4} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-[35%] pb-3 font-medium">Route</th>
                  <th className="w-[20%] pb-3 font-medium">Level Akses</th>
                  <th className="w-[15%] pb-3 font-medium">Aktif</th>
                  <th className="pb-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {routeDrafts.map((item) => {
                  const original = routes.find((route) => route.id === item.id);
                  const isDirty =
                    !original ||
                    original.route !== item.route ||
                    original.access_level !== item.access_level ||
                    original.is_enabled !== item.is_enabled;
                  const isSaving = routeSavingId === item.id;
                  return (
                    <tr key={item.id} className="align-middle">
                      <td className="py-3 pr-4">
                        <input
                          value={item.route}
                          onChange={(event) =>
                            handleRouteChange(item.id, 'route', event.target.value)
                          }
                          className="h-11 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/60"
                          placeholder="/dashboard"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <select
                          value={item.access_level}
                          onChange={(event) =>
                            handleRouteChange(item.id, 'access_level', event.target.value)
                          }
                          className="h-11 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/60"
                        >
                          {ACCESS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={item.is_enabled}
                            onChange={(value) => handleRouteChange(item.id, 'is_enabled', value)}
                            label={`Status route ${item.route || 'tanpa nama'}`}
                          />
                          <span className="text-xs text-muted-foreground">
                            {item.is_enabled ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveRoute(item)}
                            disabled={!isDirty || isSaving}
                            className={clsx(
                              'inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition',
                              isDirty && !isSaving
                                ? 'bg-brand text-white hover:bg-brand/90'
                                : 'cursor-not-allowed bg-border text-muted-foreground'
                            )}
                          >
                            {isSaving ? 'Menyimpan…' : 'Simpan'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRoute(item)}
                            disabled={isSaving}
                            className="inline-flex h-11 items-center justify-center rounded-xl border border-danger/50 px-4 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {routeDrafts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      Belum ada data route.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <form onSubmit={handleAddRoute} className="space-y-4 rounded-xl border border-dashed border-border/60 bg-surface-1/60 p-4">
          <h3 className="text-sm font-semibold text-foreground">Tambah Route Baru</h3>
          <div className="grid gap-3 md:grid-cols-4">
            <input
              value={newRoute.route}
              onChange={(event) => setNewRoute((prev) => ({ ...prev, route: event.target.value }))}
              className="h-11 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/60"
              placeholder="/admin/fitur-baru"
            />
            <select
              value={newRoute.access_level}
              onChange={(event) =>
                setNewRoute((prev) => ({ ...prev, access_level: event.target.value as RouteAccessRecord['access_level'] }))
              }
              className="h-11 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/60"
            >
              {ACCESS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-3">
              <Switch
                checked={newRoute.is_enabled}
                onChange={(value) => setNewRoute((prev) => ({ ...prev, is_enabled: value }))}
                label="Status route baru"
              />
              <span className="text-xs text-muted-foreground">
                {newRoute.is_enabled ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={routeSavingId === 'new'}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-medium text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {routeSavingId === 'new' ? 'Menyimpan…' : 'Tambah Route'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </SectionCard>
  );

  const renderUsers = () => (
    <SectionCard>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Daftar Pengguna</h2>
          <p className="text-sm text-muted-foreground">
            Ubah role dan status aktif pengguna aplikasi.
          </p>
        </div>
        {usersLoading ? (
          <SkeletonTable rows={4} columns={4} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-[30%] pb-3 font-medium">Pengguna</th>
                  <th className="w-[20%] pb-3 font-medium">Role</th>
                  <th className="w-[20%] pb-3 font-medium">Aktif</th>
                  <th className="pb-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {userDrafts.map((item) => {
                  const original = users.find((user) => user.id === item.id);
                  const isDirty =
                    !original ||
                    original.role !== item.role ||
                    original.is_active !== item.is_active;
                  const isSaving = userSavingId === item.id;
                  return (
                    <tr key={item.id} className="align-middle">
                      <td className="py-3 pr-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{item.username || item.email || item.id}</span>
                          <span className="text-xs text-muted-foreground">ID: {item.id}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <select
                          value={item.role}
                          onChange={(event) => handleUserChange(item.id, 'role', event.target.value)}
                          className="h-11 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/60"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={item.is_active}
                            onChange={(value) => handleUserChange(item.id, 'is_active', value)}
                            label={`Status aktif ${item.username || item.email || item.id}`}
                          />
                          <span className="text-xs text-muted-foreground">
                            {item.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSaveUser(item)}
                          disabled={!isDirty || isSaving}
                          className={clsx(
                            'inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition',
                            isDirty && !isSaving
                              ? 'bg-brand text-white hover:bg-brand/90'
                              : 'cursor-not-allowed bg-border text-muted-foreground'
                          )}
                        >
                          {isSaving ? 'Menyimpan…' : 'Simpan'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {userDrafts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      Belum ada data pengguna.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <form onSubmit={handleCreateUser} className="space-y-4 rounded-xl border border-dashed border-border/60 bg-surface-1/60 p-4">
          <h3 className="text-sm font-semibold text-foreground">Tambah Profil Pengguna</h3>
          <div className="grid gap-3 md:grid-cols-4">
            <input
              value={newUser.id}
              onChange={(event) => setNewUser((prev) => ({ ...prev, id: event.target.value }))}
              className="h-11 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/60"
              placeholder="UUID auth user"
              required
            />
            <input
              value={newUser.username}
              onChange={(event) => setNewUser((prev) => ({ ...prev, username: event.target.value }))}
              className="h-11 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/60"
              placeholder="Username opsional"
            />
            <select
              value={newUser.role}
              onChange={(event) =>
                setNewUser((prev) => ({ ...prev, role: event.target.value as UserProfileRecord['role'] }))
              }
              className="h-11 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/60"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <div className="flex items-center gap-3">
              <Switch
                checked={newUser.is_active}
                onChange={(value) => setNewUser((prev) => ({ ...prev, is_active: value }))}
                label="Status aktif profil baru"
              />
              <span className="text-xs text-muted-foreground">
                {newUser.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={userSavingId === 'new'}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-medium text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {userSavingId === 'new' ? 'Menyimpan…' : 'Tambah Profil'}
            </button>
          </div>
        </form>
      </div>
    </SectionCard>
  );

  const renderSettings = () => (
    <SectionCard>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Deskripsi Aplikasi</h2>
          <p className="text-sm text-muted-foreground">
            Ubah deskripsi aplikasi yang tampil pada halaman publik.
          </p>
        </div>
        {descriptionLoading ? (
          <div className="space-y-3">
            <div className="h-6 w-40 animate-pulse rounded bg-border/60" />
            <div className="h-32 animate-pulse rounded-xl bg-border/40" />
          </div>
        ) : (
          <form onSubmit={handleSaveDescription} className="space-y-4">
            <textarea
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
              className="min-h-[160px] w-full rounded-2xl border border-border bg-surface-1 px-4 py-3 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/60"
              placeholder="Tuliskan deskripsi aplikasi di sini"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingDescription || descriptionDraft === description}
                className={clsx(
                  'inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition',
                  descriptionDraft !== description && !savingDescription
                    ? 'bg-brand text-white hover:bg-brand/90'
                    : 'cursor-not-allowed bg-border text-muted-foreground'
                )}
              >
                {savingDescription ? 'Menyimpan…' : 'Simpan Deskripsi'}
              </button>
            </div>
          </form>
        )}
      </div>
    </SectionCard>
  );

  const renderAuditLog = () => (
    <SectionCard>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Audit Log</h2>
          <p className="text-sm text-muted-foreground">
            {hasAuditTimestamp
              ? 'Riwayat perubahan terbaru pada konfigurasi aplikasi.'
              : 'Snapshot terkini dari konfigurasi aplikasi.'}
          </p>
        </div>
        {auditEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 bg-surface-1/60 p-6 text-center text-sm text-muted-foreground">
            Belum ada aktivitas yang terekam.
          </div>
        ) : (
          <ul className="space-y-4">
            {auditEntries.map((entry) => {
              const hasTimestamp = entry.timestamp && Number.isFinite(Date.parse(String(entry.timestamp)));
              const timestampLabel = hasTimestamp
                ? new Date(String(entry.timestamp)).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'Snapshot';
              return (
                <li
                  key={entry.id}
                  className="flex flex-col gap-1 rounded-xl border border-border/60 bg-surface-1/60 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                    <span>{entry.name}</span>
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {entry.type}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">{entry.detail}</div>
                  <div className="text-xs text-muted-foreground/80">{timestampLabel}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SectionCard>
  );

  return (
    <div className="space-y-6 pb-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Admin Panel</h1>
        <p className="text-sm text-muted-foreground">
          Kelola akses aplikasi, pengguna, dan pengaturan global dalam satu tempat.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
              'inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition',
              activeTab === tab.key
                ? 'bg-brand text-white shadow-lg'
                : 'bg-surface-1/70 text-muted-foreground ring-1 ring-border hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'access' && renderAccessControl()}
      {activeTab === 'users' && renderUsers()}
      {activeTab === 'settings' && renderSettings()}
      {activeTab === 'audit' && renderAuditLog()}
    </div>
  );
}
