import { supabase } from './supabase';
import { getCurrentUserId } from './session';
import type { SubscriptionStatus, SubscriptionIntervalUnit, ChargeStatus } from './api-subscriptions';

export type AccountType = 'cash' | 'bank' | 'ewallet' | 'other';

export interface AccountRecord {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface AccountInput {
  name: string;
  type: AccountType;
  currency?: string;
}

export type AccountPatch = Partial<Pick<AccountInput, 'name' | 'type' | 'currency'>>;

type Nullable<T> = T | null | undefined;

function sanitizeIlike(value = ''): string {
  return String(value).replace(/[%_]/g, (match) => `\\${match}`);
}

function ensureAuth(userId: string | null | undefined): asserts userId is string {
  if (!userId) {
    throw new Error('Anda harus login untuk mengelola akun.');
  }
}

function toUserMessage(prefix: string, error: unknown): string {
  if (error instanceof Error && error.message) {
    return `${prefix}: ${error.message}`;
  }
  if (typeof error === 'string' && error.trim()) {
    return `${prefix}: ${error}`;
  }
  return `${prefix}. Silakan coba lagi.`;
}

function normalizeCurrency(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return 'IDR';
  return trimmed.toUpperCase();
}

function normalizeAccount(row: Record<string, any>, userFallback: string): AccountRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id ?? userFallback),
    name: (row.name ?? '').toString(),
    type: (row.type as AccountType) ?? 'other',
    currency: normalizeCurrency(row.currency),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export async function listAccounts(userId?: string): Promise<AccountRecord[]> {
  const authUserId = userId ?? (await getCurrentUserId());
  ensureAuth(authUserId);
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('id, user_id, name, type, currency, created_at, updated_at')
      .eq('user_id', authUserId)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data ?? []).map((row) => normalizeAccount(row, authUserId));
  } catch (error) {
    throw new Error(toUserMessage('Gagal memuat akun', error));
  }
}

export async function createAccount(payload: AccountInput, userId?: string): Promise<AccountRecord> {
  const authUserId = userId ?? (await getCurrentUserId());
  ensureAuth(authUserId);

  const name = payload.name?.trim();
  if (!name) {
    throw new Error('Nama akun wajib diisi.');
  }

  const insertData = {
    name,
    type: payload.type ?? 'other',
    currency: normalizeCurrency(payload.currency),
    user_id: authUserId,
  };

  try {
    const { data, error } = await supabase
      .from('accounts')
      .insert(insertData)
      .select('id, user_id, name, type, currency, created_at, updated_at')
      .single();

    if (error) throw error;
    if (!data) {
      throw new Error('Respon server tidak valid.');
    }

    return normalizeAccount(data, authUserId);
  } catch (error) {
    throw new Error(toUserMessage('Gagal menambah akun', error));
  }
}

export async function updateAccount(
  id: string,
  patch: AccountPatch,
  userId?: string
): Promise<AccountRecord> {
  const authUserId = userId ?? (await getCurrentUserId());
  ensureAuth(authUserId);

  if (!id) {
    throw new Error('ID akun tidak valid.');
  }

  const updates: Record<string, any> = {};

  if (patch.name !== undefined) {
    const trimmed = patch.name?.trim();
    if (!trimmed) {
      throw new Error('Nama akun wajib diisi.');
    }
    updates.name = trimmed;
  }

  if (patch.type !== undefined) {
    updates.type = patch.type;
  }

  if (patch.currency !== undefined) {
    updates.currency = normalizeCurrency(patch.currency);
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('Tidak ada perubahan untuk disimpan.');
  }

  try {
    const { data, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', authUserId)
      .select('id, user_id, name, type, currency, created_at, updated_at')
      .single();

    if (error) throw error;
    if (!data) {
      throw new Error('Respon server tidak valid.');
    }

    return normalizeAccount(data, authUserId);
  } catch (error) {
    throw new Error(toUserMessage('Gagal memperbarui akun', error));
  }
}

export async function deleteAccount(id: string, userId?: string): Promise<void> {
  const authUserId = userId ?? (await getCurrentUserId());
  ensureAuth(authUserId);

  if (!id) {
    throw new Error('ID akun tidak valid.');
  }

  try {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id)
      .eq('user_id', authUserId);

    if (error) throw error;
  } catch (error) {
    throw new Error(toUserMessage('Gagal menghapus akun', error));
  }
}

export interface SubscriptionListParams {
  q?: string;
  status?: SubscriptionStatus | 'all';
  categoryId?: Nullable<string>;
  accountId?: Nullable<string>;
  unit?: SubscriptionIntervalUnit | 'all';
  dueFrom?: Nullable<string>;
  dueTo?: Nullable<string>;
  createdFrom?: Nullable<string>;
  createdTo?: Nullable<string>;
  sort?:
    | 'name-asc'
    | 'name-desc'
    | 'amount-desc'
    | 'amount-asc'
    | 'created-desc'
    | 'created-asc'
    | 'due-asc'
    | 'due-desc';
  limit?: number;
}

