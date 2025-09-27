import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  bulkDeleteWishlist,
  bulkUpdateWishlist,
  createWishlistItem,
  deleteWishlistItem,
  listWishlist,
  updateWishlistItem,
  type ListWishlistParams,
  type ListWishlistResult,
  type WishlistItem,
  type WishlistItemPayload,
  type WishlistStatus,
} from '../lib/wishlistApi';

export type WishlistSort = ListWishlistParams['sort'];

export interface WishlistFilterState {
  search: string;
  status: WishlistStatus | 'all';
  priority: 'all' | 1 | 2 | 3 | 4 | 5;
  categoryId: string | 'all';
  priceMin: string;
  priceMax: string;
  sort: WishlistSort;
}

export interface UseWishlistOptions {
  pageSize?: number;
  initialFilters?: WishlistFilterState;
}

export interface UseWishlistResult {
  items: WishlistItem[];
  total: number;
  page: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: Error | null;
  filters: WishlistFilterState;
  setFilters: (filters: WishlistFilterState) => void;
  resetFilters: () => void;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  createItem: (payload: WishlistItemPayload) => Promise<WishlistItem>;
  updateItem: (id: string, patch: WishlistItemPayload) => Promise<WishlistItem>;
  removeItem: (id: string) => Promise<void>;
  updateBulk: (
    ids: string[],
    patch: Pick<WishlistItemPayload, 'priority' | 'status'>,
  ) => Promise<void>;
  deleteBulk: (ids: string[]) => Promise<void>;
}

export const DEFAULT_WISHLIST_FILTERS: WishlistFilterState = {
  search: '',
  status: 'all',
  priority: 'all',
  categoryId: 'all',
  priceMin: '',
  priceMax: '',
  sort: 'newest',
};

