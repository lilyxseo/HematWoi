import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { Icon, ICON_NAMES } from '../../components/icons';
import { useToast } from '../../context/ToastContext.jsx';
import {
  SidebarAccessLevel,
  SidebarItemPayload,
  SidebarItemRecord,
  deleteSidebarItem,
  listSidebarItems,
  moveSidebarItem,
  normalizeRoutePath,
  updateSidebarItem,
  createSidebarItem,
} from '../../lib/adminApi';

const ACCESS_OPTIONS: { value: SidebarAccessLevel; label: string }[] = [
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

type SidebarEditDraft = SidebarFormState & { id: string };

const INITIAL_FORM: SidebarFormState = {
  title: '',
  route: '',
  access_level: 'public',
  is_enabled: true,
  icon_name: '',
};

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold text-muted-foreground">
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        'h-11 w-full rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground shadow-sm ring-2 ring-transparent transition focus:border-transparent focus:outline-none focus:ring-primary',
        props.className
      )}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        'h-11 w-full rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground shadow-sm ring-2 ring-transparent transition focus:border-transparent focus:outline-none focus:ring-primary',
        props.className
      )}
    />
  );
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      disabled={disabled}
      className={clsx(
        'relative inline-flex h-6 w-11 items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60',
        checked ? 'bg-primary' : 'bg-border'
      )}
    >
      <span className="sr-only">{label}</span>
      <span
        className={clsx(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
          checked ? 'translate-x-5' : 'translate-x-1'
        )}
      />
    </button>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-border/40 last:border-b-0">
      {Array.from({ length: 7 }).map((_, index) => (
        <td key={index} className="p-3">
          <div className="h-9 rounded-xl bg-border/60" />
        </td>
      ))}
    </tr>
  );
}

function formatRoute(route: string) {
  return route || '-';
}

