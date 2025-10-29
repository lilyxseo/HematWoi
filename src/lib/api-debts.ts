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
  paid_at: string | null;
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

export interface DebtPaymentPayload {
  amount: number;
  date: string;
  notes?: string | null;
  account_id?: string | null;
  category_id?: string | null;
  recordTransaction?: boolean;
  markAsPaid?: boolean;
  allowOverpay?: boolean;
}

export interface DebtPaymentUpdatePayload extends DebtPaymentPayload {
  recordTransaction?: boolean;
}

const DEBT_SELECT_COLUMNS =
  'id,user_id,type,party_name,title,date,due_date,amount,rate_percent,paid_total,status,paid_at,notes,tenor_months,tenor_sequence,created_at,updated_at';

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
    paid_at: row.paid_at ?? null,
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

async function recalculateDebtAggregates(
  debtId: string,
  userId: string,
  options?: { overrideStatus?: DebtStatus; paidAt?: string | null },
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
  const evaluatedStatus = evaluateStatus(safeNumber(debtRow.amount), paidTotal, debtRow.due_date ?? null);
  const status = options?.overrideStatus ?? evaluatedStatus;
  const previousPaidAt = debtRow.paid_at ?? null;
  const nextPaidAt =
    options && Object.prototype.hasOwnProperty.call(options, 'paidAt')
      ? options.paidAt ?? null
      : status === 'paid'
      ? previousPaidAt
      : null;

  const { data: updated, error: updateError } = await supabase
    .from('debts')
    .update({
      paid_total: paidTotal.toFixed(2),
      status,
      paid_at: nextPaidAt,
    })
    .eq('id', debtId)
    .eq('user_id', userId)
    .select(DEBT_SELECT_COLUMNS)
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }
  if (!updated) return mapDebtRow({ ...debtRow, paid_total: paidTotal, status, paid_at: nextPaidAt ?? null });
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

interface DebtPaymentContext {
  userId: string;
  debt: Record<string, any>;
  amount: number;
  isoDate: string;
  notes: string | null;
}

