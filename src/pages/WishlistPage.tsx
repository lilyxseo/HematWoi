import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type SVGProps,
} from 'react';
import { useNavigate } from 'react-router-dom';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import WishlistFilterBar, {
  type WishlistFilterState,
} from '../components/wishlist/WishlistFilterBar';
import WishlistCard from '../components/wishlist/WishlistCard';
import WishlistForm from '../components/wishlist/WishlistForm';
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

function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true" {...props}>
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m7 9 5-5 5 5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 20h14" />
    </svg>
  );
}

function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m7 11 5 5 5-5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 20h14" />
    </svg>
  );
}

function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true" {...props}>
      <path strokeLinecap="round" d="m6 6 12 12" />
      <path strokeLinecap="round" d="m18 6-12 12" />
    </svg>
  );
}

export default function WishlistPage() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<WishlistFilterState>(INITIAL_FILTERS);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
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
  const formSubmitting = formMode === 'create' ? isCreating : isUpdating;

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

  const handleAdd = (event?: MouseEvent<HTMLButtonElement>) => {
    if (event?.currentTarget) {
      lastTriggerRef.current = event.currentTarget;
    }
    setFormMode('create');
    setEditingItem(null);
    setFormError(null);
    setFormOpen(true);
  };

  const handleEdit = (item: WishlistItem) => {
    setFormMode('edit');
    setEditingItem(item);
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setFormError(null);
    setEditingItem(null);
  }, []);

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
    setFormError(null);
    if (formMode === 'create') {
      try {
        await createItem(payload);
        addToast('Wishlist berhasil ditambahkan', 'success');
        closeForm();
      } catch (err) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('[Wishlist] create error', err);
        }
        addToast('Gagal menambahkan wishlist', 'error');
        setFormError(err instanceof Error ? err.message : 'Gagal menambahkan wishlist.');
      }
      return;
    }

    if (!editingItem) return;

    try {
      await updateItem({ id: editingItem.id, patch: payload });
      addToast('Wishlist berhasil diperbarui', 'success');
      closeForm();
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[Wishlist] update error', err);
      }
      addToast('Gagal memperbarui wishlist', 'error');
      setFormError(err instanceof Error ? err.message : 'Gagal memperbarui wishlist.');
    }
  };

  useEffect(() => {
    if (!formOpen) return;
    const dialogNode = dialogRef.current;
    if (!dialogNode) return;

    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const getFocusableElements = () =>
      Array.from(dialogNode.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) =>
          !element.hasAttribute('disabled') &&
          element.getAttribute('aria-hidden') !== 'true' &&
          element.tabIndex !== -1
      );

    const focusElements = () => {
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        window.setTimeout(() => {
          focusable[0]?.focus();
        }, 0);
      }
    };

    focusElements();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeForm();
        return;
      }
      if (event.key === 'Tab') {
        const focusable = getFocusableElements();
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (event.shiftKey) {
          if (active === first || !dialogNode.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else if (active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [formOpen, closeForm]);

  useEffect(() => {
    if (!formOpen && lastTriggerRef.current) {
      lastTriggerRef.current.focus();
      lastTriggerRef.current = null;
    }
  }, [formOpen]);

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
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-slate-800 bg-slate-950/60 px-6 py-16 text-center">
      <div className="rounded-full border border-slate-800 bg-slate-900/80 px-4 py-2 text-sm text-slate-400">
        Wishlist Anda masih kosong
      </div>
      <p className="max-w-sm text-balance text-sm text-slate-400">
        Simpan ide belanja tanpa komitmen finansial. Tambahkan item wishlist dan ubah menjadi goal atau transaksi kapan saja.
      </p>
      <button
        type="button"
        onClick={(event) => handleAdd(event)}
        className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <PlusIcon className="h-5 w-5" /> Tambah Wishlist
      </button>
    </div>
  );

  const hasError = isError && !isLoading;

  return (
    <Page>
      <PageHeader title="Wishlist" description="Kelola daftar keinginan dan siap jadikan goal atau transaksi kapan pun.">
        <button
          type="button"
          onClick={handleImportClick}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 text-sm font-medium text-slate-100 transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          disabled={importing || isMutating}
        >
          <UploadIcon className="h-4 w-4" /> {importing ? 'Mengimpor…' : 'Impor CSV'}
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 text-sm font-medium text-slate-100 transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          disabled={exporting}
        >
          <DownloadIcon className="h-4 w-4" /> {exporting ? 'Menyiapkan…' : 'Ekspor CSV'}
        </button>
        <button
          type="button"
          onClick={(event) => handleAdd(event)}
          className="hidden h-11 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] md:inline-flex"
        >
          <PlusIcon className="h-5 w-5" /> Tambah Wishlist
        </button>
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
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            Terjadi kesalahan saat memuat wishlist. {error instanceof Error ? error.message : ''}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ml-3 inline-flex items-center text-rose-100 underline-offset-4 hover:underline"
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
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
                <div ref={loadMoreRef} className="h-10 w-full max-w-[200px] rounded-full bg-transparent text-center text-sm text-slate-500">
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

      <button
        type="button"
        onClick={(event) => handleAdd(event)}
        className={`fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg ring-2 ring-slate-900/40 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 md:hidden ${
          formOpen ? 'pointer-events-none opacity-0' : ''
        }`}
        aria-label="Tambah wishlist"
      >
        <PlusIcon className="h-7 w-7" />
      </button>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" onClick={closeForm} />
          <div className="relative z-10 w-full max-w-lg">
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="wishlist-form-title"
              className="relative w-full rounded-2xl bg-slate-900 p-5 shadow-2xl ring-1 ring-slate-800 md:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent)]/20 text-[var(--accent)]">
                    <PlusIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 id="wishlist-form-title" className="text-lg font-semibold text-slate-100">
                      {formMode === 'create' ? 'Tambah Wishlist' : 'Edit Wishlist'}
                    </h2>
                    <p className="text-sm text-slate-400">Simpan ide belanja dan kelola prioritasnya.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  aria-label="Tutup form wishlist"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-5">
                <WishlistForm
                  mode={formMode}
                  categories={categories}
                  initialData={editingItem}
                  submitting={formSubmitting}
                  errorMessage={formError}
                  onSubmit={handleFormSubmit}
                  onCancel={closeForm}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Page>
  );
}
