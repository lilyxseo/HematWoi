import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getCurrentUserId } from './session';

export type WishlistStatus = 'planned' | 'deferred' | 'purchased' | 'archived';

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
  created_at: string | null;
  updated_at: string | null;
}

export interface WishlistItemPayload {
  title: string;
  estimated_price?: number | null;
  priority?: number | null;
  category_id?: string | null;
  store_url?: string | null;
  note?: string | null;
  status?: WishlistStatus;
  image_url?: string | null;
}

export interface ListWishlistParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: WishlistStatus | 'all';
  priority?: number | 'all';
  categoryId?: string | 'all';
  priceMin?: number | null;
  priceMax?: number | null;
  sort?: 'newest' | 'oldest' | 'price-asc' | 'price-desc' | 'priority';
}

export interface ListWishlistResult {
  items: WishlistItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const TABLE_NAME = 'wishlist_items';

function createFriendlyError(error: unknown, fallback: string): Error {
  if (error instanceof Error && error.message) {
    return new Error(error.message);
  }
  if (error && typeof error === 'object') {
    if ('message' in error && typeof (error as any).message === 'string') {
      return new Error((error as any).message);
    }
    if ('code' in error && (error as PostgrestError).code === '42501') {
      return new Error('Tidak punya izin. Coba muat ulang sesi.');
    }
  }
  return new Error(fallback);
}

function normalizeNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  return null;
}

function normalizeWishlistRow(row: Record<string, any>): WishlistItem {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title ?? '',
    estimated_price: normalizeNumber(row.estimated_price),
    priority: normalizeNumber(row.priority),
    category_id: row.category_id ?? null,
    store_url: row.store_url ?? null,
    note: row.note ?? null,
    status: (row.status ?? 'planned') as WishlistStatus,
    image_url: row.image_url ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

export async function listWishlist(params: ListWishlistParams = {}): Promise<ListWishlistResult> {
  const {
    page = 1,
    pageSize = 20,
    search,
    status = 'all',
    priority = 'all',
    categoryId = 'all',
    priceMin,
    priceMax,
    sort = 'newest',
  } = params;

  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Tidak punya izin. Coba muat ulang sesi.');
  }

  let query = supabase
    .from(TABLE_NAME)
    .select('*', { count: 'exact' })
    .eq('user_id', userId);

  if (search && search.trim()) {
    const term = escapeLike(search.trim());
    query = query.or(`title.ilike.%${term}%,note.ilike.%${term}%`);
  }

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (priority !== 'all' && priority != null) {
    query = query.eq('priority', priority);
  }

  if (categoryId && categoryId !== 'all') {
    query = query.eq('category_id', categoryId);
  }

  if (typeof priceMin === 'number' && Number.isFinite(priceMin)) {
    query = query.gte('estimated_price', priceMin);
  }

  if (typeof priceMax === 'number' && Number.isFinite(priceMax)) {
    query = query.lte('estimated_price', priceMax);
  }

  switch (sort) {
    case 'oldest':
      query = query.order('created_at', { ascending: true, nullsFirst: false });
      break;
    case 'price-asc':
      query = query.order('estimated_price', { ascending: true, nullsFirst: true });
      break;
    case 'price-desc':
      query = query.order('estimated_price', { ascending: false, nullsFirst: true });
      break;
    case 'priority':
      query = query.order('priority', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false, nullsFirst: false });
      break;
  }

  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  const { data, error, count } = await query.range(start, end);

  if (error) {
    throw createFriendlyError(error, 'Gagal memuat wishlist. Coba lagi nanti.');
  }

  const items = Array.isArray(data) ? data.map((row) => normalizeWishlistRow(row)) : [];
  const total = typeof count === 'number' ? count : items.length;
  const hasMore = end + 1 < (count ?? items.length);

  return {
    items,
    total,
    page,
    pageSize,
    hasMore,
  };
}

export async function createWishlistItem(payload: WishlistItemPayload): Promise<WishlistItem> {
  if (!payload?.title?.trim()) {
    throw new Error('Judul wajib diisi.');
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Tidak punya izin. Coba muat ulang sesi.');
  }

  const now = new Date().toISOString();
  const body = {
    ...payload,
    user_id: userId,
    status: payload.status ?? 'planned',
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(body)
    .select('*')
    .single();

  if (error) {
    throw createFriendlyError(error, 'Gagal menambahkan wishlist.');
  }

  return normalizeWishlistRow(data as Record<string, any>);
}

export async function updateWishlistItem(
  id: string,
  patch: WishlistItemPayload,
): Promise<WishlistItem> {
  if (!id) {
    throw new Error('ID tidak valid.');
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Tidak punya izin. Coba muat ulang sesi.');
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw createFriendlyError(error, 'Gagal memperbarui wishlist.');
  }

  return normalizeWishlistRow(data as Record<string, any>);
}

export async function deleteWishlistItem(id: string): Promise<void> {
  if (!id) {
    throw new Error('ID tidak valid.');
  }
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Tidak punya izin. Coba muat ulang sesi.');
  }

  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    throw createFriendlyError(error, 'Gagal menghapus wishlist.');
  }
}

export async function bulkUpdateWishlist(
  ids: string[],
  patch: Pick<WishlistItemPayload, 'priority' | 'status'>,
): Promise<number> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return 0;
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Tidak punya izin. Coba muat ulang sesi.');
  }

  const body: Record<string, any> = { ...patch, updated_at: new Date().toISOString() };

  const { error, count } = await supabase
    .from(TABLE_NAME)
    .update(body)
    .in('id', ids)
    .eq('user_id', userId);

  if (error) {
    throw createFriendlyError(error, 'Gagal memperbarui data terpilih.');
  }

  return typeof count === 'number' ? count : ids.length;
}

export async function bulkDeleteWishlist(ids: string[]): Promise<number> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return 0;
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Tidak punya izin. Coba muat ulang sesi.');
  }

  const { error, count } = await supabase
    .from(TABLE_NAME)
    .delete()
    .in('id', ids)
    .eq('user_id', userId);

  if (error) {
    throw createFriendlyError(error, 'Gagal menghapus data terpilih.');
  }

  return typeof count === 'number' ? count : ids.length;
}
