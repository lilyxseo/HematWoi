import { useEffect, useMemo, useState } from 'react';
import { Check, RefreshCcw, Search, X } from 'lucide-react';
import {
  listUsers,
  type ListUsersFilter,
  type UserProfileRecord,
  type UserRole,
  updateUserProfile,
} from '../../lib/adminApi';
import { useToast } from '../../context/ToastContext.jsx';
import { supabase } from '../../lib/supabase';

const ROLE_OPTIONS: { value: 'all' | UserRole; label: string }[] = [
  { value: 'all', label: 'Semua peran' },
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua status' },
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Tidak aktif' },
] as const;

type DraftState = Record<string, { role: UserRole; is_active: boolean }>;

function AvatarPlaceholder({ user }: { user: UserProfileRecord }) {
  const initial = (user.username || user.email || 'U').slice(0, 1).toUpperCase();
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-muted/60 text-sm font-semibold text-muted-foreground">
      {initial}
    </div>
  );
}

export default function AdminUsersTab() {
  const { addToast } = useToast();
  const [users, setUsers] = useState<UserProfileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ListUsersFilter>({ role: 'all', active: 'all' });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [drafts, setDrafts] = useState<DraftState>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then((response) => {
      if (!cancelled) {
        setCurrentUserId(response.data.user?.id ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await listUsers({ ...filters, q: debouncedSearch });
      setUsers(result);
      setDrafts({});
    } catch (err) {
      console.error('[AdminUsersTab] gagal memuat pengguna', err);
      setError('Gagal memuat pengguna');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.role, filters.active, debouncedSearch]);

  const activeAdminCount = useMemo(() => {
    return users.reduce((total, user) => {
      const draft = drafts[user.id];
      const role = draft ? draft.role : user.role;
      const active = draft ? draft.is_active : user.is_active;
      return role === 'admin' && active ? total + 1 : total;
    }, 0);
  }, [users, drafts]);

  function markDraft(id: string, patch: Partial<{ role: UserRole; is_active: boolean }>) {
    setDrafts((prev) => {
      const current = prev[id] ?? { role: users.find((user) => user.id === id)?.role ?? 'user', is_active: users.find((user) => user.id === id)?.is_active ?? true };
      const next = { ...current, ...patch };
      return { ...prev, [id]: next };
    });
  }

  function clearDraft(id: string) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function applyDraft(user: UserProfileRecord) {
    const draft = drafts[user.id];
    if (!draft) return user;
    return { ...user, ...draft };
  }

  async function handleSave(user: UserProfileRecord) {
    const draft = drafts[user.id];
    if (!draft) return;
    setSavingId(user.id);
    try {
      const updated = await updateUserProfile(user.id, draft);
      setUsers((prev) => prev.map((item) => (item.id === user.id ? updated : item)));
      clearDraft(user.id);
      addToast('Profil pengguna diperbarui', 'success');
    } catch (err) {
      console.error('[AdminUsersTab] gagal memperbarui pengguna', err);
      addToast(err instanceof Error ? err.message : 'Gagal memperbarui pengguna', 'error');
    } finally {
      setSavingId(null);
    }
  }

  const rows = users.map(applyDraft);

  const emptyState = !loading && rows.length === 0;

  return (
    <section className="space-y-6 rounded-2xl border border-border/60 bg-background/60 p-6 shadow-sm">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Users</h2>
          <p className="text-sm text-muted-foreground">Kelola peran dan status aktif pengguna aplikasi.</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border/70 px-3 text-sm font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        >
          <RefreshCcw className="h-4 w-4" /> Muat ulang
        </button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari username atau email"
                className="h-11 w-full rounded-2xl border border-border/70 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Cari pengguna"
              />
            </div>
            <div className="flex w-full flex-wrap gap-3 md:w-auto">
              <select
                value={filters.role ?? 'all'}
                onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value as ListUsersFilter['role'] }))}
                className="h-11 min-w-[160px] rounded-2xl border border-border/70 bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={filters.active ?? 'all'}
                onChange={(event) => setFilters((prev) => ({ ...prev, active: event.target.value as ListUsersFilter['active'] }))}
                className="h-11 min-w-[160px] rounded-2xl border border-border/70 bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-16 animate-pulse rounded-2xl bg-border/40" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
          ) : emptyState ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/40 p-12 text-center">
              <span className="text-4xl" role="img" aria-hidden>
                👥
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Tidak ada pengguna</p>
                <p className="text-sm text-muted-foreground">Coba ganti filter pencarian atau tambah pengguna baru.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Pengguna</th>
                    <th className="px-3 py-2">Peran</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Dibuat</th>
                    <th className="px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rows.map((user) => {
                    const draft = drafts[user.id];
                    const base = users.find((item) => item.id === user.id)!;
                    const isDirty = Boolean(draft);
                    const disableSelf = base.role === 'admin' && base.is_active && activeAdminCount <= 1 && base.id === currentUserId;
                    return (
                      <tr key={user.id} className="transition hover:bg-muted/40">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <AvatarPlaceholder user={user} />
                            <div className="min-w-[160px]">
                              <p className="truncate font-medium text-foreground">{user.username || 'Tanpa nama'}</p>
                              <p className="truncate text-xs text-muted-foreground">{user.email || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={user.role}
                            disabled={disableSelf}
                            onChange={(event) => markDraft(user.id, { role: event.target.value as UserRole })}
                            className="h-10 rounded-2xl border border-border/70 bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => markDraft(user.id, { is_active: !user.is_active })}
                            disabled={disableSelf}
                            className={`inline-flex h-10 w-24 items-center justify-center rounded-2xl border text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 ${user.is_active ? 'border-emerald-300 bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'border-border/70 bg-muted/60 text-muted-foreground hover:bg-muted/80'}`}
                          >
                            {user.is_active ? 'Aktif' : 'Nonaktif'}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          {base.created_at ? new Date(base.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-2">
                            {isDirty ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSave(base)}
                                  disabled={savingId === user.id}
                                  className="inline-flex h-9 items-center gap-2 rounded-2xl bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Check className="h-4 w-4" /> Simpan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => clearDraft(user.id)}
                                  className="inline-flex h-9 items-center gap-2 rounded-2xl border border-border/70 px-3 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                                >
                                  <X className="h-4 w-4" /> Batal
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <aside className="rounded-2xl border border-border/60 bg-muted/40 p-5">
          <h3 className="text-sm font-semibold text-foreground">Tips</h3>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-xs text-muted-foreground">
            <li>Demote admin hanya bila sudah ada admin aktif lainnya.</li>
            <li>Gunakan pencarian untuk menemukan pengguna secara cepat.</li>
            <li>Perubahan membutuhkan beberapa detik untuk direplikasi.</li>
          </ul>
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs text-primary">
            Admin aktif saat ini: <strong>{activeAdminCount}</strong>
          </div>
        </aside>
      </div>
    </section>
  );
}
