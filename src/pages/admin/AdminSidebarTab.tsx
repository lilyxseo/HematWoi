import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Icon, ICON_NAMES } from '../../components/icons';
import { useToast } from '../../context/ToastContext.jsx';
import {
  createSidebarItem,
  deleteSidebarItem,
  listSidebarItems,
  moveSidebarItem,
  normalizeRoutePath,
  updateSidebarItem,
  type SidebarAccessLevel,
  type SidebarItemRecord,
} from '../../lib/adminApi';
import {
  cardClass,
  inputClass,
  primaryButton,
  selectClass,
  subtleButton,
  ToggleSwitch,
} from './adminShared';

const accessOptions: { value: SidebarAccessLevel; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

type SidebarFormState = {
  title: string;
  route: string;
  access_level: SidebarAccessLevel;
  is_enabled: boolean;
  icon_name: string;
};

type EditState = SidebarFormState & { id: string };

function SkeletonRow() {
  return (
    <div className="grid animate-pulse gap-3 rounded-2xl border border-border/40 bg-muted/40 p-4 md:grid-cols-[70px,80px,1.2fr,1.2fr,130px,160px]">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-9 rounded-xl bg-border/60" />
      ))}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
      <div className="text-3xl">🧭</div>
      <p>Belum ada menu sidebar. Tambahkan item baru untuk memandu pengguna.</p>
      <button type="button" className={primaryButton} onClick={onAdd}>
        Tambah Item Pertama
      </button>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-6 text-sm text-destructive">
      <div className="font-semibold">Gagal memuat menu sidebar</div>
      <div>{message}</div>
      <div>
        <button type="button" className={subtleButton} onClick={onRetry}>
          Coba lagi
        </button>
      </div>
    </div>
  );
}

function prepareFormState(item?: SidebarItemRecord): SidebarFormState {
  if (!item) {
    return {
      title: '',
      route: '',
      access_level: 'public',
      is_enabled: true,
      icon_name: '',
    };
  }

  return {
    title: item.title,
    route: item.route,
    access_level: item.access_level,
    is_enabled: item.is_enabled,
    icon_name: item.icon_name ?? '',
  };
}

