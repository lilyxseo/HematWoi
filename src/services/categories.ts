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

type CategoryType = 'income' | 'expense';

type FetchCategoriesOptions = {
  types?: CategoryType[];
  order?: boolean;
};

function normalizeTypes(types?: CategoryType[]): CategoryType[] {
  if (!types || types.length === 0) {
    return ['expense', 'income'];
  }
  const deduped: CategoryType[] = [];
  types.forEach((item) => {
    if ((item === 'income' || item === 'expense') && !deduped.includes(item)) {
      deduped.push(item);
    }
  });
  return deduped.length ? deduped : ['expense', 'income'];
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
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('[categories:getCurrentUserId] Failed to get session', sessionError);
      throw sessionError;
    }
    const sessionUserId = sessionData?.session?.user?.id;
    if (sessionUserId) {
      return sessionUserId;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('[categories:getCurrentUserId] Failed to get user', userError);
      throw userError;
    }
    const userId = userData?.user?.id;
    if (userId) {
      return userId;
    }

    throw new Error('Session belum siap. Silakan login kembali.');
  } catch (error) {
    console.error('[categories:getCurrentUserId] Unexpected error', error);
    throw error;
  }
}

export async function fetchCategoriesRaw(options?: FetchCategoriesOptions): Promise<Category[]> {
  const normalizedTypes = normalizeTypes(options?.types);
  const shouldOrder = options?.order ?? true;

  try {
    const userId = await getCurrentUserId();
    let query = supabase
      .from('categories')
      .select(CATEGORY_SELECT_COLUMNS)
      .eq('user_id', userId);

    if (normalizedTypes.length) {
      query = query.in('type', normalizedTypes);
    }

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

export async function fetchCategoryById(id: string | null | undefined): Promise<Category | null> {
  if (!id) {
    return null;
  }
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('categories')
      .select(CATEGORY_SELECT_COLUMNS)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[categories:byId] Query failed', error);
      throw error;
    }

    return (data as Category | null) ?? null;
  } catch (error) {
    console.error('[categories:byId] Unexpected error', error);
    throw error;
  }
}

export async function fetchCategoriesByIds(ids: string[]): Promise<Category[]> {
  if (!ids.length) {
    return [];
  }
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('categories')
      .select(CATEGORY_SELECT_COLUMNS)
      .eq('user_id', userId)
      .in('id', ids);

    if (error) {
      console.error('[categories:raw] Failed to fetch by ids', error);
      throw error;
    }

    return (data ?? []) as Category[];
  } catch (error) {
    console.error('[categories:raw] Unexpected error while fetching by ids', error);
    throw error;
  }
}

export async function fetchCategoriesSafe(options?: FetchCategoriesOptions): Promise<Category[]> {
  try {
    const rows = await fetchCategoriesRaw(options);
    if (rows.length) {
      return rows;
    }
  } catch (error) {
    console.error('[categories:raw] Primary fetch failed', error);
  }

  try {
    const normalizedTypes = normalizeTypes(options?.types);
    const shouldOrder = options?.order ?? true;
    const userId = await getCurrentUserId();
    let fallbackQuery = supabase
      .from('categories')
      .select(CATEGORY_SELECT_COLUMNS)
      .eq('user_id', userId);

    if (normalizedTypes.length) {
      fallbackQuery = fallbackQuery.in('type', normalizedTypes);
    }

    if (shouldOrder) {
      fallbackQuery = fallbackQuery
        .order('order_index', { ascending: true, nullsFirst: true })
        .order('name', { ascending: true });
    }

    const { data, error } = await fallbackQuery;
    if (error) {
      console.error('[categories:raw] Fallback query failed', error);
      throw error;
    }

    return (data ?? []) as Category[];
  } catch (error) {
    console.error('[categories:raw] Fallback unexpected error', error);
    return [];
  }
}

function getCacheKey(types: readonly CategoryType[]): string {
  if (!types.length) {
    return `${CATEGORY_CACHE_PREFIX}expense+income`;
  }
  return `${CATEGORY_CACHE_PREFIX}${types.join('+')}`;
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
    console.error('[categories:storage] Failed to cache data', error);
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
    console.error('[categories:storage] Failed to read cache', error);
    return null;
  }
}

export function getCategoriesCacheKey(types?: ('income' | 'expense')[]): string {
  const normalized = normalizeTypes(types);
  return getCacheKey(normalized);
}
