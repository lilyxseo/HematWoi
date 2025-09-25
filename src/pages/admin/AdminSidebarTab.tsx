import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Edit2, Plus, Trash2, X } from 'lucide-react';
import {
  createSidebarItem,
  deleteSidebarItem,
  listSidebarItems,
  moveSidebarItem,
  type SidebarAccessLevel,
  type SidebarItemRecord,
  updateSidebarItem,
} from '../../lib/adminApi';
import { useToast } from '../../context/ToastContext.jsx';
import { ICON_NAMES, Icon } from '../../components/icons';

const ACCESS_LEVEL_OPTIONS: { value: SidebarAccessLevel; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

type SidebarFormState = {
  title: string;
  route: string;
  access_level: SidebarAccessLevel;
  icon_name: string;
  is_enabled: boolean;
};

const EMPTY_FORM: SidebarFormState = {
  title: '',
  route: '',
  access_level: 'public',
  icon_name: '',
  is_enabled: true,
};

function normalizeRoute(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const singleSlash = withSlash.replace(/\/+/g, '/');
  return singleSlash.length > 1 ? singleSlash.replace(/\/+$, '') : singleSlash;
}

function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className="inline-flex h-6 w-11 items-center rounded-full border border-border/60 bg-background transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-checked={checked}
      role="switch"
      aria-label={label}
      disabled={disabled}
    >
      <span
        className={`ml-0.5 h-5 w-5 transform rounded-full transition ${checked ? 'translate-x-5 bg-primary' : 'translate-x-0 bg-muted-foreground/40'}`}
      />
    </button>
  );
}

