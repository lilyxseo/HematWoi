import { supabase } from '../lib/supabase';
import { getCurrentUserId } from './categories';

export type Account = {
  id: string;
  name: string;
};

export async function fetchAccounts(): Promise<Account[]> {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('accounts')
      .select('id,name')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true, nullsFirst: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('[transactions:list] Failed to load accounts', error);
      throw error;
    }

    return (data ?? []).map((row) => ({
      id: row.id as string,
      name: typeof row.name === 'string' && row.name.trim() ? row.name : 'Tanpa nama',
    }));
  } catch (error) {
    console.error('[transactions:list] Unexpected error when loading accounts', error);
    return [];
  }
}
