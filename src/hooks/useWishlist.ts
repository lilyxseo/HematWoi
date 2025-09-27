import { useMemo } from 'react';
import {
  QueryKey,
  UseMutationResult,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import {
  bulkDeleteWishlist,
  bulkUpdateWishlist,
  createWishlistItem,
  deleteWishlistItem,
  listWishlist,
  type WishlistCreatePayload,
  type WishlistItem,
  type WishlistListParams,
  type WishlistListResult,
  type WishlistStatus,
  type WishlistUpdatePayload,
} from '../lib/wishlistApi';

export interface WishlistFilters {
  search?: string;
  status?: WishlistStatus;
  priority?: number;
  categoryId?: string;
  priceMin?: number;
  priceMax?: number;
  sort?: WishlistListParams['sort'];
}

const PAGE_SIZE = 20;

function buildQueryKey(filters: WishlistFilters): QueryKey {
  return ['wishlist', filters];
}

function updateFirstPage(
  data: InfiniteData<WishlistListResult> | undefined,
  updater: (page: WishlistListResult) => WishlistListResult
): InfiniteData<WishlistListResult> | undefined {
  if (!data) return data;
  const [first, ...rest] = data.pages;
  if (!first) return data;
  const updatedFirst = updater(first);
  return {
    pageParams: data.pageParams,
    pages: [updatedFirst, ...rest],
  };
}

function replaceItem(
  data: InfiniteData<WishlistListResult> | undefined,
  id: string,
  replacer: (item: WishlistItem) => WishlistItem
): InfiniteData<WishlistListResult> | undefined {
  if (!data) return data;
  return {
    pageParams: data.pageParams,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => (item.id === id ? replacer(item) : item)),
    })),
  };
}

function removeItems(
  data: InfiniteData<WishlistListResult> | undefined,
  ids: Set<string>
): InfiniteData<WishlistListResult> | undefined {
  if (!data) return data;
  return {
    pageParams: data.pageParams,
    pages: data.pages.map((page, index) => {
      const filtered = page.items.filter((item) => !ids.has(item.id));
      return {
        ...page,
        items: filtered,
        total: index === 0 ? Math.max(0, page.total - (page.items.length - filtered.length)) : page.total,
      };
    }),
  };
}

export interface UseWishlistResult {
  items: WishlistItem[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => Promise<void>;
  refetch: () => Promise<void>;
  createItem: UseMutationResult<WishlistItem, unknown, WishlistCreatePayload>['mutateAsync'];
  updateItem: UseMutationResult<WishlistItem, unknown, { id: string; patch: WishlistUpdatePayload }>['mutateAsync'];
  deleteItem: UseMutationResult<void, unknown, { id: string }>['mutateAsync'];
  bulkUpdate: UseMutationResult<void, unknown, { ids: string[]; patch: WishlistUpdatePayload }>['mutateAsync'];
  bulkDelete: UseMutationResult<void, unknown, { ids: string[] }>['mutateAsync'];
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isBulkUpdating: boolean;
  isBulkDeleting: boolean;
}

export function useWishlist(filters: WishlistFilters): UseWishlistResult {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => buildQueryKey(filters), [filters]);