export default function AdminSidebarTab() {
  const { addToast } = useToast();
  const [items, setItems] = useState<SidebarItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [formState, setFormState] = useState<SidebarFormState>(INITIAL_FORM);
  const [formError, setFormError] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<SidebarEditDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await listSidebarItems();
        if (!mounted) return;
        setItems(data);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Tidak dapat memuat menu sidebar.');
        addToast('Gagal memuat menu sidebar', 'error');
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
  }, [addToast]);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.position - b.position),
    [items]
  );

  const handleFormChange = (field: keyof SidebarFormState, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const title = formState.title.trim();
    const normalizedRoute = normalizeRoutePath(formState.route);

    if (!title) {
      setFormError('Judul wajib diisi.');
      return;
    }
    if (!normalizedRoute) {
      setFormError('Route harus diawali dengan /.');
      return;
    }
    if (sortedItems.some((item) => item.route === normalizedRoute)) {
      setFormError('Route sudah terdaftar.');
      return;
    }

    const payload: SidebarItemPayload = {
      title,
      route: normalizedRoute,
      access_level: formState.access_level,
      is_enabled: formState.is_enabled,
      icon_name: formState.icon_name.trim() || undefined,
    };

    setCreating(true);
    try {
      const created = await createSidebarItem(payload);
      setItems((prev) => [...prev, created]);
      setFormState(INITIAL_FORM);
      addToast('Item sidebar berhasil ditambahkan', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menambahkan item.';
      setFormError(message);
      addToast(message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleStartEdit = (item: SidebarItemRecord) => {
    setEditingId(item.id);
    setEditDraft({
      id: item.id,
      title: item.title,
      route: item.route,
      access_level: item.access_level,
      is_enabled: item.is_enabled,
      icon_name: item.icon_name ?? '',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const handleEditChange = (field: keyof SidebarFormState, value: string | boolean) => {
    setEditDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSaveEdit = async () => {
    if (!editDraft) return;

    const title = editDraft.title.trim();
    const normalizedRoute = normalizeRoutePath(editDraft.route);

    if (!title) {
      addToast('Judul wajib diisi', 'error');
      return;
    }
    if (!normalizedRoute) {
      addToast('Route harus diawali dengan /', 'error');
      return;
    }
    if (sortedItems.some((item) => item.id !== editDraft.id && item.route === normalizedRoute)) {
      addToast('Route sudah digunakan oleh item lain', 'error');
      return;
    }

    setSavingId(editDraft.id);
    try {
      const updated = await updateSidebarItem(editDraft.id, {
        title,
        route: normalizedRoute,
        access_level: editDraft.access_level,
        is_enabled: editDraft.is_enabled,
        icon_name: editDraft.icon_name.trim() || null,
      });
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditingId(null);
      setEditDraft(null);
      addToast('Item sidebar diperbarui', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal memperbarui item.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (item: SidebarItemRecord) => {
    const confirmed = window.confirm(`Hapus "${item.title}"?`);
    if (!confirmed) return;
    setSavingId(item.id);
    try {
      await deleteSidebarItem(item.id);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      addToast('Item sidebar dihapus', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal menghapus item.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleMove = async (item: SidebarItemRecord, direction: 'up' | 'down') => {
    setSavingId(`${direction}-${item.id}`);
    try {
      const next = await moveSidebarItem(item.id, direction);
      setItems(next);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal mengubah urutan.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const disableCreate = useMemo(() => {
    return creating;
  }, [creating]);

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Daftar Sidebar</h2>
            <p className="text-sm text-muted-foreground">
              Atur navigasi aplikasi, urutan, dan akses setiap item.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              setLoading(true);
              try {
                const data = await listSidebarItems();
                setItems(data);
                setError('');
                addToast('Menu sidebar diperbarui', 'success');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Gagal memuat menu sidebar');
                addToast('Gagal memuat menu sidebar', 'error');
              } finally {
                setLoading(false);
              }
            }}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border/60 px-4 text-sm font-medium text-foreground transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Loader2 className="h-4 w-4" aria-hidden="true" /> Refresh
          </button>
        </div>
        {error ? (
          <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full table-fixed">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="w-16 p-3">Pos</th>
                <th className="w-14 p-3">Ikon</th>
                <th className="p-3">Judul</th>
                <th className="p-3">Route</th>
                <th className="w-28 p-3">Akses</th>
                <th className="w-24 p-3">Aktif</th>
                <th className="w-44 p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => <SkeletonRow key={index} />)
              ) : sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="list" className="h-8 w-8 text-muted-foreground/70" />
                      <span>Tidak ada item menu. Tambahkan item baru di sebelah kanan.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedItems.map((item, index) => {
                  const isEditing = editingId === item.id && editDraft;
                  const moveUpDisabled = index === 0 || savingId === `up-${item.id}`;
                  const moveDownDisabled =
                    index === sortedItems.length - 1 || savingId === `down-${item.id}`;

                  if (isEditing && editDraft) {
                    return (
                      <tr key={item.id} className="bg-muted/20">
                        <td className="p-3 align-top text-sm font-medium text-muted-foreground">{item.position}</td>
                        <td className="p-3 align-top">
                          <div className="flex items-center gap-3">
                            <Icon name={editDraft.icon_name} className="h-5 w-5 text-muted-foreground" />
                            <Input
                              list="admin-sidebar-icon-options"
                              value={editDraft.icon_name}
                              onChange={(event) => handleEditChange('icon_name', event.target.value)}
                              placeholder="nama ikon"
                              aria-label="Nama ikon"
                            />
                          </div>
                        </td>
                        <td className="p-3 align-top">
                          <Input
                            value={editDraft.title}
                            onChange={(event) => handleEditChange('title', event.target.value)}
                            placeholder="Judul menu"
                            aria-label="Judul menu"
                          />
                        </td>
                        <td className="p-3 align-top">
                          <Input
                            value={editDraft.route}
                            onChange={(event) => handleEditChange('route', event.target.value)}
                            placeholder="/path"
                            aria-label="Route"
                          />
                        </td>
                        <td className="p-3 align-top">
                          <Select
                            value={editDraft.access_level}
                            onChange={(event) =>
                              handleEditChange('access_level', event.target.value as SidebarAccessLevel)
                            }
                            aria-label="Level akses"
                          >
                            {ACCESS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="p-3 align-top">
                          <Switch
                            checked={editDraft.is_enabled}
                            onChange={(value) => handleEditChange('is_enabled', value)}
                            label="Aktifkan menu"
                          />
                        </td>
                        <td className="p-3 align-top">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void handleSaveEdit()}
                              disabled={savingId === item.id}
                              className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : (
                                <Save className="h-4 w-4" aria-hidden="true" />
                              )}
                              Simpan
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="inline-flex h-9 items-center gap-2 rounded-xl border border-border/60 px-3 text-xs font-medium text-foreground transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                              Batal
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={item.id} className="bg-background odd:bg-muted/20">
                      <td className="p-3 text-sm font-medium text-muted-foreground">{item.position}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-muted/40">
                            <Icon name={item.icon_name ?? ''} className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <span className="text-xs text-muted-foreground/80">{item.icon_name ?? '-'}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="max-w-xs truncate text-sm font-medium text-foreground">{item.title}</div>
                      </td>
                      <td className="p-3">
                        <span className="text-sm text-muted-foreground">{formatRoute(item.route)}</span>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">{item.access_level}</td>
                      <td className="p-3">
                        <Switch
                          checked={item.is_enabled}
                          onChange={async (value) => {
                            setSavingId(item.id);
                            try {
                              const updated = await updateSidebarItem(item.id, { is_enabled: value });
                              setItems((prev) => prev.map((row) => (row.id === item.id ? updated : row)));
                            } catch (err) {
                              addToast(
                                err instanceof Error ? err.message : 'Gagal memperbarui status item.',
                                'error'
                              );
                            } finally {
                              setSavingId(null);
                            }
                          }}
                          disabled={savingId === item.id}
                          label={`Status ${item.title}`}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleMove(item, 'up')}
                            aria-label={`Pindah ${item.title} ke atas`}
                            disabled={moveUpDisabled}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <ArrowUp className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMove(item, 'down')}
                            aria-label={`Pindah ${item.title} ke bawah`}
                            disabled={moveDownDisabled}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <ArrowDown className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(item)}
                            aria-label={`Edit ${item.title}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(item)}
                            aria-label={`Hapus ${item.title}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-destructive/40 text-destructive transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
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
        <datalist id="admin-sidebar-icon-options">
          {ICON_NAMES.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>
      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-2 text-primary">
            <Plus className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Tambah Item</h2>
            <p className="text-sm text-muted-foreground">
              Buat item navigasi baru lengkap dengan ikon dan level akses.
            </p>
          </div>
        </div>
        <form className="mt-6 space-y-4" onSubmit={handleCreate}>
          <div className="space-y-2">
            <FieldLabel htmlFor="sidebar-title">Judul</FieldLabel>
            <Input
              id="sidebar-title"
              value={formState.title}
              onChange={(event) => handleFormChange('title', event.target.value)}
              placeholder="Contoh: Dashboard"
              required
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="sidebar-route">Route</FieldLabel>
            <Input
              id="sidebar-route"
              value={formState.route}
              onChange={(event) => handleFormChange('route', event.target.value)}
              placeholder="/dashboard"
              required
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="sidebar-access">Level akses</FieldLabel>
            <Select
              id="sidebar-access"
              value={formState.access_level}
              onChange={(event) => handleFormChange('access_level', event.target.value as SidebarAccessLevel)}
            >
              {ACCESS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="sidebar-icon">Ikon</FieldLabel>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-muted/40">
                <Icon name={formState.icon_name} className="h-5 w-5 text-muted-foreground" />
              </div>
              <Input
                id="sidebar-icon"
                list="admin-sidebar-icon-options"
                value={formState.icon_name}
                onChange={(event) => handleFormChange('icon_name', event.target.value)}
                placeholder="home, wallet, settings"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FieldLabel htmlFor="sidebar-enabled">Aktif</FieldLabel>
              <Switch
                checked={formState.is_enabled}
                onChange={(value) => handleFormChange('is_enabled', value)}
                label="Aktifkan item baru"
              />
            </div>
            <button
              type="submit"
              disabled={disableCreate}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Simpan item
            </button>
          </div>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </form>
      </div>
    </div>
  );
}
