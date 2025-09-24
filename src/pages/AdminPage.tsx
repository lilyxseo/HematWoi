import type { ReactNode } from 'react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Icon, ICON_NAMES } from '../components/icons';
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
  deleteSidebarItem as removeSidebarItem,
  listSidebarItems as getSidebarItems,
  moveSidebarItem as moveSidebarItemOrder,
  updateSidebarItem as updateSidebarItemApi,
  type SidebarItemRecord,
} from '../lib/adminSidebarApi';
import { supabase as supabaseClient } from '../lib/supabase';
import { useToast } from '../context/ToastContext.jsx';

type TabKey = 'access' | 'sidebar' | 'users' | 'settings' | 'audit';

type RouteDraft = RouteAccessRecord;

type UserDraft = UserProfileRecord;

type SidebarItemDraft = Omit<SidebarItemRecord, 'icon_name' | 'category'> & {
  icon_name: string;
  category: string;
};

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

function normalizeRoutePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  let withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  let collapsed = '';
  let previousWasSlash = false;

  for (const char of withLeadingSlash) {
    if (char === '/') {
      if (previousWasSlash) continue;
      previousWasSlash = true;
    } else {
      previousWasSlash = false;
    }
    collapsed += char;
  }

  while (collapsed.length > 1 && collapsed.endsWith('/')) {
    collapsed = collapsed.slice(0, -1);
  }

  return collapsed;
}

