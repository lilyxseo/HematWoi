import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  bulkDeleteWishlist,
  bulkUpdateWishlist,
  createWishlistItem,
  deleteWishlistItem,
  listWishlist,
  updateWishlistItem,
  type WishlistCreatePayload,
  type WishlistItem,
  type WishlistListParams,
  type WishlistListResponse,
  type WishlistStatus,
  type WishlistUpdatePayload,
} from '../lib/wishlistApi';

export interface UseWishlistFilters extends Omit<WishlistListParams, 'page'> {
  pageSize?: number;
}

interface NormalizedFilters {
  search: string;
  status: WishlistStatus | 'all';
  priority: number | null;
  categoryId: string | 'all';
  priceMin: number | null;
  priceMax: number | null;
  sort: WishlistListParams['sort'];
  pageSize: number;
}

type WishlistPages = InfiniteData<WishlistListResponse>;

type MutationContext = {
  previous?: WishlistPages;
};

function normalizeFilters(filters: UseWishlistFilters): NormalizedFilters {
  return {
    search: filters.search?.trim() ?? '',
    status: (filters.status ?? 'all') as WishlistStatus | 'all',
    priority: typeof filters.priority === 'number' ? filters.priority : null,
    categoryId: filters.categoryId && filters.categoryId !== 'all' ? filters.categoryId : 'all',
    priceMin: typeof filters.priceMin === 'number' ? filters.priceMin : null,
    priceMax: typeof filters.priceMax === 'number' ? filters.priceMax : null,
    sort: filters.sort ?? 'newest',
    pageSize: filters.pageSize ?? 20,
  };
}

function matchesFilters(item: WishlistItem, filters: NormalizedFilters): boolean {
  if (filters.search) {
    const term = filters.search.toLowerCase();
    const haystack = `${item.title ?? ''} ${item.note ?? ''}`.toLowerCase();
    if (!haystack.includes(term)) return false;
  }

  if (filters.status !== 'all' && item.status !== filters.status) {
    return false;
  }

  if (typeof filters.priority === 'number') {
    if ((item.priority ?? null) !== filters.priority) {
      return false;
    }
  }

  if (filters.categoryId !== 'all') {
    if ((item.category_id ?? null) !== filters.categoryId) {
      return false;
    }
  }

  if (typeof filters.priceMin === 'number') {
    if (item.estimated_price === null || item.estimated_price < filters.priceMin) {
      return false;
    }
  }

  if (typeof filters.priceMax === 'number') {
    if (item.estimated_price === null || item.estimated_price > filters.priceMax) {
      return false;
    }
  }

  return true;
}

function updateCachedPages(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: unknown[],
  updater: (page: WishlistListResponse, index: number) => WishlistListResponse
) {
  queryClient.setQueryData<WishlistPages>(queryKey, (current) => {
    if (!current) return current;
    return {
      pageParams: current.pageParams,
      pages: current.pages.map((page, index) => updater(page, index)),
    };
  });
}

function clonePage(page: WishlistListResponse): WishlistListResponse {
  return {
    ...page,
    items: [...page.items],
  };
}

