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
  created_at: string;
  updated_at: string;
}

export type WishlistSortOption = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'priority';

export interface WishlistListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: WishlistStatus | 'all';
  priority?: number | 'all';
  categoryId?: string | 'all';
  priceMin?: number | null;
  priceMax?: number | null;
  sort?: WishlistSortOption;
}

export interface WishlistListResponse {
  items: WishlistItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
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

export type WishlistUpdatePayload = Partial<WishlistCreatePayload>;

const VALID_STATUSES: WishlistStatus[] = ['planned', 'deferred', 'purchased', 'archived'];
const DEFAULT_PAGE_SIZE = 20;

const SORT_MAPPING: Record<WishlistSortOption, { column: string; ascending: boolean; nullsLast?: boolean }> = {
  newest: { column: 'created_at', ascending: false },
  oldest: { column: 'created_at', ascending: true },
  price_asc: { column: 'estimated_price', ascending: true, nullsLast: true },
  price_desc: { column: 'estimated_price', ascending: false, nullsLast: true },
  priority: { column: 'priority', ascending: true, nullsLast: true },
};

type WishlistQuery = ReturnType<(typeof supabase)['from']>;

function toWishlistItem(row: Record<string, unknown>): WishlistItem {
  return {
    id: String(row.id ?? ''),
    user_id: String(row.user_id ?? ''),
    title: typeof row.title === 'string' ? row.title : '',
    estimated_price:
      row.estimated_price === null || typeof row.estimated_price === 'undefined'
        ? null
        : Number(row.estimated_price),
    priority:
      row.priority === null || typeof row.priority === 'undefined'
        ? null
        : Number.parseInt(String(row.priority), 10),
    category_id: typeof row.category_id === 'string' ? row.category_id : null,
    store_url: typeof row.store_url === 'string' ? row.store_url : null,
    note: typeof row.note === 'string' ? row.note : null,
    status: VALID_STATUSES.includes(row.status as WishlistStatus)
      ? (row.status as WishlistStatus)
      : 'planned',
    image_url: typeof row.image_url === 'string' ? row.image_url : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : new Date().toISOString(),
  };
}

function normalizePage(value?: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizePageSize(value?: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 100) {
    return parsed;
  }
  return DEFAULT_PAGE_SIZE;
}

function applyFilters(query: WishlistQuery, params: WishlistListParams) {
  const { search, status, priority, categoryId, priceMin, priceMax } = params;

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query.or(`title.ilike.${term},note.ilike.${term}`);
  }

  if (status && status !== 'all') {
    query.eq('status', status);
  }

  if (typeof priority === 'number') {
    query.eq('priority', priority);
  }

  if (categoryId && categoryId !== 'all') {
    query.eq('category_id', categoryId);
  }

  if (typeof priceMin === 'number' && Number.isFinite(priceMin)) {
    query.gte('estimated_price', priceMin);
  }

  if (typeof priceMax === 'number' && Number.isFinite(priceMax)) {
    query.lte('estimated_price', priceMax);
  }
}

export async function listWishlist(params: WishlistListParams = {}): Promise<WishlistListResponse> {
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sortKey = params.sort && SORT_MAPPING[params.sort] ? params.sort : 'newest';
  const sort = SORT_MAPPING[sortKey];

  const query = supabase
    .from('wishlist_items')
    .select(
      'id, user_id, title, estimated_price, priority, category_id, store_url, note, status, image_url, created_at, updated_at',
      { count: 'exact' }
    );

  const userId = await getCurrentUserId().catch(() => null);
  if (userId) {
    query.eq('user_id', userId);
  }

  applyFilters(query as WishlistQuery, params);

  const { data, error, count } = await query
    .order(sort.column, { ascending: sort.ascending, nullsFirst: !sort.nullsLast })
    .range(from, to);

  if (error) {
    throw new Error(error.message || 'Gagal memuat wishlist.');
  }

  const items = (data ?? []).map((row) => toWishlistItem(row));
  const total = typeof count === 'number' ? count : items.length;
  const hasMore = page * pageSize < total;

  return { items, total, page, pageSize, hasMore };
}

function sanitizeTitle(input: string | undefined): string {
  const value = input?.trim();
  if (!value) {
    throw new Error('Judul wishlist wajib diisi.');
  }
  if (value.length > 160) {
    throw new Error('Judul wishlist terlalu panjang.');
  }
  return value;
}

function sanitizeEstimatedPrice(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Perkiraan harga harus berupa angka lebih besar atau sama dengan 0.');
  }
  return Number(parsed.toFixed(2));
}

function sanitizePriority(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
    throw new Error('Prioritas harus antara 1 sampai 5.');
  }
  return parsed;
}

