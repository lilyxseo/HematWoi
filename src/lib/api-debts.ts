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
  paid_at: string | null;
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
  transaction_type: 'income' | 'expense' | 'transfer' | null;
  transaction_category_id: string | null;
  transaction_category_name: string | null;
  transaction_title: string | null;
  transaction_notes: string | null;
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

export interface PaymentInput {
  amount: number;
  date: string;
  notes?: string | null;
  markAsPaid?: boolean;
  allowOverpay?: boolean;
}

export interface PaymentWithTransactionInput extends PaymentInput {
  account_id: string;
  category_id?: string | null;
  transaction_note?: string | null;
}

const DEBT_SELECT_COLUMNS =
  'id,user_id,type,party_name,title,date,due_date,amount,rate_percent,paid_total,status,notes,tenor_months,tenor_sequence,paid_at,created_at,updated_at';

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
  return String(value).replace(/[%_,()]/g, (match) => `\\${match}`);
}

function isMissingColumnError(error: unknown, column: string): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeCode = (error as { code?: unknown }).code;
  const maybeMessage = (error as { message?: unknown }).message;
  if (typeof maybeMessage === 'string') {
    const normalized = maybeMessage.toLowerCase();
    if (
      normalized.includes(column.toLowerCase()) &&
      (normalized.includes('does not exist') || normalized.includes('could not find'))
    ) {
      return true;
    }
  }
  if (maybeCode === '42703' || maybeCode === 'PGRST204') {
    if (typeof maybeMessage === 'string') {
      return maybeMessage.toLowerCase().includes(column.toLowerCase());
    }
    return true;
  }
  return false;
}

let accountBalanceSupported: boolean | undefined;

async function adjustAccountBalance(accountId: string, userId: string, delta: number): Promise<void> {
  if (!Number.isFinite(delta) || Math.abs(delta) < 1e-6) return;
  if (accountBalanceSupported === false) return;

  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', accountId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (isMissingColumnError(error, 'balance')) {
        accountBalanceSupported = false;
        return;
      }
      throw error;
    }

    accountBalanceSupported = accountBalanceSupported ?? true;
    const currentBalance = safeNumber(data?.balance);
    const nextBalance = currentBalance + delta;
    if (!Number.isFinite(nextBalance)) {
      return;
    }

    const formatted = Number(nextBalance.toFixed(2));
    const { error: updateError } = await supabase
      .from('accounts')
      .update({ balance: formatted })
      .eq('id', accountId)
      .eq('user_id', userId);

    if (updateError) {
      if (isMissingColumnError(updateError, 'balance')) {
        accountBalanceSupported = false;
        return;
      }
      throw updateError;
    }
  } catch (error) {
    if (accountBalanceSupported === false) return;
    throw error;
  }
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

