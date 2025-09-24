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
import {
  createSidebarItem,
  deleteSidebarItem,
  listSidebarItems,
  moveSidebarItem,
  updateSidebarItem,
  type SidebarAccessLevel,
  type SidebarItemRecord,
} from '../lib/adminSidebarApi';
import { useToast } from '../context/ToastContext.jsx';

type TabKey = 'access' | 'sidebar' | 'users' | 'settings' | 'audit';

type RouteDraft = RouteAccessRecord;

type UserDraft = UserProfileRecord;

type SidebarDraft = SidebarItemRecord;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'access', label: 'Access Control' },
  { key: 'sidebar', label: 'Sidebar Menu' },
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

  const [sidebarItems, setSidebarItems] = useState<SidebarItemRecord[]>([]);
  const [sidebarDrafts, setSidebarDrafts] = useState<SidebarDraft[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [sidebarSavingId, setSidebarSavingId] = useState<string | null>(null);
  const [sidebarMovingId, setSidebarMovingId] = useState<string | null>(null);

  const [users, setUsers] = useState<UserProfileRecord[]>([]);
  const [userDrafts, setUserDrafts] = useState<UserDraft[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSavingId, setUserSavingId] = useState<string | null>(null);

  const [newRoute, setNewRoute] = useState({
    route: '',
    access_level: 'public' as RouteAccessRecord['access_level'],
    is_enabled: true,
  });

  const [newSidebarItem, setNewSidebarItem] = useState({
    title: '',
    route: '',
    access_level: 'public' as SidebarAccessLevel,
    is_enabled: true,
    icon_name: '',
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

  const normalizeSidebarRoute = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const withoutLeadingSlash = trimmed.replace(/^\/+/, '');
    return `/${withoutLeadingSlash}`;
  }, []);

  const loadSidebarItems = useCallback(async () => {
    setSidebarLoading(true);
    try {
      const items = await listSidebarItems();
      setSidebarItems(items);
      setSidebarDrafts(items.map((item) => ({ ...item })));
    } catch (error) {
      addToast('Gagal memuat menu sidebar', 'error');
    } finally {
      setSidebarLoading(false);
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
    void loadSidebarItems();
    void loadDescription();
  }, [loadRoutes, loadUsers, loadSidebarItems, loadDescription]);

  const handleRouteChange = (
    id: string,
    field: 'route' | 'access_level' | 'is_enabled',
    value: string | boolean
  ) => {
    setRouteDrafts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSidebarDraftChange = (
    id: string,
    field: 'title' | 'route' | 'access_level' | 'is_enabled' | 'icon_name',
    value: string | boolean
  ) => {
    setSidebarDrafts((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        switch (field) {
          case 'title':
            return { ...item, title: String(value) };
          case 'route':
            return { ...item, route: String(value) };
          case 'access_level':
            return { ...item, access_level: value as SidebarAccessLevel };
          case 'is_enabled':
            return { ...item, is_enabled: Boolean(value) };
          case 'icon_name':
            return { ...item, icon_name: String(value) };
          default:
            return item;
        }
      })
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

  const handleSaveSidebarItem = async (draft: SidebarDraft) => {
    const trimmedTitle = draft.title.trim();
    const normalizedRoute = normalizeSidebarRoute(draft.route);
    const iconValue = typeof draft.icon_name === 'string' ? draft.icon_name.trim() : '';

    if (!trimmedTitle) {
      addToast('Judul menu wajib diisi', 'error');
      return;
    }

    if (!normalizedRoute) {
      addToast('Route menu wajib diisi', 'error');
      return;
    }

    if (!ACCESS_OPTIONS.some((option) => option.value === draft.access_level)) {
      addToast('Level akses menu tidak valid', 'error');
      return;
    }

    const duplicateRoute = sidebarItems.some(
      (item) => item.route === normalizedRoute && item.id !== draft.id
    );

    if (duplicateRoute) {
      addToast('Route menu sudah digunakan', 'error');
      return;
    }

    setSidebarSavingId(draft.id);
    try {
      const saved = await updateSidebarItem(draft.id, {
        title: trimmedTitle,
        route: normalizedRoute,
        access_level: draft.access_level,
        is_enabled: draft.is_enabled,
        icon_name: iconValue ? iconValue : null,
      });

      setSidebarItems((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        const updated = exists
          ? prev.map((item) => (item.id === saved.id ? saved : item))
          : [...prev, saved];
        return [...updated].sort((a, b) => a.position - b.position);
      });

      setSidebarDrafts((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        const updated = exists
          ? prev.map((item) => (item.id === saved.id ? { ...saved } : item))
          : [...prev, { ...saved }];
        return [...updated].sort((a, b) => a.position - b.position);
      });

      addToast('Menu sidebar diperbarui', 'success');
    } catch (error) {
      addToast('Gagal memperbarui menu sidebar', 'error');
    } finally {
      setSidebarSavingId(null);
    }
  };

  const handleDeleteSidebarItem = async (draft: SidebarDraft) => {
    const confirmed = window.confirm(`Hapus menu ${draft.title || draft.route}?`);
    if (!confirmed) return;

    setSidebarSavingId(draft.id);
    try {
      await deleteSidebarItem(draft.id);
      await loadSidebarItems();
      addToast('Menu sidebar dihapus', 'success');
    } catch (error) {
      addToast('Gagal menghapus menu sidebar', 'error');
    } finally {
      setSidebarSavingId(null);
    }
  };

  const handleAddSidebarItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = newSidebarItem.title.trim();
    const normalizedRoute = normalizeSidebarRoute(newSidebarItem.route);
    const iconValue = newSidebarItem.icon_name.trim();

    if (!trimmedTitle) {
      addToast('Judul menu wajib diisi', 'error');
      return;
    }

    if (!normalizedRoute) {
      addToast('Route menu wajib diawali dengan /', 'error');
      return;
    }

    if (!ACCESS_OPTIONS.some((option) => option.value === newSidebarItem.access_level)) {
      addToast('Level akses menu tidak valid', 'error');
      return;
    }

    const duplicateRoute = sidebarItems.some((item) => item.route === normalizedRoute);
    if (duplicateRoute) {
      addToast('Route menu sudah digunakan', 'error');
      return;
    }

    setSidebarSavingId('new');
    try {
      const maxPosition = sidebarItems.reduce(
        (max, item) => Math.max(max, item.position ?? 0),
        0
      );
      const created = await createSidebarItem({
        title: trimmedTitle,
        route: normalizedRoute,
        access_level: newSidebarItem.access_level,
        is_enabled: newSidebarItem.is_enabled,
        icon_name: iconValue ? iconValue : null,
        position: maxPosition + 1,
      });

      setSidebarItems((prev) => [...prev, created].sort((a, b) => a.position - b.position));
      setSidebarDrafts((prev) => [...prev, { ...created }].sort((a, b) => a.position - b.position));

      setNewSidebarItem({
        title: '',
        route: '',
        access_level: 'public',
        is_enabled: true,
        icon_name: '',
      });

      addToast('Menu sidebar ditambahkan', 'success');
    } catch (error) {
      addToast('Gagal menambahkan menu sidebar', 'error');
    } finally {
      setSidebarSavingId(null);
    }
  };

  const handleMoveSidebarItem = async (id: string, direction: 'up' | 'down') => {
    setSidebarMovingId(id);
    try {
      const updated = await moveSidebarItem(id, direction);
      if (updated) {
        setSidebarItems(updated);
        setSidebarDrafts(updated.map((item) => ({ ...item })));
      }
    } catch (error) {
      addToast('Gagal mengubah urutan menu', 'error');
    } finally {
      setSidebarMovingId(null);
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

  const sortedSidebarDrafts = useMemo(
    () => [...sidebarDrafts].sort((a, b) => a.position - b.position),
    [sidebarDrafts]
  );

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

  const renderSidebarMenu = () => (
    <SectionCard>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Sidebar Menu</h2>
          <p className="text-sm text-muted-foreground">
            Kelola item navigasi yang tampil di sidebar aplikasi.
          </p>
        </div>
        {sidebarLoading ? (
          <SkeletonTable rows={4} columns={7} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-20 pb-3 font-medium">Posisi</th>
                  <th className="w-[18%] pb-3 font-medium">Judul</th>
                  <th className="w-[20%] pb-3 font-medium">Route</th>
                  <th className="w-[15%] pb-3 font-medium">Level Akses</th>
                  <th className="w-[12%] pb-3 font-medium">Aktif</th>
                  <th className="w-[15%] pb-3 font-medium">Ikon</th>
                  <th className="pb-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {sortedSidebarDrafts.map((item, index) => {
                  const original = sidebarItems.find((sidebar) => sidebar.id === item.id);
                  const trimmedTitle = item.title.trim();
                  const normalizedRoute = normalizeSidebarRoute(item.route);
                  const draftIcon = typeof item.icon_name === 'string' ? item.icon_name.trim() : '';
                  const originalTitle = original?.title?.trim?.() ?? '';
                  const originalRoute = original?.route ?? '';
                  const originalIcon = original?.icon_name ? original.icon_name.trim() : '';
                  const isDirty =
                    !original ||
                    trimmedTitle !== originalTitle ||
                    normalizedRoute !== originalRoute ||
                    item.access_level !== original?.access_level ||
                    item.is_enabled !== original?.is_enabled ||
                    draftIcon !== originalIcon;
                  const isSaving = sidebarSavingId === item.id;
                  const isMoving = sidebarMovingId === item.id;
                  const isFirst = index === 0;
                  const isLast = index === sortedSidebarDrafts.length - 1;
                  return (
                    <tr key={item.id} className="align-middle">
                      <td className="py-3 pr-4 font-semibold text-muted-foreground">
                        {item.position || index + 1}
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          value={item.title}
                          onChange={(event) =>
                            handleSidebarDraftChange(item.id, 'title', event.target.value)
                          }
                          className="h-11 w-full rounded-2xl border border-border bg-surface-1 px-4 text-sm shadow-sm ring-2 ring-transparent transition focus:border-brand focus:outline-none focus:ring-brand/60"
                          placeholder="Menu Baru"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          value={item.route}
                          onChange={(event) =>
                            handleSidebarDraftChange(item.id, 'route', event.target.value)
                          }
                          className="h-11 w-full rounded-2xl border border-border bg-surface-1 px-4 text-sm shadow-sm ring-2 ring-transparent transition focus:border-brand focus:outline-none focus:ring-brand/60"
                          placeholder="/halaman"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <select
                          value={item.access_level}
                          onChange={(event) =>
                            handleSidebarDraftChange(
                              item.id,
                              'access_level',
                              event.target.value as SidebarAccessLevel
                            )
                          }
                          className="h-11 w-full rounded-2xl border border-border bg-surface-1 px-4 text-sm shadow-sm ring-2 ring-transparent transition focus:border-brand focus:outline-none focus:ring-brand/60"
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
                            onChange={(value) =>
                              handleSidebarDraftChange(item.id, 'is_enabled', value)
                            }
                            label={`Status menu ${item.title || item.route}`}
                          />
                          <span className="text-xs text-muted-foreground">
                            {item.is_enabled ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          value={item.icon_name ?? ''}
                          onChange={(event) =>
                            handleSidebarDraftChange(item.id, 'icon_name', event.target.value)
                          }
                          className="h-11 w-full rounded-2xl border border-border bg-surface-1 px-4 text-sm shadow-sm ring-2 ring-transparent transition focus:border-brand focus:outline-none focus:ring-brand/60"
                          placeholder="home"
                        />
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleMoveSidebarItem(item.id, 'up')}
                              disabled={isFirst || isSaving || isMoving}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-1 text-base font-semibold text-foreground transition hover:border-brand/60 hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={`Naikkan posisi ${item.title || item.route}`}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveSidebarItem(item.id, 'down')}
                              disabled={isLast || isSaving || isMoving}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-1 text-base font-semibold text-foreground transition hover:border-brand/60 hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={`Turunkan posisi ${item.title || item.route}`}
                            >
                              ↓
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveSidebarItem(item)}
                              disabled={!isDirty || isSaving}
                              className={clsx(
                                'inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-medium transition',
                                isDirty && !isSaving
                                  ? 'bg-brand text-white hover:bg-brand/90'
                                  : 'cursor-not-allowed bg-border text-muted-foreground'
                              )}
                            >
                              {isSaving ? 'Menyimpan…' : 'Simpan'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSidebarItem(item)}
                              disabled={isSaving || isMoving}
                              className="inline-flex h-11 items-center justify-center rounded-2xl border border-danger/50 px-4 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sortedSidebarDrafts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                      Belum ada menu sidebar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <form
          onSubmit={handleAddSidebarItem}
          className="space-y-4 rounded-2xl border border-dashed border-border/60 bg-surface-1/60 p-4"
        >
          <h3 className="text-sm font-semibold text-foreground">Tambah Menu Sidebar</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <input
              value={newSidebarItem.title}
              onChange={(event) =>
                setNewSidebarItem((prev) => ({ ...prev, title: event.target.value }))
              }
              className="h-11 w-full rounded-2xl border border-border bg-surface-1 px-4 text-sm shadow-sm ring-2 ring-transparent transition focus:border-brand focus:outline-none focus:ring-brand/60"
              placeholder="Judul menu"
            />
            <input
              value={newSidebarItem.route}
              onChange={(event) =>
                setNewSidebarItem((prev) => ({ ...prev, route: event.target.value }))
              }
              className="h-11 w-full rounded-2xl border border-border bg-surface-1 px-4 text-sm shadow-sm ring-2 ring-transparent transition focus:border-brand focus:outline-none focus:ring-brand/60"
              placeholder="/halaman"
            />
            <select
              value={newSidebarItem.access_level}
              onChange={(event) =>
                setNewSidebarItem((prev) => ({
                  ...prev,
                  access_level: event.target.value as SidebarAccessLevel,
                }))
              }
              className="h-11 w-full rounded-2xl border border-border bg-surface-1 px-4 text-sm shadow-sm ring-2 ring-transparent transition focus:border-brand focus:outline-none focus:ring-brand/60"
            >
              {ACCESS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="flex h-11 items-center gap-3 rounded-2xl border border-border bg-surface-1 px-4 ring-2 ring-transparent transition focus-within:border-brand focus-within:ring-brand/60">
              <Switch
                checked={newSidebarItem.is_enabled}
                onChange={(value) =>
                  setNewSidebarItem((prev) => ({ ...prev, is_enabled: value }))
                }
                label="Status menu baru"
              />
              <span className="text-xs text-muted-foreground">
                {newSidebarItem.is_enabled ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
            <input
              value={newSidebarItem.icon_name}
              onChange={(event) =>
                setNewSidebarItem((prev) => ({ ...prev, icon_name: event.target.value }))
              }
              className="h-11 w-full rounded-2xl border border-border bg-surface-1 px-4 text-sm shadow-sm ring-2 ring-transparent transition focus:border-brand focus:outline-none focus:ring-brand/60"
              placeholder="home"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sidebarSavingId === 'new'}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-5 text-sm font-medium text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {sidebarSavingId === 'new' ? 'Menyimpan…' : 'Tambah Menu'}
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
      {activeTab === 'sidebar' && renderSidebarMenu()}
      {activeTab === 'users' && renderUsers()}
      {activeTab === 'settings' && renderSettings()}
      {activeTab === 'audit' && renderAuditLog()}
    </div>
  );
}
