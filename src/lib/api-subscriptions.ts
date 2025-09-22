import { supabase } from './supabase';
import { getCurrentUserId } from './session';

export type UUID = string;

export type SubscriptionStatus = 'active' | 'paused' | 'canceled';
export type SubscriptionIntervalUnit = 'day' | 'week' | 'month' | 'year';
export type ChargeStatus = 'due' | 'paid' | 'skipped' | 'canceled' | 'overdue';

export interface SubscriptionRecord {
  id: UUID;
  user_id: UUID;
  name: string;
  vendor: string | null;
  category_id: string | null;
  account_id: string | null;
  amount: number;
  currency: string;
  interval_unit: SubscriptionIntervalUnit;
  interval_count: number;
  anchor_date: string;
  anchor_day_of_week: number | null;
  start_date: string | null;
  end_date: string | null;
  trial_end: string | null;
  status: SubscriptionStatus;
  reminder_days: number[];
  tags: string[];
  color: string | null;
  icon: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  next_due_date: string | null;
  last_charge_at: string | null;
  total_charges: number;
  category?: { id: string; name: string | null; color?: string | null } | null;
  account?: { id: string; name: string | null; type?: string | null } | null;
}

export interface SubscriptionChargeRecord {
  id: UUID;
  user_id: UUID;
  subscription_id: UUID;
  due_date: string;
  amount: number;
  currency: string;
  status: ChargeStatus;
  paid_at: string | null;
  transaction_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  subscription?: Pick<
    SubscriptionRecord,
    | 'id'
    | 'name'
    | 'vendor'
    | 'category_id'
    | 'account_id'
    | 'amount'
    | 'currency'
    | 'interval_unit'
    | 'interval_count'
    | 'status'
    | 'color'
    | 'icon'
  >;
}

export interface ListSubscriptionsParams {
  q?: string;
  status?: SubscriptionStatus | 'all';
  categoryId?: string | null;
  accountId?: string | null;
  unit?: SubscriptionIntervalUnit | 'all';
  dueFrom?: string | null;
  dueTo?: string | null;
  createdFrom?: string | null;
  createdTo?: string | null;
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

export interface UpcomingListParams {
  dueFrom?: string | null;
  dueTo?: string | null;
  status?: ChargeStatus | 'due';
  subscriptionId?: string | null;
  limit?: number;
  includePaid?: boolean;
}

export interface CreateSubscriptionPayload {
  name: string;
  vendor?: string | null;
  category_id?: string | null;
  account_id?: string | null;
  amount: number | string;
  currency?: string;
  interval_unit: SubscriptionIntervalUnit;
  interval_count?: number | string;
  anchor_date: string;
  anchor_day_of_week?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  trial_end?: string | null;
  status?: SubscriptionStatus;
  reminder_days?: number[] | string[];
  tags?: string[];
  color?: string | null;
  icon?: string | null;
  notes?: string | null;
}

export interface UpdateSubscriptionPayload extends Partial<CreateSubscriptionPayload> {}

export interface MarkPaidOptions {
  paidAt?: string;
  createTransaction?: boolean;
  transactionNotes?: string | null;
}

export interface MarkPaidResult {
  charge: SubscriptionChargeRecord;
  transactionId: string | null;
  transactionError: Error | null;
}

export interface SubscriptionForecastRow {
  user_id: string;
  period_month: string;
  due_count: number;
  due_amount: number;
  paid_count: number;
  paid_amount: number;
  skipped_count: number;
  skipped_amount: number;
}

export async function getMonthlyForecast(period?: string): Promise<SubscriptionForecastRow | null> {
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);

    const targetPeriod = (() => {
      if (period) {
        if (period.length === 7) {
          return `${period}-01`;
        }
        return period;
      }
      const now = new Date();
      const iso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        .toISOString()
        .slice(0, 10);
      return iso;
    })();

    const { data, error } = await supabase
      .from('subscriptions_forecast_month')
      .select('*')
      .eq('user_id', userId)
      .eq('period_month', targetPeriod)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return {
      user_id: data.user_id as string,
      period_month: data.period_month as string,
      due_count: Number.parseInt(String(data.due_count ?? 0), 10) || 0,
      due_amount: parseNumber(data.due_amount, 0),
      paid_count: Number.parseInt(String(data.paid_count ?? 0), 10) || 0,
      paid_amount: parseNumber(data.paid_amount, 0),
      skipped_count: Number.parseInt(String(data.skipped_count ?? 0), 10) || 0,
      skipped_amount: parseNumber(data.skipped_amount, 0),
    };
  } catch (error) {
    logDev(error, 'getMonthlyForecast');
    if (error instanceof Error) {
      throw new Error(`Gagal memuat ringkasan langganan: ${error.message}`);
    }
    throw new Error('Gagal memuat ringkasan langganan. Cek koneksi atau ulangi.');
  }
}