export interface UpcomingChargesParams {
  dueFrom?: Nullable<string>;
  dueTo?: Nullable<string>;
  status?: ChargeStatus | 'due';
  subscriptionId?: Nullable<string>;
  includePaid?: boolean;
  limit?: number;
}

const subscriptionSelectColumns = `
  id,
  user_id,
  name,
  vendor,
  category_id,
  account_id,
  amount,
  currency,
  interval_unit,
  interval_count,
  anchor_date,
  anchor_day_of_week,
  start_date,
  end_date,
  trial_end,
  status,
  reminder_days,
  tags,
  color,
  icon,
  notes,
  created_at,
  updated_at,
  next_due_date,
  last_charge_at,
  total_charges,
  category:category_id (id, name, color),
  account:account_id (id, name, type)
`;

const subscriptionChargeSelectColumns = `
  id,
  user_id,
  subscription_id,
  due_date,
  amount,
  currency,
  status,
  paid_at,
  transaction_id,
  notes,
  created_at,
  updated_at,
  subscription:subscription_id (
    id,
    name,
    vendor,
    category_id,
    account_id,
    amount,
    currency,
    interval_unit,
    interval_count,
    status,
    color,
    icon
  )
`;

export async function listSubscriptions(
  uid: string,
  params: SubscriptionListParams = {},
) {
  let query = supabase
    .from('subscriptions')
    .select(subscriptionSelectColumns)
    .eq('user_id', uid);

  if (params.q?.trim()) {
    const sanitized = sanitizeIlike(params.q.trim());
    const term = `%${sanitized}%`;
    query = query.or(`name.ilike.${term},vendor.ilike.${term}`);
  }

  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status);
  }

  if (params.categoryId && params.categoryId !== 'all') {
    query = query.eq('category_id', params.categoryId);
  }

  if (params.accountId && params.accountId !== 'all') {
    query = query.eq('account_id', params.accountId);
  }

  if (params.unit && params.unit !== 'all') {
    query = query.eq('interval_unit', params.unit);
  }

  if (params.dueFrom) {
    query = query.gte('next_due_date', params.dueFrom);
  }

  if (params.dueTo) {
    query = query.lte('next_due_date', params.dueTo);
  }

  if (params.createdFrom) {
    query = query.gte('created_at', params.createdFrom);
  }

  if (params.createdTo) {
    query = query.lte('created_at', params.createdTo);
  }

  switch (params.sort) {
    case 'name-desc':
      query = query.order('name', { ascending: false });
      break;
    case 'amount-desc':
      query = query.order('amount', { ascending: false });
      break;
    case 'amount-asc':
      query = query.order('amount', { ascending: true });
      break;
    case 'created-asc':
      query = query.order('created_at', { ascending: true });
      break;
    case 'created-desc':
      query = query.order('created_at', { ascending: false });
      break;
    case 'due-desc':
      query = query.order('next_due_date', { ascending: false, nullsLast: true });
      break;
    case 'name-asc':
      query = query.order('name', { ascending: true });
      break;
    case 'due-asc':
    default:
      query = query.order('next_due_date', { ascending: true, nullsFirst: true });
      break;
  }

  query = query.order('created_at', { ascending: true });

  if (params.limit && params.limit > 0) {
    query = query.limit(params.limit);
  }

  return query;
}

export async function listUpcomingCharges(
  uid: string,
  params: UpcomingChargesParams = {},
) {
  const today = new Date();
  const defaultFrom = params.dueFrom ?? today.toISOString().slice(0, 10);
  const defaultTo = (() => {
    if (params.dueTo) return params.dueTo;
    const limitDate = new Date(today);
    limitDate.setDate(limitDate.getDate() + 90);
    return limitDate.toISOString().slice(0, 10);
  })();

  let query = supabase
    .from('subscription_charges')
    .select(subscriptionChargeSelectColumns)
    .eq('user_id', uid)
    .gte('due_date', defaultFrom)
    .lte('due_date', defaultTo)
    .order('due_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (params.subscriptionId) {
    query = query.eq('subscription_id', params.subscriptionId);
  }

  if (params.status && params.status !== 'due') {
    query = query.eq('status', params.status);
  } else if (!params.includePaid) {
    query = query.in('status', ['due', 'overdue']);
  }

  if (params.limit && params.limit > 0) {
    query = query.limit(params.limit);
  }

  return query;
}

export async function createSubscription(
  uid: string,
  payload: {
    name: string;
    amount: number;
    interval_unit: SubscriptionIntervalUnit;
    next_due_date?: string | null;
    status?: SubscriptionStatus;
  } & Record<string, any>,
) {
  return supabase
    .from('subscriptions')
    .insert([{ user_id: uid, ...payload }])
    .select(subscriptionSelectColumns)
    .single();
}

export async function updateSubscription(
  id: string,
  patch: Record<string, any>,
  uid?: string,
) {
  let query = supabase.from('subscriptions').update(patch).eq('id', id);
  if (uid) {
    query = query.eq('user_id', uid);
  }
  return query.select(subscriptionSelectColumns).single();
}

export async function deleteSubscription(id: string, uid?: string) {
  let query = supabase.from('subscriptions').delete().eq('id', id);
  if (uid) {
    query = query.eq('user_id', uid);
  }
  return query;
}
