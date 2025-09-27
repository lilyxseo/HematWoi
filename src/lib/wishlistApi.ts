import { supabase } from './supabase';
import { getCurrentUserId } from './session';

export type WishlistStatus = 'planned' | 'deferred' | 'purchased' | 'archived';
export type WishlistSort =
  | 'newest'
  | 'oldest'
  | 'priceAsc'
  | 'priceDesc'
  | 'priority';

export interface WishlistItem {
  id: string;
  user_id: string;
  title: string;
  estimated_price: number | null;
  priority: number | null;
  category_id: string | null;
  store_url: string | null;
  note: string | null;
  status: WishlistStatus;
  image_url: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface WishlistListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: WishlistStatus | 'all';
  priority?: number | 'all';
  categoryId?: string | null | 'all';
  priceMin?: number | null;
  priceMax?: number | null;
  sort?: WishlistSort;
}

export interface WishlistCreatePayload {
  title: string;
  estimated_price?: number | null;
  priority?: number | null;
  category_id?: string | null;
  store_url?: string | null;
  status?: WishlistStatus;
  note?: string | null;
  image_url?: string | null;
}

export type WishlistUpdatePayload = Partial<WishlistCreatePayload>;

export interface WishlistListResponse {
  items: WishlistItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const TABLE_NAME = 'wishlist_items';

const SORT_CONFIG: Record<WishlistSort, { column: string; ascending: boolean }> = {
  newest: { column: 'created_at', ascending: false },
  oldest: { column: 'created_at', ascending: true },
  priceAsc: { column: 'estimated_price', ascending: true },
  priceDesc: { column: 'estimated_price', ascending: false },
  priority: { column: 'priority', ascending: false },
};

const isDevelopment = Boolean(
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'),
);

function logDevError(scope: string, error: unknown) {
  if (isDevelopment) {
    // eslint-disable-next-line no-console
    console.error(`[HW][wishlist-api] ${scope}`, error);
  }
}

function sanitizeIlike(value?: string | null) {
  if (!value) return '';
  return String(value).replace(/[%_]/g, (match) => `\\${match}`);
}

function toPositiveNumber(value: unknown): number | null {
  if (value === '' || value == null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  const parsed = Number(String(value).replace(/[^0-9.+-]/g, ''));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function toPriority(value: unknown): number | null {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const clamped = Math.max(1, Math.min(5, Math.trunc(parsed)));
  return clamped;
}

function mapWishlistRow(row: Record<string, any>): WishlistItem {
  return {
    id: String(row.id ?? ''),
    user_id: String(row.user_id ?? ''),
    title: typeof row.title === 'string' ? row.title : '',
    estimated_price: toPositiveNumber(row.estimated_price),
    priority: toPriority(row.priority),
    category_id: typeof row.category_id === 'string' ? row.category_id : null,
    store_url: typeof row.store_url === 'string' ? row.store_url : null,
    note: typeof row.note === 'string' ? row.note : null,
    status: (row.status as WishlistStatus) ?? 'planned',
    image_url: typeof row.image_url === 'string' ? row.image_url : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
  };
}

function assertValidStatus(status?: string | null): WishlistStatus {
  if (status === 'deferred' || status === 'purchased' || status === 'archived') {
    return status;
  }
  return 'planned';
}

function toError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    const wrapped = new Error(error.message);
    (wrapped as { cause?: unknown }).cause = error.cause ?? error;
    return wrapped;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  return new Error(fallback);
}

export async function listWishlist(params: WishlistListParams = {}): Promise<WishlistListResponse> {
  const {
    page = 1,
    pageSize = 20,
    search,
    status,
    priority,
    categoryId,
    priceMin,
    priceMax,
    sort = 'newest',
  } = params;

  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('User tidak ditemukan.');
  }

  try {
    let query = supabase
      .from(TABLE_NAME)
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (search && search.trim()) {
      const safe = sanitizeIlike(search.trim());
      query = query.or(`title.ilike.%${safe}%,note.ilike.%${safe}%`);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (priority && priority !== 'all') {
      const normalized = toPriority(priority);
      if (normalized) {
        query = query.eq('priority', normalized);
      }
    }

    if (categoryId && categoryId !== 'all') {
      query = query.eq('category_id', categoryId);
    }

    const min = toPositiveNumber(priceMin);
    if (typeof min === 'number') {
      query = query.gte('estimated_price', min);
    }
    const max = toPositiveNumber(priceMax);
    if (typeof max === 'number') {
      query = query.lte('estimated_price', max);
    }

    const sortConfig = SORT_CONFIG[sort] ?? SORT_CONFIG.newest;
    query = query.order(sortConfig.column, {
      ascending: sortConfig.ascending,
      nullsFirst: sortConfig.column === 'estimated_price' ? sortConfig.ascending : undefined,
    });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    const items = (data ?? []).map(mapWishlistRow);
    const total = count ?? items.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));

    return { items, total, page, pageSize, pageCount };
  } catch (error) {
    logDevError('listWishlist', error);
    throw toError(error, 'Gagal memuat wishlist.');
  }
}