function evaluateStatus(
  amount: number,
  paid: number,
  dueDate: string | null,
  paidAt?: string | null,
): DebtStatus {
  if (paidAt) return 'paid';
  if (paid + 0.0001 >= amount) return 'ongoing';
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
    paid_at: row.paid_at ?? null,
    created_at: row.created_at ?? row.date ?? new Date().toISOString(),
    updated_at: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

function mapPaymentRow(row: Record<string, any>): DebtPaymentRecord {
  const accountRelation = row.account ?? row.accounts ?? null;
  const transactionRelation = row.transaction ?? row.transactions ?? null;
  const transactionCategory =
    transactionRelation?.category ?? transactionRelation?.categories ?? row.transaction_category ?? null;
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
    transaction_type:
      typeof transactionRelation?.type === 'string'
        ? (transactionRelation.type as 'income' | 'expense' | 'transfer')
        : null,
    transaction_category_id: transactionRelation?.category_id
      ? String(transactionRelation.category_id)
      : transactionCategory?.id
      ? String(transactionCategory.id)
      : null,
    transaction_category_name:
      typeof transactionCategory?.name === 'string' && transactionCategory.name.trim()
        ? transactionCategory.name
        : null,
    transaction_title: transactionRelation?.title ?? null,
    transaction_notes: transactionRelation?.notes ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

async function recalculateDebtAggregates(
  debtId: string,
  userId: string,
  options: { markAsPaid?: boolean; paidAt?: string | null } = {},
): Promise<DebtRecord | null> {
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
  const amount = safeNumber(debtRow.amount);
  const willBeFullyPaid = paidTotal + 0.0001 >= amount;

  let paidAt: string | null = debtRow.paid_at ?? null;
  if (willBeFullyPaid) {
    if (options.markAsPaid === false) {
      paidAt = null;
    } else if (options.markAsPaid === true) {
      paidAt = options.paidAt ?? paidAt ?? new Date().toISOString();
    } else if (!paidAt) {
      paidAt = options.paidAt ?? new Date().toISOString();
    }
  } else {
    paidAt = null;
  }

  const status = evaluateStatus(amount, paidTotal, debtRow.due_date ?? null, paidAt);

  const { data: updated, error: updateError } = await supabase
    .from('debts')
    .update({
      paid_total: paidTotal.toFixed(2),
      status,
      paid_at: paidAt,
    })
    .eq('id', debtId)
    .eq('user_id', userId)
    .select(DEBT_SELECT_COLUMNS)
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }
  if (!updated) return mapDebtRow({ ...debtRow, paid_total: paidTotal, status, paid_at: paidAt });
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
    .select(
      '*, account:account_id (id, name), transaction:transaction_id (id, type, category_id, title, notes, category:category_id (id, name))',
    )
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
    .select(
      '*, account:account_id (id, name), transaction:transaction_id (id, type, category_id, title, notes, category:category_id (id, name))',
    )
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
        .select('amount, paid_total, due_date, paid_at')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();
      if (debtRow) {
        const amount =
          amountValue !== undefined ? Math.max(0, amountValue) : safeNumber(debtRow.amount);
        const paidTotal = safeNumber(debtRow.paid_total);
        const nextDue =
          patch.due_date !== undefined ? updates.due_date ?? null : debtRow.due_date ?? null;
        updates.status = evaluateStatus(amount, paidTotal, nextDue, debtRow.paid_at ?? null);
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
  payload: PaymentInput,
): Promise<{ debt: DebtRecord | null; payment: DebtPaymentRecord }>
{
  try {
    const userId = await getUserId();
    const debtRow = await fetchDebtById(debtId, userId);
    if (!debtRow) {
      throw new Error('Hutang tidak ditemukan.');
    }

    const amount = Math.max(0, payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Nominal pembayaran tidak valid.');
    }

    const totalAmount = safeNumber(debtRow.amount);
    const paidTotal = safeNumber(debtRow.paid_total);
    const remaining = Math.max(totalAmount - paidTotal, 0);
    const allowOverpay = Boolean(payload.allowOverpay);
    if (!allowOverpay && amount - remaining > 0.0001) {
      throw new Error('Nominal pembayaran melebihi sisa hutang/piutang.');
    }

    const isoDate = toISODate(payload.date) ?? new Date().toISOString();
    const trimmedNotes = payload.notes?.trim() ? payload.notes.trim() : null;

    const insertPayload = {
      debt_id: debtId,
      user_id: userId,
      amount: amount.toFixed(2),
      date: isoDate,
      notes: trimmedNotes,
      account_id: null as string | null,
      transaction_id: null as string | null,
    };

    const { data, error } = await supabase
      .from('debt_payments')
      .insert([insertPayload])
      .select(
        '*, account:account_id (id, name), transaction:transaction_id (id, type, category_id, title, notes, category:category_id (id, name))',
      )
      .single();
    if (error) throw error;

    const updatedDebt = await recalculateDebtAggregates(debtId, userId, {
      markAsPaid: payload.markAsPaid !== false,
      paidAt: isoDate,
    });

    return {
      debt: updatedDebt,
      payment: mapPaymentRow(data),
    };
  } catch (error) {
    return handleError(error, 'Gagal menambahkan pembayaran');
  }
}

export async function createDebtPaymentWithTransaction(
  debtId: string,
  payload: PaymentWithTransactionInput,
): Promise<{ debt: DebtRecord | null; payment: DebtPaymentRecord }>
{
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

    const amount = Math.max(0, payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Nominal pembayaran tidak valid.');
    }

    const totalAmount = safeNumber(debtRow.amount);
    const paidTotal = safeNumber(debtRow.paid_total);
    const remaining = Math.max(totalAmount - paidTotal, 0);
    const allowOverpay = Boolean(payload.allowOverpay);
    if (!allowOverpay && amount - remaining > 0.0001) {
      throw new Error('Nominal pembayaran melebihi sisa hutang/piutang.');
    }

    const isoDate = toISODate(payload.date) ?? new Date().toISOString();
    const transactionDate = isoDate.slice(0, 10);
    const trimmedNotes = payload.notes?.trim() ? payload.notes.trim() : null;

    const isReceivable = debtRow.type === 'receivable';
    const transactionType: 'income' | 'expense' = isReceivable ? 'income' : 'expense';
    const partyName = typeof debtRow.party_name === 'string' ? debtRow.party_name.trim() : '';
    const debtTitle = typeof debtRow.title === 'string' ? debtRow.title.trim() : '';
    const transactionTitle = debtTitle
      ? debtTitle
      : isReceivable
      ? `Penerimaan piutang${partyName ? ` - ${partyName}` : ''}`
      : `Pembayaran hutang${partyName ? ` - ${partyName}` : ''}`;
    const transactionNotes = payload.transaction_note?.trim()
      ? payload.transaction_note.trim()
      : trimmedNotes ?? null;

    let transactionId: string | null = null;
    try {
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          type: transactionType,
          amount: amount.toFixed(2),
          date: transactionDate,
          account_id: accountId,
          category_id: payload.category_id ?? null,
          title: transactionTitle,
          notes: transactionNotes,
        })
        .select('id')
        .single();
      if (transactionError) throw transactionError;
      transactionId = transactionData?.id ?? null;
    } catch (transactionError) {
      throw transactionError instanceof Error
        ? transactionError
        : new Error('Gagal membuat transaksi untuk pembayaran hutang.');
    }

    const insertPayload = {
      debt_id: debtId,
      user_id: userId,
      amount: amount.toFixed(2),
      date: isoDate,
      notes: trimmedNotes,
      account_id: accountId,
      transaction_id: transactionId,
    };

    const { data, error } = await supabase
      .from('debt_payments')
      .insert([insertPayload])
      .select(
        '*, account:account_id (id, name), transaction:transaction_id (id, type, category_id, title, notes, category:category_id (id, name))',
      )
      .single();
    if (error) {
      if (transactionId) {
        await supabase
          .from('transactions')
          .delete()
          .eq('id', transactionId)
          .eq('user_id', userId);
      }
      throw error;
    }

    try {
      const balanceDelta = isReceivable ? amount : -amount;
      await adjustAccountBalance(accountId, userId, balanceDelta);
    } catch (balanceError) {
      const paymentId = data?.id;
      if (paymentId) {
        await supabase
          .from('debt_payments')
          .delete()
          .eq('id', paymentId)
          .eq('user_id', userId);
      }
      if (transactionId) {
        await supabase
          .from('transactions')
          .delete()
          .eq('id', transactionId)
          .eq('user_id', userId);
      }
      throw balanceError;
    }

    const updatedDebt = await recalculateDebtAggregates(debtId, userId, {
      markAsPaid: payload.markAsPaid !== false,
      paidAt: isoDate,
    });

    return {
      debt: updatedDebt,
      payment: mapPaymentRow(data),
    };
  } catch (error) {
    return handleError(error, 'Gagal menambahkan pembayaran');
  }
}

export async function deleteDebtPayment(
  payload: { id: string; withRollback?: boolean },
): Promise<DebtRecord | null> {
  try {
    const userId = await getUserId();
    const { id, withRollback } = payload;
    const { data: paymentRow, error: fetchError } = await supabase
      .from('debt_payments')
      .select('id, debt_id, amount, account_id, transaction_id, debt:debt_id (id, type)')
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

    if (withRollback && paymentRow.transaction_id) {
      try {
        await supabase
          .from('transactions')
          .delete()
          .eq('id', paymentRow.transaction_id)
          .eq('user_id', userId);
      } catch (cleanupError) {
        logDevError(cleanupError, 'deleteDebtPayment:cleanupTransaction');
      }

      const accountId = paymentRow.account_id ? String(paymentRow.account_id) : null;
      if (accountId) {
        const amount = safeNumber(paymentRow.amount);
        const balanceDelta = paymentRow.debt?.type === 'receivable' ? -amount : amount;
        await adjustAccountBalance(accountId, userId, balanceDelta);
      }
    }

    const updatedDebt = await recalculateDebtAggregates(paymentRow.debt_id, userId);
    return updatedDebt;
  } catch (error) {
    return handleError(error, 'Gagal menghapus pembayaran');
  }
}
