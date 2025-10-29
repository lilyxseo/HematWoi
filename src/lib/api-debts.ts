import { supabase } from './supabase';
import { getCurrentUserId } from './session';

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
  tenor_months: number;
  tenor_sequence: number;
  created_at: string;
  updated_at: string;
}

export interface DebtPaymentRecord {
  id: string;
  debt_id: string;
  user_id: string;
  amount: number;
  date: string;
  notes: string | null;
  account_id: string | null;
  account_name: string | null;
  transaction_id: string | null;
  created_at: string;
}

export interface DebtSummary {
  totalDebt: number;
  debtDueThisMonth: number;
  debtDueNextMonth: number;
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
  tenor_months: number;
}

export interface DebtUpdateInput extends Partial<DebtInput> {
  status?: DebtStatus;
}

export interface DebtPaymentBaseInput {
  amount: number;
  date: string;
  notes?: string | null;
  markAsPaid?: boolean;
  allowOverpay?: boolean;
}

export interface DebtPaymentWithTransactionInput extends DebtPaymentBaseInput {
  account_id: string;
  category_id?: string | null;
}

export interface CreateDebtPaymentOptions extends DebtPaymentBaseInput {}

export interface CreateDebtPaymentWithTransactionOptions extends DebtPaymentWithTransactionInput {}

export interface DeleteDebtPaymentOptions {
  id: string;
  withRollback?: boolean;
}

export interface DebtPaymentMutationResult {
  debt: DebtRecord | null;
  payment: DebtPaymentRecord;
}

const DEBT_SELECT_COLUMNS =
  'id,user_id,type,party_name,title,date,due_date,amount,rate_percent,paid_total,status,notes,tenor_months,tenor_sequence,created_at,updated_at';

function logDevError(error: unknown, context?: string) {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    if (context) {
      console.error(`[HW] debts-api:${context}`, error);
    } else {
      console.error('[HW] debts-api', error);
    }
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
  return String(value).replace(/[%_,()]/g, (match) => `\\${match}`);
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
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed);
  const isoSource = hasTimezone
    ? trimmed
    : trimmed.includes('T')
    ? `${trimmed}Z`
    : `${trimmed}T00:00:00Z`;
  const date = new Date(isoSource);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toISODateEnd(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed);
  const isoSource = hasTimezone
    ? trimmed
    : trimmed.includes('T')
    ? `${trimmed}Z`
    : `${trimmed}T23:59:59Z`;
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

function addMonthsToIso(iso: string, monthsToAdd: number): string {
  const base = new Date(iso);
  if (Number.isNaN(base.getTime()) || !Number.isFinite(monthsToAdd)) {
    return iso;
  }
  const result = new Date(base.getTime());
  result.setUTCMonth(result.getUTCMonth() + monthsToAdd);
  return result.toISOString();
}