function logDev(error: unknown, scope: string) {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.error(`[HW][subscriptions-api] ${scope}`, error);
  }
}

function ensureAuth(userId: string | null | undefined) {
  if (!userId) {
    throw new Error('Anda harus login untuk mengelola langganan');
  }
}

function parseNumber(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanPayload<T extends Record<string, unknown>>(source: T): T {
  const next: Record<string, unknown> = {};
  Object.entries(source).forEach(([key, value]) => {
    if (value === undefined) return;
    if (value === null) {
      next[key] = null;
      return;
    }
    if (Array.isArray(value)) {
      next[key] = value.filter((item) => item !== undefined && item !== null);
      return;
    }
    next[key] = value;
  });
  return next as T;
}

function normalizeSubscriptionRow(row: Record<string, any>): SubscriptionRecord {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    vendor: row.vendor ?? null,
    category_id: row.category_id ?? null,
    account_id: row.account_id ?? null,
    amount: parseNumber(row.amount),
    currency: row.currency ?? 'IDR',
    interval_unit: (row.interval_unit ?? 'month') as SubscriptionIntervalUnit,
    interval_count: Number.parseInt(String(row.interval_count ?? 1), 10) || 1,
    anchor_date: row.anchor_date,
    anchor_day_of_week: row.anchor_day_of_week ?? null,
    start_date: row.start_date ?? null,
    end_date: row.end_date ?? null,
    trial_end: row.trial_end ?? null,
    status: (row.status ?? 'active') as SubscriptionStatus,
    reminder_days: Array.isArray(row.reminder_days)
      ? row.reminder_days.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n))
      : [],
    tags: Array.isArray(row.tags) ? row.tags.map((t: any) => String(t)) : [],
    color: row.color ?? null,
    icon: row.icon ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    next_due_date: row.next_due_date ?? null,
    last_charge_at: row.last_charge_at ?? null,
    total_charges: Number.parseInt(row.total_charges, 10) || 0,
    category: row.category ?? null,
    account: row.account ?? null,
  };
}

function normalizeChargeRow(row: Record<string, any>): SubscriptionChargeRecord {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    subscription_id: row.subscription_id as string,
    due_date: row.due_date,
    amount: parseNumber(row.amount),
    currency: row.currency ?? 'IDR',
    status: (row.status ?? 'due') as ChargeStatus,
    paid_at: row.paid_at ?? null,
    transaction_id: row.transaction_id ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    subscription: row.subscription ?? undefined,
  };
}

