import type { AuthChangeEvent } from '@supabase/supabase-js';
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
const SESSION_READY_EVENTS: ReadonlySet<AuthChangeEvent> = new Set([
  'SIGNED_IN',
  'TOKEN_REFRESHED',
  'INITIAL_SESSION',
]);

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

async function waitForAuthenticatedUser(): Promise<string> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('[categories:getCurrentUserId] Failed to get session', error);
      throw error;
    }

    const user = data?.session?.user;
    if (user?.id) {
      return user.id;
    }

    return await new Promise<string>((resolve, reject) => {
      let settled = false;
      const { data: subscription, error: subscriptionError } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (session?.user?.id && SESSION_READY_EVENTS.has(event)) {
            settled = true;
            cleanup();
            resolve(session.user.id);
          }
        },
      );

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        subscription?.subscription.unsubscribe();
      };

      timeoutId = setTimeout(() => {
        if (!settled) {
          cleanup();
          reject(new Error('Session belum siap. Silakan login kembali.'));
        }
      }, 15000);

      if (subscriptionError) {
        cleanup();
        reject(subscriptionError);
      }
    });
  } catch (error) {
    console.error('[categories:getCurrentUserId] Unexpected error', error);
    throw error;
  }
}

export async function getCurrentUserId(): Promise<string> {
  return waitForAuthenticatedUser();
}

type FetchCategoriesOptions = {
  types?: ('income' | 'expense')[];
  order?: boolean;
  withOrdering?: boolean;
};

function resolveTypes(options?: FetchCategoriesOptions): ('income' | 'expense')[] {
  if (options?.types && options.types.length) {
    return options.types;
  }
  return ['expense', 'income'];
}

function resolveOrdering(options?: FetchCategoriesOptions): boolean {
  if (typeof options?.order === 'boolean') {
    return options.order;
  }
  if (typeof options?.withOrdering === 'boolean') {
    return options.withOrdering;
  }
  return true;
}

export async function fetchCategoriesRaw(options?: FetchCategoriesOptions): Promise<Category[]> {
  const normalizedTypes = resolveTypes(options);
  const shouldOrder = resolveOrdering(options);

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
  if (!id) {
    return null;
  }

  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('categories')
      .select(CATEGORY_SELECT_COLUMNS)
      .eq('user_id', userId)
      .eq('id', id)
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

export async function fetchCategoriesByIds(ids: string[]): Promise<Category[]> {
  const uniqueIds = Array.from(new Set(ids.filter((value): value is string => Boolean(value))));
  if (!uniqueIds.length) {
    return [];
  }

  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('categories')
      .select(CATEGORY_SELECT_COLUMNS)
      .eq('user_id', userId)
      .in('id', uniqueIds);

    if (error) {
      console.error('[categories:byIds] Query failed', error);
      throw error;
    }

    return (data ?? []) as Category[];
  } catch (error) {
    console.error('[categories:byIds] Unexpected error', error);
    throw error;
  }
}

export async function fetchCategoriesSafe(options?: FetchCategoriesOptions): Promise<Category[]> {
  const normalizedTypes = resolveTypes(options);
  const shouldOrder = resolveOrdering(options);
  let primaryError: unknown = null;

  try {
    const rows = await fetchCategoriesRaw({ types: normalizedTypes, order: shouldOrder });
    if (rows.length) {
      return rows;
    }
  } catch (error) {
    primaryError = error;
    console.error('[categories:safe] Primary fetch failed', error);
  }

  try {
    const userId = await getCurrentUserId();
    let fallbackQuery = supabase
      .from('categories')
      .select(CATEGORY_SELECT_COLUMNS)
      .eq('user_id', userId)
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

    console.warn('[categories:safe] Empty result after fallback', {
      types: normalizedTypes,
      primaryError: primaryError instanceof Error ? primaryError.message : primaryError,
    });
    return result;
  } catch (error) {
    console.error('[categories:safe] Fallback failed', {
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
    console.error('[categories:cache] Failed to cache data', error);
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
  const normalized = types?.length ? types : ['expense', 'income'];
  return getCacheKey(normalized);
}
