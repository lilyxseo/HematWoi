import type { Session } from '@supabase/supabase-js';
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

const SESSION_READY_EVENTS = new Set([
  'SIGNED_IN',
  'INITIAL_SESSION',
  'TOKEN_REFRESHED',
]);

async function waitForSession(): Promise<Session> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('[categories:raw] Failed to get session', sessionError);
    throw sessionError;
  }

  if (sessionData?.session?.user) {
    return sessionData.session;
  }

  return new Promise<Session>((resolve, reject) => {
    const { data, error } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && SESSION_READY_EVENTS.has(event)) {
        data?.subscription.unsubscribe();
        resolve(session);
        return;
      }

      if (event === 'SIGNED_OUT') {
        data?.subscription.unsubscribe();
        reject(new Error('Session berakhir, silakan login lagi.'));
      }
    });

    if (error) {
      data?.subscription.unsubscribe();
      reject(error);
    }
  });
}

export async function getCurrentUserId(): Promise<string> {
  try {
    const session = await waitForSession();
    const userId = session.user?.id;

    if (!userId) {
      throw new Error('Session berakhir, silakan login lagi.');
    }

    return userId;
  } catch (error) {
    console.error('[categories:raw] Failed to resolve user id', error);
    throw error;
  }
}

type FetchCategoriesOptions = {
  types?: ('income' | 'expense')[];
  order?: boolean;
};

export async function fetchCategoriesRaw(options: FetchCategoriesOptions = {}): Promise<Category[]> {
  const normalizedTypes =
    options.types && options.types.length > 0 ? options.types : ['expense', 'income'];
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
      console.error('[categories:raw] Query failed', {
        error,
        types: normalizedTypes,
      });
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
      console.error('[categories:byId] Failed to fetch category', { error, id });
      throw error;
    }

    return (data as Category | null) ?? null;
  } catch (error) {
    console.error('[categories:byId] Unexpected error', { error, id });
    throw error;
  }
}

export async function fetchCategoriesSafe(options: FetchCategoriesOptions = {}): Promise<Category[]> {
  try {
    const primary = await fetchCategoriesRaw(options);
    if (primary.length) {
      return primary;
    }
  } catch (error) {
    console.error('[categories:raw] Primary fetch failed', error);
  }

  const normalizedTypes =
    options.types && options.types.length > 0 ? options.types : ['expense', 'income'];
  const shouldOrder = options.order ?? true;

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

    return (data ?? []) as Category[];
  } catch (error) {
    console.error('[categories:raw] Fallback fetch failed', error);
    return [];
  }
}

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
    console.error('[categories:raw] Failed to access localStorage', error);
    return false;
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

    return payload.data;
  } catch (error) {
    console.error('[categories:raw] Failed to read cache', error);
    return null;
  }
}

export function getCategoriesCacheKey(types?: ('income' | 'expense')[]): string {
  const normalized = types?.length ? types : ['expense', 'income'];
  return getCacheKey(normalized);
}
