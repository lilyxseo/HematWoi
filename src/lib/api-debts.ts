import { supabase } from './supabase';
import { getCurrentUserId } from './session';
import { upsert } from './sync/SyncEngine';

export type DebtType = 'debt' | 'receivable';
export type DebtStatus = 'ongoing' | 'paid' | 'overdue';

type SortKey = 'newest' | 'oldest' | 'due_soon' | 'amount';

type DateField = 'created_at' | 'due_date';

export interface DebtRecord {
  id: string;
  user_id: string;
  type: DebtType;
  party_name: string;
  title: string;
  date: string;
  due_date: string | null;
  amount: number;
  rate_percent: number | null;
  paid_total: number;
  remaining: number;
  status: DebtStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentAccountInfo {
  id: string;
  name: string;
  type: string | null;
}

export interface PaymentTransactionInfo {
  id: string;
  date: string;
  amount: number;
  title: string | null;
  deleted_at: string | null;
}

export interface DebtPaymentRecord {
  id: string;
  debt_id: string;
  user_id: string;
  amount: number;
  paid_at: string;
  note: string | null;
  account_id: string | null;
  related_tx_id: string | null;
  created_at: string;
  updated_at: string;
  account: PaymentAccountInfo | null;
  transaction: PaymentTransactionInfo | null;
  queued?: boolean;
}

export interface DebtSummary {
  totalDebt: number;
  totalReceivable: number;
  totalPaidThisMonth: number;
  dueSoon: number;
}

export interface DebtFilters {
  q?: string;
  type?: DebtType | 'all';
  status?: DebtStatus | 'all';
  dateField?: DateField;
  dateFrom?: string | null;
  dateTo?: string | null;
  sort?: SortKey;
}

export interface ListDebtsResponse {
  items: DebtRecord[];
  summary: DebtSummary;
}

export interface DebtInput {
  type: DebtType;
  party_name: string;
  title: string;
  date: string;
  due_date?: string | null;
  amount: number;
  rate_percent?: number | null;
  notes?: string | null;
}

export interface DebtUpdateInput extends Partial<DebtInput> {
  status?: DebtStatus;
}

export interface PaymentInput {
  id?: string;
  amount: number;
  paid_at: string;
  account_id: string;
  note?: string | null;
}

const DEBT_SELECT_COLUMNS =
  'id,user_id,type,party_name,title,date,due_date,amount,rate_percent,paid_total,status,notes,created_at,updated_at';

function logDevError(error: unknown) {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.error('[HW] debts-api', error);
  }
}

function handleError(error: unknown, fallback: string): never {
  logDevError(error);
  if (error instanceof Error && error.message) {
    throw new Error(error.message);
  }
  throw new Error(fallback);
}

function sanitizeIlike(value?: string | null) {
  if (!value) return '';
  return String(value).replace(/[%_]/g, (match) => `\\${match}`);
}