function mapDebtRow(row: Record<string, any>): DebtRecord {
  const amount = safeNumber(row.amount);
  const paidTotal = safeNumber(row.paid_total);
  const rate = row.rate_percent != null ? safeNumber(row.rate_percent) : null;
  const remaining = Math.max(amount - paidTotal, 0);
  const tenorMonths = Math.max(1, Math.floor(safeNumber(row.tenor_months) || 1));
  const tenorSequence = Math.max(1, Math.floor(safeNumber(row.tenor_sequence) || 1));
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
    tenor_months: tenorMonths,
    tenor_sequence: Math.min(tenorSequence, tenorMonths),
    created_at: row.created_at ?? row.date ?? new Date().toISOString(),
    updated_at: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

function mapPaymentRow(row: Record<string, any>): DebtPaymentRecord {
  const accountRelation = row.account ?? row.accounts ?? null;
  const rawAccountId =
    row.account_id ?? accountRelation?.id ?? accountRelation?.account_id ?? null;
  const accountId = rawAccountId ? String(rawAccountId) : null;
  const accountName =
    typeof row.account_name === 'string' && row.account_name.trim()
      ? row.account_name
      : accountRelation?.name ?? null;
  const rawNotes =
    typeof row.notes === 'string'
      ? row.notes
      : typeof row.note === 'string'
      ? row.note
      : null;
  let normalizedNotes: string | null = null;
  if (typeof rawNotes === 'string') {
    const trimmed = rawNotes.trim();
    normalizedNotes = trimmed ? trimmed : null;
  }
  return {
    id: String(row.id),
    debt_id: String(row.debt_id),
    user_id: String(row.user_id),
    amount: safeNumber(row.amount),
    date: row.date ?? row.created_at ?? new Date().toISOString(),
    notes: normalizedNotes,
    account_id: accountId,
    account_name: accountName ?? null,
    transaction_id: row.transaction_id ? String(row.transaction_id) : null,
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

async function adjustAccountBalance(accountId: string, userId: string, delta: number): Promise<void> {
  if (!accountId || !Number.isFinite(delta) || Math.abs(delta) < 0.000001) {
    return;
  }

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Akun tidak ditemukan.');
  }

  const balanceKey = ['balance', 'current_balance', 'initial_balance'].find((key) =>
    Object.prototype.hasOwnProperty.call(data, key),
  );

  if (!balanceKey) {
    return;
  }

  const currentBalance = safeNumber((data as Record<string, unknown>)[balanceKey]);
  const nextBalance = Number((currentBalance + delta).toFixed(2));
  const payload: Record<string, unknown> = {
    [balanceKey]: nextBalance,
  };

  const { error: updateError } = await supabase
    .from('accounts')
    .update(payload)
    .eq('id', accountId)
    .eq('user_id', userId);

  if (updateError) throw updateError;
}

async function applyDebtStatusOverride(
  debtId: string,
  userId: string,
  status: DebtStatus,
): Promise<DebtRecord | null> {
  const { data, error } = await supabase
    .from('debts')
    .update({ status })
    .eq('id', debtId)
    .eq('user_id', userId)
    .select(DEBT_SELECT_COLUMNS)
    .maybeSingle();

  if (error) throw error;
  return data ? mapDebtRow(data) : null;
}

function getRemainingBeforePayment(debtRow: Record<string, any>): number {
  return Math.max(0, safeNumber(debtRow.amount) - safeNumber(debtRow.paid_total));
}

interface CommitDebtPaymentParams {
  debtId: string;
  userId: string;
  amount: number;
  isoDate: string;
  notes: string | null;
  accountId?: string | null;
  transactionId?: string | null;
  markAsPaid: boolean;
  remainingBefore: number;
}

async function commitDebtPayment(params: CommitDebtPaymentParams): Promise<DebtPaymentMutationResult> {
  const { debtId, userId, amount, isoDate, notes, accountId, transactionId, markAsPaid, remainingBefore } = params;

  const insertPayload: Record<string, any> = {
    debt_id: debtId,
    user_id: userId,
    amount: amount.toFixed(2),
    date: isoDate,
    notes,
  };

  if (accountId) {
    insertPayload.account_id = accountId;
  }
  if (transactionId) {
    insertPayload.transaction_id = transactionId;
  }

  let insertedPaymentId: string | null = null;

  try {
    const { data, error } = await supabase
      .from('debt_payments')
      .insert([insertPayload])
      .select('*, account:account_id (id, name)')
      .single();

    if (error) throw error;

    insertedPaymentId = data?.id ? String(data.id) : null;
    const payment = mapPaymentRow(data);

    let resolvedDebt = await recalculateDebtAggregates(debtId, userId);
    const remainingAfter = resolvedDebt ? resolvedDebt.remaining : Math.max(0, remainingBefore - amount);
    const isSettled = remainingAfter <= 0.0001;

    if (resolvedDebt) {
      if (markAsPaid && isSettled && resolvedDebt.status !== 'paid') {
        resolvedDebt = (await applyDebtStatusOverride(debtId, userId, 'paid')) ?? resolvedDebt;
      } else if (!markAsPaid && isSettled && resolvedDebt.status === 'paid') {
        resolvedDebt = (await applyDebtStatusOverride(debtId, userId, 'ongoing')) ?? resolvedDebt;
      }
    }

    return {
      debt: resolvedDebt,
      payment,
    };
  } catch (error) {
    if (insertedPaymentId) {
      try {
        await supabase
          .from('debt_payments')
          .delete()
          .eq('id', insertedPaymentId)
          .eq('user_id', userId);
      } catch (cleanupError) {
        logDevError(cleanupError, 'commitDebtPayment:cleanup');
      }
    }
    throw error;
  }
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
  const monthAfterNext = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1));

  const [{ data: debtsRows, error: debtsError }, { data: paymentRows, error: paymentError }] = await Promise.all([
    supabase
      .from('debts')
      .select('type, amount, paid_total, due_date, status')
      .eq('user_id', userId),
    supabase
      .from('debt_payments')
      .select('amount, date')
      .eq('user_id', userId)
      .gte('date', startOfMonth.toISOString())
      .lt('date', nextMonth.toISOString()),
  ]);

  if (debtsError) throw debtsError;
  if (paymentError) throw paymentError;

  const summary: DebtSummary = {
    totalDebt: 0,
    debtDueThisMonth: 0,
    debtDueNextMonth: 0,
    totalReceivable: 0,
    totalPaidThisMonth: 0,
    dueSoon: 0,
  };

  const soonThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  for (const row of debtsRows ?? []) {
    const amount = safeNumber(row.amount);
    const paidTotal = safeNumber(row.paid_total);
    if (row.type === 'debt') {
      const remaining = Math.max(amount - paidTotal, 0);
      summary.totalDebt += remaining;

      if (row.status !== 'paid' && row.due_date) {
        const due = new Date(row.due_date);
        if (
          !Number.isNaN(due.getTime()) &&
          due.getTime() >= startOfMonth.getTime() &&
          due.getTime() < nextMonth.getTime()
        ) {
          summary.debtDueThisMonth += remaining;
        } else if (
          !Number.isNaN(due.getTime()) &&
          due.getTime() >= nextMonth.getTime() &&
          due.getTime() < monthAfterNext.getTime()
        ) {
          summary.debtDueNextMonth += remaining;
        }
      }
    }
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
      .select('*, account:account_id (id, name)')
      .eq('debt_id', id)
      .eq('user_id', userId)
      .order('date', { ascending: false })
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
      .select('*, account:account_id (id, name)')
      .eq('debt_id', debtId)
      .eq('user_id', userId)
      .order('date', { ascending: false })
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

    const tenorRaw = toNum(payload.tenor_months);
    const tenorMonths = tenorRaw === undefined ? 1 : Math.max(1, Math.min(36, Math.floor(tenorRaw)));

    const dateIso = toISODate(payload.date) ?? new Date().toISOString();
    const dueDateIso = payload.due_date == null ? null : toISODate(payload.due_date);
    const rateValue = toNum(payload.rate_percent);

    const basePayload: Record<string, unknown> = {
      user_id: userId,
      type: payload.type,
      party_name: payload.party_name,
      title: payload.title,
      amount: Number(amountValue.toFixed(2)),
    };

    if (payload.notes !== undefined) {
      basePayload.notes = payload.notes?.trim() ? payload.notes.trim() : null;
    }

    if (rateValue !== undefined) {
      const clamped = Math.max(0, Math.min(100, rateValue));
      basePayload.rate_percent = Number(clamped.toFixed(2));
    }

    const rowsToInsert: Record<string, unknown>[] = [];
    for (let index = 0; index < tenorMonths; index += 1) {
      const entry: Record<string, unknown> = {
        ...basePayload,
        date: addMonthsToIso(dateIso, index),
        tenor_months: tenorMonths,
        tenor_sequence: index + 1,
      };
      if (payload.due_date !== undefined) {
        entry.due_date = dueDateIso ? addMonthsToIso(dueDateIso, index) : null;
      }
      rowsToInsert.push(entry);
    }

    const { data: insertedRows, error: insertError } = await supabase
      .from('debts')
      .insert(rowsToInsert)
      .select('id, tenor_sequence');

    if (insertError) throw insertError;

    const insertedList = Array.isArray(insertedRows) ? insertedRows : insertedRows ? [insertedRows] : [];
    const firstInserted = insertedList.find((row) => (row?.tenor_sequence ?? 0) === 1) ?? insertedList[0];
    if (!firstInserted?.id) {
      throw new Error('Gagal menambahkan hutang');
    }

    const row = await fetchDebtById(String(firstInserted.id), userId);
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

    const tenorValue = toNum(patch.tenor_months);
    if (tenorValue !== undefined) {
      updates.tenor_months = Math.max(1, Math.min(36, Math.floor(tenorValue)));
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

export async function createDebtPayment(
  debtId: string,
  payload: CreateDebtPaymentOptions,
): Promise<DebtPaymentMutationResult> {
  try {
    const userId = await getUserId();
    const debtRow = await fetchDebtById(debtId, userId);
    if (!debtRow) {
      throw new Error('Hutang tidak ditemukan.');
    }

    const rawAmount = Number(payload.amount);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      throw new Error('Nominal pembayaran tidak valid.');
    }

    const normalizedAmount = Number(Math.max(0, rawAmount).toFixed(2));
    const remainingBefore = getRemainingBeforePayment(debtRow);
    const allowOverpay = Boolean(payload.allowOverpay);
    if (!allowOverpay && normalizedAmount - remainingBefore > 0.0001) {
      throw new Error('Nominal melebihi sisa tagihan.');
    }

    const isoDate = toISODate(payload.date) ?? new Date().toISOString();
    const trimmedNotes = payload.notes?.trim() ? payload.notes.trim() : null;
    const markAsPaid = payload.markAsPaid !== false;

    return await commitDebtPayment({
      debtId,
      userId,
      amount: normalizedAmount,
      isoDate,
      notes: trimmedNotes,
      markAsPaid,
      remainingBefore,
    });
  } catch (error) {
    return handleError(error, 'Gagal menambahkan pembayaran');
  }
}

export async function createDebtPaymentWithTransaction(
  debtId: string,
  payload: CreateDebtPaymentWithTransactionOptions,
): Promise<DebtPaymentMutationResult> {
  try {
    const userId = await getUserId();
    const debtRow = await fetchDebtById(debtId, userId);
    if (!debtRow) {
      throw new Error('Hutang tidak ditemukan.');
    }

    const accountId = typeof payload.account_id === 'string' ? payload.account_id.trim() : '';
    if (!accountId) {
      throw new Error('Pilih akun untuk mencatat transaksi.');
    }

    const rawAmount = Number(payload.amount);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      throw new Error('Nominal pembayaran tidak valid.');
    }

    const normalizedAmount = Number(Math.max(0, rawAmount).toFixed(2));
    const remainingBefore = getRemainingBeforePayment(debtRow);
    const allowOverpay = Boolean(payload.allowOverpay);
    if (!allowOverpay && normalizedAmount - remainingBefore > 0.0001) {
      throw new Error('Nominal melebihi sisa tagihan.');
    }

    const isoDate = toISODate(payload.date) ?? new Date().toISOString();
    const trimmedNotes = payload.notes?.trim() ? payload.notes.trim() : null;
    const markAsPaid = payload.markAsPaid !== false;

    const isReceivable = debtRow.type === 'receivable';
    const transactionType = isReceivable ? 'income' : 'expense';
    const categoryId = payload.category_id ? String(payload.category_id) : null;

    if (transactionType === 'expense' && !categoryId) {
      throw new Error('Pilih kategori transaksi untuk pembayaran hutang.');
    }

    const partyName = typeof debtRow.party_name === 'string' ? debtRow.party_name.trim() : '';
    const debtTitle = typeof debtRow.title === 'string' ? debtRow.title.trim() : '';
    const baseLabel = isReceivable ? 'Penerimaan piutang' : 'Pembayaran hutang';
    const transactionTitle = debtTitle
      ? `${baseLabel} • ${debtTitle}`
      : partyName
      ? `${baseLabel} • ${partyName}`
      : baseLabel;

    const transactionDate = isoDate.slice(0, 10);
    let transactionId: string | null = null;
    const balanceDelta = transactionType === 'expense' ? -normalizedAmount : normalizedAmount;

    try {
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          type: transactionType,
          amount: normalizedAmount.toFixed(2),
          date: transactionDate,
          account_id: accountId,
          category_id: categoryId,
          title: transactionTitle,
          notes: trimmedNotes,
        })
        .select('id')
        .single();

      if (transactionError) throw transactionError;
      transactionId = transactionData?.id ?? null;

      try {
        await adjustAccountBalance(accountId, userId, balanceDelta);
      } catch (balanceError) {
        if (transactionId) {
          await supabase
            .from('transactions')
            .delete()
            .eq('id', transactionId)
            .eq('user_id', userId);
        }
        throw balanceError;
      }

      try {
        return await commitDebtPayment({
          debtId,
          userId,
          amount: normalizedAmount,
          isoDate,
          notes: trimmedNotes,
          accountId,
          transactionId,
          markAsPaid,
          remainingBefore,
        });
      } catch (commitError) {
        if (transactionId) {
          await supabase
            .from('transactions')
            .delete()
            .eq('id', transactionId)
            .eq('user_id', userId);
        }
        try {
          await adjustAccountBalance(accountId, userId, -balanceDelta);
        } catch (rollbackError) {
          logDevError(rollbackError, 'createDebtPaymentWithTransaction:rollback');
        }
        throw commitError;
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error.message ? error : new Error('Gagal membuat transaksi untuk pembayaran hutang.');
      }
      throw new Error('Gagal membuat transaksi untuk pembayaran hutang.');
    }
  } catch (error) {
    return handleError(error, 'Gagal menambahkan pembayaran');
  }
}

