import { supabase } from './supabase';
import { getCurrentUserId } from './session';

export type WishlistStatus = 'planned' | 'deferred' | 'purchased' | 'archived';

export interface WishlistCategoryRef {
  id: string;
  name: string;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  title: string;
  estimated_price: number | null;
  priority: number | null;
  category_id: string | null;
  category: WishlistCategoryRef | null;
  store_url: string | null;
  note: string | null;
  status: WishlistStatus;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export type WishlistSortOption =
  | 'newest'
  | 'oldest'
  | 'price-asc'
  | 'price-desc'
  | 'priority-desc'
  | 'priority-asc';

export interface WishlistListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: WishlistStatus;
  priority?: number;
  categoryId?: string;
  priceMin?: number;
  priceMax?: number;
  sort?: WishlistSortOption;
}

export interface WishlistListResult {
  items: WishlistItem[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

const DEFAULT_PAGE_SIZE = 20;

function sanitizeNumber(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  return value;
}

function mapWishlistRow(row: Record<string, any>): WishlistItem {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    estimated_price: row.estimated_price != null ? Number(row.estimated_price) : null,
    priority: row.priority != null ? Number(row.priority) : null,
    category_id: row.category_id ?? null,
    category: row.category ?? null,
    store_url: row.store_url ?? null,
    note: row.note ?? null,
    status: row.status as WishlistStatus,
    image_url: row.image_url ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listWishlist(params: WishlistListParams = {}): Promise<WishlistListResult> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus masuk untuk melihat wishlist.');
  }

  const {
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    search,
    status,
    priority,
    categoryId,
    priceMin,
    priceMax,
    sort = 'newest',
  } = params;

  const pageNumber = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 100) : DEFAULT_PAGE_SIZE;
  const from = (pageNumber - 1) * size;
  const to = from + size - 1;

  let query = supabase
    .from('wishlist_items')
    .select(
      `id, user_id, title, estimated_price, priority, category_id, store_url, note, status, image_url, created_at, updated_at,
       category:categories(id, name)`
    , { count: 'exact' })
    .eq('user_id', userId);

  if (search) {
    const term = `%${search.trim().replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
    query = query.or(`title.ilike.${term},note.ilike.${term}`);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (priority != null) {
    query = query.eq('priority', priority);
  }

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  if (priceMin != null && Number.isFinite(priceMin)) {
    query = query.gte('estimated_price', priceMin);
  }

  if (priceMax != null && Number.isFinite(priceMax)) {
    query = query.lte('estimated_price', priceMax);
  }

  switch (sort) {
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'price-asc':
      query = query.order('estimated_price', { ascending: true, nullsFirst: true });
      break;
    case 'price-desc':
      query = query.order('estimated_price', { ascending: false, nullsLast: true });
      break;
    case 'priority-asc':
      query = query.order('priority', { ascending: true, nullsLast: false });
      break;
    case 'priority-desc':
      query = query.order('priority', { ascending: false, nullsFirst: false });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(error.message || 'Gagal memuat wishlist.');
  }

  const total = count ?? 0;
  const items = (data ?? []).map(mapWishlistRow);
  const hasMore = to + 1 < total;

  return {
    items,
    page: pageNumber,
    pageSize: size,
    total,
    hasMore,
  };
}

export interface WishlistCreatePayload {
  title: string;
  estimated_price?: number | null;
  priority?: number | null;
  category_id?: string | null;
  store_url?: string | null;
  note?: string | null;
  status?: WishlistStatus;
  image_url?: string | null;
}

export async function createWishlistItem(payload: WishlistCreatePayload): Promise<WishlistItem> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus masuk untuk menambah wishlist.');
  }

  const {
    title,
    estimated_price,
    priority,
    category_id,
    store_url,
    note,
    status = 'planned',
    image_url,
  } = payload;

  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error('Judul wajib diisi.');
  }

  const insertPayload = {
    user_id: userId,
    title: trimmedTitle,
    estimated_price: sanitizeNumber(estimated_price) ?? null,
    priority: priority != null ? Math.min(Math.max(priority, 1), 5) : null,
    category_id: category_id || null,
    store_url: store_url?.trim() || null,
    note: note?.trim() || null,
    status,
    image_url: image_url?.trim() || null,
  };

  const { data, error } = await supabase
    .from('wishlist_items')
    .insert(insertPayload)
    .select(
      `id, user_id, title, estimated_price, priority, category_id, store_url, note, status, image_url, created_at, updated_at,
       category:categories(id, name)`
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Gagal menambah wishlist.');
  }

  return mapWishlistRow(data);
}

export type WishlistUpdatePayload = Partial<Omit<WishlistCreatePayload, 'title'>> & { title?: string };

export async function updateWishlistItem(id: string, payload: WishlistUpdatePayload): Promise<WishlistItem> {
  if (!id) {
    throw new Error('ID wishlist tidak valid.');
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus masuk untuk memperbarui wishlist.');
  }

  const patch: Record<string, any> = {};
  if (payload.title != null) {
    const trimmed = payload.title.trim();
    if (!trimmed) {
      throw new Error('Judul wajib diisi.');
    }
    patch.title = trimmed;
  }
  if (payload.estimated_price !== undefined) {
    patch.estimated_price = sanitizeNumber(payload.estimated_price);
  }
  if (payload.priority !== undefined) {
    patch.priority = payload.priority != null ? Math.min(Math.max(payload.priority, 1), 5) : null;
  }
  if (payload.category_id !== undefined) {
    patch.category_id = payload.category_id || null;
  }
  if (payload.store_url !== undefined) {
    patch.store_url = payload.store_url?.trim() || null;
  }
  if (payload.note !== undefined) {
    patch.note = payload.note?.trim() || null;
  }
  if (payload.status !== undefined) {
    patch.status = payload.status;
  }
  if (payload.image_url !== undefined) {
    patch.image_url = payload.image_url?.trim() || null;
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('wishlist_items')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select(
      `id, user_id, title, estimated_price, priority, category_id, store_url, note, status, image_url, created_at, updated_at,
       category:categories(id, name)`
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Gagal memperbarui wishlist.');
  }

  return mapWishlistRow(data);
}

export async function deleteWishlistItem(id: string): Promise<void> {
  if (!id) {
    throw new Error('ID wishlist tidak valid.');
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus masuk untuk menghapus wishlist.');
  }

  const { error } = await supabase.from('wishlist_items').delete().eq('id', id).eq('user_id', userId);
  if (error) {
    throw new Error(error.message || 'Gagal menghapus wishlist.');
  }
}

export async function bulkUpdateWishlist(ids: string[], patch: WishlistUpdatePayload): Promise<void> {
  if (!Array.isArray(ids) || ids.length === 0) return;

  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus masuk untuk memperbarui wishlist.');
  }

  const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
  if (patch.priority !== undefined) {
    updatePayload.priority = patch.priority != null ? Math.min(Math.max(patch.priority, 1), 5) : null;
  }
  if (patch.status !== undefined) {
    updatePayload.status = patch.status;
  }

  const { error } = await supabase.from('wishlist_items').update(updatePayload).in('id', ids).eq('user_id', userId);
  if (error) {
    throw new Error(error.message || 'Gagal memperbarui wishlist secara massal.');
  }
}

export async function bulkDeleteWishlist(ids: string[]): Promise<void> {
  if (!Array.isArray(ids) || ids.length === 0) return;

  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus masuk untuk menghapus wishlist.');
  }

  const { error } = await supabase.from('wishlist_items').delete().in('id', ids).eq('user_id', userId);
  if (error) {
    throw new Error(error.message || 'Gagal menghapus wishlist secara massal.');
  }
}
