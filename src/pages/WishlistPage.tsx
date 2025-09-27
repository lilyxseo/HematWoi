/**
 * WishlistPage merangkai seluruh komponen wishlist: filter, daftar kartu, form inline, dan toolbar batch.
 * Halaman ini mengelola sinkronisasi filter dengan URL, memuat data via useWishlist, dan menangani aksi optimistik.
 */
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import WishlistFilterBar, { type WishlistFilterState } from '../components/wishlist/WishlistFilterBar';
import WishlistCard from '../components/wishlist/WishlistCard';
import WishlistBatchToolbar from '../components/wishlist/WishlistBatchToolbar';
import WishlistForm from '../components/wishlist/WishlistForm';
import { IconPlus, IconX } from '../components/wishlist/WishlistIcons';
import { useToast } from '../context/ToastContext';
import { useWishlist } from '../hooks/useWishlist';
import { listCategories } from '../lib/api-categories';
import type { WishlistCreatePayload, WishlistItem, WishlistStatus } from '../lib/wishlistApi';

interface CategoryOption {
  id: string;
  name: string;
}

const DEFAULT_FILTERS: WishlistFilterState = {
  search: '',
  status: 'all',
  priority: 'all',
  categoryId: 'all',
  priceMin: '',
  priceMax: '',
  sort: 'newest',
};

const STATUS_VALUES = new Set(['planned', 'deferred', 'purchased', 'archived']);

function parseFilters(params: URLSearchParams): WishlistFilterState {
  const status = params.get('status');
  const priorityParam = params.get('priority');
  const priorityValue = priorityParam != null ? Number(priorityParam) : undefined;
  const categoryParam = params.get('category_id');
  const categoryId = categoryParam && categoryParam.trim() ? categoryParam : null;
  const sort = params.get('sort');
  return {
    search: params.get('search') ?? DEFAULT_FILTERS.search,
    status: STATUS_VALUES.has(status ?? '') ? (status as WishlistFilterState['status']) : DEFAULT_FILTERS.status,
    priority:
      priorityValue !== undefined &&
      Number.isInteger(priorityValue) &&
      priorityValue >= 1 &&
      priorityValue <= 5
        ? (priorityValue as WishlistFilterState['priority'])
        : DEFAULT_FILTERS.priority,
    categoryId: categoryId ?? DEFAULT_FILTERS.categoryId,
    priceMin: params.get('min_price') ?? DEFAULT_FILTERS.priceMin,
    priceMax: params.get('max_price') ?? DEFAULT_FILTERS.priceMax,
    sort:
      sort && ['newest', 'oldest', 'price-asc', 'price-desc', 'priority-desc', 'priority-asc'].includes(sort)
        ? (sort as WishlistFilterState['sort'])
        : DEFAULT_FILTERS.sort,
  };
}

function buildSearchParams(filters: WishlistFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.status !== 'all') params.set('status', String(filters.status));
  if (filters.priority !== 'all') params.set('priority', String(filters.priority));
  if (filters.categoryId !== 'all' && filters.categoryId) params.set('category_id', filters.categoryId);
  if (filters.priceMin.trim()) params.set('min_price', filters.priceMin.trim());
  if (filters.priceMax.trim()) params.set('max_price', filters.priceMax.trim());
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  return params;
}

function normalizeFilters(filters: WishlistFilterState) {
  return {
    search: filters.search.trim() || undefined,
    status: filters.status === 'all' ? undefined : (filters.status as WishlistStatus),
    priority: filters.priority === 'all' ? undefined : Number(filters.priority),
    categoryId: filters.categoryId === 'all' ? undefined : filters.categoryId,
    priceMin: filters.priceMin ? Number(filters.priceMin) : undefined,
    priceMax: filters.priceMax ? Number(filters.priceMax) : undefined,
    sort: filters.sort,
  } as const;
}

function focusTrap(ref: MutableRefObject<HTMLElement | null>) {
  const node = ref.current;
  if (!node) return () => {};
  const focusable = Array.from(
    node.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  first?.focus();
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab' && focusable.length) {
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };
  document.addEventListener('keydown', handleKeyDown);
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
}

