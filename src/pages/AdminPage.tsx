import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdminAccessLevel,
  AdminRouteAccess,
  AdminUserProfile,
  createUserProfile,
  deleteRoute,
  getAppDescription,
  listRoutes,
  listUsers,
  setAppDescription,
  updateUserProfile,
  upsertRoute,
} from '../lib/adminApi';
import { useToast } from '../context/ToastContext';

const ACCESS_LEVEL_OPTIONS: AdminAccessLevel[] = ['public', 'user', 'admin'];
const USER_ROLES: Array<'user' | 'admin'> = ['user', 'admin'];

type TabKey = 'access' | 'users' | 'settings' | 'audit';

type RouteDraft = {
  route: string;
  access_level: AdminAccessLevel;
  is_enabled: boolean;
};

type UserDraft = {
  role: 'user' | 'admin';
  is_active: boolean;
};

type AuditEntry = {
  id: string;
  type: 'route' | 'user';
  description: string;
  timestamp: string | null;
};

const baseInputClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm font-medium text-slate-800 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-700';
const baseButtonClass =
  'inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200';

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const knobClass = [
    'absolute left-0 top-0 h-6 w-6 rounded-full bg-white shadow-sm transition-transform',
    checked ? 'translate-x-5' : 'translate-x-0',
  ].join(' ');
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        checked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      disabled={disabled}
    >
      <span className="sr-only">Toggle</span>
      <span className={knobClass} />
    </button>
  );
}

function formatRelativeDate(value: string | null, formatter: Intl.DateTimeFormat) {
  if (!value) return 'snapshot';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'snapshot';
    }
    return formatter.format(date);
  } catch {
    return 'snapshot';
  }
}