export function useWishlist(filters: UseWishlistFilters) {
  const normalized = useMemo(() => normalizeFilters(filters), [
    filters.search,
    filters.status,
    filters.priority,
    filters.categoryId,
    filters.priceMin,
    filters.priceMax,
    filters.sort,
    filters.pageSize,
  ]);

  const queryClient = useQueryClient();
  const queryKey: unknown[] = useMemo(() => ['wishlist', normalized], [normalized]);

  const listQuery = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 1 }) =>
      listWishlist({
        page: pageParam as number,
        pageSize: normalized.pageSize,
        search: normalized.search,
        status: normalized.status,
        priority: normalized.priority ?? undefined,
        categoryId: normalized.categoryId,
        priceMin: normalized.priceMin ?? undefined,
        priceMax: normalized.priceMax ?? undefined,
        sort: normalized.sort,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

  const items = listQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const total = listQuery.data?.pages[0]?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: createWishlistItem,
    onMutate: async (payload): Promise<MutationContext> => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WishlistPages>(queryKey);
      const now = new Date().toISOString();
      const optimisticItem: WishlistItem = {
        id: `temp-${Date.now()}`,
        user_id: 'local',
        title: payload.title.trim(),
        estimated_price: payload.estimated_price ?? null,
        priority: payload.priority ?? null,
        category_id: payload.category_id ?? null,
        store_url: payload.store_url?.trim() || null,
        note: payload.note?.trim() || null,
        status: payload.status ?? 'planned',
        image_url: payload.image_url?.trim() || null,
        created_at: now,
        updated_at: now,
      };

      if (matchesFilters(optimisticItem, normalized)) {
        updateCachedPages(queryClient, queryKey, (page, index) => {
          if (index === 0) {
            const next = clonePage(page);
            next.items = [optimisticItem, ...next.items];
            next.total += 1;
            return next;
          }
          return page;
        });
      }

      return { previous };
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (item) => {
      updateCachedPages(queryClient, queryKey, (page, index) => {
        const next = clonePage(page);
        const optimisticIndex = next.items.findIndex((i) => i.id.startsWith('temp-'));
        if (optimisticIndex !== -1) {
          next.items[optimisticIndex] = item;
        } else if (index === 0 && matchesFilters(item, normalized)) {
          next.items = [item, ...next.items];
          next.total += 1;
        }
        if (index === 0) {
          next.total = Math.max(next.total, next.items.length);
        }
        return next;
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: WishlistUpdatePayload }) => updateWishlistItem(id, patch),
    onMutate: async ({ id, patch }): Promise<MutationContext & { id: string }> => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WishlistPages>(queryKey);
      updateCachedPages(queryClient, queryKey, (page) => {
        const next = clonePage(page);
        next.items = next.items.map((item) => {
          if (item.id !== id) return item;
          const patched: WishlistItem = {
            ...item,
            ...patch,
            title: typeof patch.title === 'string' ? patch.title : item.title,
            estimated_price:
              typeof patch.estimated_price === 'number'
                ? patch.estimated_price
                : patch.estimated_price === null
                ? null
                : item.estimated_price,
            priority:
              typeof patch.priority === 'number'
                ? patch.priority
                : patch.priority === null
                ? null
                : item.priority,
            category_id:
              typeof patch.category_id === 'string'
                ? patch.category_id
                : patch.category_id === null
                ? null
                : item.category_id,
            store_url:
              typeof patch.store_url === 'string'
                ? patch.store_url
                : patch.store_url === null
                ? null
                : item.store_url,
            note:
              typeof patch.note === 'string'
                ? patch.note
                : patch.note === null
                ? null
                : item.note,
            status: (patch.status as WishlistStatus) ?? item.status,
            image_url:
              typeof patch.image_url === 'string'
                ? patch.image_url
                : patch.image_url === null
                ? null
                : item.image_url,
            updated_at: new Date().toISOString(),
          };
          return patched;
        });
        next.items = next.items.filter((item) => matchesFilters(item, normalized));
        return next;
      });
      return { previous, id };
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (item) => {
      updateCachedPages(queryClient, queryKey, (page) => {
        const next = clonePage(page);
        const index = next.items.findIndex((existing) => existing.id === item.id || existing.id.startsWith('temp-'));
        if (index !== -1) {
          next.items[index] = item;
        }
        next.items = next.items.filter((entry) => matchesFilters(entry, normalized));
        return next;
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWishlistItem,
    onMutate: async (id: string): Promise<MutationContext> => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WishlistPages>(queryKey);
      updateCachedPages(queryClient, queryKey, (page) => {
        const next = clonePage(page);
        const before = next.items.length;
        next.items = next.items.filter((item) => item.id !== id);
        if (next.items.length !== before) {
          next.total = Math.max(0, next.total - 1);
        }
        return next;
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, patch }: { ids: string[]; patch: WishlistUpdatePayload }) =>
      bulkUpdateWishlist(ids, patch),
    onMutate: async ({ ids, patch }): Promise<MutationContext> => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WishlistPages>(queryKey);
      updateCachedPages(queryClient, queryKey, (page) => {
        const next = clonePage(page);
        const now = new Date().toISOString();
        next.items = next.items
          .map((item) => {
            if (!ids.includes(item.id)) return item;
            return {
              ...item,
              status: (patch.status as WishlistStatus) ?? item.status,
              priority:
                typeof patch.priority === 'number'
                  ? patch.priority
                  : patch.priority === null
                  ? null
                  : item.priority,
              updated_at: now,
            };
          })
          .filter((item) => matchesFilters(item, normalized));
        return next;
      });
      return { previous };
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteWishlist(ids),
    onMutate: async (ids: string[]): Promise<MutationContext> => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WishlistPages>(queryKey);
      updateCachedPages(queryClient, queryKey, (page) => {
        const next = clonePage(page);
        const before = next.items.length;
        next.items = next.items.filter((item) => !ids.includes(item.id));
        if (next.items.length !== before) {
          next.total = Math.max(0, next.total - (before - next.items.length));
        }
        return next;
      });
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    filters: normalized,
    items,
    total,
    hasNextPage: listQuery.hasNextPage,
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    isFetchingNextPage: listQuery.isFetchingNextPage,
    error: listQuery.error as Error | null,
    fetchNextPage: listQuery.fetchNextPage,
    refetch: listQuery.refetch,
    createItem: (payload: WishlistCreatePayload) => createMutation.mutateAsync(payload),
    updateItem: (id: string, patch: WishlistUpdatePayload) => updateMutation.mutateAsync({ id, patch }),
    deleteItem: (id: string) => deleteMutation.mutateAsync(id),
    bulkUpdate: (ids: string[], patch: WishlistUpdatePayload) =>
      bulkUpdateMutation.mutateAsync({ ids, patch }),
    bulkDelete: (ids: string[]) => bulkDeleteMutation.mutateAsync(ids),
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
    bulkUpdating: bulkUpdateMutation.isPending,
    bulkDeleting: bulkDeleteMutation.isPending,
  };
}
