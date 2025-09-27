import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  CheckCircle2,
  CircleDollarSign,
  Layers3,
  Plus,
  Sparkles,
} from 'lucide-react';
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

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

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

export default function WishlistPage() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<WishlistFilterState>(INITIAL_FILTERS);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [exporting, setExporting] = useState(false);
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

  const statusSummary = useMemo(() => {
    const counts: Record<WishlistStatus, number> = {
      planned: 0,
      deferred: 0,
      purchased: 0,
      archived: 0,
    };
    let estimatedTotal = 0;
    let pricedCount = 0;

    for (const item of items) {
      counts[item.status] += 1;
      if (typeof item.estimated_price === 'number') {
        estimatedTotal += item.estimated_price;
        pricedCount += 1;
      }
    }

    return {
      counts,
      estimatedTotal,
      pricedCount,
    };
  }, [items]);

  const statsCards = useMemo(
    () => [
      {
        id: 'total',
        label: 'Total Wishlist',
        value: total.toLocaleString('id-ID'),
        description: 'Semua item wishlist yang tersimpan.',
        icon: Layers3,
        iconClass: 'bg-brand/20 text-brand',
      },
      {
        id: 'planned',
        label: 'Rencana Aktif',
        value: statusSummary.counts.planned.toLocaleString('id-ID'),
        description: 'Wishlist yang siap diwujudkan.',
        icon: Sparkles,
        iconClass: 'bg-info/20 text-info',
      },
      {
        id: 'purchased',
        label: 'Sudah Dibeli',
        value: statusSummary.counts.purchased.toLocaleString('id-ID'),
        description: 'Ditandai selesai dan dibeli.',
        icon: CheckCircle2,
        iconClass: 'bg-success/20 text-success',
      },
      {
        id: 'estimate',
        label: 'Nilai Estimasi',
        value: currencyFormatter.format(statusSummary.estimatedTotal),
        description:
          statusSummary.pricedCount > 0
            ? `Dari ${statusSummary.pricedCount.toLocaleString('id-ID')} item dengan harga.`
            : 'Belum ada estimasi harga yang diisi.',
        icon: CircleDollarSign,
        iconClass: 'bg-warning/20 text-warning',
      },
    ],
    [statusSummary, total]
  );

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
            className="h-48 animate-pulse rounded-2xl border border-border-subtle/70 bg-surface-alt/60"
          />
        ))}
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border-subtle/70 bg-surface-alt/60 px-6 py-16 text-center">
      <div className="rounded-full border border-border-subtle bg-surface px-4 py-2 text-sm text-muted">
        Wishlist Anda masih kosong
      </div>
      <p className="max-w-sm text-balance text-sm text-muted">
        Simpan ide belanja tanpa komitmen finansial. Tambahkan item wishlist dan ubah menjadi goal atau transaksi kapan saja.
      </p>
      <button
        type="button"
        onClick={handleAdd}
        className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand px-5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
      >
        <Plus className="h-4 w-4" aria-hidden="true" /> Tambah Wishlist
      </button>
    </div>
  );

  const hasError = isError && !isLoading;

  return (
    <Page>
      <PageHeader title="Wishlist" description="Kelola daftar keinginan dan siap jadikan goal atau transaksi kapan pun.">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand px-4 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isMutating}
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Tambah Wishlist
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border-subtle bg-surface-alt px-4 text-sm font-semibold text-text shadow-sm transition hover:border-border-strong hover:bg-surface-alt/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={exporting}
          >
            <ArrowDownToLine className="h-4 w-4" aria-hidden="true" /> {exporting ? 'Menyiapkan…' : 'Ekspor CSV'}
          </button>
        </div>
      </PageHeader>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statsCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.id}
              className="flex h-full items-start gap-4 rounded-3xl border border-border-subtle bg-surface p-4 shadow-sm transition-colors duration-200 hover:border-brand/40 hover:shadow-md"
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.iconClass}`}>
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{card.label}</p>
                <p className="mt-1 text-lg font-semibold text-text">{card.value}</p>
                <p className="mt-1 text-xs text-muted">{card.description}</p>
              </div>
            </article>
          );
        })}
      </section>

      <div className="space-y-6">
        <WishlistFilterBar filters={filters} categories={categories} onChange={handleFilterChange} onReset={handleResetFilters} />

        {hasError ? (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            Terjadi kesalahan saat memuat wishlist. {error instanceof Error ? error.message : ''}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ml-3 inline-flex items-center text-danger underline-offset-4 hover:underline"
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
                <div ref={loadMoreRef} className="h-10 w-full max-w-[200px] rounded-full bg-transparent text-center text-sm text-muted">
                  {isFetchingNextPage ? 'Memuat…' : 'Memuat lainnya'}
                </div>
              </div>
            ) : null}
            {total ? (
              <p className="text-center text-xs text-muted">
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
