import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Download, Plus, RefreshCcw, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import WishlistFilterBar from '../components/wishlist/WishlistFilterBar';
import WishlistCard from '../components/wishlist/WishlistCard';
import WishlistFormDialog from '../components/wishlist/WishlistFormDialog';
import WishlistBatchToolbar from '../components/wishlist/WishlistBatchToolbar';
import ConfirmDialog from '../components/debts/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { listCategories } from '../lib/api-categories';
import { useWishlist, type WishlistFilterState } from '../hooks/useWishlist';
import type { WishlistItem, WishlistItemPayload, WishlistStatus } from '../lib/wishlistApi';

interface CategoryOption {
  id: string;
  name: string;
}

function escapeCsv(value: string | number | null | undefined) {
  if (value == null) return '';
  const text = String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeNumber(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/[^0-9,.-]/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(/,/g, '.');
  const parsed = Number.parseFloat(normalized);
  if (Number.isFinite(parsed)) return parsed;
  return null;
}

export default function WishlistPage() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<WishlistItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    items,
    total,
    loading,
    loadingMore,
    hasMore,
    error,
    filters,
    setFilters,
    resetFilters,
    refresh,
    loadMore,
    createItem,
    updateItem,
    removeItem,
    updateBulk,
    deleteBulk,
  } = useWishlist();

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((category) => {
      map.set(category.id, category.name);
    });
    return map;
  }, [categories]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await listCategories();
        if (!active) return;
        setCategories(result.map((item) => ({ id: item.id, name: item.name })));
      } catch (err) {
        if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
          // eslint-disable-next-line no-console
          console.error('[HW][Wishlist] listCategories', err);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  const handleFilterChange = (next: WishlistFilterState) => {
    setFilters(next);
    setSelectedIds([]);
  };

  const handleResetFilters = () => {
    resetFilters();
    setSelectedIds([]);
  };

  const handleCreateClick = () => {
    setFormMode('create');
    setEditingItem(null);
    setFormOpen(true);
  };

  const handleEditItem = (item: WishlistItem) => {
    setEditingItem(item);
    setFormMode('edit');
    setFormOpen(true);
  };

  const handleFormSubmit = async (payload: WishlistItemPayload) => {
    setFormSubmitting(true);
    try {
      if (formMode === 'create') {
        await createItem(payload);
        addToast('Wishlist berhasil ditambahkan', 'success');
      } else if (editingItem) {
        await updateItem(editingItem.id, payload);
        addToast('Wishlist berhasil diperbarui', 'success');
      }
      setFormOpen(false);
      setEditingItem(null);
      await refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal menyimpan wishlist', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!pendingDelete) return;
    setDeleteLoading(true);
    try {
      await removeItem(pendingDelete.id);
      addToast('Wishlist dihapus', 'success');
      setSelectedIds((prev) => prev.filter((id) => id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal menghapus wishlist', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return prev.filter((itemId) => itemId !== id);
    });
  };

  const handleBatchStatus = async (status: WishlistStatus) => {
    if (selectedIds.length === 0) return;
    setBatchProcessing(true);
    try {
      await updateBulk(selectedIds, { status });
      addToast('Status wishlist diperbarui', 'success');
      await refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal memperbarui status', 'error');
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleBatchPriority = async (priority: number) => {
    if (selectedIds.length === 0) return;
    setBatchProcessing(true);
    try {
      await updateBulk(selectedIds, { priority });
      addToast('Prioritas wishlist diperbarui', 'success');
      await refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal memperbarui prioritas', 'error');
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    setBatchProcessing(true);
    try {
      await deleteBulk(selectedIds);
      addToast('Wishlist terpilih dihapus', 'success');
      setSelectedIds([]);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal menghapus data', 'error');
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleMarkPurchased = async (item: WishlistItem) => {
    try {
      await updateItem(item.id, { status: 'purchased' });
      addToast('Wishlist ditandai dibeli', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal memperbarui status', 'error');
    }
  };

  const handleMakeGoal = (item: WishlistItem) => {
    const params = new URLSearchParams();
    params.set('title', item.title);
    if (item.estimated_price != null) {
      params.set('target', String(item.estimated_price));
    }
    if (item.category_id) {
      params.set('category_id', item.category_id);
    }
    navigate(`/goals/new?${params.toString()}`);
  };

  const handleCopyTransaction = (item: WishlistItem) => {
    const params = new URLSearchParams();
    params.set('type', 'expense');
    if (item.estimated_price != null) {
      params.set('amount', String(item.estimated_price));
    }
    params.set('note', item.title);
    if (item.category_id) {
      params.set('category_id', item.category_id);
    }
    navigate(`/add?${params.toString()}`);
  };

  const handleRetry = () => {
    refresh();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      if (lines.length <= 1) {
        addToast('File CSV kosong atau tidak valid', 'warning');
        return;
      }
      const header = parseCsvLine(lines[0]);
      const titleIndex = header.indexOf('title');
      const priceIndex = header.indexOf('estimated_price');
      const priorityIndex = header.indexOf('priority');
      const categoryIndex = header.indexOf('category_id');
      const statusIndex = header.indexOf('status');
      const noteIndex = header.indexOf('note');
      const storeIndex = header.indexOf('store_url');
      const imageIndex = header.indexOf('image_url');
      let imported = 0;
      for (let i = 1; i < lines.length; i += 1) {
        const values = parseCsvLine(lines[i]);
        const payload: WishlistItemPayload = {
          title: values[titleIndex] ?? '',
          estimated_price: priceIndex >= 0 ? normalizeNumber(values[priceIndex]) : null,
          priority:
            priorityIndex >= 0 && values[priorityIndex]
              ? Number(values[priorityIndex]) || null
              : null,
          category_id: categoryIndex >= 0 ? values[categoryIndex] || null : null,
          status:
            statusIndex >= 0 && values[statusIndex]
              ? (values[statusIndex] as WishlistStatus)
              : 'planned',
          note: noteIndex >= 0 ? values[noteIndex] || null : null,
          store_url: storeIndex >= 0 ? values[storeIndex] || null : null,
          image_url: imageIndex >= 0 ? values[imageIndex] || null : null,
        };
        if (!payload.title) continue;
        try {
          await createItem(payload);
          imported += 1;
        } catch (err) {
          if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
            // eslint-disable-next-line no-console
            console.error('[HW][Wishlist] import line failed', err);
          }
        }
      }
      if (imported > 0) {
        addToast(`${imported} wishlist berhasil diimpor`, 'success');
        await refresh();
      } else {
        addToast('Tidak ada wishlist yang berhasil diimpor', 'warning');
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal mengimpor CSV', 'error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExport = () => {
    if (!items.length) {
      addToast('Tidak ada data untuk diekspor', 'warning');
      return;
    }
    const header = [
      'title',
      'estimated_price',
      'priority',
      'category_id',
      'status',
      'note',
      'store_url',
      'image_url',
    ];
    const rows = items.map((item) =>
      [
        escapeCsv(item.title),
        escapeCsv(item.estimated_price ?? ''),
        escapeCsv(item.priority ?? ''),
        escapeCsv(item.category_id ?? ''),
        escapeCsv(item.status),
        escapeCsv(item.note ?? ''),
        escapeCsv(item.store_url ?? ''),
        escapeCsv(item.image_url ?? ''),
      ].join(','),
    );
    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'wishlist.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderSkeleton = () => (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={`skeleton-${index}`}
          className="h-48 rounded-2xl border border-slate-800 bg-slate-900/60"
        >
          <div className="h-full animate-pulse rounded-2xl bg-slate-800/50" />
        </div>
      ))}
    </div>
  );

  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700/70 bg-slate-900/50 p-12 text-center">
      <div className="mb-4 h-16 w-16 rounded-full bg-slate-800/70" />
      <h3 className="text-lg font-semibold text-white">Wishlist kamu masih kosong</h3>
      <p className="mt-2 max-w-md text-sm text-muted">
        Simpan ide belanja tanpa rasa bersalah. Catat barang incaran, atur prioritas, dan buat goal kalau sudah siap menabung.
      </p>
      <button
        type="button"
        onClick={handleCreateClick}
        className="mt-6 inline-flex h-[44px] items-center justify-center rounded-2xl bg-[color:var(--accent)] px-6 text-sm font-semibold text-slate-950 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
      >
        Tambah Wishlist
      </button>
    </div>
  );

  return (
    <Page>
      <PageHeader
        title="Wishlist"
        description="Kelola daftar keinginan sebelum jadi komitmen finansial."
      >
        <button
          type="button"
          onClick={handleImportClick}
          className="inline-flex h-[40px] items-center gap-2 rounded-2xl border border-slate-800 px-4 text-sm font-medium text-text transition hover:border-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
        >
          <Upload className="h-4 w-4" /> Import CSV
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex h-[40px] items-center gap-2 rounded-2xl border border-slate-800 px-4 text-sm font-medium text-text transition hover:border-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
        <button
          type="button"
          onClick={handleCreateClick}
          className="inline-flex h-[40px] items-center gap-2 rounded-2xl bg-[color:var(--accent)] px-4 text-sm font-semibold text-slate-950 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
        >
          <Plus className="h-4 w-4" /> Tambah Wishlist
        </button>
      </PageHeader>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleImport}
        className="hidden"
      />

      <div className="space-y-6">
        <WishlistFilterBar
          filters={filters}
          categories={categories}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
        />

        {error ? (
          <div className="flex items-center justify-between rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <span>Gagal memuat wishlist. Coba lagi.</span>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1 rounded-xl border border-amber-500/40 px-3 py-1 text-xs font-semibold hover:bg-amber-500/20"
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Muat ulang
            </button>
          </div>
        ) : null}

        {loading ? (
          renderSkeleton()
        ) : items.length === 0 ? (
          renderEmpty()
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted">
              Menampilkan {items.length} dari {total} wishlist
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <WishlistCard
                  key={item.id}
                  item={item}
                  categoryName={item.category_id ? categoryMap.get(item.category_id) ?? null : null}
                  selected={selectedIds.includes(item.id)}
                  onSelectChange={toggleSelection}
                  onEdit={handleEditItem}
                  onDelete={(target) => setPendingDelete(target)}
                  onMarkPurchased={handleMarkPurchased}
                  onMakeGoal={handleMakeGoal}
                  onCopyToTransaction={handleCopyTransaction}
                />
              ))}
            </div>
            {hasMore ? (
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex h-[44px] items-center justify-center rounded-2xl border border-slate-800 px-6 text-sm font-medium text-text transition hover:border-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingMore ? 'Memuat…' : 'Muat lebih'}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <WishlistFormDialog
        open={formOpen}
        mode={formMode}
        initialData={editingItem}
        categories={categories}
        submitting={formSubmitting}
        onSubmit={handleFormSubmit}
        onClose={() => {
          setFormOpen(false);
          setEditingItem(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Hapus wishlist?"
        description={pendingDelete ? `Wishlist "${pendingDelete.title}" akan dihapus permanen.` : ''}
        confirmLabel="Hapus"
        destructive
        loading={deleteLoading}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDeleteItem}
      />

      <WishlistBatchToolbar
        open={selectedIds.length > 0}
        selectedCount={selectedIds.length}
        processing={batchProcessing}
        onClear={() => setSelectedIds([])}
        onDelete={handleBatchDelete}
        onChangeStatus={handleBatchStatus}
        onChangePriority={handleBatchPriority}
      />
    </Page>
  );
}