  const listQuery = useInfiniteQuery({
    queryKey,
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) =>
      listWishlist({ page: pageParam, pageSize: PAGE_SIZE, ...filters }),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    networkMode: 'offlineFirst',
  });

  const createMutation = useMutation({
    mutationFn: createWishlistItem,
    networkMode: 'offlineFirst',
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InfiniteData<WishlistListResult>>(queryKey);
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticItem: WishlistItem = {
        id: optimisticId,
        user_id: 'optimistic',
        title: payload.title.trim(),
        estimated_price: payload.estimated_price ?? null,
        priority: payload.priority ?? null,
        category_id: payload.category_id ?? null,
        category: null,
        store_url: payload.store_url?.trim() || null,
        note: payload.note?.trim() || null,
        status: payload.status ?? 'planned',
        image_url: payload.image_url?.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData<InfiniteData<WishlistListResult>>(queryKey, (old) => {
        if (!old) {
          return {
            pageParams: [1],
            pages: [
              {
                items: [optimisticItem],
                page: 1,
                pageSize: PAGE_SIZE,
                total: 1,
                hasMore: false,
              },
            ],
          };
        }
        return updateFirstPage(old, (page) => {
          const items = [optimisticItem, ...page.items];
          if (items.length > page.pageSize) {
            items.pop();
          }
          return {
            ...page,
            items,
            total: page.total + 1,
          };
        });
      });

      return { previous, optimisticId };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (result, _variables, context) => {
      queryClient.setQueryData<InfiniteData<WishlistListResult>>(queryKey, (old) => {
        if (!old) return old;
        const optimisticId = context?.optimisticId;
        if (!optimisticId) return old;
        return replaceItem(old, optimisticId, () => result);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: WishlistUpdatePayload }) =>
      updateWishlistItem(id, patch),
    networkMode: 'offlineFirst',
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InfiniteData<WishlistListResult>>(queryKey);
      queryClient.setQueryData<InfiniteData<WishlistListResult>>(queryKey, (old) => {
        if (!old) return old;
        return replaceItem(old, id, (item) => ({
          ...item,
          ...patch,
          title: patch.title?.trim() ?? item.title,
          store_url: patch.store_url?.trim() ?? (patch.store_url === '' ? null : item.store_url),
          note: patch.note?.trim() ?? (patch.note === '' ? null : item.note),
          image_url: patch.image_url?.trim() ?? (patch.image_url === '' ? null : item.image_url),
          updated_at: new Date().toISOString(),
        }));
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (result) => {
      queryClient.setQueryData<InfiniteData<WishlistListResult>>(queryKey, (old) => {
        if (!old) return old;
        return replaceItem(old, result.id, () => result);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteWishlistItem(id),
    networkMode: 'offlineFirst',
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InfiniteData<WishlistListResult>>(queryKey);
      queryClient.setQueryData<InfiniteData<WishlistListResult>>(queryKey, (old) => {
        if (!old) return old;
        return removeItems(old, new Set([id]));
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
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
    networkMode: 'offlineFirst',
    onMutate: async ({ ids, patch }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InfiniteData<WishlistListResult>>(queryKey);
      const idSet = new Set(ids);
      queryClient.setQueryData<InfiniteData<WishlistListResult>>(queryKey, (old) => {
        if (!old) return old;
        return {
          pageParams: old.pageParams,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => {
              if (!idSet.has(item.id)) return item;
              return {
                ...item,
                ...patch,
                priority: patch.priority ?? item.priority,
                status: patch.status ?? item.status,
                updated_at: new Date().toISOString(),
              };
            }),
          })),
        };
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: ({ ids }: { ids: string[] }) => bulkDeleteWishlist(ids),
    networkMode: 'offlineFirst',
    onMutate: async ({ ids }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InfiniteData<WishlistListResult>>(queryKey);
      queryClient.setQueryData<InfiniteData<WishlistListResult>>(queryKey, (old) => {
        if (!old) return old;
        return removeItems(old, new Set(ids));
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const items = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listQuery.data]
  );
  const total = listQuery.data?.pages[0]?.total ?? 0;

  return {
    items,
    total,
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    error: listQuery.error,
    isFetchingNextPage: listQuery.isFetchingNextPage,
    hasNextPage: Boolean(listQuery.hasNextPage),
    fetchNextPage: async () => {
      if (listQuery.hasNextPage) {
        await listQuery.fetchNextPage();
      }
    },
    refetch: async () => {
      await listQuery.refetch();
    },
    createItem: createMutation.mutateAsync,
    updateItem: updateMutation.mutateAsync,
    deleteItem: deleteMutation.mutateAsync,
    bulkUpdate: bulkUpdateMutation.mutateAsync,
    bulkDelete: bulkDeleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isBulkUpdating: bulkUpdateMutation.isPending,
    isBulkDeleting: bulkDeleteMutation.isPending,
  };
}