function sanitizeStatus(value: unknown): WishlistStatus {
  if (VALID_STATUSES.includes(value as WishlistStatus)) {
    return value as WishlistStatus;
  }
  return 'planned';
}

function sanitizeUrl(value: unknown): string | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error('URL toko tidak valid.');
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('URL toko harus diawali dengan http atau https.');
    }
    return parsed.toString();
  } catch {
    throw new Error('URL toko tidak valid.');
  }
}

function sanitizeNote(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function sanitizeImageUrl(value: unknown): string | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error('URL gambar tidak valid.');
  }
  return value.trim();
}

export async function createWishlistItem(payload: WishlistCreatePayload): Promise<WishlistItem> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda perlu masuk untuk menambah wishlist.');
  }

  const record = {
    user_id: userId,
    title: sanitizeTitle(payload.title),
    estimated_price: sanitizeEstimatedPrice(payload.estimated_price ?? null),
    priority: sanitizePriority(payload.priority ?? null),
    category_id: payload.category_id || null,
    store_url: sanitizeUrl(payload.store_url ?? null),
    note: sanitizeNote(payload.note ?? null),
    status: sanitizeStatus(payload.status ?? 'planned'),
    image_url: sanitizeImageUrl(payload.image_url ?? null),
  };

  const { data, error } = await supabase
    .from('wishlist_items')
    .insert(record)
    .select(
      'id, user_id, title, estimated_price, priority, category_id, store_url, note, status, image_url, created_at, updated_at'
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Gagal menambah wishlist.');
  }

  return toWishlistItem(data);
}

export async function updateWishlistItem(id: string, patch: WishlistUpdatePayload): Promise<WishlistItem> {
  if (!id) {
    throw new Error('ID wishlist tidak valid.');
  }

  const updates: Record<string, unknown> = {};

  if (typeof patch.title !== 'undefined') {
    updates.title = sanitizeTitle(patch.title);
  }
  if (typeof patch.estimated_price !== 'undefined') {
    updates.estimated_price = sanitizeEstimatedPrice(patch.estimated_price);
  }
  if (typeof patch.priority !== 'undefined') {
    updates.priority = sanitizePriority(patch.priority);
  }
  if (typeof patch.category_id !== 'undefined') {
    updates.category_id = patch.category_id || null;
  }
  if (typeof patch.store_url !== 'undefined') {
    updates.store_url = sanitizeUrl(patch.store_url);
  }
  if (typeof patch.note !== 'undefined') {
    updates.note = sanitizeNote(patch.note);
  }
  if (typeof patch.status !== 'undefined') {
    updates.status = sanitizeStatus(patch.status);
  }
  if (typeof patch.image_url !== 'undefined') {
    updates.image_url = sanitizeImageUrl(patch.image_url);
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('Tidak ada perubahan untuk disimpan.');
  }

  const { data, error } = await supabase
    .from('wishlist_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(
      'id, user_id, title, estimated_price, priority, category_id, store_url, note, status, image_url, created_at, updated_at'
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Gagal memperbarui wishlist.');
  }

  return toWishlistItem(data);
}

export async function deleteWishlistItem(id: string): Promise<void> {
  if (!id) {
    throw new Error('ID wishlist tidak valid.');
  }
  const { error } = await supabase.from('wishlist_items').delete().eq('id', id);
  if (error) {
    throw new Error(error.message || 'Gagal menghapus wishlist.');
  }
}

export async function bulkUpdateWishlist(ids: string[], patch: WishlistUpdatePayload): Promise<void> {
  if (!Array.isArray(ids) || !ids.length) {
    throw new Error('Pilih minimal satu wishlist untuk diperbarui.');
  }

  const updates: Record<string, unknown> = {};

  if (typeof patch.status !== 'undefined') {
    updates.status = sanitizeStatus(patch.status);
  }
  if (typeof patch.priority !== 'undefined') {
    updates.priority = sanitizePriority(patch.priority);
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('Tidak ada perubahan yang dipilih.');
  }

  const { error } = await supabase
    .from('wishlist_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .in('id', ids);

  if (error) {
    throw new Error(error.message || 'Gagal memperbarui wishlist terpilih.');
  }
}

export async function bulkDeleteWishlist(ids: string[]): Promise<void> {
  if (!Array.isArray(ids) || !ids.length) {
    throw new Error('Pilih minimal satu wishlist untuk dihapus.');
  }
  const { error } = await supabase.from('wishlist_items').delete().in('id', ids);
  if (error) {
    throw new Error(error.message || 'Gagal menghapus wishlist terpilih.');
  }
}
