import { FormEvent, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Icon, ICON_NAMES } from '../../components/icons';
import { useToast } from '../../context/ToastContext.jsx';
import {
  createSidebarItem,
  deleteSidebarItem,
  listSidebarItems,
  moveSidebarItem,
  reorderSidebarItems,
  SidebarAccessLevel,
  SidebarItemRecord,
  updateSidebarItem,
} from '../../lib/adminApi';

const ACCESS_LABEL: Record<SidebarAccessLevel, string> = {
  public: 'Public',
  user: 'User',
  admin: 'Admin',
};

const ACCESS_OPTIONS: SidebarAccessLevel[] = ['public', 'user', 'admin'];

const INPUT_CLASS =
  'h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary';

const SELECT_CLASS = clsx(INPUT_CLASS, 'pr-10');

function normalizeRouteInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const parts = withSlash.split('/').filter(Boolean);
  if (parts.length === 0) return '/';
  return `/${parts.join('/')}`;
}

type SidebarFormState = {
  title: string;
  route: string;
  access_level: SidebarAccessLevel;
  is_enabled: boolean;
  icon_name: string;
  category: string;
};

const EMPTY_FORM: SidebarFormState = {
  title: '',
  route: '',
  access_level: 'public',
  is_enabled: true,
  icon_name: '',
  category: '',
};

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
      className={clsx(
        'flex h-11 w-16 items-center rounded-2xl border border-border/60 bg-background px-1 transition',
        disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-primary'
      )}
      role="switch"
      aria-label={label}
      aria-checked={checked}
      aria-disabled={disabled}
      disabled={disabled}
    >
      <span
        className={clsx(
          'inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-white transition',
          checked ? 'translate-x-6' : 'translate-x-0'
        )}
      >
        <span className="text-xs font-semibold">{checked ? 'On' : 'Off'}</span>
      </span>
    </button>
  );
}

function ActionIconButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={clsx(
        'flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition',
        disabled ? 'cursor-not-allowed opacity-40' : 'hover:border-primary hover:text-primary'
      )}
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}

