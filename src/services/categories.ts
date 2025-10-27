import type { PostgrestFilterBuilder, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type CategoryType = 'income' | 'expense';

export type Category = {
  id: string;
  user_id: string;
  type: CategoryType;
  name: string;
  group_name: string | null;
  order_index: number | null;
  inserted_at: string;
};

const CATEGORY_FIELDS = 'id,user_id,type,name,group_name,order_index,inserted_at';
const DEFAULT_TYPES: CategoryType[] = ['expense', 'income'];
const CACHE_PREFIX = 'hw:categories:';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const client = supabase as SupabaseClient<any, 'public', any>;

type FetchOptions = {
  types?: CategoryType[];
  withOrdering?: boolean;
};

type CachedEntry = {
  timestamp: number;
  data: Category[];
};

function normalizeTypes(types?: CategoryType[]): CategoryType[] {
  if (!types || types.length === 0) {
    return [...DEFAULT_TYPES];
  }
  const filtered = types.filter((item): item is CategoryType => item === 'income' || item === 'expense');
  if (filtered.length === 0) {
    return [...DEFAULT_TYPES];
  }
  return Array.from(new Set(filtered));
}

function buildQuery(
  types: CategoryType[],
  withOrdering: boolean,
): PostgrestFilterBuilder<Category, Category[], unknown> {
  let query = client.from<Category>('categories').select(CATEGORY_FIELDS);
  if (types.length > 0) {
    query = query.in('type', types);
  }
  if (withOrdering) {
    query = query.order('order_index', { ascending: true, nullsFirst: true }).order('name', { ascending: true });
  }
  return query;
}

export async function getCurrentUserId(): Promise<string> {
  try {
    const { data, error } = await client.auth.getUser();
    if (error) {
      console.error('[categories:getCurrentUserId] Failed to retrieve user from Supabase', error);
      throw error;
    }
    const userId = data?.user?.id;
    if (!userId) {
      console.error('[categories:getCurrentUserId] No authenticated user present');
      throw new Error('Session berakhir, silakan login lagi.');
    }
    return userId;
  } catch (err) {
    console.error('[categories:getCurrentUserId] Unexpected error', err);
    throw err;
  }
}

export async function fetchCategoriesRaw(options: FetchOptions = {}): Promise<Category[]> {
  const { types = DEFAULT_TYPES, withOrdering = true } = options;
  const resolvedTypes = normalizeTypes(types);

  try {
    const userId = await getCurrentUserId();
    const { data, error } = await buildQuery(resolvedTypes, withOrdering).eq('user_id', userId);
    if (error) {
      throw error;
    }
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[categories:fetchCategoriesRaw] Failed to fetch categories with user filter', err);
    throw err;
  }
}

export async function fetchCategoriesSafe(options: FetchOptions = {}): Promise<Category[]> {
  const { types = DEFAULT_TYPES, withOrdering = true } = options;
  const resolvedTypes = normalizeTypes(types);
  const context = `types=${resolvedTypes.join('+')}`;

  try {
    const direct = await fetchCategoriesRaw({ types: resolvedTypes, withOrdering });
    if (direct.length > 0) {
      return direct;
    }
    console.warn(`[categories:fetchCategoriesSafe] Primary fetch returned empty result (${context}), trying fallback.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[categories:fetchCategoriesSafe] Primary fetch failed (${context}): ${message}`);
  }

  try {
    const { data, error } = await buildQuery(resolvedTypes, withOrdering);
    if (error) {
      throw error;
    }
    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`[categories:fetchCategoriesSafe] Fallback fetch returned empty result (${context}).`);
      return [];
    }
    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[categories:fetchCategoriesSafe] Fallback fetch failed (${context}): ${message}`);
    return [];
  }
}

export function getCategoriesCacheKey(types?: CategoryType[]): string {
  const resolved = normalizeTypes(types)
    .slice()
    .sort()
    .join('+');
  return `${CACHE_PREFIX}${resolved}`;
}

export function cacheCategories(key: string, data: Category[]): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const payload: CachedEntry = {
      timestamp: Date.now(),
      data,
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    console.error('[categories:cacheCategories] Failed to store categories cache', err);
  }
}

export function getCachedCategories(key: string): Category[] | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored) as CachedEntry | null;
    if (!parsed) {
      return null;
    }
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      window.localStorage.removeItem(key);
      return null;
    }
    return Array.isArray(parsed.data) ? parsed.data : null;
  } catch (err) {
    console.error('[categories:getCachedCategories] Failed to read categories cache', err);
    return null;
  }
}
