import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Upload, Download, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useWishlist } from '../hooks/useWishlist';
import WishlistFilterBar from '../components/wishlist/WishlistFilterBar';
import WishlistCard from '../components/wishlist/WishlistCard';
import WishlistFormDialog from '../components/wishlist/WishlistFormDialog';
import WishlistBatchToolbar from '../components/wishlist/WishlistBatchToolbar';
import Skeleton from '../components/Skeleton';
import { useToast } from '../context/ToastContext.jsx';
import type { WishlistCreatePayload, WishlistItem, WishlistSortOption, WishlistStatus } from '../lib/wishlistApi';
import { listWishlist } from '../lib/wishlistApi';

interface CategoryOption {
  id: string;
  name: string;
}

type FilterState = {
  search: string;
  status: WishlistStatus | 'all';
  priority: number | 'all';
  categoryId: string | 'all';
  priceMin: string;
  priceMax: string;
  sort: WishlistSortOption;
};

const DEFAULT_FILTERS: FilterState = {
  search: '',
  status: 'all',
  priority: 'all',
  categoryId: 'all',
  priceMin: '',
  priceMax: '',
  sort: 'newest',
};

function parseNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const numberValue = Number(value.replace(/[^0-9.,-]/g, '').replace(',', '.'));
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function csvEscape(value: unknown): string {
  if (value === null || typeof value === 'undefined') return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
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
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((value) => value.trim());
}