function safeNumber(value: unknown): number {
  if (value == null) return 0;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNum(value: unknown): number | undefined {
  if (value === '' || value == null) return undefined;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toISODate(value?: string | null): string | null {
  if (!value) return null;
  const isoSource = `${value}T00:00:00`;
  const date = new Date(isoSource);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toISODateEnd(value?: string | null): string | null {
  if (!value) return null;
  const isoSource = `${value}T23:59:59`;
  const date = new Date(isoSource);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function evaluateStatus(amount: number, paid: number, dueDate: string | null): DebtStatus {
  if (paid + 0.0001 >= amount) return 'paid';
  if (dueDate) {
    const due = new Date(dueDate);
    const now = new Date();
    if (!Number.isNaN(due.getTime()) && due.getTime() < now.getTime()) {
      return 'overdue';
    }
  }
  return 'ongoing';
}

function mapDebtRow(row: Record<string, any>): DebtRecord {
  const amount = safeNumber(row.amount);
  const paidTotal = safeNumber(row.paid_total);
  const rate = row.rate_percent != null ? safeNumber(row.rate_percent) : null;
  const remaining = Math.max(amount - paidTotal, 0);
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    type: row.type as DebtType,
    party_name: row.party_name ?? '',
    title: row.title ?? '',
    date: row.date ?? row.created_at ?? new Date().toISOString(),
    due_date: row.due_date ?? null,
    amount,
    rate_percent: rate,
    paid_total: paidTotal,
    remaining,
    status: row.status as DebtStatus,
    notes: row.notes ?? null,
    created_at: row.created_at ?? row.date ?? new Date().toISOString(),
    updated_at: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

function mapPaymentRow(row: Record<string, any>): DebtPaymentRecord {
  const account = row.account ?? row.accounts ?? null;
  const transaction = row.transaction ?? row.transactions ?? null;

  return {
    id: String(row.id),
    debt_id: String(row.debt_id),
    user_id: String(row.user_id),
    amount: safeNumber(row.amount),
    paid_at: row.paid_at ?? row.date ?? row.created_at ?? new Date().toISOString(),
    note: row.note ?? row.notes ?? null,
    account_id: row.account_id ? String(row.account_id) : null,
    related_tx_id: row.related_tx_id ? String(row.related_tx_id) : null,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? row.created_at ?? new Date().toISOString(),
    account: account
      ? {
          id: String(account.id),
          name: account.name ?? '',
          type: account.type ?? null,
        }
      : null,
    transaction: transaction
      ? {
          id: String(transaction.id),
          date: transaction.date ?? transaction.created_at ?? new Date().toISOString(),
          amount: safeNumber(transaction.amount),
          title: transaction.title ?? transaction.description ?? null,
          deleted_at: transaction.deleted_at ?? null,
        }
      : null,
  };
}

async function recalculateDebtAggregates(debtId: string, userId: string): Promise<DebtRecord | null> {
  const { data: debtRow, error: debtError } = await supabase
    .from('debts')
    .select(DEBT_SELECT_COLUMNS)
    .eq('id', debtId)
    .eq('user_id', userId)
    .maybeSingle();

  if (debtError) {
    throw debtError;
  }
  if (!debtRow) return null;

  const { data: paymentsRows, error: paymentsError } = await supabase
    .from('debt_payments')
    .select('amount')
    .eq('debt_id', debtId)
    .eq('user_id', userId);

  if (paymentsError) throw paymentsError;

  const paidTotal = (paymentsRows ?? []).reduce((sum, item) => sum + safeNumber(item.amount), 0);
  const status = evaluateStatus(safeNumber(debtRow.amount), paidTotal, debtRow.due_date ?? null);

  const { data: updated, error: updateError } = await supabase
    .from('debts')
    .update({
      paid_total: paidTotal.toFixed(2),
      status,
    })
    .eq('id', debtId)
    .eq('user_id', userId)
    .select(DEBT_SELECT_COLUMNS)
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }
  if (!updated) return mapDebtRow({ ...debtRow, paid_total: paidTotal, status });
  return mapDebtRow(updated);
}

async function buildSummary(userId: string): Promise<DebtSummary> {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [{ data: debtsRows, error: debtsError }, { data: paymentRows, error: paymentError }] = await Promise.all([
    supabase
      .from('debts')
      .select('type, amount, paid_total, due_date, status')
      .eq('user_id', userId),
    supabase
      .from('debt_payments')
      .select('amount, paid_at')
      .eq('user_id', userId)
      .gte('paid_at', startOfMonth.toISOString().slice(0, 10))
      .lt('paid_at', nextMonth.toISOString().slice(0, 10)),
  ]);

  if (debtsError) throw debtsError;
  if (paymentError) throw paymentError;

  const summary: DebtSummary = {
    totalDebt: 0,
    totalReceivable: 0,
    totalPaidThisMonth: 0,
    dueSoon: 0,
  };

  const soonThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  for (const row of debtsRows ?? []) {
    const amount = safeNumber(row.amount);
    const paidTotal = safeNumber(row.paid_total);
    if (row.type === 'debt') summary.totalDebt += Math.max(amount - paidTotal, 0);
    if (row.type === 'receivable') summary.totalReceivable += Math.max(amount - paidTotal, 0);

    if (row.status !== 'paid' && row.due_date) {
      const due = new Date(row.due_date);
      if (!Number.isNaN(due.getTime()) && due <= soonThreshold) {
        summary.dueSoon += Math.max(amount - paidTotal, 0);
      }
    }
  }

  for (const payment of paymentRows ?? []) {
    summary.totalPaidThisMonth += safeNumber(payment.amount);
  }

  return summary;
}

export async function getUserId() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('Pengguna tidak ditemukan. Silakan masuk kembali.');
    }
    return userId;
  } catch (error) {
    return handleError(error, 'Gagal mendapatkan informasi pengguna');
  }
}

export async function listDebts(filters: DebtFilters = {}): Promise<ListDebtsResponse> {
  try {
    const userId = await getUserId();
    const {
      q = '',
      type = 'all',
      status = 'all',
      dateField = 'created_at',
      dateFrom,
      dateTo,
      sort = 'newest',
    } = filters;

    let query = supabase
      .from('debts')
      .select(DEBT_SELECT_COLUMNS)
      .eq('user_id', userId);

    if (type !== 'all') {
      query = query.eq('type', type);
    }
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const search = sanitizeIlike(q?.trim());
    if (search) {
      query = query.or(
        `party_name.ilike.%${search}%,title.ilike.%${search}%,notes.ilike.%${search}%`
      );
    }

    const rangeField: DateField = dateField === 'due_date' ? 'due_date' : 'created_at';
    const fromISO = toISODate(dateFrom ?? undefined);
    const toISO = toISODateEnd(dateTo ?? undefined);
    if (fromISO) {
      query = query.gte(rangeField, fromISO);
    }
    if (toISO) {
      query = query.lte(rangeField, toISO);
    }

    switch (sort) {
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'due_soon':
        query = query
          .order('due_date', { ascending: true, nullsLast: true })
          .order('created_at', { ascending: false });
        break;
      case 'amount':
        query = query
          .order('amount', { ascending: false })
          .order('created_at', { ascending: false });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    const { data, error } = await query;
    if (error) throw error;

    const summary = await buildSummary(userId);

    return {
      items: (data ?? []).map(mapDebtRow),
      summary,
    };
  } catch (error) {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.error('[HW] debts-api list', error);
    }
    throw new Error('Gagal memuat hutang');
  }
}

export async function getDebt(id: string): Promise<{ debt: DebtRecord | null; payments: DebtPaymentRecord[] }>
{
  try {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('debts')
      .select(DEBT_SELECT_COLUMNS)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;

    const { data: paymentRows, error: paymentsError } = await supabase
      .from('debt_payments')
      .select(
        'id,debt_id,user_id,amount,paid_at,account_id,related_tx_id,note,created_at,updated_at,' +
          'accounts (id,name,type),transactions (id,date,title,amount,deleted_at,account_id,notes)'
      )
      .eq('debt_id', id)
      .eq('user_id', userId)
      .order('paid_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (paymentsError) throw paymentsError;

    return {
      debt: data ? mapDebtRow(data) : null,
      payments: (paymentRows ?? []).map(mapPaymentRow),
    };
  } catch (error) {
    return handleError(error, 'Gagal memuat detail hutang');
  }
}

export async function listPayments(debtId: string): Promise<DebtPaymentRecord[]> {
  try {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('debt_payments')
      .select(
        'id,debt_id,user_id,amount,paid_at,account_id,related_tx_id,note,created_at,updated_at,' +
          'accounts (id,name,type),transactions (id,date,title,amount,deleted_at,account_id,notes)'
      )
      .eq('debt_id', debtId)
      .eq('user_id', userId)
      .order('paid_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapPaymentRow);
  } catch (error) {
    return handleError(error, 'Gagal memuat pembayaran hutang');
  }
}

async function fetchDebtById(id: string, userId: string): Promise<Record<string, any> | null> {
  const { data, error } = await supabase
    .from('debts')
    .select(DEBT_SELECT_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ?? null;
}

export async function createDebt(payload: DebtInput): Promise<DebtRecord> {
  try {
    const userId = await getUserId();

    const amountValue = toNum(payload.amount);
    if (amountValue === undefined || amountValue <= 0) {
      throw new Error('Nominal hutang tidak valid.');
    }

    const dateIso = toISODate(payload.date) ?? new Date().toISOString();
    const dueDateIso = payload.due_date == null ? null : toISODate(payload.due_date);
    const rateValue = toNum(payload.rate_percent);

    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      type: payload.type,
      party_name: payload.party_name,
      title: payload.title,
      date: dateIso,
      amount: Number(amountValue.toFixed(2)),
    };

    if (payload.due_date !== undefined) {
      insertPayload.due_date = dueDateIso;
    }

    if (rateValue !== undefined) {
      const clamped = Math.max(0, Math.min(100, rateValue));
      insertPayload.rate_percent = Number(clamped.toFixed(2));
    }

    if (payload.notes !== undefined) {
      insertPayload.notes = payload.notes?.trim() ? payload.notes.trim() : null;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('debts')
      .insert([insertPayload])
      .select('id')
      .single();

    if (insertError) throw insertError;
    const insertedId = inserted?.id;
    if (!insertedId) {
      throw new Error('Gagal menambahkan hutang');
    }

    const row = await fetchDebtById(String(insertedId), userId);
    if (!row) {
      throw new Error('Hutang tidak ditemukan setelah dibuat.');
    }

    return mapDebtRow(row);
  } catch (error) {
    if (error instanceof Error && error.message === 'Nominal hutang tidak valid.') {
      throw error;
    }
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.error('[HW] debts-api', error);
    }
    throw new Error('Gagal menambahkan hutang');
  }
}

export async function updateDebt(id: string, patch: DebtUpdateInput): Promise<DebtRecord> {
  try {
    const userId = await getUserId();
    const updates: Record<string, any> = {};
    if (patch.type) updates.type = patch.type;
    if (patch.party_name != null) updates.party_name = patch.party_name;
    if (patch.title != null) updates.title = patch.title;
    if (patch.date) updates.date = toISODate(patch.date);
    if (patch.due_date !== undefined) updates.due_date = toISODate(patch.due_date);

    const amountValue = toNum(patch.amount);
    if (amountValue !== undefined) {
      if (amountValue <= 0) {
        throw new Error('Nominal hutang tidak valid.');
      }
      updates.amount = Number(Math.max(0, amountValue).toFixed(2));
    }

    const rateValue = toNum(patch.rate_percent);
    if (rateValue !== undefined) {
      const clamped = Math.max(0, Math.min(100, rateValue));
      updates.rate_percent = Number(clamped.toFixed(2));
    }

    if (patch.notes !== undefined) {
      updates.notes = patch.notes === null ? null : patch.notes.trim() ? patch.notes.trim() : null;
    }
    if (patch.status) updates.status = patch.status;

    if (Object.keys(updates).length === 0) {
      const { data, error } = await supabase
        .from('debts')
        .select(DEBT_SELECT_COLUMNS)
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error('Hutang tidak ditemukan');
      }
      return mapDebtRow(data);
    }

    const shouldRecalculateStatus =
      !('status' in updates) && (amountValue !== undefined || patch.due_date !== undefined);

    if (shouldRecalculateStatus) {
      const { data: debtRow } = await supabase
        .from('debts')
        .select('amount, paid_total, due_date')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();
      if (debtRow) {
        const amount =
          amountValue !== undefined ? Math.max(0, amountValue) : safeNumber(debtRow.amount);
        const paidTotal = safeNumber(debtRow.paid_total);
        const nextDue =
          patch.due_date !== undefined ? updates.due_date ?? null : debtRow.due_date ?? null;
        updates.status = evaluateStatus(amount, paidTotal, nextDue);
      }
    }

    const { data, error } = await supabase
      .from('debts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select(DEBT_SELECT_COLUMNS)
      .single();

    if (error) throw error;
    return mapDebtRow(data);
  } catch (error) {
    return handleError(error, 'Gagal memperbarui hutang');
  }
}

export async function deleteDebt(id: string): Promise<void> {
  try {
    const userId = await getUserId();
    const { error } = await supabase
      .from('debts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  } catch (error) {
    return handleError(error, 'Gagal menghapus hutang');
  }
}

export async function addPayment(
  debtId: string,
  payload: PaymentInput
): Promise<{ debt: DebtRecord | null; payment: DebtPaymentRecord; queued: boolean }>
{
  try {
    const userId = await getUserId();
    const amount = Math.max(0, payload.amount);
    const accountId = payload.account_id?.trim();

    if (!accountId) {
      throw new Error('Akun sumber wajib dipilih.');
    }

    const paidAtDate = toISODate(payload.paid_at) ?? new Date().toISOString();
    const paidAt = paidAtDate.slice(0, 10);
    const noteValue = payload.note?.trim() ? payload.note.trim() : null;
    const id = payload.id ?? (typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}`);

    const record = {
      id,
      debt_id: debtId,
      user_id: userId,
      amount: amount.toFixed(2),
      paid_at: paidAt,
      account_id: accountId,
      note: noteValue,
      related_tx_id: null as string | null,
    };

    const offline =
      typeof navigator !== 'undefined' &&
      (!navigator.onLine ||
        (typeof window !== 'undefined' && (window as { __sync?: { fakeOffline?: boolean } }).__sync?.fakeOffline));

    if (offline) {
      const saved = await upsert('debt_payments', record);
      const payment = mapPaymentRow(saved);
      payment.queued = true;
      return { debt: null, payment, queued: true };
    }

    const { data, error } = await supabase
      .from('debt_payments')
      .insert([record])
      .select(
        'id,debt_id,user_id,amount,paid_at,account_id,related_tx_id,note,created_at,updated_at,' +
          'accounts (id,name,type),transactions (id,date,title,amount,deleted_at,account_id,notes)'
      )
      .single();
    if (error) throw error;

    const updatedDebt = await recalculateDebtAggregates(debtId, userId);
    const payment = mapPaymentRow(data);
    payment.queued = false;

    return {
      debt: updatedDebt,
      payment,
      queued: false,
    };
  } catch (error) {
    return handleError(error, 'Gagal menambahkan pembayaran');
  }
}

export async function deletePayment(paymentId: string): Promise<DebtRecord | null> {
  try {
    const userId = await getUserId();
    const { data: paymentRow, error: fetchError } = await supabase
      .from('debt_payments')
      .select('debt_id')
      .eq('id', paymentId)
      .eq('user_id', userId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!paymentRow) {
      throw new Error('Pembayaran tidak ditemukan');
    }

    const { error } = await supabase
      .from('debt_payments')
      .delete()
      .eq('id', paymentId)
      .eq('user_id', userId);
    if (error) throw error;

    const updatedDebt = await recalculateDebtAggregates(paymentRow.debt_id, userId);
    return updatedDebt;
  } catch (error) {
    return handleError(error, 'Gagal menghapus pembayaran');
  }
}
