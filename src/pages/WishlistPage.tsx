/**
 * WishlistPage composes filters, wishlist grid, inline form modal, and batch actions for wishlist management.
 * It uses react-query backed hooks for optimistic mutations and keeps filter state in the URL for persistence.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import WishlistFilterBar, {
  type WishlistFilterState,
} from '../components/wishlist/WishlistFilterBar';
import WishlistCard from '../components/wishlist/WishlistCard';
import WishlistForm from '../components/wishlist/WishlistForm';
import WishlistBatchToolbar from '../components/wishlist/WishlistBatchToolbar';
import { IconPlus } from '../components/wishlist/icons';
import { useToast } from '../context/ToastContext';
import { useWishlist } from '../hooks/useWishlist';
import { listCategories } from '../lib/api-categories';
import type { WishlistCreatePayload, WishlistItem, WishlistStatus } from '../lib/wishlistApi';

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

function parseFiltersFromSearch(params: URLSearchParams): WishlistFilterState {
  const statusParam = params.get('status');
  const status: WishlistFilterState['status'] =
    statusParam === 'planned' ||
    statusParam === 'deferred' ||
    statusParam === 'purchased' ||
    statusParam === 'archived'
      ? statusParam
      : 'all';
  const priorityParam = params.get('priority');
  const allowedPriority = ['1', '2', '3', '4', '5'];
  const priority: WishlistFilterState['priority'] = allowedPriority.includes(priorityParam ?? '')
    ? (priorityParam as WishlistFilterState['priority'])
    : 'all';
  const sortParam = params.get('sort');
  const allowedSort: WishlistFilterState['sort'][] = [
    'newest',
    'oldest',
    'price-asc',
    'price-desc',
    'priority-asc',
    'priority-desc',
  ];
  const sort = allowedSort.includes((sortParam ?? 'newest') as WishlistFilterState['sort'])
    ? ((sortParam as WishlistFilterState['sort']) ?? 'newest')
    : 'newest';
  return {
    search: params.get('search') ?? '',
    status,
    priority,
    categoryId: (params.get('categoryId') as WishlistFilterState['categoryId']) ?? 'all',
    priceMin: params.get('priceMin') ?? '',
    priceMax: params.get('priceMax') ?? '',
    sort,
  };
}

function filtersToSearchParams(filters: WishlistFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.priority !== 'all') params.set('priority', filters.priority);
  if (filters.categoryId !== 'all') params.set('categoryId', filters.categoryId);
  if (filters.priceMin) params.set('priceMin', filters.priceMin);
  if (filters.priceMax) params.set('priceMax', filters.priceMax);
  if (filters.sort && filters.sort !== 'newest') params.set('sort', filters.sort);
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

function renderSkeletons() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 9 }).map((_, index) => (
        <div
          key={`wishlist-skeleton-${index}`}
          className="flex animate-pulse flex-col overflow-hidden rounded-2xl bg-slate-900/60 ring-1 ring-slate-800"
        >
          <div className="aspect-video w-full bg-slate-800/70" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-2/3 rounded-full bg-slate-800" />
            <div className="h-3 w-1/2 rounded-full bg-slate-800/80" />
            <div className="h-20 rounded-2xl bg-slate-800/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

function renderEmptyState(onAdd: () => void) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-800/70 bg-slate-950/60 px-6 py-16 text-center text-slate-300">
      <p className="text-lg font-semibold text-slate-100">Wishlist kamu masih kosong</p>
      <p className="mt-2 max-w-md text-sm text-slate-400">
        Simpan ide belanja, tandai prioritasnya, dan siapkan diri untuk jadikan goal atau transaksi kapan saja.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      >
        <IconPlus className="h-4 w-4" aria-hidden="true" /> Tambah Wishlist
      </button>
    </div>
  );
}

export default function WishlistPage() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamString = searchParams.toString();
  const [filters, setFilters] = useState<WishlistFilterState>(() => parseFiltersFromSearch(searchParams));
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const nextFilters = parseFiltersFromSearch(searchParams);
    setFilters((prev) => {
      const prevKey = JSON.stringify(prev);
      const nextKey = JSON.stringify(nextFilters);
      return prevKey === nextKey ? prev : nextFilters;
    });
  }, [searchParams]);

  useEffect(() => {
    const params = filtersToSearchParams(filters);
    const stringified = params.toString();
    if (stringified !== searchParamString) {
      setSearchParams(params, { replace: true });
    }
  }, [filters, searchParamString, setSearchParams]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await listCategories();
        if (!active) return;
        setCategories(list.map((category) => ({ id: category.id, name: category.name })));
      } catch (error) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('[Wishlist] gagal memuat kategori', error);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
        const first = entries[0];
        if (first?.isIntersecting && !isFetchingNextPage) {
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
    const confirmed = window.confirm(`Hapus ${selectedCount} wishlist terpilih?`);
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

  const hasError = isError && !isLoading;

  return (
    <Page>
      <PageHeader title="Wishlist" description="Satu tempat untuk mengingat setiap barang impian dan siap eksekusi kapan saja.">
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <IconPlus className="h-4 w-4" aria-hidden="true" /> Wishlist Baru
        </button>
      </PageHeader>

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
          renderEmptyState(handleAdd)
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
              <p className="text-center text-xs text-slate-500">Menampilkan {items.length} dari {total} wishlist</p>
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

      <WishlistForm
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
