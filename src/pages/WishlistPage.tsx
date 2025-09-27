import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ArrowDownToLine, FileUp, Plus, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import WishlistFilterBar, {
  type WishlistFilterState,
} from '../components/wishlist/WishlistFilterBar';
import WishlistCard from '../components/wishlist/WishlistCard';
import WishlistFormDialog from '../components/wishlist/WishlistFormDialog';
import WishlistBatchToolbar from '../components/wishlist/WishlistBatchToolbar';
import { useToast } from '../context/ToastContext';
import { useWishlist } from '../hooks/useWishlist';
import { listCategories } from '../lib/api-categories';
import type { WishlistCreatePayload, WishlistItem, WishlistStatus } from '../lib/wishlistApi';
import { listWishlist } from '../lib/wishlistApi';

interface CategoryOption {
  id: string;
  name: string;
}

const INITIAL_FILTERS: WishlistFilterState = {
  search: '',
  status: 'all',
  priority: 'all',
  categoryId: 'all',
  priceMin: '',
  priceMax: '',
  sort: 'newest',
};

function normalizeFilters(filters: WishlistFilterState) {
  return {
    search: filters.search.trim() || undefined,
    status: filters.status === 'all' ? undefined : filters.status,
    priority: filters.priority === 'all' ? undefined : Number(filters.priority),
    categoryId: filters.categoryId === 'all' ? undefined : filters.categoryId,
    priceMin: filters.priceMin ? Number(filters.priceMin) : undefined,
    priceMax: filters.priceMax ? Number(filters.priceMax) : undefined,
    sort: filters.sort,
  } as const;
}

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value == null) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function parseCsv(content: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let insideQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    if (char === '"') {
      const nextChar = content[i + 1];
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === ',' && !insideQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && content[i + 1] === '\n') {
        i += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length) {
    row.push(current);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const header = rows.shift() ?? [];
  const cleanedHeader = header.map((cell) => cell.trim());

  return rows
    .filter((cells) => cells.some((cell) => cell.trim().length > 0))
    .map((cells) => {
      const record: Record<string, string> = {};
      cleanedHeader.forEach((key, index) => {
        record[key] = (cells[index] ?? '').trim();
      });
      return record;
    });
}

export default function WishlistPage() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<WishlistFilterState>(INITIAL_FILTERS);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const normalizedFilters = useMemo(() => normalizeFilters(filters), [filters]);

  const {
    items,
    total,
    isLoading,
    isError,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    createItem,
    updateItem,
    deleteItem,
    bulkUpdate,
    bulkDelete,
    isCreating,
    isUpdating,
    isDeleting,
    isBulkUpdating,
    isBulkDeleting,
  } = useWishlist(normalizedFilters);

  const isMutating = isCreating || isUpdating || isDeleting || isBulkUpdating || isBulkDeleting;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await listCategories();
        if (!active) return;
        setCategories(list.map((category) => ({ id: category.id, name: category.name })));
      } catch (err) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('[Wishlist] gagal memuat kategori', err);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const item of items) {
        if (prev.has(item.id)) {
          next.add(item.id);
        }
      }
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  useEffect(() => {
    if (!hasNextPage) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '240px' }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, fetchNextPage, isFetchingNextPage, items.length]);

  const handleFilterChange = (next: WishlistFilterState) => {
    setFilters(next);
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const handleAdd = () => {
    setFormMode('create');
    setEditingItem(null);
    setFormOpen(true);
  };

  const handleEdit = (item: WishlistItem) => {
    setFormMode('edit');
    setEditingItem(item);
    setFormOpen(true);
  };

  const handleSelectChange = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(() => new Set());
  };

  const selectedCount = selectedIds.size;

  const handleDelete = async (item: WishlistItem) => {
    const confirmed = window.confirm(`Hapus "${item.title}" dari wishlist?`);
    if (!confirmed) return;
    try {
      await deleteItem({ id: item.id });
      addToast('Wishlist berhasil dihapus', 'success');
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[Wishlist] delete error', err);
      }
      addToast('Gagal menghapus wishlist', 'error');
    }
  };

  const handleFormSubmit = async (payload: WishlistCreatePayload) => {
    if (formMode === 'create') {
      try {
        await createItem(payload);
        addToast('Wishlist berhasil ditambahkan', 'success');
        setFormOpen(false);
      } catch (err) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('[Wishlist] create error', err);
        }
        addToast('Gagal menambahkan wishlist', 'error');
      }
      return;
    }

    if (!editingItem) return;

    try {
      await updateItem({ id: editingItem.id, patch: payload });
      addToast('Wishlist berhasil diperbarui', 'success');
      setFormOpen(false);
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[Wishlist] update error', err);
      }
      addToast('Gagal memperbarui wishlist', 'error');
    }
  };

  const handleMarkPurchased = async (item: WishlistItem) => {
    try {
      await updateItem({ id: item.id, patch: { status: 'purchased' } });
      addToast('Ditandai sebagai dibeli', 'success');
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[Wishlist] mark purchased error', err);
      }
      addToast('Gagal memperbarui status', 'error');
    }
  };

  const handleMakeGoal = (item: WishlistItem) => {
    const params = new URLSearchParams();
    params.set('title', item.title);
    if (item.estimated_price != null) {
      params.set('target', String(Math.round(item.estimated_price)));
    }
    if (item.category_id) {
      params.set('category_id', item.category_id);
    }
    navigate(`/goals/new?${params.toString()}`);
  };

  const handleCopyToTransaction = (item: WishlistItem) => {
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
    addToast('Form transaksi terisi dari wishlist', 'info');
  };

  const handleBatchDelete = async () => {
    if (!selectedCount) return;
    const confirmed = window.confirm(`Hapus ${selectedCount} item wishlist terpilih?`);
    if (!confirmed) return;
    try {
      await bulkDelete({ ids: Array.from(selectedIds) });
      addToast('Wishlist terpilih dihapus', 'success');
      setSelectedIds(() => new Set());
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[Wishlist] bulk delete error', err);
      }
      addToast('Gagal menghapus wishlist terpilih', 'error');
    }
  };

  const handleBatchStatus = async (status: WishlistStatus) => {
    if (!selectedCount) return;
    try {
      await bulkUpdate({ ids: Array.from(selectedIds), patch: { status } });
      addToast('Status wishlist diperbarui', 'success');
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[Wishlist] bulk status error', err);
      }
      addToast('Gagal memperbarui status', 'error');
    }
  };

  const handleBatchPriority = async (priority: number) => {
    if (!selectedCount) return;
    try {
      await bulkUpdate({ ids: Array.from(selectedIds), patch: { priority } });
      addToast('Prioritas wishlist diperbarui', 'success');
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[Wishlist] bulk priority error', err);
      }
      addToast('Gagal memperbarui prioritas', 'error');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const records = parseCsv(text);
      if (!records.length) {
        addToast('CSV kosong atau tidak valid', 'warning');
        return;
      }
      let successCount = 0;
      const allowedStatus: WishlistStatus[] = ['planned', 'deferred', 'purchased', 'archived'];
      for (const record of records) {
        if (!record.title) continue;
        const estimated = record.estimated_price ? Number(record.estimated_price) : null;
        const priority = record.priority ? Number(record.priority) : null;
        const status = allowedStatus.includes(record.status as WishlistStatus)
          ? (record.status as WishlistStatus)
          : 'planned';
        const payload: WishlistCreatePayload = {
          title: record.title,
          estimated_price: Number.isFinite(estimated ?? NaN) && (estimated ?? 0) >= 0 ? estimated : null,
          priority: Number.isInteger(priority ?? NaN) && priority != null && priority >= 1 && priority <= 5 ? priority : null,
          status,
          category_id: record.category_id || null,
          store_url: record.store_url || undefined,
          note: record.note || undefined,
          image_url: record.image_url || undefined,
        };
        try {
          await createItem(payload);
          successCount += 1;
        } catch (err) {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.error('[Wishlist] import item error', err);
          }
        }
      }
      addToast(`Berhasil mengimpor ${successCount} wishlist`, successCount ? 'success' : 'warning');
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[Wishlist] import error', err);
      }
      addToast('Gagal mengimpor CSV', 'error');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const rows: WishlistItem[] = [];
      let page = 1;
      const filterPayload = normalizeFilters(filters);
      for (let i = 0; i < 20; i += 1) {
        const result = await listWishlist({ ...filterPayload, page, pageSize: 200 });
        rows.push(...result.items);
        if (!result.hasMore) break;
        page += 1;
      }
      const header = [
        'title',
        'estimated_price',
        'priority',
        'status',
        'category_id',
        'category_name',
        'store_url',
        'note',
        'image_url',
        'created_at',
        'updated_at',
      ];
      const lines = [header.join(',')];
      for (const row of rows) {
        lines.push(
          [
            escapeCsvValue(row.title),
            escapeCsvValue(row.estimated_price ?? ''),
            escapeCsvValue(row.priority ?? ''),
            escapeCsvValue(row.status),
            escapeCsvValue(row.category_id ?? ''),
            escapeCsvValue(row.category?.name ?? ''),
            escapeCsvValue(row.store_url ?? ''),
            escapeCsvValue(row.note ?? ''),
            escapeCsvValue(row.image_url ?? ''),
            escapeCsvValue(row.created_at),
            escapeCsvValue(row.updated_at),
          ].join(',')
        );
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wishlist-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addToast('Wishlist diekspor sebagai CSV', 'success');
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[Wishlist] export error', err);
      }
      addToast('Gagal mengekspor wishlist', 'error');
    } finally {
      setExporting(false);
    }
  }, [filters, addToast]);

  const renderSkeletons = () => {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className="h-48 animate-pulse rounded-2xl bg-slate-900/60 ring-1 ring-slate-800"
          />
        ))}
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center gap-5 rounded-3xl border border-dashed border-slate-800/70 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950/80 px-8 py-16 text-center shadow-inner">
      <div className="flex items-center gap-2 rounded-full border border-slate-800/80 bg-slate-950/80 px-4 py-2 text-sm text-slate-300">
        <Sparkles className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" /> Wishlist Anda masih kosong
      </div>
      <p className="max-w-md text-balance text-sm text-slate-400">
        Simpan ide belanja tanpa komitmen finansial. Tambahkan item wishlist dan ubah menjadi goal atau transaksi kapan saja.
      </p>
      <button
        type="button"
        onClick={handleAdd}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-slate-950 shadow-lg shadow-[var(--accent)]/30 transition hover:-translate-y-0.5 hover:bg-[var(--accent)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        <Plus className="h-4 w-4" aria-hidden="true" /> Tambah Wishlist
      </button>
    </div>
  );

  const hasError = isError && !isLoading;

  return (
    <Page>
      <PageHeader title="Wishlist" description="Kelola daftar keinginan dan siap jadikan goal atau transaksi kapan pun.">
        <div className="flex w-full flex-wrap items-center justify-start gap-2 rounded-3xl border border-slate-800/80 bg-slate-950/70 p-2 shadow-inner shadow-slate-950/40 sm:justify-end">
          <button
            type="button"
            onClick={handleImportClick}
            className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-full border border-slate-800 bg-slate-950/80 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-[var(--accent)] hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            disabled={importing || isMutating}
          >
            <FileUp className="h-4 w-4" aria-hidden="true" /> {importing ? 'Mengimpor…' : 'Impor CSV'}
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-full border border-slate-800 bg-slate-950/80 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-[var(--accent)] hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            disabled={exporting}
          >
            <ArrowDownToLine className="h-4 w-4" aria-hidden="true" /> {exporting ? 'Menyiapkan…' : 'Ekspor CSV'}
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/70 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-[var(--accent)]/30 transition hover:-translate-y-0.5 hover:from-[var(--accent)] hover:to-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Tambah Wishlist
          </button>
        </div>
      </PageHeader>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleImportFile}
      />

      <div className="space-y-6">
        <WishlistFilterBar filters={filters} categories={categories} onChange={handleFilterChange} onReset={handleResetFilters} />

        {hasError ? (
          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            Terjadi kesalahan saat memuat wishlist. {error instanceof Error ? error.message : ''}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ml-3 inline-flex items-center gap-1 text-rose-100 underline-offset-4 hover:underline"
            >
              Muat ulang
            </button>
          </div>
        ) : null}

        {isLoading ? (
          renderSkeletons()
        ) : items.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <WishlistCard
                  key={item.id}
                  item={item}
                  selected={selectedIds.has(item.id)}
                  onSelectChange={(selected) => handleSelectChange(item.id, selected)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onMarkPurchased={handleMarkPurchased}
                  onMakeGoal={handleMakeGoal}
                  onCopyToTransaction={handleCopyToTransaction}
                  disabled={isMutating}
                />
              ))}
            </div>
            {hasNextPage ? (
              <div className="flex justify-center">
                <div
                  ref={loadMoreRef}
                  className="flex h-10 w-full max-w-[220px] items-center justify-center rounded-full border border-slate-800/80 bg-slate-950/70 text-center text-sm text-slate-400"
                >
                  {isFetchingNextPage ? 'Memuat…' : 'Memuat lainnya'}
                </div>
              </div>
            ) : null}
            {total ? (
              <p className="text-center text-xs text-slate-500">
                Menampilkan {items.length} dari {total} wishlist
              </p>
            ) : null}
          </div>
        )}
      </div>

      {selectedCount > 0 ? (
        <WishlistBatchToolbar
          selectedCount={selectedCount}
          onClear={handleClearSelection}
          onDelete={handleBatchDelete}
          onStatusChange={handleBatchStatus}
          onPriorityChange={handleBatchPriority}
          disabled={isMutating}
        />
      ) : null}

      <WishlistFormDialog
        open={formOpen}
        mode={formMode}
        initialData={editingItem}
        categories={categories}
        submitting={isMutating}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
      />
    </Page>
  );
}