function parsePrice(value: string): number | undefined {
  if (!value || !value.trim()) return undefined;
  const normalized = value.replace(/[^0-9,.-]/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(/,/g, '.');
  const parsed = Number.parseFloat(normalized);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return undefined;
}

function buildOptimisticItem(payload: WishlistItemPayload): WishlistItem {
  const now = new Date().toISOString();
  return {
    id: `optimistic-${Date.now()}`,
    user_id: 'optimistic',
    title: payload.title,
    estimated_price: payload.estimated_price ?? null,
    priority: payload.priority ?? null,
    category_id: payload.category_id ?? null,
    store_url: payload.store_url ?? null,
    note: payload.note ?? null,
    status: payload.status ?? 'planned',
    image_url: payload.image_url ?? null,
    created_at: now,
    updated_at: now,
  };
}

export function useWishlist({
  pageSize = 20,
  initialFilters = DEFAULT_WISHLIST_FILTERS,
}: UseWishlistOptions = {}): UseWishlistResult {
  const [filters, setFiltersState] = useState<WishlistFilterState>({ ...initialFilters });
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const baseParams = useMemo(() => {
    const priorityValue = filters.priority === 'all' ? 'all' : Number(filters.priority);
    return {
      search: filters.search.trim() || undefined,
      status: filters.status,
      priority: Number.isNaN(priorityValue as number) ? 'all' : priorityValue,
      categoryId: filters.categoryId,
      priceMin: parsePrice(filters.priceMin),
      priceMax: parsePrice(filters.priceMax),
      sort: filters.sort,
      pageSize,
    } satisfies ListWishlistParams;
  }, [filters, pageSize]);

  const fetchPage = useCallback(
    async (pageNumber: number, append = false) => {
      setError(null);
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const result: ListWishlistResult = await listWishlist({ ...baseParams, page: pageNumber });
        setItems((prev) => {
          if (append) {
            const existingIds = new Set(prev.map((item) => item.id));
            const merged = [...prev];
            result.items.forEach((item) => {
              if (!existingIds.has(item.id)) {
                merged.push(item);
              }
            });
            return merged;
          }
          return result.items;
        });
        setTotal(result.total);
        setPage(result.page);
        setHasMore(result.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Gagal memuat wishlist.'));
        if (!append) {
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [baseParams],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await fetchPage(1, false);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err : new Error('Gagal memuat wishlist.'));
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchPage]);

  const setFilters = useCallback((next: WishlistFilterState) => {
    setFiltersState({ ...next });
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState({ ...DEFAULT_WISHLIST_FILTERS });
  }, []);

  const refresh = useCallback(async () => {
    await fetchPage(1, false);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    await fetchPage(page + 1, true);
  }, [fetchPage, hasMore, loadingMore, page]);

  const createItemAction = useCallback(
    async (payload: WishlistItemPayload) => {
      const optimistic = buildOptimisticItem(payload);
      setItems((prev) => [optimistic, ...prev]);
      setTotal((prev) => prev + 1);
      try {
        const created = await createWishlistItem(payload);
        setItems((prev) => prev.map((item) => (item.id === optimistic.id ? created : item)));
        return created;
      } catch (err) {
        setItems((prev) => prev.filter((item) => item.id !== optimistic.id));
        setTotal((prev) => Math.max(0, prev - 1));
        throw err;
      }
    },
    [],
  );

  const updateItemAction = useCallback(
    async (id: string, patch: WishlistItemPayload) => {
      let backup: WishlistItem | undefined;
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          backup = item;
          return {
            ...item,
            ...patch,
            estimated_price: patch.estimated_price ?? item.estimated_price,
            priority: patch.priority ?? item.priority,
            category_id: patch.category_id ?? item.category_id,
            store_url: patch.store_url ?? item.store_url,
            note: patch.note ?? item.note,
            status: patch.status ?? item.status,
            image_url: patch.image_url ?? item.image_url,
            updated_at: new Date().toISOString(),
          };
        }),
      );

      try {
        const updated = await updateWishlistItem(id, patch);
        setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
        return updated;
      } catch (err) {
        if (backup) {
          setItems((prev) => prev.map((item) => (item.id === id ? backup! : item)));
        }
        throw err;
      }
    },
    [],
  );

  const removeItemAction = useCallback(async (id: string) => {
    let backup: { item: WishlistItem; index: number } | null = null;
    setItems((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index >= 0) {
        backup = { item: prev[index], index };
      }
      return prev.filter((item) => item.id !== id);
    });
    setTotal((prev) => Math.max(0, prev - 1));
    try {
      await deleteWishlistItem(id);
    } catch (err) {
      if (backup) {
        setItems((prev) => {
          const next = [...prev];
          const insertIndex = Math.min(backup!.index, next.length);
          next.splice(insertIndex, 0, backup!.item);
          return next;
        });
        setTotal((prev) => prev + 1);
      }
      throw err;
    }
  }, []);

  const updateBulkAction = useCallback(
    async (ids: string[], patch: Pick<WishlistItemPayload, 'priority' | 'status'>) => {
      if (!ids.length) return;
      const previous = new Map<string, WishlistItem>();
      setItems((prev) =>
        prev.map((item) => {
          if (!ids.includes(item.id)) return item;
          previous.set(item.id, item);
          return {
            ...item,
            priority: patch.priority ?? item.priority,
            status: patch.status ?? item.status,
            updated_at: new Date().toISOString(),
          };
        }),
      );
      try {
        await bulkUpdateWishlist(ids, patch);
        await refresh();
      } catch (err) {
        setItems((prev) => prev.map((item) => previous.get(item.id) ?? item));
        throw err;
      }
    },
    [refresh],
  );

  const deleteBulkAction = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      let backups: { item: WishlistItem; index: number }[] = [];
      setItems((prev) => {
        backups = prev
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => ids.includes(item.id));
        return prev.filter((item) => !ids.includes(item.id));
      });
      setTotal((prev) => Math.max(0, prev - ids.length));
      try {
        await bulkDeleteWishlist(ids);
      } catch (err) {
        setItems((prev) => {
          const next = [...prev];
          backups
            .sort((a, b) => a.index - b.index)
            .forEach(({ item, index }) => {
              if (next.some((existing) => existing.id === item.id)) return;
              const insertIndex = Math.min(index, next.length);
              next.splice(insertIndex, 0, item);
            });
          return next;
        });
        setTotal((prev) => prev + backups.length);
        throw err;
      }
    },
    [],
  );

  return {
    items,
    total,
    page,
    hasMore,
    loading,
    loadingMore,
    error,
    filters,
    setFilters,
    resetFilters,
    refresh,
    loadMore,
    createItem: createItemAction,
    updateItem: updateItemAction,
    removeItem: removeItemAction,
    updateBulk: updateBulkAction,
    deleteBulk: deleteBulkAction,
  };
}
