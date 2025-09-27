import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Plus, Upload } from 'lucide-react';
import WishlistFilterBar, {
  type WishlistFilterState,
} from '../components/wishlist/WishlistFilterBar';
import WishlistCard from '../components/wishlist/WishlistCard';
import WishlistFormDialog from '../components/wishlist/WishlistFormDialog';
import WishlistBatchToolbar from '../components/wishlist/WishlistBatchToolbar';
import { useWishlist } from '../hooks/useWishlist';
import { listCategories, type CategoryRecord } from '../lib/api-categories';
import {
  createWishlistItem,
  listWishlist,
  type WishlistCreatePayload,
  type WishlistItem,
  type WishlistStatus,
} from '../lib/wishlistApi';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../lib/format';

const DEFAULT_FILTERS: WishlistFilterState = {
  search: '',
  status: 'all',
  priority: 'all',
  categoryId: 'all',
  priceMin: '',
  priceMax: '',
  sort: 'newest',
};

const PAGE_SIZE = 20;

function normalizeNumber(value: string): number | undefined {
  if (!value) return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return numeric;
}

function escapeCsv(value: unknown): string {
  if (value == null || value === '') return '';
  const stringValue = String(value).replace(/\r?\n|\r/g, ' ').trim();
  if (stringValue.includes(',') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function formatTimestamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}`;
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function parseCsv(text: string): string[][] {
  const result: string[][] = [];
  let current = '';
  let row: string[] = [];
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i += 1;
        continue;
      }
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === ',' && !insideQuotes) {
      row.push(current.trim());
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i += 1;
      }
      row.push(current.trim());
      if (row.some((cell) => cell !== '')) {
        result.push(row);
      }
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current || row.length) {
    row.push(current.trim());
    if (row.some((cell) => cell !== '')) {
      result.push(row);
    }
  }

  return result;
}

const VALID_STATUSES: WishlistStatus[] = ['planned', 'deferred', 'purchased', 'archived'];

function clampPriority(value: number | null): number | null {
  if (value == null || Number.isNaN(value)) return null;
  const clamped = Math.max(1, Math.min(5, Math.round(value)));
  return clamped;
}

function parseNumeric(value?: string | null): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.+-]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function WishlistPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const addToast = toast?.addToast;
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [filters, setFilters] = useState<WishlistFilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const categoryQuery = useQuery<CategoryRecord[], Error>({
    queryKey: ['categories', 'wishlist'],
    queryFn: ({ signal }) => listCategories(signal),
    staleTime: 5 * 60 * 1000,
  });

  const expenseCategories = useMemo(
    () => (categoryQuery.data ?? []).filter((category) => category.type !== 'income'),
    [categoryQuery.data],
  );

  const categoryLookup = useMemo(() => {
    const map = new Map<string, string>();
    expenseCategories.forEach((category) => {
      map.set(category.id, category.name);
    });
    return map;
  }, [expenseCategories]);

  const queryParams = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      search: filters.search || undefined,
      status: filters.status,
      priority: filters.priority,
      categoryId: filters.categoryId,
      priceMin: normalizeNumber(filters.priceMin),
      priceMax: normalizeNumber(filters.priceMax),
      sort: filters.sort,
    }),
    [filters, page],
  );

  const wishlist = useWishlist(queryParams);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, filters.search, filters.status, filters.priority, filters.categoryId, filters.priceMin, filters.priceMax, filters.sort]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      wishlist.items.forEach((item) => {
        if (prev.has(item.id)) next.add(item.id);
      });
      return next;
    });
  }, [wishlist.items]);

  useEffect(() => {
    if (!wishlist.isFetching && !wishlist.isLoading && page > 1 && wishlist.items.length === 0 && wishlist.total > 0) {
      setPage((prev) => Math.max(1, prev - 1));
    }
  }, [wishlist.items.length, wishlist.total, wishlist.isLoading, wishlist.isFetching, page]);

  const handleFilterChange = useCallback((changes: Partial<WishlistFilterState>) => {
    setFilters((prev) => ({ ...prev, ...changes }));
    setPage(1);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  const openCreateDialog = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const handleEdit = (item: WishlistItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingItem(null);
  };

  const handleFormSubmit = async (payload: WishlistCreatePayload) => {
    try {
      setIsSubmitting(true);
      if (editingItem) {
        await wishlist.updateItem(editingItem.id, payload);
      } else {
        await wishlist.createItem(payload);
      }
      setDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleDelete = async (item: WishlistItem) => {
    await wishlist.deleteItem(item.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  };

  const handleConvertToGoal = (item: WishlistItem) => {
    const params = new URLSearchParams();
    params.set('title', item.title);
    if (item.estimated_price) params.set('target', String(item.estimated_price));
    if (item.category_id) params.set('category_id', item.category_id);
    navigate(`/goals/new?${params.toString()}`);
  };

  const handleCopyToTransaction = (item: WishlistItem) => {
    const params = new URLSearchParams();
    params.set('type', 'expense');
    if (item.estimated_price) params.set('amount', String(item.estimated_price));
    params.set('note', item.title);
    if (item.category_id) params.set('category_id', item.category_id);
    navigate(`/add?${params.toString()}`);
  };

  const handleMarkPurchased = async (item: WishlistItem) => {
    await wishlist.updateItem(item.id, { status: 'purchased' });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    await wishlist.bulkDelete(ids);
    setSelectedIds(new Set());
  };

  const handleBulkStatus = async (status: WishlistStatus) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    await wishlist.bulkSetStatus(ids, status);
    setSelectedIds(new Set(ids));
  };

  const handleBulkPriority = async (priority: number) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    await wishlist.bulkSetPriority(ids, priority);
    setSelectedIds(new Set(ids));
  };

  const handleExport = async () => {
    if (typeof document === 'undefined') {
      return;
    }
    try {
      setIsExporting(true);
      const baseParams = {
        ...queryParams,
        page: 1,
        pageSize: 500,
      };
      const rows: WishlistItem[] = [];
      let currentPage = 1;
      let pageCount = 1;
      do {
        const response = await listWishlist({ ...baseParams, page: currentPage });
        rows.push(...response.items);
        pageCount = response.pageCount;
        currentPage += 1;
      } while (currentPage <= pageCount);

      const lines = [
        ['title', 'estimated_price', 'priority', 'category_id', 'store_url', 'status', 'note', 'image_url']
          .map(escapeCsv)
          .join(','),
        ...rows.map((item) =>
          [
            item.title,
            item.estimated_price ?? '',
            item.priority ?? '',
            item.category_id ?? '',
            item.store_url ?? '',
            item.status,
            item.note ?? '',
            item.image_url ?? '',
          ]
            .map(escapeCsv)
            .join(','),
        ),
      ];

      downloadCsv(lines.join('\r\n'), `hematwoi-wishlist-${formatTimestamp()}.csv`);
      if (addToast) {
        addToast('Wishlist diekspor ke CSV.', 'success');
      }
    } catch (error) {
      if (addToast) {
        addToast(error instanceof Error ? error.message : 'Gagal mengekspor CSV.', 'danger');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) {
        throw new Error('File CSV kosong.');
      }

      const [header, ...dataRows] = rows;
      const normalizedHeader = header.map((cell) => cell.trim().toLowerCase());
      const idxTitle = normalizedHeader.indexOf('title');
      if (idxTitle === -1) {
        throw new Error('Kolom "title" wajib ada.');
      }
      const idxPrice = normalizedHeader.indexOf('estimated_price');
      const idxPriority = normalizedHeader.indexOf('priority');
      const idxCategory = normalizedHeader.indexOf('category_id');
      const idxStore = normalizedHeader.indexOf('store_url');
      const idxStatus = normalizedHeader.indexOf('status');
      const idxNote = normalizedHeader.indexOf('note');
      const idxImage = normalizedHeader.indexOf('image_url');

      let success = 0;
      let failure = 0;

      for (const row of dataRows) {
        const title = row[idxTitle]?.trim();
        if (!title) {
          failure += 1;
          continue;
        }

        const estimatedValue = idxPrice !== -1 ? parseNumeric(row[idxPrice]) : null;
        const priorityValue = idxPriority !== -1 ? parseNumeric(row[idxPriority]) : null;
        const statusValue = idxStatus !== -1 ? row[idxStatus]?.trim().toLowerCase() : '';
        const status = VALID_STATUSES.includes(statusValue as WishlistStatus)
          ? (statusValue as WishlistStatus)
          : 'planned';

        const payload: WishlistCreatePayload = {
          title,
          estimated_price: estimatedValue != null && estimatedValue >= 0 ? estimatedValue : null,
          priority: clampPriority(priorityValue) ?? null,
          category_id: idxCategory !== -1 ? row[idxCategory]?.trim() || null : null,
          store_url: idxStore !== -1 ? row[idxStore]?.trim() || null : null,
          status,
          note: idxNote !== -1 ? row[idxNote]?.trim() || null : null,
          image_url: idxImage !== -1 ? row[idxImage]?.trim() || null : null,
        };

        try {
          await createWishlistItem(payload);
          success += 1;
        } catch {
          failure += 1;
        }
      }

      await wishlist.refetch();

      if (addToast) {
        if (failure > 0) {
          addToast(`Import selesai: ${success} berhasil, ${failure} gagal.`, 'warning');
        } else {
          addToast(`Import berhasil: ${success} item ditambahkan.`, 'success');
        }
      }
    } catch (error) {
      if (addToast) {
        addToast(error instanceof Error ? error.message : 'Gagal mengimpor CSV.', 'danger');
      }
    } finally {
      setIsImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  };

  const selectedCount = selectedIds.size;
  const canPrev = page > 1;
  const canNext = page < wishlist.pageCount;
  const pageStart = wishlist.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, wishlist.total);
  const isEmpty = !wishlist.isLoading && !wishlist.isFetching && wishlist.items.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Wishlist</h1>
          <p className="mt-1 text-sm text-slate-400">
            Simpan ide belanja tanpa komitmen, ubah menjadi goal kapan pun kamu siap.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={isImporting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-700/70 px-4 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            {isImporting ? 'Mengimpor…' : 'Import CSV'}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || wishlist.total === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-700/70 px-4 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {isExporting ? 'Mengekspor…' : 'Export CSV'}
          </button>
          <button
            type="button"
            onClick={openCreateDialog}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-[var(--accent)]/30 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Tambah Wishlist
          </button>
        </div>
      </div>

      <WishlistFilterBar
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
        categories={expenseCategories.map((category) => ({ id: category.id, name: category.name }))}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
        <span>
          {wishlist.total === 0
            ? 'Belum ada wishlist'
            : `Menampilkan ${pageStart}–${pageEnd} dari ${wishlist.total} item`}
        </span>
        <span className="font-semibold text-slate-300">
          Total estimasi halaman ini:{' '}
          {formatCurrency(
            wishlist.items.reduce((sum, item) => sum + (item.estimated_price ?? 0), 0),
            'IDR',
          )}
        </span>
      </div>

      {wishlist.error ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-100">
          <p className="text-sm font-medium">Gagal memuat wishlist.</p>
          <button
            type="button"
            onClick={() => wishlist.refetch()}
            className="mt-2 inline-flex h-9 items-center justify-center rounded-xl border border-rose-400/60 px-3 text-xs font-semibold text-rose-100 transition hover:border-rose-300 hover:text-white"
          >
            Coba lagi
          </button>
        </div>
      ) : null}

      {wishlist.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: Math.min(9, PAGE_SIZE) }).map((_, index) => (
            <div
              key={`wishlist-skeleton-${index}`}
              className="h-60 animate-pulse rounded-2xl border border-slate-800/80 bg-slate-900/60"
            />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-slate-700/70 bg-slate-950/40 p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
            <Plus className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-white">Wishlist kamu masih kosong</h2>
            <p className="text-sm text-slate-400">
              Tambahkan barang impianmu dan kelola prioritas sebelum menjadi goal sungguhan.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateDialog}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-[var(--accent)]/30 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Tambah Wishlist
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {wishlist.items.map((item) => (
            <WishlistCard
              key={item.id}
              item={item}
              selected={selectedIds.has(item.id)}
              onSelect={(checked) => toggleSelect(item.id, checked)}
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDelete(item)}
              onMarkPurchased={() => handleMarkPurchased(item)}
              onConvertToGoal={() => handleConvertToGoal(item)}
              onCopyToTransaction={() => handleCopyToTransaction(item)}
              categoryName={item.category_id ? categoryLookup.get(item.category_id) ?? null : null}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => canPrev && setPage((prev) => Math.max(1, prev - 1))}
          disabled={!canPrev}
          className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-700/70 px-4 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Sebelumnya
        </button>
        <span className="text-sm text-slate-400">
          Halaman {wishlist.page} dari {wishlist.pageCount}
        </span>
        <button
          type="button"
          onClick={() => canNext && setPage((prev) => prev + 1)}
          disabled={!canNext}
          className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-700/70 px-4 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Selanjutnya
        </button>
      </div>

      <WishlistFormDialog
        open={dialogOpen}
        mode={editingItem ? 'edit' : 'create'}
        initialItem={editingItem}
        categories={expenseCategories.map((category) => ({ id: category.id, name: category.name }))}
        onClose={handleDialogClose}
        onSubmit={handleFormSubmit}
        submitting={isSubmitting}
      />

      <WishlistBatchToolbar
        selectedCount={selectedCount}
        onClear={() => setSelectedIds(new Set())}
        onDelete={handleBulkDelete}
        onStatusChange={handleBulkStatus}
        onPriorityChange={handleBulkPriority}
        isProcessing={wishlist.isMutating}
      />
    </div>
  );
}