export async function createWishlistItem(payload: WishlistCreatePayload): Promise<WishlistItem> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('User tidak ditemukan.');
  }

  const now = new Date().toISOString();
  const record = {
    user_id: userId,
    title: payload.title,
    estimated_price: toPositiveNumber(payload.estimated_price),
    priority: toPriority(payload.priority),
    category_id: payload.category_id ?? null,
    store_url: payload.store_url?.trim() || null,
    status: assertValidStatus(payload.status),
    note: payload.note?.trim() || null,
    image_url: payload.image_url?.trim() || null,
    created_at: now,
    updated_at: now,
  };

  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    return mapWishlistRow(data ?? record);
  } catch (error) {
    logDevError('createWishlistItem', error);
    throw toError(error, 'Gagal menyimpan wishlist.');
  }
}

export async function updateWishlistItem(
  id: string,
  patch: WishlistUpdatePayload,
): Promise<WishlistItem> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('User tidak ditemukan.');
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    updated_at: now,
  };

  if (typeof patch.title === 'string') update.title = patch.title;
  if ('estimated_price' in patch) update.estimated_price = toPositiveNumber(patch.estimated_price);
  if ('priority' in patch) update.priority = toPriority(patch.priority);
  if ('category_id' in patch) update.category_id = patch.category_id ?? null;
  if ('store_url' in patch) update.store_url = patch.store_url?.trim() || null;
  if ('status' in patch) update.status = assertValidStatus(patch.status);
  if ('note' in patch) update.note = patch.note?.trim() || null;
  if ('image_url' in patch) update.image_url = patch.image_url?.trim() || null;

  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(update)
      .eq('user_id', userId)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapWishlistRow(data ?? { ...update, id, user_id: userId });
  } catch (error) {
    logDevError('updateWishlistItem', error);
    throw toError(error, 'Gagal memperbarui wishlist.');
  }
}

export async function deleteWishlistItem(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('User tidak ditemukan.');
  }

  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    logDevError('deleteWishlistItem', error);
    throw toError(error, 'Gagal menghapus wishlist.');
  }
}

export async function bulkUpdateWishlist(
  ids: string[],
  patch: Pick<WishlistUpdatePayload, 'priority' | 'status'>,
): Promise<WishlistItem[]> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('User tidak ditemukan.');
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('priority' in patch) update.priority = toPriority(patch.priority);
  if ('status' in patch && patch.status) update.status = assertValidStatus(patch.status);

  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(update)
      .eq('user_id', userId)
      .in('id', ids)
      .select();
    if (error) throw error;
    return (data ?? []).map(mapWishlistRow);
  } catch (error) {
    logDevError('bulkUpdateWishlist', error);
    throw toError(error, 'Gagal memperbarui wishlist terpilih.');
  }
}

export async function bulkDeleteWishlist(ids: string[]): Promise<void> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return;
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('User tidak ditemukan.');
  }

  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('user_id', userId)
      .in('id', ids);
    if (error) throw error;
  } catch (error) {
    logDevError('bulkDeleteWishlist', error);
    throw toError(error, 'Gagal menghapus wishlist terpilih.');
  }
}