export default function AdminSidebarTab() {
  const { addToast } = useToast();
  const [items, setItems] = useState<SidebarItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [form, setForm] = useState<SidebarFormState>(() => prepareFormState());
  const [editing, setEditing] = useState<EditState | null>(null);

  const fetchSidebarItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listSidebarItems();
      setItems(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSidebarItems();
  }, [fetchSidebarItems]);

  const iconPreview = useMemo(() => form.icon_name.trim(), [form.icon_name]);

  const handleFormChange = <Key extends keyof SidebarFormState>(key: Key, value: SidebarFormState[Key]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleEditChange = <Key extends keyof SidebarFormState>(key: Key, value: SidebarFormState[Key]) => {
    setEditing((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedRoute = normalizeRoutePath(form.route);
    if (!form.title.trim()) {
      addToast('Judul wajib diisi', 'error');
      return;
    }
    if (!normalizedRoute) {
      addToast('Route wajib diisi dan diawali /', 'error');
      return;
    }
    if (items.some((item) => item.route === normalizedRoute)) {
      addToast('Route sudah terdaftar di menu', 'error');
      return;
    }

    setSavingId('new');
    try {
      const created = await createSidebarItem({
        title: form.title,
        route: normalizedRoute,
        access_level: form.access_level,
        is_enabled: form.is_enabled,
        icon_name: form.icon_name || null,
      });
      setItems((prev) => [...prev, created].sort((a, b) => a.position - b.position));
      setForm(prepareFormState());
      addToast('Menu sidebar berhasil ditambahkan', 'success');
    } catch (err) {
      console.error(err);
      addToast(err instanceof Error ? err.message : 'Gagal menambahkan item sidebar', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleEnabled = async (item: SidebarItemRecord, value: boolean) => {
    setSavingId(item.id);
    try {
      const updated = await updateSidebarItem(item.id, { is_enabled: value });
      setItems((prev) => prev.map((row) => (row.id === item.id ? updated : row)));
      addToast(`Menu ${value ? 'diaktifkan' : 'dinonaktifkan'}`, 'success');
    } catch (err) {
      console.error(err);
      addToast(err instanceof Error ? err.message : 'Gagal mengubah status menu', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleChangeAccess = async (item: SidebarItemRecord, level: SidebarAccessLevel) => {
    setSavingId(item.id);
    try {
      const updated = await updateSidebarItem(item.id, { access_level: level });
      setItems((prev) => prev.map((row) => (row.id === item.id ? updated : row)));
      addToast('Level akses menu diperbarui', 'success');
    } catch (err) {
      console.error(err);
      addToast(err instanceof Error ? err.message : 'Gagal memperbarui level akses', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (item: SidebarItemRecord) => {
    const confirmation = window.confirm(`Hapus menu "${item.title}"?`);
    if (!confirmation) return;

    setSavingId(item.id);
    try {
      await deleteSidebarItem(item.id);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      addToast('Menu sidebar dihapus', 'success');
    } catch (err) {
      console.error(err);
      addToast(err instanceof Error ? err.message : 'Gagal menghapus menu', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleMove = async (item: SidebarItemRecord, direction: 'up' | 'down') => {
    setSavingId(item.id);
    try {
      const reordered = await moveSidebarItem(item.id, direction);
      setItems(reordered);
    } catch (err) {
      console.error(err);
      addToast(err instanceof Error ? err.message : 'Gagal mengubah urutan', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleStartEdit = (item: SidebarItemRecord) => {
    setEditing({ id: item.id, ...prepareFormState(item) });
    setShowCreate(true);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const normalizedRoute = normalizeRoutePath(editing.route);
    if (!editing.title.trim()) {
      addToast('Judul wajib diisi', 'error');
      return;
    }
    if (!normalizedRoute) {
      addToast('Route wajib diisi dan diawali /', 'error');
      return;
    }
    if (
      items.some(
        (item) => item.id !== editing.id && normalizeRoutePath(item.route) === normalizedRoute
      )
    ) {
      addToast('Route sudah digunakan oleh menu lain', 'error');
      return;
    }

    setSavingId(editing.id);
    try {
      const updated = await updateSidebarItem(editing.id, {
        title: editing.title,
        route: normalizedRoute,
        icon_name: editing.icon_name || null,
        access_level: editing.access_level,
        is_enabled: editing.is_enabled,
      });
      setItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setEditing(null);
      addToast('Menu sidebar diperbarui', 'success');
    } catch (err) {
      console.error(err);
      addToast(err instanceof Error ? err.message : 'Gagal menyimpan perubahan', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Sidebar Menu</h2>
            <p className="text-sm text-muted-foreground">
              Kelola navigasi aplikasi, lengkap dengan ikon dan level akses.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className={subtleButton} onClick={() => void fetchSidebarItems()}>
              Muat ulang
            </button>
          </div>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={() => void fetchSidebarItems()} />
        ) : loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonRow key={index} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState onAdd={() => setShowCreate(true)} />
        ) : (
          <div className="space-y-3">
            <div className="hidden text-xs font-medium uppercase text-muted-foreground md:grid md:grid-cols-[70px,80px,1.2fr,1.2fr,130px,160px] md:gap-3">
              <div>Posisi</div>
              <div>Ikon</div>
              <div>Judul</div>
              <div>Route</div>
              <div>Akses</div>
              <div className="text-right">Aksi</div>
            </div>
            {items.map((item) => (
              <div
                key={item.id}
                className="grid gap-4 rounded-2xl border border-border/40 bg-background/70 p-4 transition hover:shadow-sm md:grid-cols-[70px,80px,1.2fr,1.2fr,130px,160px] md:items-center"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-sm font-semibold text-muted-foreground">
                    {item.position}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-background">
                    <Icon name={item.icon_name ?? undefined} className="h-5 w-5" />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {item.icon_name ? item.icon_name : 'default'}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{item.title}</div>
                  <div className="text-xs text-muted-foreground">{item.route}</div>
                </div>
                <div>
                  <select
                    className={selectClass}
                    value={item.access_level}
                    disabled={savingId === item.id}
                    aria-label={`Ubah akses untuk ${item.title}`}
                    onChange={(event) =>
                      handleChangeAccess(item, event.target.value as SidebarAccessLevel)
                    }
                  >
                    {accessOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center md:justify-center">
                  <ToggleSwitch
                    checked={item.is_enabled}
                    label={`Toggle menu ${item.title}`}
                    disabled={savingId === item.id}
                    onChange={(value) => handleToggleEnabled(item, value)}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    className={subtleButton}
                    aria-label={`Pindah ${item.title} ke atas`}
                    onClick={() => handleMove(item, 'up')}
                    disabled={savingId === item.id}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={subtleButton}
                    aria-label={`Pindah ${item.title} ke bawah`}
                    onClick={() => handleMove(item, 'down')}
                    disabled={savingId === item.id}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={subtleButton}
                    aria-label={`Edit menu ${item.title}`}
                    onClick={() => handleStartEdit(item)}
                    disabled={savingId === item.id}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={`${subtleButton} border-destructive/30 text-destructive`}
                    aria-label={`Hapus menu ${item.title}`}
                    onClick={() => handleDelete(item)}
                    disabled={savingId === item.id}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {editing && (
        <section className={cardClass}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Edit Item Sidebar</h3>
              <p className="text-sm text-muted-foreground">Perbarui detail menu yang dipilih.</p>
            </div>
            <button type="button" className={subtleButton} onClick={handleCancelEdit}>
              Batal
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
              Judul
              <input
                className={inputClass}
                value={editing.title}
                onChange={(event) => handleEditChange('title', event.target.value)}
                placeholder="Dashboard"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
              Route
              <input
                className={inputClass}
                value={editing.route}
                onChange={(event) => handleEditChange('route', event.target.value)}
                placeholder="/dashboard"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
              Level Akses
              <select
                className={selectClass}
                value={editing.access_level}
                onChange={(event) =>
                  handleEditChange('access_level', event.target.value as SidebarAccessLevel)
                }
              >
                {accessOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
              Ikon (lucide)
              <div className="relative">
                <input
                  list="sidebar-icon-options"
                  className={inputClass}
                  value={editing.icon_name}
                  onChange={(event) => handleEditChange('icon_name', event.target.value)}
                  placeholder="wallet"
                />
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                  <Icon name={editing.icon_name} className="h-5 w-5" />
                </div>
              </div>
            </label>
            <div className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
              Status
              <ToggleSwitch
                checked={editing.is_enabled}
                label="Toggle status menu"
                onChange={(value) => handleEditChange('is_enabled', value)}
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className={subtleButton} onClick={handleCancelEdit}>
              Batalkan
            </button>
            <button
              type="button"
              className={primaryButton}
              onClick={() => void handleSaveEdit()}
              disabled={savingId === editing.id}
            >
              Simpan Perubahan
            </button>
          </div>
        </section>
      )}

      <section className={cardClass}>
        <div className="mb-4 flex flex-col gap-2">
          <h3 className="text-lg font-semibold">Tambah Item Sidebar</h3>
          <p className="text-sm text-muted-foreground">
            Isi formulir berikut untuk menambahkan navigasi baru ke aplikasi.
          </p>
        </div>
        <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
            Judul
            <input
              className={inputClass}
              value={form.title}
              onChange={(event) => handleFormChange('title', event.target.value)}
              placeholder="Dashboard"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
            Route
            <input
              className={inputClass}
              value={form.route}
              onChange={(event) => handleFormChange('route', event.target.value)}
              placeholder="/dashboard"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
            Level Akses
            <select
              className={selectClass}
              value={form.access_level}
              onChange={(event) =>
                handleFormChange('access_level', event.target.value as SidebarAccessLevel)
              }
            >
              {accessOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
            Ikon (lucide)
            <div className="relative">
              <input
                list="sidebar-icon-options"
                className={inputClass}
                value={form.icon_name}
                onChange={(event) => handleFormChange('icon_name', event.target.value)}
                placeholder="wallet"
              />
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                <Icon name={iconPreview} className="h-5 w-5" />
              </div>
            </div>
          </label>
          <div className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
            Status
            <ToggleSwitch
              checked={form.is_enabled}
              label="Toggle status item baru"
              onChange={(value) => handleFormChange('is_enabled', value)}
            />
          </div>
          <div className="md:col-span-2 flex items-center justify-end">
            <button type="submit" className={primaryButton} disabled={savingId === 'new'}>
              Simpan Item
            </button>
          </div>
        </form>
      </section>
      <datalist id="sidebar-icon-options">
        {ICON_NAMES.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
}