export default function AdminSidebarTab() {
  const { addToast } = useToast();
  const [items, setItems] = useState<SidebarItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SidebarFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await listSidebarItems();
        if (!mounted) return;
        setItems(data);
      } catch (err) {
        console.error('[AdminSidebarTab] gagal memuat sidebar', err);
        if (!mounted) return;
        setError('Gagal memuat data sidebar');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.position === b.position) {
          return a.title.localeCompare(b.title);
        }
        return a.position - b.position;
      }),
    [items]
  );

  const nextPosition = useMemo(() => {
    if (!items.length) return 1;
    return Math.max(...items.map((item) => item.position)) + 1;
  }, [items]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function handleEdit(item: SidebarItemRecord) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      route: item.route,
      access_level: item.access_level,
      icon_name: item.icon_name ?? '',
      is_enabled: item.is_enabled,
    });
  }

  async function handleDelete(item: SidebarItemRecord) {
    const confirmed = window.confirm(`Hapus menu "${item.title}"?`);
    if (!confirmed) return;
    try {
      await deleteSidebarItem(item.id);
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      addToast('Menu sidebar dihapus', 'success');
    } catch (err) {
      console.error('[AdminSidebarTab] gagal menghapus sidebar', err);
      addToast(err instanceof Error ? err.message : 'Gagal menghapus item sidebar', 'error');
    }
  }

  async function handleMove(item: SidebarItemRecord, direction: 'up' | 'down') {
    try {
      const result = await moveSidebarItem(item.id, direction);
      if (!result) return;
      setItems((prev) =>
        prev.map((it) => {
          if (it.id === result.current.id) {
            return { ...it, position: result.current.position };
          }
          if (it.id === result.target.id) {
            return { ...it, position: result.target.position };
          }
          return it;
        })
      );
    } catch (err) {
      console.error('[AdminSidebarTab] gagal mengubah urutan', err);
      addToast(err instanceof Error ? err.message : 'Gagal mengubah urutan', 'error');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const normalizedRoute = normalizeRoute(form.route);
    if (!normalizedRoute) {
      addToast('Route harus diawali "/"', 'error');
      return;
    }

    if (!form.title.trim()) {
      addToast('Judul menu wajib diisi', 'error');
      return;
    }

    const hasConflict = items.some(
      (item) => item.route === normalizedRoute && item.id !== editingId
    );
    if (hasConflict) {
      addToast('Route sudah digunakan oleh menu lain', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateSidebarItem(editingId, {
          title: form.title,
          route: normalizedRoute,
          access_level: form.access_level,
          icon_name: form.icon_name,
          is_enabled: form.is_enabled,
        });
        setItems((prev) => prev.map((item) => (item.id === editingId ? updated : item)));
        addToast('Menu sidebar diperbarui', 'success');
      } else {
        const created = await createSidebarItem({
          title: form.title,
          route: normalizedRoute,
          access_level: form.access_level,
          icon_name: form.icon_name,
          is_enabled: form.is_enabled,
          position: nextPosition,
        });
        setItems((prev) => [...prev, created]);
        addToast('Menu sidebar ditambahkan', 'success');
      }
      resetForm();
    } catch (err) {
      console.error('[AdminSidebarTab] gagal menyimpan sidebar', err);
      addToast(err instanceof Error ? err.message : 'Gagal menyimpan menu sidebar', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="rounded-2xl border border-border/60 bg-background/60 p-6 shadow-sm">
        <header className="flex items-center justify-between gap-4 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Sidebar Menu</h2>
            <p className="text-sm text-muted-foreground">
              Kelola navigasi utama aplikasi dan atur urutan tampilannya.
            </p>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border/70 px-3 text-sm font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          >
            {editingId ? (
              <>
                <X className="h-4 w-4" aria-hidden />
                Batal edit
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" aria-hidden />
                Item baru
              </>
            )}
          </button>
        </header>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="h-12 animate-pulse rounded-xl bg-border/40" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/40 p-10 text-center">
            <Icon name="list" className="h-10 w-10 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Belum ada menu</p>
              <p className="text-sm text-muted-foreground">Tambah item baru untuk mengisi navigasi aplikasi.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Pos</th>
                  <th className="px-3 py-2">Ikon</th>
                  <th className="px-3 py-2">Judul</th>
                  <th className="px-3 py-2">Route</th>
                  <th className="px-3 py-2">Akses</th>
                  <th className="px-3 py-2">Aktif</th>
                  <th className="px-3 py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {sortedItems.map((item, index) => {
                  const isFirst = index === 0;
                  const isLast = index === sortedItems.length - 1;
                  return (
                    <tr key={item.id} className="transition hover:bg-muted/40">
                      <td className="px-3 py-3 font-medium text-muted-foreground">{index + 1}</td>
                      <td className="px-3 py-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background">
                          <Icon name={item.icon_name ?? undefined} className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </td>
                      <td className="max-w-[200px] px-3 py-3">
                        <p className="truncate font-medium text-foreground">{item.title}</p>
                      </td>
                      <td className="max-w-[200px] px-3 py-3">
                        <code className="truncate text-xs text-primary">{item.route}</code>
                      </td>
                      <td className="px-3 py-3 capitalize text-muted-foreground">{item.access_level}</td>
                      <td className="px-3 py-3">
                        <Switch
                          checked={item.is_enabled}
                          onChange={async (next) => {
                            try {
                              const updated = await updateSidebarItem(item.id, { is_enabled: next });
                              setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));
                            } catch (err) {
                              console.error('[AdminSidebarTab] gagal toggle', err);
                              addToast('Gagal mengubah status menu', 'error');
                            }
                          }}
                          label="Toggle menu"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            aria-label="Pindah ke atas"
                            onClick={() => handleMove(item, 'up')}
                            disabled={isFirst}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Pindah ke bawah"
                            onClick={() => handleMove(item, 'down')}
                            disabled={isLast}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Edit menu"
                            onClick={() => handleEdit(item)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Hapus menu"
                            onClick={() => handleDelete(item)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-destructive/40 text-destructive transition hover:border-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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

      <div className="h-fit rounded-2xl border border-border/60 bg-background/60 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-foreground">
          {editingId ? 'Edit Sidebar Item' : 'Tambah Sidebar Item'}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Formulir dengan tinggi seragam dan preview ikon secara langsung.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted-foreground" htmlFor="sidebar-title">
              Judul
            </label>
            <input
              id="sidebar-title"
              type="text"
              required
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              className="h-11 w-full rounded-2xl border border-border/70 px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Dashboard"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted-foreground" htmlFor="sidebar-route">
              Route
            </label>
            <input
              id="sidebar-route"
              type="text"
              required
              value={form.route}
              onChange={(event) => setForm((prev) => ({ ...prev, route: event.target.value }))}
              className="h-11 w-full rounded-2xl border border-border/70 px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="/dashboard"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground" htmlFor="sidebar-access">
                Tingkat akses
              </label>
              <select
                id="sidebar-access"
                value={form.access_level}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, access_level: event.target.value as SidebarAccessLevel }))
                }
                className="h-11 w-full rounded-2xl border border-border/70 bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {ACCESS_LEVEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground" htmlFor="sidebar-icon">
                Icon (lucide)
              </label>
              <input
                id="sidebar-icon"
                list="sidebar-icon-options"
                value={form.icon_name}
                onChange={(event) => setForm((prev) => ({ ...prev, icon_name: event.target.value }))}
                className="h-11 w-full rounded-2xl border border-border/70 px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="wallet"
              />
              <datalist id="sidebar-icon-options">
                {ICON_NAMES.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/40 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Preview ikon</p>
              <p className="text-xs text-muted-foreground">Gunakan nama ikon lucide, contoh: home, wallet.</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-background">
              <Icon name={form.icon_name || undefined} className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Aktifkan menu</p>
              <p className="text-xs text-muted-foreground">Menu nonaktif tidak akan tampil untuk pengguna.</p>
            </div>
            <Switch
              checked={form.is_enabled}
              onChange={(next) => setForm((prev) => ({ ...prev, is_enabled: next }))}
              label="Toggle enabled"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex h-11 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Menyimpan…' : editingId ? 'Simpan perubahan' : 'Tambah menu'}
          </button>
        </form>
      </div>
    </section>
  );
}