export async function deleteDebtPayment(options: DeleteDebtPaymentOptions): Promise<DebtRecord | null> {
  try {
    const { id, withRollback } = options;
    const userId = await getUserId();
    const { data: paymentRow, error: fetchError } = await supabase
      .from('debt_payments')
      .select('id, debt_id, amount, transaction_id, account_id')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!paymentRow) {
      throw new Error('Pembayaran tidak ditemukan');
    }

    const { error } = await supabase
      .from('debt_payments')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;

    const amountValue = safeNumber(paymentRow.amount);
    const debtRow = await fetchDebtById(String(paymentRow.debt_id), userId);
    const isReceivable = debtRow?.type === 'receivable';

    if (withRollback && paymentRow.transaction_id && paymentRow.account_id) {
      try {
        await supabase
          .from('transactions')
          .delete()
          .eq('id', paymentRow.transaction_id)
          .eq('user_id', userId);

        const delta = isReceivable ? -amountValue : amountValue;
        await adjustAccountBalance(String(paymentRow.account_id), userId, delta);
      } catch (cleanupError) {
        logDevError(cleanupError, 'deleteDebtPayment:rollback');
      }
    }

    const updatedDebt = await recalculateDebtAggregates(String(paymentRow.debt_id), userId);
    return updatedDebt;
  } catch (error) {
    return handleError(error, 'Gagal menghapus pembayaran');
  }
}
