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

async function waitForSession(): Promise<Session> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[categories:user] Failed to get session', error);
    throw error;
  }

  if (data?.session?.user) {
    return data.session;
  }

  return new Promise<Session>((resolve, reject) => {
    const timer = setTimeout(() => {
      subscription?.unsubscribe();
      reject(new Error('Session belum siap. Silakan login kembali.'));
    }, 10_000);

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        clearTimeout(timer);
        subscription?.unsubscribe();
        resolve(session);
      }
    });

    const subscription = listener?.subscription;
  });
}

export async function getCurrentUserId(): Promise<string> {
  try {
    const session = await waitForSession();
    const userId = session.user?.id;
    if (!userId) {
      throw new Error('Session tidak ditemukan. Silakan login kembali.');
    }
    return userId;
  } catch (error) {
    console.error('[categories:user] Failed to resolve current user', error);
    throw error;
  }
}

export async function fetchCategoriesRaw(options?: {
  types?: ('income' | 'expense')[];
  order?: boolean;
}): Promise<Category[]> {
  const normalizedTypes = options?.types?.length ? options.types : ['expense', 'income'];
  const shouldOrder = options?.order ?? true;

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

    return (data as Category) ?? null;
  } catch (error) {
    console.error('[categories:byId] Unexpected error', error);
    throw error;
  }
}

export async function fetchCategoriesSafe(options?: {
  types?: ('income' | 'expense')[];
  order?: boolean;
}): Promise<Category[]> {
  const normalizedTypes = options?.types?.length ? options.types : ['expense', 'income'];
  const shouldOrder = options?.order ?? true;
  let primaryError: unknown = null;

  try {
    const rows = await fetchCategoriesRaw({ types: normalizedTypes, order: shouldOrder });
    if (rows.length) {
      return rows;
    }
  } catch (error) {
    primaryError = error;
    console.error('[categories:raw] Primary fetch failed', error);
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