export async function listSubscriptions(
  params: ListSubscriptionsParams = {},
): Promise<SubscriptionRecord[]> {
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);

    const columns = `
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

    let query = supabase
      .from('subscriptions')
      .select(columns)
      .eq('user_id', userId);

    if (params.q) {
      const term = `%${params.q.trim()}%`;
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

    if (params.limit && params.limit > 0) {
      query = query.limit(params.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return Array.isArray(data) ? data.map(normalizeSubscriptionRow) : [];
  } catch (error) {
    logDev(error, 'listSubscriptions');
    if (error instanceof Error) {
      throw new Error(`Gagal memuat langganan: ${error.message}`);
    }
    throw new Error('Gagal memuat langganan. Cek koneksi atau ulangi.');
  }
}

export async function getSubscription(id: string): Promise<SubscriptionRecord | null> {
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);

    const { data, error } = await supabase
      .from('subscriptions')
      .select(
        `
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
      `,
      )
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return normalizeSubscriptionRow(data);
  } catch (error) {
    logDev(error, 'getSubscription');
    if (error instanceof Error) {
      throw new Error(`Gagal memuat detail langganan: ${error.message}`);
    }
    throw new Error('Gagal memuat detail langganan. Cek koneksi atau ulangi.');
  }
}

export async function createSubscription(
  payload: CreateSubscriptionPayload,
): Promise<SubscriptionRecord> {
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);

    const amount = parseNumber(payload.amount, 0);
    if (amount <= 0) {
      throw new Error('Nominal langganan harus lebih besar dari 0');
    }

    const body = cleanPayload({
      user_id: userId,
      name: payload.name.trim(),
      vendor: payload.vendor?.trim() ?? null,
      category_id: payload.category_id ?? null,
      account_id: payload.account_id ?? null,
      amount,
      currency: payload.currency ?? 'IDR',
      interval_unit: payload.interval_unit,
      interval_count: Math.max(1, Number.parseInt(String(payload.interval_count ?? 1), 10) || 1),
      anchor_date: payload.anchor_date,
      anchor_day_of_week:
        payload.interval_unit === 'week' ? payload.anchor_day_of_week ?? null : null,
      start_date: payload.start_date ?? payload.anchor_date,
      end_date: payload.end_date ?? null,
      trial_end: payload.trial_end ?? null,
      status: payload.status ?? 'active',
      reminder_days: Array.isArray(payload.reminder_days)
        ? payload.reminder_days.map((n) => Number(n)).filter((n) => Number.isFinite(n))
        : [],
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      color: payload.color ?? null,
      icon: payload.icon ?? null,
      notes: payload.notes ?? null,
    });

    const { data, error } = await supabase
      .from('subscriptions')
      .insert(body)
      .select(
        `
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
      `,
      )
      .single();

    if (error) throw error;
    return normalizeSubscriptionRow(data);
  } catch (error) {
    logDev(error, 'createSubscription');
    if (error instanceof Error) {
      throw new Error(`Gagal menyimpan langganan: ${error.message}`);
    }
    throw new Error('Gagal menyimpan langganan. Cek koneksi atau ulangi.');
  }
}

export async function updateSubscription(
  id: string,
  patch: UpdateSubscriptionPayload,
): Promise<SubscriptionRecord> {
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);

    if (patch.amount !== undefined) {
      const amount = parseNumber(patch.amount, 0);
      if (amount <= 0) {
        throw new Error('Nominal langganan harus lebih besar dari 0');
      }
      patch.amount = amount;
    }

    const cleaned = cleanPayload({
      ...patch,
      name: patch.name?.trim(),
      vendor: patch.vendor?.trim() ?? null,
      interval_count:
        patch.interval_count !== undefined
          ? Math.max(1, Number.parseInt(String(patch.interval_count), 10) || 1)
          : undefined,
      anchor_day_of_week:
        patch.interval_unit === 'week'
          ? patch.anchor_day_of_week ?? null
          : patch.anchor_day_of_week === undefined
          ? undefined
          : null,
      reminder_days: Array.isArray(patch.reminder_days)
        ? patch.reminder_days.map((n) => Number(n)).filter((n) => Number.isFinite(n))
        : undefined,
      tags: Array.isArray(patch.tags) ? patch.tags : undefined,
    });

    const { data, error } = await supabase
      .from('subscriptions')
      .update(cleaned)
      .eq('user_id', userId)
      .eq('id', id)
      .select(
        `
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
      `,
      )
      .single();

    if (error) throw error;
    return normalizeSubscriptionRow(data);
  } catch (error) {
    logDev(error, 'updateSubscription');
    if (error instanceof Error) {
      throw new Error(`Gagal memperbarui langganan: ${error.message}`);
    }
    throw new Error('Gagal memperbarui langganan. Cek koneksi atau ulangi.');
  }
}

export async function deleteSubscription(id: string): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);

    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    logDev(error, 'deleteSubscription');
    if (error instanceof Error) {
      throw new Error(`Gagal menghapus langganan: ${error.message}`);
    }
    throw new Error('Gagal menghapus langganan. Cek koneksi atau ulangi.');
  }
}

export async function listUpcoming(
  params: UpcomingListParams = {},
): Promise<SubscriptionChargeRecord[]> {
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);

    const today = new Date();
    const defaultFrom = params.dueFrom ?? today.toISOString().slice(0, 10);
    const defaultTo = (() => {
      if (params.dueTo) return params.dueTo;
      const limitDate = new Date(today);
      limitDate.setDate(limitDate.getDate() + 90);
      return limitDate.toISOString().slice(0, 10);
    })();

    const columns = `
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

    let query = supabase
      .from('subscription_charges')
      .select(columns)
      .eq('user_id', userId)
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

    const { data, error } = await query;
    if (error) throw error;
    return Array.isArray(data) ? data.map(normalizeChargeRow) : [];
  } catch (error) {
    logDev(error, 'listUpcoming');
    if (error instanceof Error) {
      throw new Error(`Gagal memuat tagihan langganan: ${error.message}`);
    }
    throw new Error('Gagal memuat tagihan langganan. Cek koneksi atau ulangi.');
  }
}