export default function AdminSidebarTab() {
  const { addToast } = useToast();
  const [items, setItems] = useState<SidebarItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SidebarFormState>(EMPTY_FORM);
  const [editDraft, setEditDraft] = useState<SidebarFormState | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [iconSearch, setIconSearch] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showEditIconPicker, setShowEditIconPicker] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listSidebarItems();
        if (mounted) {
          setItems(data);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal memuat menu sidebar';
        if (mounted) {
          setError(message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const existingRoutes = useMemo(() => {
    return new Set(items.map((item) => item.route.toLowerCase()));
  }, [items]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setIconSearch('');
    setShowIconPicker(false);
  };

  const filteredIcons = useMemo(() => {
    const query = iconSearch.trim().toLowerCase();
    if (!query) return ICON_NAMES;
    return ICON_NAMES.filter((name) => name.toLowerCase().includes(query));
  }, [iconSearch]);

  const reorderItems = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return items;
    const list = [...items];
    const sourceIndex = list.findIndex((item) => item.id === sourceId);
    const targetIndex = list.findIndex((item) => item.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return items;
    const [moved] = list.splice(sourceIndex, 1);
    list.splice(targetIndex, 0, moved);
    return list.map((item, index) => ({ ...item, position: index + 1 }));
  };

  const handleDrop = async (sourceId: string, targetId: string) => {
    const reordered = reorderItems(sourceId, targetId);
    setItems(reordered);
    setDraggingId(null);
    try {
      const updated = await reorderSidebarItems(reordered.map((item) => item.id));
      setItems(updated);
      addToast('Urutan menu diperbarui', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengubah urutan';
      addToast(message, 'error');
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const route = normalizeRouteInput(form.route);
    if (!route.startsWith('/')) {
      addToast("Route harus diawali '/'", 'error');
      return;
    }

    if (existingRoutes.has(route.toLowerCase())) {
      addToast('Route sudah ada di menu', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const newItem = await createSidebarItem({
        title: form.title,
        route,
        access_level: form.access_level,
        is_enabled: form.is_enabled,
        icon_name: form.icon_name,
        category: form.category,
      });
      setItems((prev) => [...prev, newItem].sort((a, b) => a.position - b.position));
      addToast('Menu berhasil ditambahkan', 'success');
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menambah menu';
      addToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item: SidebarItemRecord) => {
    setEditingId(item.id);
    setEditDraft({
      title: item.title,
      route: item.route,
      access_level: item.access_level,
      is_enabled: item.is_enabled,
      icon_name: item.icon_name ?? '',
      category: item.category ?? '',
    });
  };

  const handleUpdate = async () => {
    if (!editingId || !editDraft || submitting) return;
    const route = normalizeRouteInput(editDraft.route);
    if (!route.startsWith('/')) {
      addToast("Route harus diawali '/'", 'error');
      return;
    }

    const duplicate = items.some(
      (item) => item.id !== editingId && item.route.toLowerCase() === route.toLowerCase()
    );
    if (duplicate) {
      addToast('Route sudah digunakan oleh menu lain', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const updated = await updateSidebarItem(editingId, {
        title: editDraft.title,
        route,
        access_level: editDraft.access_level,
        is_enabled: editDraft.is_enabled,
        icon_name: editDraft.icon_name,
        category: editDraft.category,
      });
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      addToast('Menu berhasil diperbarui', 'success');
      setEditingId(null);
      setEditDraft(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memperbarui menu';
      addToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus menu ini?')) return;
    setSubmitting(true);
    try {
      await deleteSidebarItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      addToast('Menu dihapus', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus menu';
      addToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    setMovingId(id);
    try {
      const updated = await moveSidebarItem(id, direction);
      setItems(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengubah urutan';
      addToast(message, 'error');
    } finally {
      setMovingId(null);
    }
  };

  const renderSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="grid gap-3 rounded-2xl bg-muted/20 p-4 md:grid-cols-8">
          {Array.from({ length: 8 }).map((__, col) => (
            <div key={col} className="h-11 animate-pulse rounded-2xl bg-muted/40" />
          ))}
        </div>
      ))}
    </div>
  );

  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 p-10 text-center">
      <Icon name="list" className="h-10 w-10 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium text-muted-foreground">
        Belum ada menu. Tambahkan item pertama di bawah ini.
      </p>
    </div>
  );

  const renderMobileCards = () => (
    <div className="grid gap-3 md:hidden">
      {items.map((item) => (
        <div
          key={item.id}
          className={clsx(
            'rounded-2xl border border-border/60 bg-background p-4 shadow-sm transition',
            draggingId === item.id && 'border-primary/50 bg-primary/5'
          )}
          draggable
          onDragStart={() => setDraggingId(item.id)}
          onDragEnd={() => setDraggingId(null)}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={() => {
            if (draggingId) {
              void handleDrop(draggingId, item.id);
            }
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/40">
                <Icon name={item.icon_name ?? 'circle'} className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.route}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Kategori: {item.category ? item.category : '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="ellipsis-vertical" className="h-4 w-4 text-muted-foreground" />
              <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {ACCESS_LABEL[item.access_level]}
              </span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Posisi #{item.position}</span>
            <span>•</span>
            <span>{item.is_enabled ? 'Aktif' : 'Nonaktif'}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionIconButton
              icon="arrow-up"
              label="Geser ke atas"
              onClick={() => handleMove(item.id, 'up')}
              disabled={movingId === item.id}
            />
            <ActionIconButton
              icon="arrow-down"
              label="Geser ke bawah"
              onClick={() => handleMove(item.id, 'down')}
              disabled={movingId === item.id}
            />
            <ActionIconButton icon="pencil" label="Edit" onClick={() => startEdit(item)} />
            <ActionIconButton
              icon="trash"
              label="Hapus"
              onClick={() => handleDelete(item.id)}
              disabled={submitting}
            />
          </div>
        </div>
      ))}
    </div>
  );

  const renderDesktopTable = () => (
    <div className="hidden md:block">
      <div className="overflow-hidden rounded-2xl border border-border/60">
        <table className="min-w-full divide-y divide-border/60 text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Urut</th>
              <th className="px-4 py-3 text-left font-semibold">Pos</th>
              <th className="px-4 py-3 text-left font-semibold">Ikon</th>
              <th className="px-4 py-3 text-left font-semibold">Judul</th>
              <th className="px-4 py-3 text-left font-semibold">Route</th>
              <th className="px-4 py-3 text-left font-semibold">Kategori</th>
              <th className="px-4 py-3 text-left font-semibold">Akses</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {items.map((item) => (
              <tr
                key={item.id}
                className={clsx(
                  'odd:bg-muted/10 transition',
                  draggingId === item.id && 'bg-primary/5'
                )}
                draggable
                onDragStart={() => setDraggingId(item.id)}
                onDragEnd={() => setDraggingId(null)}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={() => {
                  if (draggingId) {
                    void handleDrop(draggingId, item.id);
                  }
                }}
              >
                <td className="px-4 py-3 text-muted-foreground">
                  <Icon name="ellipsis-vertical" className="h-4 w-4" />
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-muted-foreground">#{item.position}</td>
                <td className="px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/40">
                    <Icon name={item.icon_name ?? 'circle'} className="h-5 w-5" />
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-medium">{item.title}</td>
                <td className="px-4 py-3 text-xs font-medium text-muted-foreground">{item.route}</td>
                <td className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  {item.category || '-'}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {ACCESS_LABEL[item.access_level]}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-muted-foreground">
                  {item.is_enabled ? 'Aktif' : 'Nonaktif'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ActionIconButton
                      icon="arrow-up"
                      label="Geser ke atas"
                      onClick={() => handleMove(item.id, 'up')}
                      disabled={movingId === item.id}
                    />
                    <ActionIconButton
                      icon="arrow-down"
                      label="Geser ke bawah"
                      onClick={() => handleMove(item.id, 'down')}
                      disabled={movingId === item.id}
                    />
                    <ActionIconButton icon="pencil" label="Edit" onClick={() => startEdit(item)} />
                    <ActionIconButton
                      icon="trash"
                      label="Hapus"
                      onClick={() => handleDelete(item.id)}
                      disabled={submitting}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Sidebar Menu</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola navigasi utama aplikasi. Atur ikon, akses, dan urutan menu.
        </p>
      </div>

      <form onSubmit={handleCreate} className="space-y-4 rounded-2xl border border-border/60 bg-muted/10 p-4 md:p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm font-semibold text-muted-foreground">
            Judul
            <input
              required
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              className={clsx(INPUT_CLASS, 'mt-1')}
              placeholder="Contoh: Dashboard"
            />
          </label>
          <label className="text-sm font-semibold text-muted-foreground">
            Route
            <input
              required
              value={form.route}
              onChange={(event) => setForm((prev) => ({ ...prev, route: event.target.value }))}
              className={clsx(INPUT_CLASS, 'mt-1')}
              placeholder="/dashboard"
            />
          </label>
          <label className="text-sm font-semibold text-muted-foreground">
            Kategori
            <input
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              className={clsx(INPUT_CLASS, 'mt-1')}
              placeholder="Contoh: Navigasi Utama"
            />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm font-semibold text-muted-foreground md:col-span-2">
            Icon Name
            <input
              value={form.icon_name}
              onChange={(event) => setForm((prev) => ({ ...prev, icon_name: event.target.value }))}
              className={clsx(INPUT_CLASS, 'mt-1')}
              placeholder="Contoh: home atau brand-github"
              list="admin-icon-options"
            />
            <span className="mt-1 block text-xs font-normal text-muted-foreground/80">
              Gunakan nama ikon Tabler (slug seperti di tabler.io). Contoh: <code>home</code>, <code>brand-github</code>,
              atau <code>wallet</code>.
            </span>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowIconPicker((prev) => !prev)}
                className="rounded-2xl border border-border/60 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                {showIconPicker ? 'Tutup Picker' : 'Pilih Ikon'}
              </button>
            </div>
            {showIconPicker ? (
              <div className="mt-3 space-y-3 rounded-2xl border border-border/60 bg-background p-3">
                <input
                  value={iconSearch}
                  onChange={(event) => setIconSearch(event.target.value)}
                  className={clsx(INPUT_CLASS, 'h-10')}
                  placeholder="Cari ikon..."
                />
                <div className="grid max-h-40 grid-cols-6 gap-2 overflow-auto pr-1">
                  {filteredIcons.slice(0, 60).map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, icon_name: name }));
                        setShowIconPicker(false);
                      }}
                      className="flex h-10 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition hover:border-primary hover:text-primary"
                      title={name}
                    >
                      <Icon name={name} className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </label>
          <label className="text-sm font-semibold text-muted-foreground">
            Akses
            <select
              value={form.access_level}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, access_level: event.target.value as SidebarAccessLevel }))
              }
              className={clsx(SELECT_CLASS, 'mt-1')}
            >
              {ACCESS_OPTIONS.map((level) => (
                <option key={level} value={level}>
                  {ACCESS_LABEL[level]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-muted-foreground">
            Status
            <div className="mt-1">
              <Switch
                checked={form.is_enabled}
                onChange={(next) => setForm((prev) => ({ ...prev, is_enabled: next }))}
                label="Aktif"
              />
            </div>
          </label>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>Preview ikon:</span>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-background">
              <Icon name={form.icon_name || 'circle'} className="h-5 w-5" />
            </div>
          </div>
          <button
            type="submit"
            className="h-11 rounded-2xl bg-primary px-6 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-60"
            disabled={submitting}
          >
            Tambah Item
          </button>
        </div>
        <datalist id="admin-icon-options">
          {ICON_NAMES.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </form>

      {error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        renderSkeleton()
      ) : items.length === 0 ? (
        renderEmpty()
      ) : (
        <>
          {renderMobileCards()}
          {renderDesktopTable()}
        </>
      )}

      {editingId && editDraft ? (
        <div className="space-y-4 rounded-2xl border border-primary/40 bg-primary/5 p-4 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Edit Sidebar Item</h3>
              <p className="text-sm text-muted-foreground">Perbarui detail menu yang dipilih.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setEditDraft(null);
              }}
              className="h-10 rounded-2xl border border-border/60 px-4 text-sm font-medium text-muted-foreground transition hover:border-destructive hover:text-destructive"
            >
              Batal
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm font-semibold text-muted-foreground">
              Judul
              <input
                value={editDraft.title}
                onChange={(event) =>
                  setEditDraft((prev) =>
                    prev ? { ...prev, title: event.target.value } : prev
                  )
                }
                className={clsx(INPUT_CLASS, 'mt-1')}
              />
            </label>
            <label className="text-sm font-semibold text-muted-foreground">
              Route
              <input
                value={editDraft.route}
                onChange={(event) =>
                  setEditDraft((prev) =>
                    prev ? { ...prev, route: event.target.value } : prev
                  )
                }
                className={clsx(INPUT_CLASS, 'mt-1')}
              />
            </label>
            <label className="text-sm font-semibold text-muted-foreground">
              Kategori
              <input
                value={editDraft.category}
                onChange={(event) =>
                  setEditDraft((prev) =>
                    prev ? { ...prev, category: event.target.value } : prev
                  )
                }
                className={clsx(INPUT_CLASS, 'mt-1')}
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-sm font-semibold text-muted-foreground md:col-span-2">
              Icon Name
              <input
                value={editDraft.icon_name}
                onChange={(event) =>
                  setEditDraft((prev) =>
                    prev ? { ...prev, icon_name: event.target.value } : prev
                  )
                }
                className={clsx(INPUT_CLASS, 'mt-1')}
                list="admin-icon-options"
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground/80">
                Gunakan nama ikon Tabler (slug seperti di tabler.io), misalnya <code>home</code> atau <code>brand-github</code>.
              </span>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowEditIconPicker((prev) => !prev)}
                  className="rounded-2xl border border-border/60 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
                >
                  {showEditIconPicker ? 'Tutup Picker' : 'Pilih Ikon'}
                </button>
              </div>
              {showEditIconPicker ? (
                <div className="mt-3 space-y-3 rounded-2xl border border-border/60 bg-background p-3">
                  <input
                    value={iconSearch}
                    onChange={(event) => setIconSearch(event.target.value)}
                    className={clsx(INPUT_CLASS, 'h-10')}
                    placeholder="Cari ikon..."
                  />
                  <div className="grid max-h-40 grid-cols-6 gap-2 overflow-auto pr-1">
                    {filteredIcons.slice(0, 60).map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setEditDraft((prev) => (prev ? { ...prev, icon_name: name } : prev));
                          setShowEditIconPicker(false);
                        }}
                        className="flex h-10 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition hover:border-primary hover:text-primary"
                        title={name}
                      >
                        <Icon name={name} className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </label>
            <label className="text-sm font-semibold text-muted-foreground">
              Akses
              <select
                value={editDraft.access_level}
                onChange={(event) =>
                  setEditDraft((prev) =>
                    prev
                      ? { ...prev, access_level: event.target.value as SidebarAccessLevel }
                      : prev
                  )
                }
                className={clsx(SELECT_CLASS, 'mt-1')}
              >
                {ACCESS_OPTIONS.map((level) => (
                  <option key={level} value={level}>
                    {ACCESS_LABEL[level]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-muted-foreground">
              Status
              <div className="mt-1">
                <Switch
                  checked={editDraft.is_enabled}
                  onChange={(next) =>
                    setEditDraft((prev) => (prev ? { ...prev, is_enabled: next } : prev))
                  }
                  label="Aktif"
                />
              </div>
            </label>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>Preview ikon:</span>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-background">
                <Icon name={editDraft.icon_name || 'circle'} className="h-5 w-5" />
              </div>
            </div>
            <button
              type="button"
              onClick={handleUpdate}
              className="h-11 rounded-2xl bg-primary px-6 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-60"
              disabled={submitting}
            >
              Simpan Perubahan
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