export default function WishlistPage() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
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
    refetch,
  } = useWishlist(normalizedFilters);

  const isMutating = isCreating || isUpdating || isDeleting || isBulkUpdating || isBulkDeleting;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await listCategories();
        if (!active) return;
        setCategories(result.map((category) => ({ id: category.id, name: category.name })));
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
        const entry = entries[0];
        if (entry?.isIntersecting) {
          fetchNextPage().catch(() => {
            // noop, kesalahan akan ditangani oleh react-query
          });
        }
      },
      { rootMargin: '240px' }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, fetchNextPage, items.length]);

  useEffect(() => {
    if (!formOpen) return;
    const cleanup = focusTrap(drawerRef);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFormOpen(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      cleanup();
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [formOpen]);

  const handleFilterChange = (next: WishlistFilterState) => {
    const params = buildSearchParams(next);
    setSearchParams(params, { replace: true });
  };

  const handleResetFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true });
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

  const handleBatchDelete = async () => {
    const count = selectedIds.size;
    if (!count) return;
    const confirmed = window.confirm(`Hapus ${count} wishlist terpilih?`);
    if (!confirmed) return;
    try {
      await bulkDelete({ ids: Array.from(selectedIds) });
      addToast('Wishlist terpilih dihapus', 'success');
      setSelectedIds(new Set());
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[Wishlist] bulk delete error', err);
      }
      addToast('Gagal menghapus wishlist terpilih', 'error');
    }
  };

  const handleBatchStatus = async (status: WishlistStatus) => {
    if (!selectedIds.size) return;
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
    if (!selectedIds.size) return;
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

  const selectedCount = selectedIds.size;
  const hasError = isError && !isLoading;

  const renderSkeletons = () => (
    <div className="flex flex-col space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3">
      {Array.from({ length: 9 }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
          <div className="mb-4 aspect-video rounded-2xl bg-slate-800/60" />
          <div className="h-4 w-3/4 rounded-full bg-slate-800/60" />
          <div className="mt-2 h-3 w-1/2 rounded-full bg-slate-800/50" />
          <div className="mt-5 flex gap-2">
            <div className="h-10 w-20 rounded-full bg-slate-800/50" />
            <div className="h-10 w-20 rounded-full bg-slate-800/40" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-800/70 bg-slate-950/70 px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-900/80 text-[var(--accent)]">
        <IconPlus className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-slate-100">Wishlist masih kosong</h3>
      <p className="mt-2 max-w-md text-sm text-slate-400">
        Simpan ide belanja dan wujudkan menjadi goal atau transaksi saat waktunya tepat.
      </p>
      <button
        type="button"
        onClick={handleAdd}
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <IconPlus className="h-4 w-4" aria-hidden="true" /> Tambah wishlist
      </button>
    </div>
  );

  return (
    <Page>
      <PageHeader
        title="Wishlist"
        description="Kelola daftar keinginan dan siap jadikan goal atau transaksi kapan pun."
      >
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <IconPlus className="h-4 w-4" aria-hidden="true" /> Wishlist Baru
        </button>
      </PageHeader>

      <div className="space-y-6">
        <WishlistFilterBar
          filters={filters}
          categories={categories}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
        />

        {hasError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            <span>
              Terjadi kesalahan saat memuat wishlist.{' '}
              {error instanceof Error ? error.message : 'Silakan coba lagi.'}
            </span>
            <button
              type="button"
              onClick={() => {
                refetch().catch(() => {
                  /* handled by react-query */
                });
              }}
              className="inline-flex h-9 items-center rounded-2xl bg-rose-500/20 px-3 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
            >
              Coba lagi
            </button>
          </div>
        ) : null}

        {isLoading ? (
          renderSkeletons()
        ) : items.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3">
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
                  className="flex h-12 w-full max-w-[220px] items-center justify-center rounded-full bg-slate-900/60 text-sm text-slate-400"
                >
                  {isFetchingNextPage ? 'Memuat…' : 'Scroll untuk memuat lainnya'}
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

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            className="flex-1 bg-slate-950/70 backdrop-blur"
            aria-label="Tutup form wishlist"
            onClick={() => setFormOpen(false)}
          />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            className="flex w-full max-w-md flex-col overflow-hidden border-l border-slate-800 bg-slate-950/95 shadow-[0_0_60px_rgba(15,23,42,0.6)]"
          >
            <header className="flex items-center justify-between border-b border-slate-800/70 bg-slate-950/80 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  {formMode === 'create' ? 'Tambah Wishlist' : 'Edit Wishlist'}
                </h2>
                <p className="text-xs text-slate-400">Isi detail wishlist dan simpan tanpa meninggalkan halaman.</p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                aria-label="Tutup panel form"
              >
                <IconX className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>
            <div className="flex-1 overflow-hidden px-6 py-6">
              <WishlistForm
                mode={formMode}
                initialData={editingItem}
                categories={categories}
                submitting={isMutating}
                onSubmit={handleFormSubmit}
                onCancel={() => setFormOpen(false)}
              />
            </div>
          </aside>
        </div>
      ) : null}
    </Page>
  );
}