function Switch({
  checked,
  onChange,
  id,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  id?: string;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      id={id}
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
      className={clsx(
        'relative inline-flex h-6 w-11 items-center rounded-full transition',
        checked ? 'bg-brand' : 'bg-border',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      )}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
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
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [sidebarSavingId, setSidebarSavingId] = useState<string | null>(null);
  const [editingSidebarId, setEditingSidebarId] = useState<string | null>(null);
  const [sidebarDraft, setSidebarDraft] = useState<SidebarItemDraft | null>(null);
  const [newSidebarItem, setNewSidebarItem] = useState({
    title: '',
    route: '',
    access_level: 'public' as SidebarItemRecord['access_level'],
    is_enabled: true,
    icon_name: '',
    category: '',
  });

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

  const loadSidebarMenu = useCallback(
    async (withSkeleton = true) => {
      if (withSkeleton) {
        setSidebarLoading(true);
      }
      try {
        const items = await getSidebarItems();
        setSidebarItems(items);
        setEditingSidebarId(null);
        setSidebarDraft(null);
      } catch (error) {
        addToast('Gagal memuat menu sidebar', 'error');
      } finally {
        setSidebarLoading(false);
      }
    },
    [addToast]
  );

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
    void loadSidebarMenu();
    void loadUsers();
    void loadDescription();
  }, [loadRoutes, loadSidebarMenu, loadUsers, loadDescription]);

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

  const handleSidebarDraftChange = <Field extends keyof SidebarItemDraft>(
    field: Field,
    value: SidebarItemDraft[Field]
  ) => {
    setSidebarDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleStartSidebarEdit = (item: SidebarItemRecord) => {
    setEditingSidebarId(item.id);
    setSidebarDraft({
      id: item.id,
      title: item.title,
      route: item.route,
      access_level: item.access_level,
      is_enabled: item.is_enabled,
      position: item.position,
      category: item.category ?? '',
      icon_name: (item.icon_name ?? '').toLowerCase(),
    });
  };

  const handleCancelSidebarEdit = () => {
    setEditingSidebarId(null);
    setSidebarDraft(null);
  };

  const handleSaveSidebarItem = async () => {
    if (!editingSidebarId || !sidebarDraft) {
      return;
    }

    const trimmedTitle = sidebarDraft.title.trim();
    if (!trimmedTitle) {
      addToast('Judul menu wajib diisi', 'error');
      return;
    }

    const rawRoute = sidebarDraft.route.trim();
    if (!rawRoute) {
      addToast('Route wajib diisi', 'error');
      return;
    }

    if (/\s/.test(rawRoute)) {
      addToast('Route tidak boleh mengandung spasi', 'error');
      return;
    }

    const normalizedRoute = normalizeRoutePath(rawRoute);

    if (
      sidebarItems.some(
        (item) => item.route === normalizedRoute && item.id !== editingSidebarId
      )
    ) {
      addToast('Route sudah digunakan', 'error');
      return;
    }

    if (!ACCESS_OPTIONS.some((option) => option.value === sidebarDraft.access_level)) {
      addToast('Level akses tidak valid', 'error');
      return;
    }

    const iconValue = sidebarDraft.icon_name.trim().toLowerCase();
    const categoryValue = sidebarDraft.category.trim();

    setSidebarSavingId(editingSidebarId);
    try {
      const updated = await updateSidebarItemApi(editingSidebarId, {
        title: trimmedTitle,
        route: normalizedRoute,
        access_level: sidebarDraft.access_level,
        is_enabled: sidebarDraft.is_enabled,
        icon_name: iconValue ? iconValue : null,
        category: categoryValue ? categoryValue : null,
      });

      setSidebarItems((prev) =>
        [...prev.map((item) => (item.id === updated.id ? updated : item))].sort(
          (a, b) => a.position - b.position
        )
      );
      setEditingSidebarId(null);
      setSidebarDraft(null);
      addToast('Menu sidebar diperbarui', 'success');
    } catch (error) {
      addToast('Gagal menyimpan menu sidebar', 'error');
    } finally {
      setSidebarSavingId(null);
    }
  };

  const handleDeleteSidebarItem = async (item: SidebarItemRecord) => {
    const confirmDelete = window.confirm(`Hapus menu ${item.title || item.route}?`);
    if (!confirmDelete) return;

    setSidebarSavingId(item.id);
    try {
      await removeSidebarItem(item.id);
      await loadSidebarMenu(false);
      addToast('Menu sidebar berhasil dihapus', 'success');
    } catch (error) {
      addToast('Gagal menghapus menu sidebar', 'error');
    } finally {
      setSidebarSavingId(null);
    }
  };

  const handleMoveSidebarItem = async (
    item: SidebarItemRecord,
    direction: 'up' | 'down'
  ) => {
    setSidebarSavingId(item.id);
    try {
      const updatedList = await moveSidebarItemOrder(item.id, direction);
      setSidebarItems(updatedList);
      setEditingSidebarId(null);
      setSidebarDraft(null);
      addToast('Urutan menu diperbarui', 'success');
    } catch (error) {
      addToast('Gagal mengubah urutan menu', 'error');
    } finally {
      setSidebarSavingId(null);
    }
  };

  const handleCreateSidebarItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = newSidebarItem.title.trim();
    if (!trimmedTitle) {
      addToast('Judul menu wajib diisi', 'error');
      return;
    }

    const rawRoute = newSidebarItem.route.trim();
    if (!rawRoute) {
      addToast('Route wajib diisi', 'error');
      return;
    }

    if (/\s/.test(rawRoute)) {
      addToast('Route tidak boleh mengandung spasi', 'error');
      return;
    }

    if (!rawRoute.startsWith('/')) {
      addToast("Route harus diawali '/'", 'error');
      return;
    }

    if (!ACCESS_OPTIONS.some((option) => option.value === newSidebarItem.access_level)) {
      addToast('Level akses tidak valid', 'error');
      return;
    }

    const normalizedRoute = normalizeRoutePath(rawRoute);

    if (sidebarItems.some((item) => item.route === normalizedRoute)) {
      addToast('Route sudah digunakan', 'error');
      return;
    }

    const nextPosition =
      sidebarItems.reduce((max, item) => Math.max(max, item.position ?? 0), 0) + 1;
    const iconValue = newSidebarItem.icon_name.trim().toLowerCase();
    const categoryValue = newSidebarItem.category.trim();

    setSidebarSavingId('new');
    try {
      await createSidebarItem(supabaseClient, {
        title: trimmedTitle,
        route: normalizedRoute,
        access_level: newSidebarItem.access_level,
        is_enabled: newSidebarItem.is_enabled,
        icon_name: iconValue ? iconValue : null,
        position: nextPosition,
        category: categoryValue ? categoryValue : null,
      });
      await loadSidebarMenu(false);
      setNewSidebarItem({
        title: '',
        route: '',
        access_level: 'public',
        is_enabled: true,
        icon_name: '',
        category: '',
      });
      addToast('Menu sidebar berhasil ditambahkan', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menambahkan menu sidebar';
      addToast(message, 'error');
    } finally {
      setSidebarSavingId(null);
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

  const renderSidebarMenu = () => {
    const accessLabel = (value: SidebarItemRecord['access_level']) =>
      ACCESS_OPTIONS.find((option) => option.value === value)?.label ?? value;
    const nextPosition =
      sidebarItems.reduce((max, item) => Math.max(max, item.position ?? 0), 0) + 1;
    const baseInputClass =
      'h-11 w-full rounded-2xl border border-border/70 bg-surface-1 px-4 text-sm shadow-sm ring-2 ring-transparent transition focus:border-brand focus:outline-none focus:ring-brand/60';

    const newIconValue = newSidebarItem.icon_name.trim().toLowerCase();
    const newIconSelectValue = ICON_NAMES.includes(newIconValue) ? newIconValue : '';

    return (
      <SectionCard>
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Sidebar Menu</h2>
            <p className="text-sm text-muted-foreground">
              Kelola item navigasi yang tampil untuk setiap level akses pengguna.
            </p>
          </div>
          {sidebarLoading ? (
            <SkeletonTable rows={4} columns={8} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-16 pb-3 font-medium">Posisi</th>
                    <th className="w-[18%] pb-3 font-medium">Judul</th>
                    <th className="w-[18%] pb-3 font-medium">Kategori</th>
                    <th className="w-[22%] pb-3 font-medium">Route</th>
                    <th className="w-[16%] pb-3 font-medium">Level Akses</th>
                    <th className="w-[14%] pb-3 font-medium">Aktif</th>
                    <th className="w-[16%] pb-3 font-medium">Ikon</th>
                    <th className="pb-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {sidebarItems.map((item, index) => {
                    const isFirst = index === 0;
                    const isLast = index === sidebarItems.length - 1;
                    const isEditing = editingSidebarId === item.id;
                    const draft = isEditing && sidebarDraft ? sidebarDraft : null;
                    const titleValue = draft?.title ?? item.title;
                    const routeValue = draft?.route ?? item.route;
                    const categoryValue = draft?.category ?? item.category ?? '';
                    const accessValue = draft?.access_level ?? item.access_level;
                    const enabledValue = draft?.is_enabled ?? item.is_enabled;
                    const iconRawValue = draft?.icon_name ?? item.icon_name ?? '';
                    const iconValue = iconRawValue.trim().toLowerCase();
                    const iconStoredValue = (item.icon_name ?? '').trim().toLowerCase();
                    const iconSelectValue = ICON_NAMES.includes(iconValue) ? iconValue : '';
                    const isProcessing = sidebarSavingId === item.id;
                    const isAnotherEditing =
                      editingSidebarId !== null && editingSidebarId !== item.id;
                    const disableReorder =
                      sidebarLoading || sidebarSavingId !== null || editingSidebarId !== null;
                    const isDirty =
                      !!draft &&
                      (draft.title.trim() !== item.title ||
                        draft.route.trim() !== item.route ||
                        draft.category.trim() !== (item.category ?? '').trim() ||
                        draft.access_level !== item.access_level ||
                        draft.is_enabled !== item.is_enabled ||
                        draft.icon_name.trim().toLowerCase() !== iconStoredValue);

                    return (
                      <tr key={item.id} className="align-middle">
                        <td className="py-3 pr-4">
                          <span className="inline-flex h-11 items-center text-sm font-semibold text-muted-foreground">
                            #{item.position}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          {isEditing ? (
                            <input
                              value={titleValue}
                              onChange={(event) =>
                                handleSidebarDraftChange('title', event.target.value)
                              }
                              className={baseInputClass}
                              placeholder="Dashboard"
                            />
                          ) : (
                            <span className="block min-h-[44px] text-sm font-medium text-foreground">
                              {item.title || 'Tanpa Judul'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {isEditing ? (
                            <input
                              value={categoryValue}
                              onChange={(event) =>
                                handleSidebarDraftChange('category', event.target.value)
                              }
                              className={baseInputClass}
                              placeholder="Misal: Analitik"
                            />
                          ) : (
                            <span className="block min-h-[44px] text-sm text-foreground">
                              {item.category?.trim() || 'Tanpa Kategori'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {isEditing ? (
                            <input
                              value={routeValue}
                              onChange={(event) =>
                                handleSidebarDraftChange('route', event.target.value)
                              }
                              className={baseInputClass}
                              placeholder="/dashboard"
                            />
                          ) : (
                            <span className="inline-flex min-h-[44px] items-center rounded-2xl bg-surface-2/70 px-3 text-xs font-medium text-muted-foreground">
                              {item.route}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {isEditing ? (
                            <select
                              value={accessValue}
                              onChange={(event) =>
                                handleSidebarDraftChange(
                                  'access_level',
                                  event.target.value as SidebarItemRecord['access_level']
                                )
                              }
                              className={baseInputClass}
                            >
                              {ACCESS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="inline-flex min-h-[32px] items-center rounded-full bg-surface-2/60 px-3 text-xs font-medium text-muted-foreground">
                              {accessLabel(item.access_level)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={enabledValue}
                              onChange={(value) => handleSidebarDraftChange('is_enabled', value)}
                              label={`Status menu ${titleValue || item.route}`}
                              disabled={!isEditing || isProcessing}
                            />
                            <span className="text-xs text-muted-foreground">
                              {enabledValue ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-surface-2/60 text-muted-foreground">
                              <Icon
                                name={iconRawValue}
                                label={titleValue || item.route}
                                className="h-5 w-5 shrink-0"
                              />
                            </span>
                            {isEditing ? (
                              <select
                                value={iconSelectValue}
                                onChange={(event) =>
                                  handleSidebarDraftChange(
                                    'icon_name',
                                    event.target.value.toLowerCase()
                                  )
                                }
                                className={clsx(baseInputClass, 'flex-1')}
                              >
                                <option value="">Tanpa ikon</option>
                                {ICON_NAMES.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="inline-flex min-h-[32px] items-center rounded-full bg-surface-2/60 px-3 text-xs text-muted-foreground">
                                {iconValue || '—'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleMoveSidebarItem(item, 'up')}
                              disabled={isFirst || disableReorder}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-1 text-sm font-semibold transition hover:bg-border/30 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={`Pindahkan ${item.title || item.route} ke atas`}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveSidebarItem(item, 'down')}
                              disabled={isLast || disableReorder}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-1 text-sm font-semibold transition hover:bg-border/30 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={`Pindahkan ${item.title || item.route} ke bawah`}
                            >
                              ↓
                            </button>
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={handleSaveSidebarItem}
                                  disabled={!isDirty || isProcessing}
                                  className={clsx(
                                    'inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition',
                                    isDirty && !isProcessing
                                      ? 'bg-brand text-white hover:bg-brand/90'
                                      : 'cursor-not-allowed bg-border text-muted-foreground'
                                  )}
                                >
                                  {isProcessing ? 'Menyimpan…' : 'Simpan'}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelSidebarEdit}
                                  disabled={isProcessing}
                                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-border px-4 text-sm font-medium text-muted-foreground transition hover:bg-border/30 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Batal
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStartSidebarEdit(item)}
                                  disabled={isProcessing || isAnotherEditing || sidebarSavingId === 'new'}
                                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-border px-4 text-sm font-medium text-foreground transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSidebarItem(item)}
                                  disabled={isProcessing || sidebarSavingId === 'new'}
                                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-danger/50 px-4 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Hapus
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {sidebarItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                        Belum ada menu sidebar yang terdaftar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <form
            onSubmit={handleCreateSidebarItem}
            className="space-y-4 rounded-2xl border border-dashed border-border/60 bg-surface-1/60 p-4"
          >
            <div className="grid gap-4 md:grid-cols-6">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Judul Menu
                </label>
                <input
                  value={newSidebarItem.title}
                  onChange={(event) =>
                    setNewSidebarItem((prev) => ({ ...prev, title: event.target.value }))
                  }
                  className={baseInputClass}
                  placeholder="Misal: Dashboard"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Route
                </label>
                <input
                  value={newSidebarItem.route}
                  onChange={(event) =>
                    setNewSidebarItem((prev) => ({ ...prev, route: event.target.value }))
                  }
                  className={baseInputClass}
                  placeholder="/dashboard"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Kategori (opsional)
                </label>
                <input
                  value={newSidebarItem.category}
                  onChange={(event) =>
                    setNewSidebarItem((prev) => ({ ...prev, category: event.target.value }))
                  }
                  className={baseInputClass}
                  placeholder="Misal: Analitik"
                />
              </div>
              <div className="md:col-span-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Level Akses
                </label>
                <select
                  value={newSidebarItem.access_level}
                  onChange={(event) =>
                    setNewSidebarItem((prev) => ({
                      ...prev,
                      access_level: event.target.value as SidebarItemRecord['access_level'],
                    }))
                  }
                  className={baseInputClass}
                >
                  {ACCESS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Ikon (opsional)
                </label>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-surface-2/60 text-muted-foreground">
                    <Icon
                      name={newSidebarItem.icon_name}
                      label={newSidebarItem.title || newSidebarItem.route || 'Ikon menu baru'}
                      className="h-5 w-5 shrink-0"
                    />
                  </span>
                  <select
                    value={newIconSelectValue}
                    onChange={(event) =>
                      setNewSidebarItem((prev) => ({
                        ...prev,
                        icon_name: event.target.value.toLowerCase(),
                      }))
                    }
                    className={clsx(baseInputClass, 'flex-1')}
                  >
                    <option value="">Tanpa ikon</option>
                    {ICON_NAMES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Status
                </label>
                <div className="flex h-11 items-center justify-between rounded-2xl border border-border/70 bg-surface-1 px-4 ring-2 ring-transparent">
                  <span className="text-sm text-muted-foreground">{newSidebarItem.is_enabled ? 'Aktif' : 'Nonaktif'}</span>
                  <Switch
                    checked={newSidebarItem.is_enabled}
                    onChange={(value) =>
                      setNewSidebarItem((prev) => ({ ...prev, is_enabled: value }))
                    }
                    label="Status menu baru"
                    disabled={sidebarSavingId === 'new'}
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Posisi
                </label>
                <div className="flex h-11 items-center rounded-2xl border border-dashed border-border/70 bg-surface-1 px-4 text-sm text-muted-foreground">
                  Otomatis #{nextPosition}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sidebarSavingId === 'new'}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-6 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {sidebarSavingId === 'new' ? 'Menyimpan…' : 'Tambah Menu'}
              </button>
            </div>
          </form>
        </div>
      </SectionCard>
    );
  };

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
      {activeTab === 'sidebar' && renderSidebarMenu()}
      {activeTab === 'users' && renderUsers()}
      {activeTab === 'settings' && renderSettings()}
      {activeTab === 'audit' && renderAuditLog()}
    </div>
  );
}
