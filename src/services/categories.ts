import { supabase } from '../lib/supabase';

export type Category = {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  name: string;
  group_name: string | null;
  order_index: number | null;
  inserted_at: string;
};

const CATEGORY_SELECT_COLUMNS =
  'id,user_id,type,name,group_name,order_index,inserted_at';
const CATEGORY_CACHE_PREFIX = 'hw:categories:';
const CATEGORY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCacheKey(types: readonly ('income' | 'expense')[]): string {
  if (!types.length) {
    return `${CATEGORY_CACHE_PREFIX}expense+income`;
  }
  return `${CATEGORY_CACHE_PREFIX}${types.join('+')}`;
}

function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch (error) {
    console.error('[categories:storage] Failed to access localStorage', error);
    return false;
  }
}

export async function getCurrentUserId(): Promise<string> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('[categories:user] Failed to resolve user', error);
      throw error;
    }
    const user = data?.user;
    if (!user) {
      const message = 'Session berakhir, silakan login lagi.';
      console.error('[categories:user] Missing active session');
      throw new Error(message);
    }
    return user.id;
  } catch (error) {
    console.error('[categories:user] Unexpected failure', error);
    throw error;
  }
}

function normalizeTypes(
  types?: readonly ('income' | 'expense')[],
): ('income' | 'expense')[] {
  if (!types || types.length === 0) {
    return ['expense', 'income'];
  }
  const unique: ('income' | 'expense')[] = [];
  types.forEach((item) => {
    if ((item === 'income' || item === 'expense') && !unique.includes(item)) {
      unique.push(item);
    }
  });
  return unique.length ? unique : ['expense', 'income'];
}

export async function fetchCategoriesRaw(options?: {
  types?: ('income' | 'expense')[];
  order?: boolean;
  withOrdering?: boolean;
}): Promise<Category[]> {
  const normalizedTypes = normalizeTypes(options?.types);
  const shouldOrder = options?.order ?? options?.withOrdering ?? true;

  try {
    const userId = await getCurrentUserId();
    let query = supabase
      .from('categories')
      .select(CATEGORY_SELECT_COLUMNS)
      .eq('user_id', userId)
      .in('type', normalizedTypes);

    if (shouldOrder) {
      query = query
        .order('order_index', { ascending: true, nullsFirst: true })
        .order('name', { ascending: true });
    }

    const { data, error } = await query;
    if (error) {
      console.error('[categories:raw] Query failed', error);
      throw error;
    }

    return (data ?? []) as Category[];
  } catch (error) {
    console.error('[categories:raw] Unexpected error', error);
    throw error;
  }
}

export async function fetchCategoryById(id: string): Promise<Category | null> {
  const trimmed = id?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('categories')
      .select(CATEGORY_SELECT_COLUMNS)
      .eq('user_id', userId)
      .eq('id', trimmed)
      .maybeSingle();

    if (error) {
      console.error('[categories:byId] Query failed', error);
      throw error;
    }

    return (data ?? null) as Category | null;
  } catch (error) {
    console.error('[categories:byId] Unexpected error', error);
    throw error;
  }
}

export async function fetchCategoriesSafe(options?: {
  types?: ('income' | 'expense')[];
  order?: boolean;
  withOrdering?: boolean;
}): Promise<Category[]> {
  const normalizedTypes = normalizeTypes(options?.types);
  const shouldOrder = options?.order ?? options?.withOrdering ?? true;
  let primaryError: unknown = null;

  try {
    const rows = await fetchCategoriesRaw({ types: normalizedTypes, order: shouldOrder });
    if (rows.length) {
      return rows;
    }
  } catch (error) {
    console.error('[categories:raw] Primary fetch failed', error);
    primaryError = error;
  }

  try {
    let fallbackQuery = supabase
      .from('categories')
      .select(CATEGORY_SELECT_COLUMNS)
      .in('type', normalizedTypes);

    if (shouldOrder) {
      fallbackQuery = fallbackQuery
        .order('order_index', { ascending: true, nullsFirst: true })
        .order('name', { ascending: true });
    }

    const { data, error } = await fallbackQuery;
    if (error) {
      throw error;
    }

    const result = (data ?? []) as Category[];
    if (result.length) {
      return result;
    }

    console.warn('[categories:raw] Empty result after fallback', {
      types: normalizedTypes,
      primaryError: primaryError instanceof Error ? primaryError.message : primaryError,
    });
    return result;
  } catch (error) {
    console.error('[categories:raw] Fallback fetch failed', {
      error,
      types: normalizedTypes,
      primaryError: primaryError instanceof Error ? primaryError.message : primaryError,
    });
    return [];
  }
}

export function cacheCategories(key: string, data: Category[]): void {
  if (!isLocalStorageAvailable()) return;
  const payload = {
    timestamp: Date.now(),
    data,
  } satisfies { timestamp: number; data: Category[] };
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.error('[categories:cache] Failed to persist cache', error);
  }
}

export function getCachedCategories(key: string): Category[] | null {
  if (!isLocalStorageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const payload = JSON.parse(raw) as { timestamp?: number; data?: Category[] };
    if (!payload || typeof payload.timestamp !== 'number' || !Array.isArray(payload.data)) {
      window.localStorage.removeItem(key);
      return null;
    }
    const isExpired = Date.now() - payload.timestamp > CATEGORY_CACHE_TTL;
    if (isExpired) {
      window.localStorage.removeItem(key);
      return null;
    }
    return payload.data;
  } catch (error) {
    console.error('[categories:cache] Failed to read cache', error);
    return null;
  }
}

export function getCategoriesCacheKey(types?: ('income' | 'expense')[]): string {
  const normalized = normalizeTypes(types);
  return getCacheKey(normalized);
}