export async function markPaid(
  chargeId: string,
  options: MarkPaidOptions = {},
): Promise<MarkPaidResult> {
  let transactionError: Error | null = null;
  let transactionId: string | null = null;

  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);

    const { data: existing, error: fetchError } = await supabase
      .from('subscription_charges')
      .select(
        `
        id,
        user_id,
        subscription_id,
        due_date,
        amount,
        currency,
        status,
        paid_at,
        transaction_id,
        subscription:subscription_id (
          id,
          name,
          account_id,
          category_id,
          amount,
          currency
        )
      `,
      )
      .eq('user_id', userId)
      .eq('id', chargeId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      throw new Error('Tagihan langganan tidak ditemukan');
    }

    const paidAt = options.paidAt ?? new Date().toISOString();

    if (options.createTransaction) {
      try {
        const description = existing.subscription?.name
          ? `Langganan ${existing.subscription.name}`
          : 'Pembayaran langganan';
        const txPayload: Record<string, unknown> = {
          user_id: userId,
          type: 'expense',
          amount: parseNumber(existing.amount, 0),
          date: paidAt.slice(0, 10),
          title: description,
          notes: options.transactionNotes ?? null,
          account_id: existing.subscription?.account_id ?? null,
          category_id: existing.subscription?.category_id ?? null,
        };
        const { data: tx, error: txError } = await supabase
          .from('transactions')
          .insert(cleanPayload(txPayload))
          .select('id')
          .single();
        if (txError) throw txError;
        transactionId = tx?.id ?? null;
      } catch (err) {
        logDev(err, 'markPaid:createTransaction');
        transactionError = err instanceof Error ? err : new Error('Gagal membuat transaksi');
      }
    }

    const updatePayload = cleanPayload({
      status: 'paid' as ChargeStatus,
      paid_at: paidAt,
      transaction_id: transactionId ?? existing.transaction_id ?? null,
    });

    const { data, error } = await supabase
      .from('subscription_charges')
      .update(updatePayload)
      .eq('user_id', userId)
      .eq('id', chargeId)
      .select(
        `
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
      `,
      )
      .single();

    if (error) throw error;

    const charge = normalizeChargeRow(data);
    return { charge, transactionId, transactionError };
  } catch (error) {
    if (!transactionError) {
      logDev(error, 'markPaid');
    }
    if (error instanceof Error) {
      throw new Error(`Gagal menandai sudah dibayar: ${error.message}`);
    }
    throw new Error('Gagal menandai sudah dibayar. Cek koneksi atau ulangi.');
  }
}

export async function skipOnce(subscriptionId: string, dueDate: string): Promise<SubscriptionChargeRecord> {
  try {
    const userId = await getCurrentUserId();
    ensureAuth(userId);

    const { data: existing, error: fetchError } = await supabase
      .from('subscription_charges')
      .select(
        `
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
        updated_at
      `,
      )
      .eq('user_id', userId)
      .eq('subscription_id', subscriptionId)
      .eq('due_date', dueDate)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existing) {
      const { data, error } = await supabase
        .from('subscription_charges')
        .update({ status: 'skipped', paid_at: null, transaction_id: null })
        .eq('user_id', userId)
        .eq('id', existing.id)
        .select(
          `
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
        `,
        )
        .single();
      if (error) throw error;
      return normalizeChargeRow(data);
    }

    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id, user_id, amount, currency, interval_unit, interval_count, name')
      .eq('user_id', userId)
      .eq('id', subscriptionId)
      .maybeSingle();

    if (subError) throw subError;
    if (!subscription) {
      throw new Error('Langganan tidak ditemukan');
    }

    const insertPayload = {
      user_id: userId,
      subscription_id: subscriptionId,
      due_date: dueDate,
      amount: parseNumber(subscription.amount, 0),
      currency: subscription.currency ?? 'IDR',
      status: 'skipped' as ChargeStatus,
      paid_at: null,
      transaction_id: null,
    };

    const { data, error } = await supabase
      .from('subscription_charges')
      .insert(insertPayload)
      .select(
        `
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
      `,
      )
      .single();

    if (error) throw error;
    return normalizeChargeRow(data);
  } catch (error) {
    logDev(error, 'skipOnce');
    if (error instanceof Error) {
      throw new Error(`Gagal melewati tagihan: ${error.message}`);
    }
    throw new Error('Gagal melewati tagihan. Cek koneksi atau ulangi.');
  }
}
