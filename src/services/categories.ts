import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
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

type CategoryType = Category['type'];

type FetchCategoriesOptions = {
  types?: CategoryType[];
  order?: boolean;
};

const CATEGORY_SELECT_COLUMNS =
  'id,user_id,type,name,group_name,order_index,inserted_at';
const CATEGORY_CACHE_PREFIX = 'hw:categories:';
const CATEGORY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const SESSION_READY_EVENTS: ReadonlySet<AuthChangeEvent> = new Set([
  'SIGNED_IN',
  'INITIAL_SESSION',
  'TOKEN_REFRESHED',
]);
const SESSION_WAIT_TIMEOUT = 10_000;

function normalizeTypes(types?: CategoryType[]): CategoryType[] {
  if (!types || types.length === 0) {
    return ['expense', 'income'];
  }
  const normalized: CategoryType[] = [];
  types.forEach((value) => {
    if ((value === 'expense' || value === 'income') && !normalized.includes(value)) {
      normalized.push(value);
    }
  });
  return normalized.length ? normalized : ['expense', 'income'];
}

async function waitForSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('[categories:raw] Failed to get session', error);
      throw error;
    }
    if (data?.session?.user) {
      return data.session;
    }
  } catch (error) {
    console.error('[categories:raw] Unexpected error while getting session', error);
    throw error;
  }

  return new Promise<Session | null>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const { data, error } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && SESSION_READY_EVENTS.has(event)) {
        data.subscription.unsubscribe();
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve(session);
      }
    });

    if (error) {
      data?.subscription.unsubscribe();
      reject(error);
      return;
    }

    timeoutId = setTimeout(() => {
      data.subscription.unsubscribe();
      resolve(null);
    }, SESSION_WAIT_TIMEOUT);
  });
}

export async function getCurrentUserId(): Promise<string> {
  try {
    const session = await waitForSession();
    if (session?.user?.id) {
      return session.user.id;
    }

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('[categories:raw] Failed to resolve user', error);
      throw error;
    }
    const userId = data?.user?.id;
    if (!userId) {
      throw new Error('Session berakhir, silakan login lagi.');
    }
    return userId;
  } catch (error) {
    console.error('[categories:raw] Unable to resolve current user', error);
    throw error;
  }
}

export async function fetchCategoriesRaw(
  options: FetchCategoriesOptions = {},
): Promise<Category[]> {
  const normalizedTypes = normalizeTypes(options.types);
  const shouldOrder = options.order ?? true;
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

    return (data as Category | null) ?? null;
  } catch (error) {
    console.error('[categories:byId] Unexpected error', error);
    throw error;
  }
}

export async function fetchCategoriesSafe(
  options: FetchCategoriesOptions = {},
): Promise<Category[]> {
  const normalizedTypes = normalizeTypes(options.types);
  const shouldOrder = options.order ?? true;
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
    let query = supabase.from('categories').select(CATEGORY_SELECT_COLUMNS).in('type', normalizedTypes);

    if (shouldOrder) {
      query = query
        .order('order_index', { ascending: true, nullsFirst: true })
        .order('name', { ascending: true });
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const result = (data ?? []) as Category[];
    if (!result.length) {
      console.warn('[categories:raw] Empty result after fallback', {
        types: normalizedTypes,
        primaryError: primaryError instanceof Error ? primaryError.message : primaryError,
      });
    }
    return result;
  } catch (error) {
    console.error('[categories:raw] Fallback failed', {
      error,
      types: normalizedTypes,
      primaryError: primaryError instanceof Error ? primaryError.message : primaryError,
    });
    return [];
  }
}

function getCacheKey(types: readonly CategoryType[]): string {
  if (!types.length) {
    return `${CATEGORY_CACHE_PREFIX}expense+income`;
  }
  return `${CATEGORY_CACHE_PREFIX}${types.join('+')}`;
}

function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch (error) {
    console.error('[categories:raw] Failed to access localStorage', error);
    return false;
  }
}

export function cacheCategories(key: string, data: Category[]): void {
  if (!isLocalStorageAvailable()) return;
  const payload = { timestamp: Date.now(), data } satisfies { timestamp: number; data: Category[] };
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.error('[categories:raw] Failed to cache data', error);
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
    return payload.data ?? null;
  } catch (error) {
    console.error('[categories:raw] Failed to read cache', error);
    return null;
  }
}

export function getCategoriesCacheKey(types?: ('income' | 'expense')[]): string {
  const normalized = normalizeTypes(types);
  return getCacheKey(normalized);
}