async function createLinkedTransaction({
  userId,
  debt,
  amount,
  isoDate,
  notes,
  accountId,
  categoryId,
}: DebtPaymentContext & { accountId: string; categoryId?: string | null }): Promise<string | null> {
  const isReceivable = debt.type === 'receivable';
  const transactionType = isReceivable ? 'income' : 'expense';
  const partyName = typeof debt.party_name === 'string' ? debt.party_name.trim() : '';
  const debtTitle = typeof debt.title === 'string' ? debt.title.trim() : '';
  const transactionTitle = debtTitle
    ? debtTitle
    : isReceivable
    ? `Pelunasan piutang${partyName ? ` - ${partyName}` : ''}`
    : `Pembayaran hutang${partyName ? ` - ${partyName}` : ''}`;

  const transactionDate = isoDate.slice(0, 10);

  const payload: Record<string, unknown> = {
    user_id: userId,
    type: transactionType,
    amount: amount.toFixed(2),
    date: transactionDate,
    account_id: accountId,
    title: transactionTitle,
    notes,
  };

  if (categoryId) {
    payload.category_id = categoryId;
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return data?.id ?? null;
}

function normalizeNotes(notes?: string | null): string | null {
  if (typeof notes !== 'string') return null;
  const trimmed = notes.trim();
  return trimmed ? trimmed : null;
}

async function ensureDebt(debtId: string, userId: string) {
  const debtRow = await fetchDebtById(debtId, userId);
  if (!debtRow) {
    throw new Error('Hutang tidak ditemukan.');
  }
  return debtRow;
}

function resolveMarkAsPaid(markAsPaid: boolean | undefined): boolean {
  return markAsPaid !== false;
}

function computeRemainingAfter(debt: Record<string, any>, amount: number, excludeAmount = 0): {
  before: number;
  after: number;
  totalPaid: number;
} {
  const baseAmount = safeNumber(debt.amount);
  const paidTotal = safeNumber(debt.paid_total);
  const before = Math.max(baseAmount - (paidTotal - excludeAmount), 0);
  const after = Math.max(baseAmount - (paidTotal - excludeAmount + amount), -Number.MAX_VALUE);
  return {
    before,
    after,
    totalPaid: paidTotal - excludeAmount + amount,
  };
}

async function recalcAfterChange(
  debtId: string,
  userId: string,
  options?: { overrideStatus?: DebtStatus; paidAt?: string | null },
): Promise<DebtRecord | null> {
  return recalculateDebtAggregates(debtId, userId, options);
}

async function updatePaymentRow(
  id: string,
  updates: Record<string, unknown>,
  userId: string,
): Promise<DebtPaymentRecord> {
  const { data, error } = await supabase
    .from('debt_payments')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*, account:account_id (id, name)')
    .single();
  if (error) throw error;
  return mapPaymentRow(data);
}

function toCurrency(amount: number): string {
  return amount.toFixed(2);
}

async function fetchPaymentById(paymentId: string, userId: string) {
  const { data, error } = await supabase
    .from('debt_payments')
    .select('*, account:account_id (id, name)')
    .eq('id', paymentId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error('Pembayaran tidak ditemukan.');
  }
  return data;
}

export async function createDebtPayment(
  debtId: string,
  payload: DebtPaymentPayload,
): Promise<{ debt: DebtRecord | null; payment: DebtPaymentRecord }>
{
  try {
    const userId = await getUserId();
    const debtRow = await ensureDebt(debtId, userId);

    const rawAmount = Number(payload.amount);
    const amount = Number.isFinite(rawAmount) ? Math.max(0, rawAmount) : Number.NaN;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Nominal pembayaran tidak valid.');
    }

    const isoDate = toISODate(payload.date) ?? new Date().toISOString();
    const notes = normalizeNotes(payload.notes);
    const { before, after, totalPaid } = computeRemainingAfter(debtRow, amount);

    if (after < -0.009 && payload.allowOverpay !== true) {
      throw new Error('Nominal melebihi sisa tagihan. Aktifkan opsi overpay untuk melanjutkan.');
    }

    const shouldRecordTransaction = payload.recordTransaction !== false;
    const accountId =
      typeof payload.account_id === 'string' && payload.account_id.trim()
        ? payload.account_id.trim()
        : null;
    if (shouldRecordTransaction && !accountId) {
      throw new Error('Pilih akun untuk mencatat transaksi.');
    }

    let transactionId: string | null = null;
    if (shouldRecordTransaction && accountId) {
      transactionId = await createLinkedTransaction({
        userId,
        debt: debtRow,
        amount,
        isoDate,
        notes,
        accountId,
        categoryId: payload.category_id ?? null,
      }).catch((error) => {
        throw error instanceof Error
          ? error
          : new Error('Gagal membuat transaksi untuk pembayaran hutang.');
      });
    }

    const insertPayload: Record<string, unknown> = {
      debt_id: debtId,
      user_id: userId,
      amount: toCurrency(amount),
      date: isoDate,
      notes,
      transaction_id: transactionId,
    };

    if (accountId) {
      insertPayload.account_id = accountId;
    }

    const { data, error } = await supabase
      .from('debt_payments')
      .insert([insertPayload])
      .select('*, account:account_id (id, name)')
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

    const markAsPaid = resolveMarkAsPaid(payload.markAsPaid);
    const remainingAfter = Math.max(after, 0);
    let overrideStatus: DebtStatus | undefined;
    let recalculationOptions: { overrideStatus: DebtStatus; paidAt?: string | null } | undefined;
    if (remainingAfter <= 0) {
      if (markAsPaid) {
        overrideStatus = 'paid';
        recalculationOptions = { overrideStatus, paidAt: isoDate };
      } else {
        overrideStatus = 'ongoing';
        recalculationOptions = { overrideStatus, paidAt: null };
      }
    }

    const updatedDebt = await recalcAfterChange(debtId, userId, recalculationOptions);

    if (updatedDebt) {
      updatedDebt.paid_total = totalPaid;
      updatedDebt.remaining = remainingAfter;
      if (overrideStatus === 'paid') {
        updatedDebt.status = 'paid';
        updatedDebt.paid_at = isoDate;
      } else if (overrideStatus === 'ongoing') {
        updatedDebt.status = 'ongoing';
        updatedDebt.paid_at = null;
      }
    }

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
  payload: DebtPaymentPayload,
): Promise<{ debt: DebtRecord | null; payment: DebtPaymentRecord }>
{
  return createDebtPayment(debtId, { ...payload, recordTransaction: true });
}

export async function updateDebtPayment(
  paymentId: string,
  payload: DebtPaymentUpdatePayload,
): Promise<{ debt: DebtRecord | null; payment: DebtPaymentRecord }>
{
  try {
    const userId = await getUserId();
    const paymentRow = await fetchPaymentById(paymentId, userId);
    const debtId = String(paymentRow.debt_id);
    const debtRow = await ensureDebt(debtId, userId);

    const originalAmount = safeNumber(paymentRow.amount);
    const rawAmount = Number(payload.amount);
    const amount = Number.isFinite(rawAmount) ? Math.max(0, rawAmount) : Number.NaN;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Nominal pembayaran tidak valid.');
    }

    const isoDate = toISODate(payload.date) ?? new Date().toISOString();
    const notes = normalizeNotes(payload.notes);
    const { before, after, totalPaid } = computeRemainingAfter(debtRow, amount, originalAmount);

    if (after < -0.009 && payload.allowOverpay !== true) {
      throw new Error('Nominal melebihi sisa tagihan. Aktifkan opsi overpay untuk melanjutkan.');
    }

    const shouldRecordTransaction = payload.recordTransaction ?? Boolean(paymentRow.transaction_id);
    const accountIdInput =
      typeof payload.account_id === 'string' && payload.account_id.trim()
        ? payload.account_id.trim()
        : null;
    const accountId = shouldRecordTransaction
      ? accountIdInput ?? (paymentRow.account_id ? String(paymentRow.account_id) : null)
      : accountIdInput;

    if (shouldRecordTransaction && !accountId) {
      throw new Error('Pilih akun untuk mencatat transaksi.');
    }

    let transactionId: string | null = paymentRow.transaction_id ? String(paymentRow.transaction_id) : null;

    if (shouldRecordTransaction) {
      if (transactionId) {
        const { error: updateError } = await supabase
          .from('transactions')
          .update({
            amount: toCurrency(amount),
            date: isoDate.slice(0, 10),
            account_id: accountId,
            notes,
            ...(payload.category_id ? { category_id: payload.category_id } : {}),
          })
          .eq('id', transactionId)
          .eq('user_id', userId);
        if (updateError) throw updateError;
      } else if (accountId) {
        transactionId = await createLinkedTransaction({
          userId,
          debt: debtRow,
          amount,
          isoDate,
          notes,
          accountId,
          categoryId: payload.category_id ?? null,
        }).catch((error) => {
          throw error instanceof Error
            ? error
            : new Error('Gagal membuat transaksi untuk pembayaran hutang.');
        });
      }
    } else if (transactionId) {
      await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', userId);
      transactionId = null;
    }

    const updates: Record<string, unknown> = {
      amount: toCurrency(amount),
      date: isoDate,
      notes,
      transaction_id: transactionId,
    };

    if (accountId) {
      updates.account_id = accountId;
    } else if (shouldRecordTransaction === false) {
      updates.account_id = null;
    }

    const payment = await updatePaymentRow(paymentId, updates, userId);

    const markAsPaid = resolveMarkAsPaid(payload.markAsPaid);
    const remainingAfter = Math.max(after, 0);
    let overrideStatus: DebtStatus | undefined;
    let recalculationOptions: { overrideStatus: DebtStatus; paidAt?: string | null } | undefined;
    if (remainingAfter <= 0) {
      if (markAsPaid) {
        overrideStatus = 'paid';
        recalculationOptions = { overrideStatus, paidAt: isoDate };
      } else {
        overrideStatus = 'ongoing';
        recalculationOptions = { overrideStatus, paidAt: null };
      }
    }

    const updatedDebt = await recalcAfterChange(debtId, userId, recalculationOptions);

    if (updatedDebt) {
      updatedDebt.paid_total = totalPaid;
      updatedDebt.remaining = remainingAfter;
      if (overrideStatus === 'paid') {
        updatedDebt.status = 'paid';
        updatedDebt.paid_at = isoDate;
      } else if (overrideStatus === 'ongoing') {
        updatedDebt.status = 'ongoing';
        updatedDebt.paid_at = null;
      }
    }

    return { debt: updatedDebt, payment };
  } catch (error) {
    return handleError(error, 'Gagal memperbarui pembayaran');
  }
}

export async function deleteDebtPayment(
  paymentId: string,
  { withRollback }: { withRollback?: boolean } = {},
): Promise<DebtRecord | null> {
  try {
    const userId = await getUserId();
    const { data: paymentRow, error: fetchError } = await supabase
      .from('debt_payments')
      .select('debt_id, transaction_id')
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

    if (withRollback && paymentRow.transaction_id) {
      try {
        await supabase
          .from('transactions')
          .delete()
          .eq('id', paymentRow.transaction_id)
          .eq('user_id', userId);
      } catch (cleanupError) {
        logDevError(cleanupError, 'deletePayment:cleanupTransaction');
      }
    }

    const updatedDebt = await recalcAfterChange(paymentRow.debt_id, userId);
    return updatedDebt;
  } catch (error) {
    return handleError(error, 'Gagal menghapus pembayaran');
  }
}

export async function addPayment(
  debtId: string,
  payload: DebtPaymentPayload,
): Promise<{ debt: DebtRecord | null; payment: DebtPaymentRecord }>
{
  return createDebtPaymentWithTransaction(debtId, payload);
}

export async function deletePayment(paymentId: string): Promise<DebtRecord | null> {
  return deleteDebtPayment(paymentId, { withRollback: true });
}