export default function WishlistPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const { addToast } = useToast() ?? { addToast: () => {} };

  const priceMinNumber = useMemo(() => parseNumber(filters.priceMin), [filters.priceMin]);
  const priceMaxNumber = useMemo(() => parseNumber(filters.priceMax), [filters.priceMax]);

  const wishlist = useWishlist({
    search: filters.search,
    status: filters.status,
    priority: filters.priority === 'all' ? undefined : filters.priority,
    categoryId: filters.categoryId,
    priceMin: priceMinNumber,
    priceMax: priceMaxNumber,
    sort: filters.sort,
    pageSize: 20,
  });

  const categoryQuery = useQuery<CategoryOption[]>({
    queryKey: ['wishlist', 'categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('id, name, type').order('name');
      if (error) {
        throw new Error(error.message || 'Gagal memuat kategori.');
      }
      return (data ?? []).map((row) => ({
        id: row.id as string,
        name: (row.name as string) || 'Tanpa nama',
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categoryQuery.data ?? []) {
      map.set(category.id, category.name);
    }
    return map;
  }, [categoryQuery.data]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const available = new Set(wishlist.items.map((item) => item.id));
      const next = new Set<string>();
      for (const id of prev) {
        if (available.has(id)) {
          next.add(id);
        }
      }
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [wishlist.items]);

  function handleChangeFilters(next: Partial<FilterState>) {
    setFilters((prev) => ({ ...prev, ...next }));
  }

  function handleResetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  function openCreateDialog() {
    setEditingItem(null);
    setIsFormOpen(true);
  }

  function handleEdit(item: WishlistItem) {
    setEditingItem(item);
    setIsFormOpen(true);
  }

  async function handleSubmitForm(payload: WishlistCreatePayload) {
    try {
      if (editingItem) {
        await wishlist.updateItem(editingItem.id, payload);
        addToast?.('Wishlist diperbarui', 'success');
      } else {
        await wishlist.createItem(payload);
        addToast?.('Wishlist ditambahkan', 'success');
      }
    } catch (error) {
      addToast?.((error as Error).message ?? 'Gagal menyimpan wishlist', 'danger');
      throw error;
    }
  }

  async function handleDelete(item: WishlistItem) {
    try {
      await wishlist.deleteItem(item.id);
      addToast?.('Wishlist dihapus', 'success');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    } catch (error) {
      addToast?.((error as Error).message ?? 'Gagal menghapus wishlist', 'danger');
    }
  }

  async function handleMarkPurchased(item: WishlistItem) {
    try {
      await wishlist.updateItem(item.id, { status: 'purchased' });
      addToast?.('Item ditandai sebagai dibeli', 'success');
    } catch (error) {
      addToast?.((error as Error).message ?? 'Gagal memperbarui status', 'danger');
    }
  }

  function handleMakeGoal(item: WishlistItem) {
    const params = new URLSearchParams();
    params.set('title', item.title);
    if (typeof item.estimated_price === 'number') {
      params.set('target', String(item.estimated_price));
    }
    if (item.category_id) {
      params.set('category_id', item.category_id);
    }
    navigate(`/goals/new?${params.toString()}`);
  }

  function handleCopyToTransaction(item: WishlistItem) {
    const params = new URLSearchParams();
    params.set('type', 'expense');
    if (typeof item.estimated_price === 'number') {
      params.set('amount', String(item.estimated_price));
    }
    params.set('note', item.title);
    if (item.category_id) {
      params.set('category_id', item.category_id);
    }
    navigate(`/add?${params.toString()}`);
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  async function handleBulkDelete() {
    try {
      await wishlist.bulkDelete(Array.from(selectedIds));
      addToast?.('Wishlist terpilih dihapus', 'success');
      setSelectedIds(new Set());
    } catch (error) {
      addToast?.((error as Error).message ?? 'Gagal menghapus batch wishlist', 'danger');
    }
  }

  async function handleBulkStatus(status: WishlistStatus) {
    try {
      await wishlist.bulkUpdate(Array.from(selectedIds), { status });
      addToast?.('Status diperbarui', 'success');
    } catch (error) {
      addToast?.((error as Error).message ?? 'Gagal memperbarui status', 'danger');
    }
  }

  async function handleBulkPriority(priority: number) {
    try {
      await wishlist.bulkUpdate(Array.from(selectedIds), { priority });
      addToast?.('Prioritas diperbarui', 'success');
    } catch (error) {
      addToast?.((error as Error).message ?? 'Gagal memperbarui prioritas', 'danger');
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (!lines.length) {
        throw new Error('Berkas CSV kosong.');
      }
      const header = parseCsvLine(lines[0]);
      const rows = lines.slice(1).map(parseCsvLine);
      const headerMap = header.map((key) => key.toLowerCase());
      const expectedFields = ['title', 'estimated_price', 'priority', 'category_id', 'store_url', 'status', 'note', 'image_url'];
      for (const expected of expectedFields) {
        if (!headerMap.includes(expected)) {
          throw new Error('Format CSV tidak sesuai.');
        }
      }
      let successCount = 0;
      for (const row of rows) {
        const record: Record<string, string> = {};
        headerMap.forEach((key, index) => {
          record[key] = row[index] ?? '';
        });
        const parsedPrice = record.estimated_price ? parseNumber(record.estimated_price) : undefined;
        const parsedPriority = record.priority ? Number(record.priority) : undefined;
        const priorityValue =
          typeof parsedPriority === 'number' && Number.isFinite(parsedPriority) && parsedPriority >= 1 && parsedPriority <= 5
            ? parsedPriority
            : null;
        const payload: WishlistCreatePayload = {
          title: record.title,
          estimated_price: typeof parsedPrice === 'number' && parsedPrice >= 0 ? parsedPrice : null,
          priority: priorityValue,
          category_id: record.category_id ? record.category_id.trim() : null,
          store_url: record.store_url ? record.store_url.trim() : null,
          status: (['planned', 'deferred', 'purchased', 'archived'].includes((record.status || '').toLowerCase())
            ? (record.status || '').toLowerCase()
            : 'planned') as WishlistStatus,
          note: record.note ? record.note.trim() : null,
          image_url: record.image_url ? record.image_url.trim() : null,
        };
        try {
          await wishlist.createItem(payload);
          successCount += 1;
        } catch (_error) {
          continue;
        }
      }
      if (successCount > 0) {
        addToast?.(`Berhasil mengimport ${successCount} item wishlist`, 'success');
      } else {
        addToast?.('Tidak ada baris yang berhasil diimport', 'warning');
      }
    } catch (error) {
      addToast?.((error as Error).message ?? 'Gagal mengimport wishlist', 'danger');
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    try {
      let page = 1;
      const rows: WishlistItem[] = [];
      while (true) {
        const result = await listWishlist({
          page,
          pageSize: 200,
          search: filters.search,
          status: filters.status,
          priority: filters.priority === 'all' ? undefined : filters.priority,
          categoryId: filters.categoryId,
          priceMin: priceMinNumber,
          priceMax: priceMaxNumber,
          sort: filters.sort,
        });
        rows.push(...result.items);
        if (!result.hasMore) {
          break;
        }
        page += 1;
      }
      if (!rows.length) {
        addToast?.('Tidak ada data untuk diekspor', 'info');
        return;
      }
      const headers = ['title', 'estimated_price', 'priority', 'category_id', 'store_url', 'status', 'note', 'image_url'];
      const csv = [headers.join(','), ...rows.map((item) => headers.map((key) => csvEscape((item as Record<string, unknown>)[key])).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `wishlist-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      addToast?.('Wishlist berhasil diekspor', 'success');
    } catch (error) {
      addToast?.((error as Error).message ?? 'Gagal mengekspor wishlist', 'danger');
    }
  }

  const isEmpty = !wishlist.isLoading && wishlist.items.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-20 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Wishlist</h1>
          <p className="text-sm text-slate-400">Kelola ide belanja tanpa komitmen finansial, lalu ubah menjadi goal atau transaksi saat siap.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleImportClick}
            disabled={importing}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-700 px-4 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" /> Import CSV
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-700 px-4 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            type="button"
            onClick={wishlist.refetch}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-700 px-4 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" /> Muat ulang
          </button>
          <button
            type="button"
            onClick={openCreateDialog}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-slate-900 transition hover:bg-[var(--accent)]/90"
          >
            <Plus className="h-5 w-5" /> Tambah Wishlist
          </button>
        </div>
      </div>

      <WishlistFilterBar
        value={filters}
        onChange={handleChangeFilters}
        onReset={handleResetFilters}
        categories={categoryQuery.data ?? []}
        categoriesLoading={categoryQuery.isLoading}
      />

      {wishlist.isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : null}

      {wishlist.error ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
          Gagal memuat wishlist.{' '}
          <button type="button" className="font-semibold underline" onClick={() => wishlist.refetch()}>
            Coba lagi
          </button>
        </div>
      ) : null}

      {isEmpty ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-slate-700 bg-slate-900/60 px-8 py-16 text-center text-slate-300">
          <p className="text-lg font-semibold">Belum ada wishlist</p>
          <p className="max-w-xl text-sm text-slate-400">
            Simpan ide pembelian, atur prioritas, dan ubah menjadi goal atau transaksi saat waktunya tiba.
          </p>
          <button
            type="button"
            onClick={openCreateDialog}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-slate-900 transition hover:bg-[var(--accent)]/90"
          >
            <Plus className="h-4 w-4" /> Tambah Wishlist
          </button>
        </div>
      ) : null}

      {!wishlist.isLoading && wishlist.items.length > 0 ? (
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3">
          {wishlist.items.map((item) => (
            <WishlistCard
              key={item.id}
              item={item}
              selected={selectedIds.has(item.id)}
              onSelect={(checked) => toggleSelect(item.id, checked)}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onMarkPurchased={handleMarkPurchased}
              onMakeGoal={handleMakeGoal}
              onCopyToTransaction={handleCopyToTransaction}
              categoryName={item.category_id ? categoryMap.get(item.category_id) : undefined}
            />
          ))}
        </div>
      ) : null}

      {wishlist.hasNextPage ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => wishlist.fetchNextPage()}
            disabled={wishlist.isFetchingNextPage}
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-700 px-6 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {wishlist.isFetchingNextPage ? 'Memuat...' : 'Muat lebih banyak'}
          </button>
        </div>
      ) : null}

      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} />

      <WishlistFormDialog
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmitForm}
        initialItem={editingItem}
        categories={categoryQuery.data ?? []}
      />

      {selectedIds.size > 0 ? (
        <WishlistBatchToolbar
          count={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onDelete={handleBulkDelete}
          onUpdateStatus={handleBulkStatus}
          onUpdatePriority={handleBulkPriority}
          disabled={wishlist.bulkDeleting || wishlist.bulkUpdating}
        />
      ) : null}
    </div>
  );
}
