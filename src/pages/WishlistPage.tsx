import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import WishlistFilterBar, { type WishlistFilterState } from '../components/wishlist/WishlistFilterBar';
import WishlistCard from '../components/wishlist/WishlistCard';
import WishlistBatchToolbar from '../components/wishlist/WishlistBatchToolbar';
import WishlistForm, { type CategoryOption } from '../components/wishlist/WishlistForm';
import { useToast } from '../context/ToastContext';
import { useWishlist } from '../hooks/useWishlist';
import { listCategories } from '../lib/api-categories';
import {
  listWishlist,
  type WishlistCreatePayload,
  type WishlistItem,
  type WishlistStatus,
} from '../lib/wishlistApi';

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

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SkeletonCard() {
  return (
    <div className="flex animate-pulse flex-col gap-4 rounded-2xl bg-slate-900/40 p-4 ring-1 ring-slate-800/70">
      <div className="aspect-video w-full rounded-xl bg-slate-800/60" />
      <div className="h-4 w-3/4 rounded-full bg-slate-800" />
      <div className="space-y-2">
        <div className="h-3 w-1/2 rounded-full bg-slate-800/80" />
        <div className="h-3 w-2/3 rounded-full bg-slate-800/60" />
      </div>
      <div className="flex gap-2">
        <div className="h-10 flex-1 rounded-xl bg-slate-800/70" />
        <div className="h-10 flex-1 rounded-xl bg-slate-800/70" />
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-slate-700/80 bg-slate-900/40 p-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--accent)]/10 text-[var(--accent)]">
        <PlusIcon className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-100">Belum ada wishlist</h2>
        <p className="max-w-sm text-sm text-slate-400">
          Buat daftar barang impianmu, tetapkan prioritas, dan wujudkan satu per satu.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <PlusIcon className="h-4 w-4" /> Tambah Wishlist
      </button>
    </div>
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    if (!formOpen) return;
    const node = modalRef.current;
    if (!node) return;
    const focusable = node.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first) {
      setTimeout(() => first.focus(), 0);
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeForm();
      }
      if (event.key === 'Tab' && focusable.length) {
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            (last ?? first)?.focus();
          }
        } else if (document.activeElement === last) {
          event.preventDefault();
          (first ?? last)?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [formOpen]);

  const handleFilterChange = (next: WishlistFilterState) => {
    setFilters(next);
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const openForm = (mode: 'create' | 'edit', item: WishlistItem | null, trigger?: HTMLElement | null) => {
    triggerRef.current = trigger ?? null;
    setFormMode(mode);
    setEditingItem(item);
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormError(null);
    setEditingItem(null);
    const trigger = triggerRef.current;
    if (trigger) {
      setTimeout(() => trigger.focus(), 0);
    }
    triggerRef.current = null;
  };

  useEffect(() => {
    if (!formOpen) {
      return;
    }
    const handleFocusOut = (event: FocusEvent) => {
      if (!modalRef.current) return;
      if (modalRef.current.contains(event.relatedTarget as Node)) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      if (first) {
        setTimeout(() => first.focus(), 0);
      }
    };
    modalRef.current.addEventListener('focusout', handleFocusOut);
    return () => {
      modalRef.current?.removeEventListener('focusout', handleFocusOut);
    };
  }, [formOpen]);

  const handleAdd = (event?: MouseEvent<HTMLButtonElement>) => {
    openForm('create', null, event?.currentTarget ?? null);
  };

  const handleEdit = (item: WishlistItem, event: MouseEvent<HTMLButtonElement>) => {
    openForm('edit', item, event.currentTarget);
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
        setFormError(err instanceof Error ? err.message : 'Gagal menambahkan wishlist.');
        addToast('Gagal menambahkan wishlist', 'error');
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
      setFormError(err instanceof Error ? err.message : 'Gagal memperbarui wishlist.');
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

  const handleExport = useCallback(async () => {
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
      'store_url',
      'note',
      'image_url',
      'created_at',
      'updated_at',
    ];
    const csvContent = [header.join(',')]
      .concat(
        rows.map((item) =>
          [
            item.title,
            item.estimated_price ?? '',
            item.priority ?? '',
            item.status,
            item.category_id ?? '',
            item.store_url ?? '',
            item.note ?? '',
            item.image_url ?? '',
            item.created_at,
            item.updated_at,
          ]
            .map((value) => {
              const text = String(value);
              if (/[",\n]/.test(text)) {
                return `"${text.replace(/"/g, '""')}"`;
              }
              return text;
            })
            .join(',')
        )
      )
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'wishlist.csv';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    addToast('Wishlist diekspor ke CSV', 'success');
  }, [filters, addToast]);

  const hasError = isError && !isLoading;

  return (
    <Page>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Wishlist"
          description="Kelola daftar keinginan dan siap jadikan goal atau transaksi kapan pun."
        >
          <button
            type="button"
            onClick={(event) => handleAdd(event)}
            className="hidden items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[var(--accent)]/20 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] md:inline-flex"
          >
            <PlusIcon className="h-4 w-4" /> Tambah Wishlist
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Ekspor CSV
          </button>
        </PageHeader>

        <WishlistFilterBar
          filters={filters}
          categories={categories}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
        />

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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState onAdd={() => handleAdd()} />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <WishlistCard
                  key={item.id}
                  item={item}
                  selected={selectedIds.has(item.id)}
                  onSelectChange={(selected) => handleSelectChange(item.id, selected)}
                  onEdit={(current, event) => handleEdit(current, event)}
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
                  className="h-10 w-full max-w-[200px] rounded-full bg-slate-900/60 text-center text-sm text-slate-500"
                >
                  {isFetchingNextPage ? 'Memuat…' : 'Gulir untuk memuat lagi'}
                </div>
              </div>
            ) : null}
            {total ? (
              <p className="text-center text-xs text-slate-500">Menampilkan {items.length} dari {total} wishlist</p>
            ) : null}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={(event) => handleAdd(event)}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/40 ring-2 ring-slate-900/40 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:hidden"
        aria-label="Tambah wishlist"
      >
        <PlusIcon className="h-6 w-6" />
      </button>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={(event: MouseEvent<HTMLDivElement>) => {
              if (event.target === event.currentTarget) {
                closeForm();
              }
            }}
          />
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wishlist-form-title"
            className="relative z-10 w-full max-w-lg rounded-2xl bg-slate-900 p-5 md:p-6 shadow-2xl ring-1 ring-slate-800"
          >
            <WishlistForm
              mode={formMode}
              initialData={editingItem}
              categories={categories}
              submitting={isMutating}
              errorMessage={formError}
              onSubmit={handleFormSubmit}
              onCancel={closeForm}
            />
          </div>
        </div>
      ) : null}
    </Page>
  );
}
