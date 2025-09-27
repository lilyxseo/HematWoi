import { useMemo } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  MutationFunction,
} from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';
import {
  WishlistCreatePayload,
  WishlistItem,
  WishlistListParams,
  WishlistListResponse,
  WishlistSort,
  WishlistStatus,
  WishlistUpdatePayload,
  bulkDeleteWishlist,
  bulkUpdateWishlist,
  createWishlistItem,
  deleteWishlistItem,
  listWishlist,
  updateWishlistItem,
} from '../lib/wishlistApi';

function normalizeNumber(value: unknown): number | null {
  if (value === '' || value == null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number(String(value).replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePriority(value: unknown): number | null {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const clamped = Math.max(1, Math.min(5, Math.trunc(parsed)));
  return clamped;
}

function matchFilters(item: WishlistItem, params: WishlistListParams): boolean {
  const { search, status, priority, categoryId, priceMin, priceMax } = params;
  if (search && search.trim()) {
    const normalized = search.trim().toLocaleLowerCase('id-ID');
    const matchesTitle = item.title.toLocaleLowerCase('id-ID').includes(normalized);
    const matchesNote = (item.note ?? '').toLocaleLowerCase('id-ID').includes(normalized);
    if (!matchesTitle && !matchesNote) {
      return false;
    }
  }
  if (status && status !== 'all' && item.status !== status) {
    return false;
  }
  if (priority && priority !== 'all') {
    const wanted = normalizePriority(priority);
    if (wanted != null && (item.priority ?? null) !== wanted) {
      return false;
    }
  }
  if (categoryId && categoryId !== 'all' && item.category_id !== categoryId) {
    return false;
  }
  const min = normalizeNumber(priceMin);
  if (min != null && (item.estimated_price ?? 0) < min) {
    return false;
  }
  const max = normalizeNumber(priceMax);
  if (max != null && (item.estimated_price ?? 0) > max) {
    return false;
  }
  return true;
}

function sortItems(items: WishlistItem[], sort?: WishlistSort): WishlistItem[] {
  const sorted = [...items];
  switch (sort) {
    case 'oldest':
      sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
      break;
    case 'priceAsc':
      sorted.sort((a, b) => {
        const aPrice = a.estimated_price ?? Number.POSITIVE_INFINITY;
        const bPrice = b.estimated_price ?? Number.POSITIVE_INFINITY;
        if (aPrice === bPrice) {
          return a.title.localeCompare(b.title, 'id-ID');
        }
        return aPrice - bPrice;
      });
      break;
    case 'priceDesc':
      sorted.sort((a, b) => {
        const aPrice = a.estimated_price ?? Number.NEGATIVE_INFINITY;
        const bPrice = b.estimated_price ?? Number.NEGATIVE_INFINITY;
        if (aPrice === bPrice) {
          return a.title.localeCompare(b.title, 'id-ID');
        }
        return bPrice - aPrice;
      });
      break;
    case 'priority':
      sorted.sort((a, b) => {
        const aPriority = a.priority ?? -1;
        const bPriority = b.priority ?? -1;
        if (aPriority === bPriority) {
          return b.created_at.localeCompare(a.created_at);
        }
        return bPriority - aPriority;
      });
      break;
    case 'newest':
    default:
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
      break;
  }
  return sorted;
}

function applyPatch(item: WishlistItem, patch: WishlistUpdatePayload): WishlistItem {
  return {
    ...item,
    title: typeof patch.title === 'string' ? patch.title : item.title,
    estimated_price:
      patch.estimated_price !== undefined
        ? normalizeNumber(patch.estimated_price)
        : item.estimated_price,
    priority: patch.priority !== undefined ? normalizePriority(patch.priority) : item.priority,
    category_id:
      patch.category_id !== undefined ? (patch.category_id ?? null) : item.category_id,
    store_url: patch.store_url !== undefined ? patch.store_url?.trim() || null : item.store_url,
    status:
      patch.status !== undefined
        ? (patch.status as WishlistStatus)
        : item.status,
    note: patch.note !== undefined ? patch.note?.trim() || null : item.note,
    image_url: patch.image_url !== undefined ? patch.image_url?.trim() || null : item.image_url,
    updated_at: new Date().toISOString(),
  };
}

function baseQueryKey(params: WishlistListParams) {
  return ['wishlist', params] as const;
}

type UpdateVariables = { id: string; patch: WishlistUpdatePayload };
type DeleteVariables = { id: string };

export function useWishlist(params: WishlistListParams) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const addToast = toast?.addToast;

  const queryKey = useMemo(() => baseQueryKey(params), [params]);

  const query = useQuery<WishlistListResponse, Error>({
    queryKey,
    queryFn: () => listWishlist(params),
    keepPreviousData: true,
    staleTime: 60_000,
  });

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['wishlist'] });
  };

  const createMutation = useMutation({
    mutationFn: createWishlistItem as MutationFunction<WishlistItem, WishlistCreatePayload>,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WishlistListResponse>(queryKey);
      const optimisticId = `temp-${Date.now()}`;
      const optimisticItem: WishlistItem = {
        id: optimisticId,
        user_id: '',
        title: payload.title,
        estimated_price: normalizeNumber(payload.estimated_price),
        priority: normalizePriority(payload.priority),
        category_id: payload.category_id ?? null,
        store_url: payload.store_url?.trim() || null,
        note: payload.note?.trim() || null,
        status: (payload.status as WishlistStatus) ?? 'planned',
        image_url: payload.image_url?.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let inserted = false;
      if (previous && params.page === 1 && matchFilters(optimisticItem, params)) {
        const items = sortItems([optimisticItem, ...previous.items], params.sort);
        const limited = items.slice(0, previous.pageSize);
        const total = previous.total + 1;
        const pageCount = Math.max(1, Math.ceil(total / previous.pageSize));
        queryClient.setQueryData<WishlistListResponse>(queryKey, {
          ...previous,
          items: limited,
          total,
          pageCount,
        });
        inserted = true;
      }

      return { previous, optimisticId, inserted };
    },
    onError: (error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      if (addToast) {
        addToast(error.message || 'Gagal menambahkan wishlist.', 'danger');
      }
    },
    onSuccess: (data, _payload, context) => {
      const inserted = Boolean(context?.inserted);
      queryClient.setQueryData<WishlistListResponse>(queryKey, (current) => {
        if (!current) return current;
        if (!matchFilters(data, params)) {
          return inserted
            ? {
                ...current,
                total: Math.max(0, current.total - 1),
                pageCount: Math.max(1, Math.ceil(Math.max(0, current.total - 1) / current.pageSize)),
              }
            : current;
        }
        const items = [...current.items];
        if (context?.optimisticId) {
          const idx = items.findIndex((item) => item.id === context.optimisticId);
          if (idx !== -1) {
            items[idx] = data;
          } else if (params.page === 1) {
            items.unshift(data);
            if (items.length > current.pageSize) {
              items.pop();
            }
          }
        } else if (params.page === 1) {
          items.unshift(data);
          if (items.length > current.pageSize) {
            items.pop();
          }
        }
        const sorted = sortItems(items, params.sort);
        const total = inserted ? current.total : current.total + 1;
        return {
          ...current,
          items: sorted,
          total,
          pageCount: Math.max(1, Math.ceil(total / current.pageSize)),
        };
      });
      if (addToast) {
        addToast('Wishlist berhasil ditambahkan.', 'success');
      }
    },
    onSettled: () => {
      invalidateAll();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: UpdateVariables) => updateWishlistItem(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WishlistListResponse>(queryKey);
      if (previous) {
        const items = previous.items.map((item) => {
          if (item.id !== id) return item;
          return applyPatch(item, patch);
        });
        queryClient.setQueryData<WishlistListResponse>(queryKey, {
          ...previous,
          items: sortItems(items, params.sort),
        });
      }
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      if (addToast) {
        addToast(error.message || 'Gagal memperbarui wishlist.', 'danger');
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData<WishlistListResponse>(queryKey, (current) => {
        if (!current) return current;
        let items = current.items.filter((item) => item.id !== data.id);
        if (matchFilters(data, params)) {
          items = sortItems([...items, data], params.sort);
        }
        return { ...current, items };
      });
      if (addToast) {
        addToast('Wishlist diperbarui.', 'success');
      }
    },
    onSettled: () => {
      invalidateAll();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }: DeleteVariables) => deleteWishlistItem(id),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WishlistListResponse>(queryKey);
      if (previous) {
        const items = previous.items.filter((item) => item.id !== id);
        const total = Math.max(0, previous.total - 1);
        queryClient.setQueryData<WishlistListResponse>(queryKey, {
          ...previous,
          items,
          total,
          pageCount: Math.max(1, Math.ceil(total / previous.pageSize)),
        });
      }
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      if (addToast) {
        addToast(error.message || 'Gagal menghapus wishlist.', 'danger');
      }
    },
    onSuccess: () => {
      if (addToast) {
        addToast('Wishlist dihapus.', 'success');
      }
    },
    onSettled: () => {
      invalidateAll();
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: WishlistStatus }) =>
      bulkUpdateWishlist(ids, { status }),
    onMutate: async ({ ids, status }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WishlistListResponse>(queryKey);
      if (previous) {
        const items = sortItems(
          previous.items.map((item) =>
            ids.includes(item.id) ? { ...item, status } : item,
          ),
          params.sort,
        );
        queryClient.setQueryData<WishlistListResponse>(queryKey, {
          ...previous,
          items,
        });
      }
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      if (addToast) {
        addToast(error.message || 'Gagal mengubah status.', 'danger');
      }
    },
    onSuccess: () => {
      if (addToast) {
        addToast('Status wishlist diperbarui.', 'success');
      }
    },
    onSettled: () => {
      invalidateAll();
    },
  });

  const bulkPriorityMutation = useMutation({
    mutationFn: ({ ids, priority }: { ids: string[]; priority: number }) =>
      bulkUpdateWishlist(ids, { priority }),
    onMutate: async ({ ids, priority }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WishlistListResponse>(queryKey);
      if (previous) {
        const items = sortItems(
          previous.items.map((item) =>
            ids.includes(item.id) ? { ...item, priority } : item,
          ),
          params.sort,
        );
        queryClient.setQueryData<WishlistListResponse>(queryKey, {
          ...previous,
          items,
        });
      }
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      if (addToast) {
        addToast(error.message || 'Gagal mengubah prioritas.', 'danger');
      }
    },
    onSuccess: () => {
      if (addToast) {
        addToast('Prioritas wishlist diperbarui.', 'success');
      }
    },
    onSettled: () => {
      invalidateAll();
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: ({ ids }: { ids: string[] }) => bulkDeleteWishlist(ids),
    onMutate: async ({ ids }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WishlistListResponse>(queryKey);
      if (previous) {
        const items = previous.items.filter((item) => !ids.includes(item.id));
        const total = Math.max(0, previous.total - ids.length);
        queryClient.setQueryData<WishlistListResponse>(queryKey, {
          ...previous,
          items,
          total,
          pageCount: Math.max(1, Math.ceil(total / previous.pageSize)),
        });
      }
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      if (addToast) {
        addToast(error.message || 'Gagal menghapus wishlist terpilih.', 'danger');
      }
    },
    onSuccess: () => {
      if (addToast) {
        addToast('Wishlist terpilih dihapus.', 'success');
      }
    },
    onSettled: () => {
      invalidateAll();
    },
  });

  const data = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const page = query.data?.page ?? params.page ?? 1;
  const pageCount = query.data?.pageCount ?? 1;
  const pageSize = query.data?.pageSize ?? params.pageSize ?? 20;

  return {
    items: data,
    total,
    page,
    pageCount,
    pageSize,
    query,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    createItem: createMutation.mutateAsync,
    updateItem: (id: string, patch: WishlistUpdatePayload) =>
      updateMutation.mutateAsync({ id, patch }),
    deleteItem: (id: string) => deleteMutation.mutateAsync({ id }),
    bulkSetStatus: (ids: string[], status: WishlistStatus) =>
      bulkStatusMutation.mutateAsync({ ids, status }),
    bulkSetPriority: (ids: string[], priority: number) =>
      bulkPriorityMutation.mutateAsync({ ids, priority }),
    bulkDelete: (ids: string[]) => bulkDeleteMutation.mutateAsync({ ids }),
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      bulkStatusMutation.isPending ||
      bulkPriorityMutation.isPending ||
      bulkDeleteMutation.isPending,
  };
}
