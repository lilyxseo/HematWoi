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

const SESSION_READY_EVENTS = new Set([
  'SIGNED_IN',
  'INITIAL_SESSION',
  'TOKEN_REFRESHED',
]);

async function waitForSessionUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[categories:session] Failed to get session', error);
    throw error;
  }
  const user = data?.session?.user;
  if (user?.id) {
    return user;
  }

  return await new Promise((resolve, reject) => {
    const { data: subscriptionData, error: subscriptionError } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (SESSION_READY_EVENTS.has(event) && session?.user?.id) {
          cleanup();
          resolve(session.user);
        }
      },
    );

    const subscription = subscriptionData?.subscription ?? null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      subscription?.unsubscribe();
    };

    if (subscriptionError) {
      cleanup();
      reject(subscriptionError);
      return;
    }

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Session belum siap. Silakan login ulang.'));
    }, 10_000);
  });
}

export async function getCurrentUserId(): Promise<string> {
  try {
    const user = await waitForSessionUser();
    if (!user?.id) {
      throw new Error('Session tidak ditemukan.');
    }
    return user.id;
  } catch (error) {
    console.error('[categories:getCurrentUserId] Failed to resolve user', error);
    throw error;
  }
}

export async function fetchCategoriesRaw(options: FetchCategoriesOptions = {}): Promise<Category[]> {
  const types = options.types?.length ? options.types : ['expense', 'income'];
  const shouldOrder = options.order ?? true;

  try {
    const userId = await getCurrentUserId();
    let query = supabase
      .from('categories')
      .select(CATEGORY_SELECT_COLUMNS)
      .eq('user_id', userId)
      .in('type', types);

    if (shouldOrder) {
      query = query
        .order('order_index', { ascending: true, nullsFirst: true })
        .order('name', { ascending: true });
    }

    const { data, error } = await query;
    if (error) {
      console.error('[categories:raw] Failed to fetch categories', error);
      throw error;
    }

    return (data ?? []) as Category[];
  } catch (error) {
    console.error('[categories:raw] Unexpected failure', error);
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
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[categories:byId] Failed to fetch category', { error, id });
      throw error;
    }

    return (data ?? null) as Category | null;
  } catch (error) {
    console.error('[categories:byId] Unexpected failure', { error, id });
    throw error;
  }
}

export async function fetchCategoriesSafe(options: FetchCategoriesOptions = {}): Promise<Category[]> {
  try {
    const rows = await fetchCategoriesRaw(options);
    if (rows.length) {
      return rows;
    }
  } catch (primaryError) {
    console.error('[categories:raw] Primary fetch failed', primaryError);
  }

  try {
    const types = options.types?.length ? options.types : ['expense', 'income'];
    const shouldOrder = options.order ?? true;
    let fallbackQuery = supabase.from('categories').select(CATEGORY_SELECT_COLUMNS).in('type', types);
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
  } catch (fallbackError) {
    console.error('[categories:raw] Fallback fetch failed', fallbackError);
    return [];
  }
}

const CATEGORY_CACHE_PREFIX = 'hw:categories:';
const CATEGORY_CACHE_TTL = 10 * 60 * 1000;

function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch (error) {
    console.error('[categories:cache] localStorage unavailable', error);
    return false;
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
  try {
    const payload = JSON.stringify({ timestamp: Date.now(), data });
    window.localStorage.setItem(key, payload);
  } catch (error) {
    console.error('[categories:cache] Failed to cache categories', error);
  }
}

export function getCachedCategories(key: string): Category[] | null {
  if (!isLocalStorageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const payload = JSON.parse(raw) as { timestamp?: number; data?: Category[] };
    if (!payload?.timestamp || !Array.isArray(payload.data)) {
      window.localStorage.removeItem(key);
      return null;
    }
    if (Date.now() - payload.timestamp > CATEGORY_CACHE_TTL) {
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
  const normalized: CategoryType[] = types?.length ? types : ['expense', 'income'];
  return getCacheKey(normalized);
}

