import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import WishlistFilterBar, {
  type WishlistFilterState,
} from '../components/wishlist/WishlistFilterBar';
import WishlistCard from '../components/wishlist/WishlistCard';
import WishlistForm, { type CategoryOption } from '../components/wishlist/WishlistForm';
import WishlistBatchToolbar from '../components/wishlist/WishlistBatchToolbar';
import { useToast } from '../context/ToastContext';
import { useWishlist } from '../hooks/useWishlist';
import { listCategories } from '../lib/api-categories';
import type { WishlistCreatePayload, WishlistItem, WishlistStatus } from '../lib/wishlistApi';
import { listWishlist } from '../lib/wishlistApi';

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
  const [formError, setFormError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const desktopAddButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileAddButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
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
  const isFormSubmitting = formMode === 'create' ? isCreating : isUpdating;

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

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingItem(null);
    setFormError(null);
  }, []);

  useEffect(() => {
    if (!formOpen) return;
    const dialogNode = dialogRef.current;
    if (!dialogNode) return;

    const focusableSelectors =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(
      dialogNode.querySelectorAll<HTMLElement>(focusableSelectors)
    ).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeForm();
        return;
      }

      if (event.key === 'Tab' && focusable.length > 0) {
        if (event.shiftKey) {
          if (document.activeElement === first || !dialogNode.contains(document.activeElement)) {
            event.preventDefault();
            last?.focus();
          }
        } else if (document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    window.setTimeout(() => {
      const initialFocus = dialogNode.querySelector<HTMLElement>('#wishlist-title');
      if (initialFocus && !initialFocus.hasAttribute('disabled')) {
        initialFocus.focus({ preventScroll: true });
      } else {
        first?.focus({ preventScroll: true });
      }
    }, 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [formOpen, closeForm]);

  useEffect(() => {
    if (formOpen) return;
    const node = lastFocusRef.current;
    if (node) {
      window.setTimeout(() => {
        node.focus({ preventScroll: true });
      }, 0);
      lastFocusRef.current = null;
    }
  }, [formOpen]);

  const handleOverlayMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === overlayRef.current) {
      closeForm();
    }
  };

  const handleFilterChange = (next: WishlistFilterState) => {
    setFilters(next);
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const handleAddDesktop = (event: MouseEvent<HTMLButtonElement>) => {
    lastFocusRef.current = event.currentTarget;
    setFormMode('create');
    setEditingItem(null);
    setFormError(null);
    setFormOpen(true);
  };

  const handleAddMobile = (event: MouseEvent<HTMLButtonElement>) => {
    lastFocusRef.current = event.currentTarget;
    setFormMode('create');
    setEditingItem(null);
    setFormError(null);
    setFormOpen(true);
  };

  const handleEdit = (item: WishlistItem) => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      lastFocusRef.current = active;
    }
    setFormMode('edit');
    setEditingItem(item);
    setFormError(null);
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
    try {
      setFormError(null);
      if (formMode === 'create') {
        await createItem(payload);
        addToast('Wishlist berhasil ditambahkan', 'success');
      } else if (editingItem) {
        await updateItem({ id: editingItem.id, patch: payload });
        addToast('Wishlist berhasil diperbarui', 'success');
      }
      closeForm();
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[Wishlist] submit error', err);
      }
      const message = err instanceof Error ? err.message : 'Gagal menyimpan wishlist.';
      setFormError(message);
      addToast(
        formMode === 'create' ? 'Gagal menambahkan wishlist' : 'Gagal memperbarui wishlist',
        'error'
      );
      throw err;
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
          priority:
            Number.isInteger(priority ?? NaN) && priority != null && priority >= 1 && priority <= 5
              ? priority
              : null,
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

  const hasError = isError && !isLoading;

  const renderSkeletons = () => (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 9 }).map((_, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={index} className="h-52 animate-pulse rounded-2xl bg-slate-900/60 ring-1 ring-slate-800" />
      ))}
    </div>
  );

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-slate-800 bg-slate-950/60 px-6 py-16 text-center">
      <div className="rounded-full border border-slate-800 bg-slate-900/80 px-4 py-2 text-sm text-slate-400">
        Wishlist Anda masih kosong
      </div>
      <p className="max-w-sm text-balance text-sm text-slate-400">
        Simpan ide belanja, atur prioritasnya, lalu ubah menjadi goal atau transaksi kapan saja.
      </p>
      <button
        type="button"
        onClick={() => {
          const active = document.activeElement;
          if (active instanceof HTMLElement) {
            lastFocusRef.current = active;
          }
          setFormMode('create');
          setEditingItem(null);
          setFormError(null);
          setFormOpen(true);
        }}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <PlusIcon /> Tambah Wishlist
      </button>
    </div>
  );

  const initialFormData = formMode === 'edit' ? editingItem : null;

  return (
    <Page>
      <PageHeader
        title="Wishlist"
        description="Kelola daftar keinginan dan siap jadikan goal atau transaksi kapan pun."
      >
        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={handleImportClick}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 text-sm font-medium text-slate-100 transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            disabled={importing || isMutating}
          >
            <UploadIcon /> {importing ? 'Mengimpor…' : 'Impor CSV'}
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 text-sm font-medium text-slate-100 transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            disabled={exporting}
          >
            <DownloadIcon /> {exporting ? 'Menyiapkan…' : 'Ekspor CSV'}
          </button>
          <button
            ref={desktopAddButtonRef}
            type="button"
            onClick={handleAddDesktop}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <PlusIcon /> Tambah Wishlist
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
        <WishlistFilterBar
          filters={filters}
          categories={categories}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
        />

        {hasError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span>
              Terjadi kesalahan saat memuat wishlist. {error instanceof Error ? error.message : ''}
            </span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl border border-rose-500/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-200 transition hover:bg-rose-500/10"
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
                <div
                  ref={loadMoreRef}
                  className="h-10 w-full max-w-[200px] rounded-full bg-transparent text-center text-sm text-slate-500"
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

      <button
        ref={mobileAddButtonRef}
        type="button"
        onClick={handleAddMobile}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg ring-2 ring-slate-900/40 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent)]/60 md:hidden"
        aria-label="Tambah wishlist"
      >
        <PlusIconLarge />
      </button>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            ref={overlayRef}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onMouseDown={handleOverlayMouseDown}
            aria-hidden="true"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wishlist-form-title"
            className="relative z-10 w-full max-w-lg rounded-2xl bg-slate-900 p-5 shadow-2xl ring-1 ring-slate-800 md:p-6"
          >
            <button
              type="button"
              onClick={closeForm}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label="Tutup form wishlist"
              disabled={isFormSubmitting}
            >
              <CloseIcon />
            </button>
            <WishlistForm
              mode={formMode}
              initialData={initialFormData}
              categories={categories}
              submitting={isFormSubmitting}
              serverError={formError}
              onCancel={closeForm}
              onSubmit={handleFormSubmit}
            />
          </div>
        </div>
      ) : null}
    </Page>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5">
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function PlusIconLarge() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <path strokeLinecap="round" d="M12 4v16M4 12h16" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m7 9 5-5 5 5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h16" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m7 11 5 5 5-5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
      <path strokeLinecap="round" d="m6 6 12 12M6 18 18 6" />
    </svg>
  );
}