export default function AdminPage() {
  const toast = useToast();
  const addToast = toast?.addToast;

  const [activeTab, setActiveTab] = useState<TabKey>('access');

  const [routes, setRoutes] = useState<AdminRouteAccess[]>([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [routeDrafts, setRouteDrafts] = useState<Record<string, RouteDraft>>({});
  const [routeSaving, setRouteSaving] = useState<string | null>(null);
  const [routeDeleting, setRouteDeleting] = useState<string | null>(null);
  const [newRoute, setNewRoute] = useState<RouteDraft>({ route: '', access_level: 'public', is_enabled: true });

  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userDrafts, setUserDrafts] = useState<Record<string, UserDraft>>({});
  const [userSaving, setUserSaving] = useState<string | null>(null);
  const [newUser, setNewUser] = useState<{ id: string; username: string; role: 'user' | 'admin'; is_active: boolean }>(
    {
      id: '',
      username: '',
      role: 'user',
      is_active: true,
    },
  );

  const [description, setDescription] = useState('');
  const [descriptionLoading, setDescriptionLoading] = useState(true);
  const [descriptionSaving, setDescriptionSaving] = useState(false);

  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditSnapshot, setAuditSnapshot] = useState(false);
  const [auditFetchedAt, setAuditFetchedAt] = useState<string | null>(null);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [],
  );

  const loadRoutes = useCallback(async () => {
    setRoutesLoading(true);
    try {
      const rows = await listRoutes();
      setRoutes(rows);
      setRouteDrafts({});
    } catch (error) {
      addToast?.(error instanceof Error ? error.message : 'Gagal memuat akses route.', 'error');
      setRoutes([]);
    } finally {
      setRoutesLoading(false);
    }
  }, [addToast]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const rows = await listUsers();
      setUsers(rows);
      setUserDrafts({});
    } catch (error) {
      addToast?.(error instanceof Error ? error.message : 'Gagal memuat pengguna.', 'error');
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [addToast]);

  const loadDescription = useCallback(async () => {
    setDescriptionLoading(true);
    try {
      const text = await getAppDescription();
      setDescription(text);
    } catch (error) {
      addToast?.(error instanceof Error ? error.message : 'Gagal memuat deskripsi aplikasi.', 'error');
      setDescription('');
    } finally {
      setDescriptionLoading(false);
    }
  }, [addToast]);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const [routeData, userData] = await Promise.all([listRoutes(), listUsers()]);
      const entries: AuditEntry[] = [];
      for (const item of routeData) {
        entries.push({
          id: `route-${item.id}`,
          type: 'route',
          description: `Route ${item.route} • akses ${item.access_level} • ${item.is_enabled ? 'aktif' : 'nonaktif'}`,
          timestamp: item.updated_at ?? null,
        });
      }
      for (const item of userData) {
        const identifier = item.username || item.email || item.id;
        entries.push({
          id: `user-${item.id}`,
          type: 'user',
          description: `User ${identifier} • role ${item.role} • ${item.is_active ? 'aktif' : 'nonaktif'}`,
          timestamp: item.updated_at ?? item.created_at ?? null,
        });
      }
      entries.sort((a, b) => {
        const timeA = a.timestamp ? Date.parse(a.timestamp) : 0;
        const timeB = b.timestamp ? Date.parse(b.timestamp) : 0;
        return timeB - timeA;
      });
      const limited = entries.slice(0, 10);
      const snapshot = limited.every((entry) => !entry.timestamp);
      setAuditEntries(limited);
      setAuditSnapshot(snapshot);
      setAuditFetchedAt(new Date().toISOString());
    } catch (error) {
      addToast?.(error instanceof Error ? error.message : 'Gagal memuat audit log.', 'error');
      setAuditEntries([]);
      setAuditSnapshot(true);
      setAuditFetchedAt(new Date().toISOString());
    } finally {
      setAuditLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadRoutes();
    loadUsers();
    loadDescription();
  }, [loadRoutes, loadUsers, loadDescription]);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAudit();
    }
  }, [activeTab, loadAudit, auditRefreshKey]);

  const handleRouteDraftChange = useCallback(
    (id: string | number, field: keyof RouteDraft, value: string | boolean) => {
      const key = String(id);
      setRouteDrafts((prev) => {
        const base = prev[key] ?? routes.find((item) => String(item.id) === key);
        const current: RouteDraft = {
          route: base?.route ?? '',
          access_level: base?.access_level ?? 'public',
          is_enabled: base?.is_enabled ?? true,
        };
        return {
          ...prev,
          [key]: { ...current, [field]: value } as RouteDraft,
        };
      });
    },
    [routes],
  );

  const handleRouteSave = useCallback(
    async (item: AdminRouteAccess) => {
      const key = String(item.id);
      const draft = routeDrafts[key] ?? {
        route: item.route,
        access_level: item.access_level,
        is_enabled: item.is_enabled,
      };
      const trimmedRoute = draft.route.trim();
      if (!trimmedRoute) {
        addToast?.('Route wajib diisi.', 'error');
        return;
      }
      if (!trimmedRoute.startsWith('/')) {
        addToast?.('Route harus diawali dengan /.', 'error');
        return;
      }
      const duplicate = routes.some((r) => r.id !== item.id && r.route.trim() === trimmedRoute);
      if (duplicate) {
        addToast?.('Route sudah terdaftar.', 'error');
        return;
      }
      setRouteSaving(key);
      try {
        await upsertRoute({
          route: trimmedRoute,
          access_level: draft.access_level,
          is_enabled: draft.is_enabled,
        });
        if (trimmedRoute !== item.route) {
          await deleteRoute(item.id);
        }
        addToast?.('Akses route tersimpan.', 'success');
        setAuditRefreshKey((value) => value + 1);
        await loadRoutes();
      } catch (error) {
        addToast?.(error instanceof Error ? error.message : 'Gagal menyimpan route.', 'error');
      } finally {
        setRouteSaving(null);
      }
    },
    [addToast, loadRoutes, routeDrafts, routes],
  );

  const handleRouteDelete = useCallback(
    async (item: AdminRouteAccess) => {
      const key = String(item.id);
      setRouteDeleting(key);
      try {
        await deleteRoute(item.id);
        addToast?.('Route dihapus.', 'success');
        setAuditRefreshKey((value) => value + 1);
        await loadRoutes();
      } catch (error) {
        addToast?.(error instanceof Error ? error.message : 'Gagal menghapus route.', 'error');
      } finally {
        setRouteDeleting(null);
      }
    },
    [addToast, loadRoutes],
  );

  const handleNewRouteChange = useCallback((event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setNewRoute((prev) => {
      if (name === 'route') {
        return { ...prev, route: value };
      }
      if (name === 'access_level') {
        return { ...prev, access_level: value as AdminAccessLevel };
      }
      return prev;
    });
  }, []);

  const handleNewRouteToggle = useCallback((value: boolean) => {
    setNewRoute((prev) => ({ ...prev, is_enabled: value }));
  }, []);

  const handleNewRouteSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedRoute = newRoute.route.trim();
      if (!trimmedRoute) {
        addToast?.('Route wajib diisi.', 'error');
        return;
      }
      if (!trimmedRoute.startsWith('/')) {
        addToast?.('Route harus diawali dengan /.', 'error');
        return;
      }
      const duplicate = routes.some((item) => item.route.trim() === trimmedRoute);
      if (duplicate) {
        addToast?.('Route sudah terdaftar.', 'error');
        return;
      }
      try {
        await upsertRoute({
          route: trimmedRoute,
          access_level: newRoute.access_level,
          is_enabled: newRoute.is_enabled,
        });
        addToast?.('Route baru ditambahkan.', 'success');
        setAuditRefreshKey((value) => value + 1);
        setNewRoute({ route: '', access_level: 'public', is_enabled: true });
        await loadRoutes();
      } catch (error) {
        addToast?.(error instanceof Error ? error.message : 'Gagal menambah route.', 'error');
      }
    },
    [addToast, loadRoutes, newRoute, routes],
  );

  const handleUserDraftChange = useCallback(
    (id: string, field: keyof UserDraft, value: string | boolean) => {
      setUserDrafts((prev) => {
        const base = prev[id] ?? users.find((item) => item.id === id);
        const current: UserDraft = {
          role: base?.role ?? 'user',
          is_active: base?.is_active ?? true,
        };
        return {
          ...prev,
          [id]: { ...current, [field]: value } as UserDraft,
        };
      });
    },
    [users],
  );

  const handleUserSave = useCallback(
    async (item: AdminUserProfile) => {
      const draft = userDrafts[item.id] ?? { role: item.role, is_active: item.is_active };
      if (!USER_ROLES.includes(draft.role)) {
        addToast?.('Role tidak valid.', 'error');
        return;
      }
      const updates: Partial<{ role: 'user' | 'admin'; is_active: boolean }> = {};
      if (draft.role !== item.role) {
        updates.role = draft.role;
      }
      if (draft.is_active !== item.is_active) {
        updates.is_active = draft.is_active;
      }
      if (Object.keys(updates).length === 0) {
        addToast?.('Tidak ada perubahan untuk disimpan.', 'info');
        return;
      }
      setUserSaving(item.id);
      try {
        await updateUserProfile(item.id, updates);
        addToast?.('Profil pengguna diperbarui.', 'success');
        setAuditRefreshKey((value) => value + 1);
        await loadUsers();
      } catch (error) {
        addToast?.(error instanceof Error ? error.message : 'Gagal menyimpan profil.', 'error');
      } finally {
        setUserSaving(null);
      }
    },
    [addToast, loadUsers, userDrafts],
  );

  const handleNewUserChange = useCallback((event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setNewUser((prev) => {
      if (name === 'id') {
        return { ...prev, id: value };
      }
      if (name === 'username') {
        return { ...prev, username: value };
      }
      if (name === 'role') {
        return { ...prev, role: value as 'user' | 'admin' };
      }
      return prev;
    });
  }, []);

  const handleNewUserToggle = useCallback((value: boolean) => {
    setNewUser((prev) => ({ ...prev, is_active: value }));
  }, []);

  const handleNewUserSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!USER_ROLES.includes(newUser.role)) {
        addToast?.('Role tidak valid.', 'error');
        return;
      }
      try {
        const id = newUser.id.trim();
        const username = newUser.username.trim();
        await createUserProfile({
          id: id || undefined,
          username: username || undefined,
          role: newUser.role,
          is_active: newUser.is_active,
        });
        addToast?.('Profil pengguna dibuat.', 'success');
        setAuditRefreshKey((value) => value + 1);
        setNewUser({ id: '', username: '', role: 'user', is_active: true });
        await loadUsers();
      } catch (error) {
        addToast?.(error instanceof Error ? error.message : 'Gagal membuat profil.', 'error');
      }
    },
    [addToast, loadUsers, newUser],
  );

  const handleDescriptionSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setDescriptionSaving(true);
      try {
        await setAppDescription(description.trim());
        addToast?.('Deskripsi aplikasi diperbarui.', 'success');
        setAuditRefreshKey((value) => value + 1);
      } catch (error) {
        addToast?.(error instanceof Error ? error.message : 'Gagal menyimpan deskripsi.', 'error');
      } finally {
        setDescriptionSaving(false);
      }
    },
    [addToast, description],
  );

  const renderRoutes = () => (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/70 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/80 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3">Route</th>
              <th className="px-4 py-3">Access Level</th>
              <th className="px-4 py-3">Aktif</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {routesLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6">
                  <div className="h-6 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                </td>
              </tr>
            ) : routes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Belum ada konfigurasi akses.
                </td>
              </tr>
            ) : (
              routes.map((item) => {
                const key = String(item.id);
                const draft = routeDrafts[key] ?? item;
                const saving = routeSaving === key;
                const deleting = routeDeleting === key;
                return (
                  <tr key={key}>
                    <td className="px-4 py-3">
                      <input
                        name="route"
                        value={draft.route}
                        onChange={(event) => handleRouteDraftChange(item.id, 'route', event.target.value)}
                        className={baseInputClass}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        name="access_level"
                        value={draft.access_level}
                        onChange={(event) => handleRouteDraftChange(item.id, 'access_level', event.target.value)}
                        className={baseInputClass}
                      >
                        {ACCESS_LEVEL_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <Toggle
                        checked={draft.is_enabled}
                        onChange={(value) => handleRouteDraftChange(item.id, 'is_enabled', value)}
                        disabled={saving || deleting}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          className={baseButtonClass}
                          onClick={() => handleRouteSave(item)}
                          disabled={saving || deleting}
                        >
                          {saving ? 'Menyimpan…' : 'Simpan'}
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/60 dark:text-rose-200"
                          onClick={() => handleRouteDelete(item)}
                          disabled={saving || deleting}
                        >
                          {deleting ? 'Menghapus…' : 'Hapus'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <form
        onSubmit={handleNewRouteSubmit}
        className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 shadow-inner transition dark:border-slate-700 dark:bg-slate-900/60"
      >
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Tambah Route Baru</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <span>Route</span>
            <input
              name="route"
              value={newRoute.route}
              onChange={handleNewRouteChange}
              className={baseInputClass}
              placeholder="/contoh"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <span>Access Level</span>
            <select name="access_level" value={newRoute.access_level} onChange={handleNewRouteChange} className={baseInputClass}>
              {ACCESS_LEVEL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <span>Status</span>
            <Toggle checked={newRoute.is_enabled} onChange={handleNewRouteToggle} />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button type="submit" className={baseButtonClass}>
            Simpan Route
          </button>
        </div>
      </form>
    </div>
  );

  const renderUsers = () => (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/70 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/80 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Aktif</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {usersLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6">
                  <div className="h-6 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Belum ada profil pengguna.
                </td>
              </tr>
            ) : (
              users.map((item) => {
                const draft = userDrafts[item.id] ?? { role: item.role, is_active: item.is_active };
                const saving = userSaving === item.id;
                const label = item.username || item.email || item.id;
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{label}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{item.id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        name="role"
                        value={draft.role}
                        onChange={(event) => handleUserDraftChange(item.id, 'role', event.target.value)}
                        className={baseInputClass}
                      >
                        {USER_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <Toggle
                        checked={draft.is_active}
                        onChange={(value) => handleUserDraftChange(item.id, 'is_active', value)}
                        disabled={saving}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className={baseButtonClass}
                          onClick={() => handleUserSave(item)}
                          disabled={saving}
                        >
                          {saving ? 'Menyimpan…' : 'Simpan'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <form
        onSubmit={handleNewUserSubmit}
        className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 shadow-inner transition dark:border-slate-700 dark:bg-slate-900/60"
      >
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Tambah Profil Pengguna</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <span>ID Pengguna (opsional)</span>
            <input name="id" value={newUser.id} onChange={handleNewUserChange} className={baseInputClass} placeholder="UUID" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <span>Username (opsional)</span>
            <input
              name="username"
              value={newUser.username}
              onChange={handleNewUserChange}
              className={baseInputClass}
              placeholder="username"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <span>Role</span>
            <select name="role" value={newUser.role} onChange={handleNewUserChange} className={baseInputClass}>
              {USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <span>Status</span>
            <Toggle checked={newUser.is_active} onChange={handleNewUserToggle} />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button type="submit" className={baseButtonClass}>
            Simpan Profil
          </button>
        </div>
      </form>
    </div>
  );

  const renderSettings = () => (
    <form
      onSubmit={handleDescriptionSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm ring-1 ring-slate-100 dark:border-slate-800 dark:bg-slate-900/70 dark:ring-slate-800"
    >
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
        <span>Deskripsi Aplikasi</span>
        {descriptionLoading ? (
          <div className="h-32 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
        ) : (
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-[180px] w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-3 text-sm text-slate-800 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-700"
            placeholder="Tulis deskripsi aplikasi di sini"
          />
        )}
      </label>
      <div className="flex justify-end">
        <button type="submit" className={baseButtonClass} disabled={descriptionSaving || descriptionLoading}>
          {descriptionSaving ? 'Menyimpan…' : 'Simpan Deskripsi'}
        </button>
      </div>
    </form>
  );

  const renderAudit = () => (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm ring-1 ring-slate-100 dark:border-slate-800 dark:bg-slate-900/70 dark:ring-slate-800">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Aktivitas Terbaru</h3>
        {auditFetchedAt && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {`Diambil ${formatRelativeDate(auditFetchedAt, dateFormatter)}`}
          </span>
        )}
      </div>
      {auditSnapshot && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
          Menampilkan snapshot data terkini.
        </p>
      )}
      <div className="mt-4 space-y-3">
        {auditLoading ? (
          <div className="space-y-2">
            <div className="h-5 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ) : auditEntries.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada aktivitas terbaru.</p>
        ) : (
          auditEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm transition dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {entry.type === 'route' ? 'Route' : 'User'}
              </span>
              <span className="mt-1 font-medium text-slate-800 dark:text-slate-100">{entry.description}</span>
              <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {formatRelativeDate(entry.timestamp, dateFormatter)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Admin Panel</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Kelola akses aplikasi, pengguna, dan pengaturan umum.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 rounded-full bg-slate-100/60 p-1 dark:bg-slate-800/60">
        {(
          [
            { key: 'access', label: 'Access Control' },
            { key: 'users', label: 'Users' },
            { key: 'settings', label: 'App Settings' },
            { key: 'audit', label: 'Audit Log' },
          ] as Array<{ key: TabKey; label: string }>
        ).map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`h-11 rounded-full px-5 text-sm font-semibold transition ${
                active
                  ? 'bg-white text-slate-900 shadow dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-700/60'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="rounded-3xl border border-transparent bg-white/70 p-6 shadow-xl ring-2 ring-slate-100 dark:bg-slate-900/70 dark:ring-slate-800">
        {activeTab === 'access' && renderRoutes()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'settings' && renderSettings()}
        {activeTab === 'audit' && renderAudit()}
      </div>
    </div>
  );
}
