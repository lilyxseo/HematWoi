// src/lib/budgets.ts (contoh nama file)

import { supabase } from './supabase';
import { getCurrentUserId, getUserToken } from './session';
import { listCategories as listAllCategories } from './api-categories';
import { buildSupabaseHeaders, createRestUrl } from './supabaseRest';

type UUID = string;

type Nullable<T> = T | null;

type CarryRule = 'none' | 'carry-positive' | 'carry-all' | 'reset-zero';

export interface ExpenseCategory {
  id: UUID;
  user_id: UUID;
  type: 'income' | 'expense';
  name: string;
  inserted_at: string;
  group_name: Nullable<string>;
  order_index: Nullable<number>;
}

const FALLBACK_CATEGORY_INSERTED_AT = '1970-01-01T00:00:00.000Z';

const CATEGORY_VIEW_REQUIRED_COLUMNS = ['id', 'user_id', 'type', 'name'] as const;
const CATEGORY_VIEW_OPTIONAL_COLUMNS = ['inserted_at', 'group_name', 'order_index'] as const;
const CATEGORY_VIEW_OPTIONAL_COLUMN_SET = new Set<string>([...CATEGORY_VIEW_OPTIONAL_COLUMNS]);
const CATEGORY_VIEW_COLUMNS = [
  ...CATEGORY_VIEW_REQUIRED_COLUMNS,
  ...CATEGORY_VIEW_OPTIONAL_COLUMNS,
] as const;
const CATEGORY_ORDER_DEFINITIONS: ReadonlyArray<{ value: string; column?: string }> = [
  { value: 'order_index.asc.nullsfirst', column: 'order_index' },
  { value: 'name.asc' },
];
const CATEGORY_SELECT_COLUMNS = CATEGORY_VIEW_COLUMNS.join(',');
const CATEGORY_ORDER_PARAMS = CATEGORY_ORDER_DEFINITIONS.map((definition) => definition.value);
const missingCategoryViewColumns = new Set<string>();

let categoriesViewUnavailable = false;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function parsePostgrestError(response: Response, fallback: string): Promise<Error> {
  let message = fallback;
  try {
    const body = await response.json();
    if ((body as any)?.message) {
      message = (body as any).message as string;
    }
  } catch (_error) {
    // ignore JSON parse errors from PostgREST error responses
  }
  const err = new Error(message);
  (err as { status?: number }).status = response.status;
  return err;
}

function parseOrderIndex(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function mapCategoryRecordToExpense(category: {
  id: string;
  user_id: string | null;
  name: string;
  type: string;
  inserted_at?: string | null;
  created_at?: string | null;
  group_name?: string | null;
  order_index?: number | null;
  sort_order?: number | null;
}): ExpenseCategory {
  return {
    id: category.id as UUID,
    user_id: (category.user_id ?? 'local') as UUID,
    type: 'expense',
    name: category.name,
    inserted_at:
      category.inserted_at ??
      category.created_at ??
      FALLBACK_CATEGORY_INSERTED_AT,
    group_name: category.group_name ?? null,
    order_index: (category.order_index ?? category.sort_order) ?? null,
  };
}

export interface BudgetRow {
  id: UUID;
  user_id: UUID;
  category_id: UUID | null;
  amount_planned: number;
  carryover_enabled: boolean;
  notes: Nullable<string>;
  period_month: string; // ISO date (YYYY-MM-01)
  created_at: string;
  updated_at: string;
  carry_rule?: CarryRule;
  rollover_in?: number;
  rollover_out?: number;
  category: {
    id: UUID;
    name: string;
    type?: 'income' | 'expense' | null;
  } | null;
}

export interface BudgetSpentRow {
  category_id: UUID;
  amount: number;
}

export interface BudgetWithSpent extends BudgetRow {
  spent: number;
  remaining: number;
}

export interface BudgetSummary {
  planned: number;
  spent: number;
  remaining: number;
  percentage: number;
}

export interface WeeklyBudgetRow {
  id: UUID;
  user_id: UUID;
  category_id: UUID;
  amount_planned: number;
  carryover_enabled: boolean;
  notes: Nullable<string>;
  week_start: string;
  created_at: string;
  updated_at: string;
  category: {
    id: UUID;
    name: string;
    type?: 'income' | 'expense' | null;
  } | null;
}

export interface WeeklyBudgetWithSpent extends WeeklyBudgetRow {
  week_end: string;
  spent: number;
  remaining: number;
}

export interface WeeklyBudgetCategorySummary {
  category_id: UUID;
  category_name: string;
  category_type: 'income' | 'expense' | null;
  planned: number;
  spent: number;
  remaining: number;
  percentage: number;
}

export interface WeeklyBudgetPeriod {
  start: string;
  end: string;
  sequence: number;
  label: string;
}

export interface WeeklyBudgetsResult {
  rows: WeeklyBudgetWithSpent[];
  summaryByCategory: WeeklyBudgetCategorySummary[];
  weeks: WeeklyBudgetPeriod[];
}

export type HighlightBudgetType = 'monthly' | 'weekly';

export interface HighlightBudgetSelection {
  id: UUID;
  user_id: UUID;
  budget_type: HighlightBudgetType;
  budget_id: UUID;
}

export interface UpsertBudgetInput {
  id?: UUID;
  category_id: UUID;
  period: string; // YYYY-MM
  amount_planned: number;
  carryover_enabled: boolean;
  notes?: Nullable<string>;
}

function ensureAuth(userId: Nullable<string>): asserts userId is string {
  if (!userId) {
    throw new Error('Pengguna belum masuk.');
  }
}

function toMonthStart(period: string): string {
  if (!period) throw new Error('Periode tidak valid');
  const [yearStr, monthStr] = period.split('-');
  if (!yearStr || !monthStr) throw new Error('Periode harus dalam format YYYY-MM');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    throw new Error('Periode harus dalam format YYYY-MM');
  }
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-01`;
}

function getPreviousPeriod(period: string): string | null {
  try {
    const [yearStr, monthStr] = period.split('-');
    if (!yearStr || !monthStr) return null;
    const year = Number.parseInt(yearStr, 10);
    const month = Number.parseInt(monthStr, 10);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
    const current = new Date(Date.UTC(year, month - 1, 1));
    current.setUTCMonth(current.getUTCMonth() - 1);
    const prevYear = current.getUTCFullYear();
    const prevMonth = (current.getUTCMonth() + 1).toString().padStart(2, '0');
    return `${prevYear}-${prevMonth}`;
  } catch (_error) {
    return null;
  }
}

function isMissingColumnError(error: unknown, column: string): boolean {
  if (!error || typeof error !== 'object') return false;
  const message = (error as { message?: string }).message;
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes('does not exist') && normalized.includes(column.toLowerCase());
}

function normalizeCarryRule(value: unknown): CarryRule {
  if (value === 'carry-positive' || value === 'carry-all' || value === 'reset-zero') {
    return value;
  }
  return 'none';
}

function toNumberSafe(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function mapCategoryRelation(row: any): BudgetRow['category'] {
  if (!row) return null;
  const idValue = row.id ?? row.ID ?? null;
  if (idValue == null) return null;
  const id = String(idValue);
  const name = row.name != null ? String(row.name) : '';
  const type = typeof row.type === 'string' ? (row.type as 'income' | 'expense' | null) : null;
  return { id, name, type };
}

function mapBudgetRowNewSchema(row: Record<string, any>, fallbackPeriod: string): BudgetRow {
  const carryRule = normalizeCarryRule(row.carry_rule);
  const carryoverEnabled =
    typeof row.carryover_enabled === 'boolean'
      ? row.carryover_enabled
      : carryRule === 'carry-positive' || carryRule === 'carry-all';
  const planned = toNumberSafe(row.planned ?? row.amount_planned);
  const rolloverIn = toNumberSafe(row.rollover_in);
  const rolloverOut = toNumberSafe(row.rollover_out);
  const periodValue = row.period_month ?? row.period ?? null;

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    category_id: row.category_id != null ? String(row.category_id) : null,
    amount_planned: planned,
    carryover_enabled: carryoverEnabled,
    notes: row.note ?? row.notes ?? null,
    period_month: typeof periodValue === 'string' ? periodValue : fallbackPeriod,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
    carry_rule: carryRule,
    rollover_in: rolloverIn,
    rollover_out: rolloverOut,
    category: mapCategoryRelation(row.category),
  };
}

function mapBudgetRowLegacy(row: Record<string, any>, fallbackPeriod: string): BudgetRow {
  const carryoverEnabled = typeof row.carryover_enabled === 'boolean'
    ? row.carryover_enabled
    : Boolean(row.carryover_enabled);
  const carryRule = carryoverEnabled ? 'carry-positive' : 'none';
  const planned = toNumberSafe(row.amount_planned ?? row.planned);
  const periodValue = row.period_month ?? row.period ?? null;

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    category_id: row.category_id != null ? String(row.category_id) : null,
    amount_planned: planned,
    carryover_enabled: carryoverEnabled,
    notes: row.notes ?? row.note ?? null,
    period_month: typeof periodValue === 'string' ? periodValue : fallbackPeriod,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
    carry_rule: carryRule,
    rollover_in: toNumberSafe(row.rollover_in),
    rollover_out: toNumberSafe(row.rollover_out),
    category: mapCategoryRelation(row.category),
  };
}

async function fetchBudgetsForPeriod(userId: string, period: string): Promise<BudgetRow[]> {
  const periodMonth = toMonthStart(period);
  const { data, error } = await supabase
    .from('budgets')
    .select(
      'id,user_id,category_id,planned,rollover_in,rollover_out,carry_rule,note,period_month,created_at,updated_at,category:categories(id,name,type)'
    )
    .eq('user_id', userId)
    .eq('period_month', periodMonth)
    .order('created_at', { ascending: false });

  if (!error) {
    return (data ?? []).map((row) => mapBudgetRowNewSchema(row, periodMonth));
  }

  if (
    isMissingColumnError(error, 'rollover_in') ||
    isMissingColumnError(error, 'rollover_out') ||
    isMissingColumnError(error, 'carry_rule') ||
    isMissingColumnError(error, 'note')
  ) {
    return fetchBudgetsForPeriodLegacy(userId, periodMonth);
  }

  throw error;
}

async function fetchBudgetsForPeriodLegacy(userId: string, periodMonth: string): Promise<BudgetRow[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select(
      'id,user_id,category_id,amount_planned:planned,carryover_enabled,notes,period_month,created_at,updated_at,category:categories(id,name,type)'
    )
    .eq('user_id', userId)
    .eq('period_month', periodMonth)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapBudgetRowLegacy(row, periodMonth));
}

function getMonthRange(period: string): { start: string; end: string } {
  const start = new Date(`${toMonthStart(period)}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const format = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  return {
    start: format(start),
    end: format(end),
  };
}

function formatIsoDateUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function getWeekStartOnOrAfter(date: Date): string {
  const result = new Date(date);
  const day = result.getUTCDay();
  const diff = (8 - day) % 7;
  result.setUTCDate(result.getUTCDate() + diff);
  return formatIsoDateUTC(result);
}

function getWeekStartForDate(date: Date): string {
  const result = new Date(date);
  const day = result.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // convert Sunday (0) to 6
  result.setUTCDate(result.getUTCDate() - diff);
  return formatIsoDateUTC(result);
}

function getWeekEndFromStart(weekStart: string): string {
  const startDate = parseIsoDate(weekStart);
  startDate.setUTCDate(startDate.getUTCDate() + 6);
  return formatIsoDateUTC(startDate);
}

const WEEK_LABEL_MONTH_FORMATTER = new Intl.DateTimeFormat('id-ID', { month: 'long' });

function formatWeeklyLabel(sequence: number, weekStart: string): string {
  try {
    const monthNameRaw = WEEK_LABEL_MONTH_FORMATTER.format(new Date(`${weekStart}T00:00:00.000Z`));
    const monthName = monthNameRaw.charAt(0).toUpperCase() + monthNameRaw.slice(1);
    return `Minggu ke ${sequence} bulan ${monthName}`;
  } catch (error) {
    return `Minggu ke ${sequence}`;
  }
}

export function getFirstWeekStartOfPeriod(period: string): string {
  try {
    const monthStart = toMonthStart(period);
    return getWeekStartOnOrAfter(parseIsoDate(monthStart));
  } catch (error) {
    const fallback = new Date();
    const fallbackMonthStart = new Date(
      Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), 1)
    );
    return getWeekStartOnOrAfter(fallbackMonthStart);
  }
}

export function getWeeklyTransactionEndExclusive(period: string): string {
  const { end } = getMonthRange(period);
  const lastDayOfPeriod = parseIsoDate(end);
  lastDayOfPeriod.setUTCDate(lastDayOfPeriod.getUTCDate() - 1);
  const lastWeekStart = getWeekStartForDate(lastDayOfPeriod);
  const lastWeekEnd = getWeekEndFromStart(lastWeekStart);
  const exclusive = parseIsoDate(lastWeekEnd);
  exclusive.setUTCDate(exclusive.getUTCDate() + 1);
  return formatIsoDateUTC(exclusive);
}

interface WeeklyCarryoverEntry {
  planned_amount: number;
  carryover_enabled: boolean;
  notes: Nullable<string>;
}

async function ensureWeeklyCarryover(
  userId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<void> {
  if (!rangeStart || !rangeEnd) return;

  const normalizedStart = getWeekStartForDate(parseIsoDate(rangeStart));
  const startDate = parseIsoDate(normalizedStart);
  const endDate = parseIsoDate(rangeEnd);

  if (!(startDate < endDate)) {
    return;
  }

  const { data, error } = await supabase
    .from('budgets_weekly')
    .select('category_id,planned_amount,carryover_enabled,notes,week_start')
    .eq('user_id', userId)
    .gte('week_start', normalizedStart)
    .lt('week_start', rangeEnd)
    .order('week_start', { ascending: true });

  if (error) throw error;

  const budgetsByWeek = new Map<string, Map<string, WeeklyCarryoverEntry>>();

  for (const row of (data ?? []) as {
    category_id: UUID | null;
    planned_amount: number | null;
    carryover_enabled: boolean | null;
    notes: Nullable<string>;
    week_start: string | null;
  }[]) {
    const categoryId = row.category_id ?? undefined;
    const weekStartValue = row.week_start ?? undefined;
    if (!categoryId || !weekStartValue) continue;

    const normalizedWeekStart = getWeekStartForDate(parseIsoDate(weekStartValue));
    let currentWeekBudgets = budgetsByWeek.get(normalizedWeekStart);
    if (!currentWeekBudgets) {
      currentWeekBudgets = new Map();
      budgetsByWeek.set(normalizedWeekStart, currentWeekBudgets);
    }

    const plannedAmount = Number(row.planned_amount ?? 0);
    const carryoverEnabled = typeof row.carryover_enabled === 'boolean'
      ? row.carryover_enabled
      : Boolean(row.carryover_enabled);

    currentWeekBudgets.set(categoryId, {
      planned_amount: Number.isFinite(plannedAmount) ? plannedAmount : 0,
      carryover_enabled: carryoverEnabled,
      notes: row.notes ?? null,
    });
  }

  if (!budgetsByWeek.size) {
    return;
  }

  const weekStartDates: string[] = [];
  for (let current = new Date(startDate); current < endDate; current.setUTCDate(current.getUTCDate() + 7)) {
    weekStartDates.push(formatIsoDateUTC(current));
  }

  const toInsert: {
    category_id: UUID;
    week_start: string;
    planned_amount: number;
    carryover_enabled: boolean;
    notes: Nullable<string>;
  }[] = [];

  for (const weekStart of weekStartDates) {
    const currentBudgets = budgetsByWeek.get(weekStart);
    if (!currentBudgets) continue;

    for (const [categoryId, budget] of currentBudgets.entries()) {
      if (!budget.carryover_enabled) continue;

      const nextWeekDate = parseIsoDate(weekStart);
      nextWeekDate.setUTCDate(nextWeekDate.getUTCDate() + 7);
      if (!(nextWeekDate < endDate)) continue;

      const nextWeekStart = formatIsoDateUTC(nextWeekDate);
      let nextWeekBudgets = budgetsByWeek.get(nextWeekStart);
      if (!nextWeekBudgets) {
        nextWeekBudgets = new Map();
        budgetsByWeek.set(nextWeekStart, nextWeekBudgets);
      }

      if (nextWeekBudgets.has(categoryId)) {
        continue;
      }

      nextWeekBudgets.set(categoryId, {
        planned_amount: budget.planned_amount,
        carryover_enabled: budget.carryover_enabled,
        notes: budget.notes ?? null,
      });

      toInsert.push({
        category_id: categoryId,
        week_start: nextWeekStart,
        planned_amount: budget.planned_amount,
        carryover_enabled: budget.carryover_enabled,
        notes: budget.notes ?? null,
      });
    }
  }

  if (!toInsert.length) {
    return;
  }

  const insertPayload = toInsert.map((item) => ({
    user_id: userId,
    category_id: item.category_id,
    planned_amount: item.planned_amount,
    carryover_enabled: item.carryover_enabled,
    notes: item.notes ?? null,
    week_start: item.week_start,
  }));

  const { error: upsertError } = await supabase
    .from('budgets_weekly')
    .upsert(insertPayload, { onConflict: 'user_id,category_id,week_start' });

  if (upsertError) {
    throw upsertError;
  }
}

export async function listCategoriesExpense(): Promise<ExpenseCategory[]> {
  async function fetchFromCloud(): Promise<ExpenseCategory[]> {
    const userId = await getCurrentUserId();
    ensureAuth(userId);
    return listExpenseCategories(userId);
  }

  try {
    const rows = await fetchFromCloud();
    return rows;
  } catch (_error) {
    // Fallback handled below when cloud fetch fails (e.g. offline or guest mode)
  }

  const localCategories = await listAllCategories();
  return localCategories
    .filter((category) => category.type === 'expense')
    .map((category) =>
      mapCategoryRecordToExpense({
        id: category.id,
        user_id: category.user_id,
        name: category.name,
        type: category.type,
        created_at: category.created_at,
        order_index: category.sort_order,
      })
    );
}

function buildCategoryViewSelect(): string {
  const optionalColumns = CATEGORY_VIEW_OPTIONAL_COLUMNS.filter(
    (column) => !missingCategoryViewColumns.has(column)
  );
  return [...CATEGORY_VIEW_REQUIRED_COLUMNS, ...optionalColumns].join(',');
}

function buildCategoryViewOrderParams(): ReadonlyArray<string> {
  return CATEGORY_ORDER_DEFINITIONS.filter(
    (definition) =>
      !definition.column || !missingCategoryViewColumns.has(definition.column)
  ).map((definition) => definition.value);
}

function createCategoryViewParams(userId: string, type: 'income' | 'expense'): URLSearchParams {
  const params = new URLSearchParams({
    select: buildCategoryViewSelect(),
    user_id: `eq.${userId}`,
    type: `eq.${type}`,
  });
  buildCategoryViewOrderParams().forEach((order) => {
    params.append('order', order);
  });
  return params;
}

function createCategoryFallbackParams(userId: string, type: 'income' | 'expense'): URLSearchParams {
  const params = new URLSearchParams({
    select: CATEGORY_SELECT_COLUMNS,
    user_id: `eq.${userId}`,
    type: `eq.${type}`,
  });
  CATEGORY_ORDER_PARAMS.forEach((order) => {
    params.append('order', order);
  });
  return params;
}

function extractMissingColumnName(bodyText: string): string | null {
  const match = bodyText.match(/column\s+"?([A-Za-z0-9_]+)"?\s+does not exist/i);
  return match ? match[1] ?? null : null;
}

function isMissingRelationError(bodyText: string): boolean {
  return /relation\s+"?[A-Za-z0-9_.]+"?\s+does not exist/i.test(bodyText);
}

async function fetchExpenseCategoriesRemote(
  userId: string,
  signal?: AbortSignal
): Promise<ExpenseCategory[]> {
  const headers = buildSupabaseHeaders();

  if (!categoriesViewUnavailable) {
    while (!categoriesViewUnavailable) {
      const params = createCategoryViewParams(userId, 'expense');
      const viewUrl = createRestUrl('/rest/v1/v_categories_budget', params);
      const response = await fetch(viewUrl, { headers, signal });
      if (response.status === 404) {
        categoriesViewUnavailable = true;
        break;
      }
      if (response.status === 400) {
        const bodyText = await response.clone().text();
        const missingColumnName = extractMissingColumnName(bodyText);
        const shouldRetry =
          missingColumnName !== null &&
          CATEGORY_VIEW_OPTIONAL_COLUMN_SET.has(missingColumnName) &&
          !missingCategoryViewColumns.has(missingColumnName);
        if (shouldRetry) {
          missingCategoryViewColumns.add(missingColumnName);
          continue;
        }
        if (isMissingRelationError(bodyText)) {
          categoriesViewUnavailable = true;
          break;
        }
        const missingColumn =
          /column/iu.test(bodyText) && /does not exist/iu.test(bodyText);
        if (missingColumn) {
          categoriesViewUnavailable = true;
          break;
        }
        throw await parsePostgrestError(response, 'Gagal memuat kategori pengeluaran');
      }
      if (!response.ok) {
        throw await parsePostgrestError(response, 'Gagal memuat kategori pengeluaran');
      }
      const data = ((await response.json()) ?? []) as Record<string, unknown>[];
      return data.map((row) =>
        mapCategoryRecordToExpense({
          id: String(row.id ?? ''),
          user_id: typeof row.user_id === 'string' ? row.user_id : userId,
          name: String(row.name ?? ''),
          type: 'expense',
          inserted_at: typeof row.inserted_at === 'string' ? row.inserted_at : undefined,
          group_name: (row.group_name as string | null | undefined) ?? null,
          order_index: parseOrderIndex((row as any).order_index),
        })
      );
    }
  }

  const fallbackParams = createCategoryFallbackParams(userId, 'expense');
  const fallbackUrl = createRestUrl('/rest/v1/categories', fallbackParams);
  const fallbackResponse = await fetch(fallbackUrl, { headers, signal });
  if (fallbackResponse.status === 404) {
    throw new Error('Endpoint kategori belum tersedia');
  }
  if (!fallbackResponse.ok) {
    throw await parsePostgrestError(fallbackResponse, 'Gagal memuat kategori pengeluaran');
  }
  const fallbackData = ((await fallbackResponse.json()) ?? []) as Record<string, unknown>[];
  return fallbackData.map((row) =>
    mapCategoryRecordToExpense({
      id: String(row.id ?? ''),
      user_id: typeof row.user_id === 'string' ? row.user_id : userId,
      name: String(row.name ?? ''),
      type: 'expense',
      inserted_at: typeof row.inserted_at === 'string' ? row.inserted_at : undefined,
      group_name: (row.group_name as string | null | undefined) ?? null,
      order_index: parseOrderIndex((row as any).order_index),
    })
  );
}

export async function listExpenseCategories(
  userId: string,
  signal?: AbortSignal
): Promise<ExpenseCategory[]> {
  try {
    return await fetchExpenseCategoriesRemote(userId, signal);
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw error;
  }
}

export async function listBudgets(period: string): Promise<BudgetRow[]> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  const currentBudgets = await fetchBudgetsForPeriod(userId, period);
  const existingCategoryIds = new Set(
    currentBudgets
      .map((row) => row.category_id)
      .filter((value): value is string => Boolean(value))
  );

  const previousPeriod = getPreviousPeriod(period);
  if (!previousPeriod) {
    return currentBudgets;
  }

  const previousBudgets = await fetchBudgetsForPeriod(userId, previousPeriod);
  const toCarryOver = previousBudgets.filter(
    (row) => row.carryover_enabled && row.category_id && !existingCategoryIds.has(row.category_id)
  );

  if (!toCarryOver.length) {
    return currentBudgets;
  }

  const results = await Promise.allSettled(
    toCarryOver.map((row) =>
      upsertBudget({
        category_id: row.category_id as string,
        period,
        amount_planned: Number(row.amount_planned ?? 0),
        carryover_enabled: true,
        notes: row.notes ?? undefined,
      })
    )
  );

  const hasSuccess = results.some((result) => result.status === 'fulfilled');
  if (!hasSuccess) {
    return currentBudgets;
  }

  return fetchBudgetsForPeriod(userId, period);
}

export async function computeSpent(period: string): Promise<Record<string, number>> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  const { start, end } = getMonthRange(period);
  const { data, error } = await supabase
    .from('transactions')
    .select('category_id, amount, date, to_account_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('type', 'expense')
    .is('to_account_id', null)
    .gte('date', start)
    .lt('date', end);
  if (error) throw error;
  const totals: Record<string, number> = {};
  for (const row of (data ?? []) as any[]) {
    const categoryId = row?.category_id as string | null;
    if (!categoryId) continue;
    const amount = Number(row?.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    totals[categoryId] = (totals[categoryId] ?? 0) + amount;
  }
  return totals;
}

export async function listWeeklyBudgets(period: string): Promise<WeeklyBudgetsResult> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  const { start, end } = getMonthRange(period);
  const firstWeekStart = getFirstWeekStartOfPeriod(period);
  const transactionRangeEndExclusive = getWeeklyTransactionEndExclusive(period);

  const carryoverRangeStartDate = parseIsoDate(firstWeekStart);
  carryoverRangeStartDate.setUTCDate(carryoverRangeStartDate.getUTCDate() - 7);
  const carryoverRangeStart = formatIsoDateUTC(carryoverRangeStartDate);

  await ensureWeeklyCarryover(userId, carryoverRangeStart, end);

  const budgetsPromise = supabase
    .from('budgets_weekly')
    .select(
      'id,user_id,category_id,amount_planned:planned_amount,carryover_enabled,notes,week_start,created_at,updated_at,category:categories(id,name,type)'
    )
    .eq('user_id', userId)
    .gte('week_start', firstWeekStart)
    .lt('week_start', end)
    .order('week_start', { ascending: true })
    .order('created_at', { ascending: false });

  const transactionsPromise = supabase
    .from('transactions')
    .select('category_id, amount, date, to_account_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('type', 'expense')
    .is('to_account_id', null)
    .gte('date', firstWeekStart)
    .lt('date', transactionRangeEndExclusive);

  const [budgetsResponse, transactionsResponse] = await Promise.all([budgetsPromise, transactionsPromise]);

  if (budgetsResponse.error) throw budgetsResponse.error;
  if (transactionsResponse.error) throw transactionsResponse.error;

  const transactionsByCategory = new Map<string, { date: string; amount: number }[]>();

  for (const row of (transactionsResponse.data ?? []) as any[]) {
    const categoryId = row?.category_id as string | null;
    if (!categoryId) continue;
    const amount = Number(row?.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    const dateValue = typeof row?.date === 'string' ? row.date : null;
    if (!dateValue) continue;
    const list = transactionsByCategory.get(categoryId) ?? [];
    list.push({ date: dateValue, amount });
    transactionsByCategory.set(categoryId, list);
  }

  const summaryAccumulator = new Map<
    string,
    {
      category_id: string;
      category_name: string;
      category_type: 'income' | 'expense' | null;
      planned: number;
      spent: number;
    }
  >();

  const rows = ((budgetsResponse.data ?? []) as WeeklyBudgetRow[]).map((row) => {
    const rawWeekStart = row.week_start ?? start;
    const normalizedWeekStart = getWeekStartForDate(parseIsoDate(rawWeekStart));
    const weekEnd = getWeekEndFromStart(normalizedWeekStart);
    const planned = Number(row.amount_planned ?? 0);
    const transactions = transactionsByCategory.get(row.category_id) ?? [];
    const spent = transactions.reduce((total, transaction) => {
      return transaction.date >= normalizedWeekStart && transaction.date <= weekEnd
        ? total + transaction.amount
        : total;
    }, 0);
    const remaining = planned - spent;
    const carryoverEnabled = typeof row.carryover_enabled === 'boolean'
      ? row.carryover_enabled
      : Boolean(row.carryover_enabled);

    if (!summaryAccumulator.has(row.category_id)) {
      summaryAccumulator.set(row.category_id, {
        category_id: row.category_id,
        category_name: row.category?.name ?? 'Tanpa kategori',
        category_type: row.category?.type ?? null,
        planned: 0,
        spent: 0,
      });
    }
    const current = summaryAccumulator.get(row.category_id);
    if (current) {
      current.planned += planned;
      current.spent += spent;
    }

    return {
      ...row,
      week_start: normalizedWeekStart,
      carryover_enabled: carryoverEnabled,
      week_end: weekEnd,
      spent,
      remaining,
    } satisfies WeeklyBudgetWithSpent;
  });

  const summaryByCategory: WeeklyBudgetCategorySummary[] = Array.from(summaryAccumulator.values()).map((item) => {
    const remaining = item.planned - item.spent;
    const percentage = item.planned > 0 ? Math.min(item.spent / item.planned, 1) : 0;
    return {
      category_id: item.category_id,
      category_name: item.category_name,
      category_type: item.category_type,
      planned: item.planned,
      spent: item.spent,
      remaining,
      percentage,
    };
  });

  summaryByCategory.sort((a, b) => a.category_name.localeCompare(b.category_name));

  const weeks: WeeklyBudgetPeriod[] = [];
  {
    const periodEndDate = parseIsoDate(end);
    const firstWeekDate = parseIsoDate(firstWeekStart);
    for (
      let index = 0, cursor = new Date(firstWeekDate);
      cursor < periodEndDate;
      index += 1, cursor.setUTCDate(cursor.getUTCDate() + 7)
    ) {
      const weekStart = formatIsoDateUTC(cursor);
      const weekEnd = getWeekEndFromStart(weekStart);
      const sequence = index + 1;
      weeks.push({
        start: weekStart,
        end: weekEnd,
        sequence,
        label: formatWeeklyLabel(sequence, weekStart),
      });
    }
  }

  return {
    rows,
    summaryByCategory,
    weeks,
  };
}

export interface UpsertWeeklyBudgetInput {
  id?: UUID;
  category_id: UUID;
  week_start: string; // YYYY-MM-DD
  amount_planned: number;
  carryover_enabled: boolean;
  notes?: Nullable<string>;
}

function normalizeWeekStart(input: string): string {
  if (!input) throw new Error('Tanggal minggu wajib diisi');
  return getWeekStartForDate(parseIsoDate(input));
}

export async function upsertWeeklyBudget(input: UpsertWeeklyBudgetInput): Promise<void> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);

  try {
    await getUserToken();
  } catch (error) {
    if (error instanceof Error && error.message === 'Not signed in') {
      throw new Error('Silakan login untuk menyimpan anggaran');
    }
    throw error;
  }

  const normalizedWeekStart = normalizeWeekStart(input.week_start);
  const sharedPayload = {
    category_id: input.category_id,
    planned_amount: Number(input.amount_planned ?? 0),
    week_start: normalizedWeekStart,
    carryover_enabled: Boolean(input.carryover_enabled),
    notes: input.notes ?? null,
  };

  if (input.id) {
    const { error } = await supabase
      .from('budgets_weekly')
      .update(sharedPayload)
      .eq('user_id', userId)
      .eq('id', input.id);
    if (error) {
      const errorCode = (error as { code?: string } | null)?.code;
      if (errorCode === '23505') {
        throw new Error('Anggaran untuk kategori dan minggu ini sudah ada');
      }
      throw error;
    }
    return;
  }

  const insertPayload = {
    ...sharedPayload,
    user_id: userId,
  };

  const { error } = await supabase
    .from('budgets_weekly')
    .upsert(insertPayload, { onConflict: 'user_id,category_id,week_start' });

  if (error) {
    const errorCode = (error as { code?: string } | null)?.code;
    if (errorCode === '23505') {
      throw new Error('Anggaran untuk kategori dan minggu ini sudah ada');
    }
    throw error;
  }
}

export async function deleteWeeklyBudget(id: UUID): Promise<void> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  const { error } = await supabase.from('budgets_weekly').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}

async function removeMissingHighlightSelections(
  userId: string,
  selections: HighlightBudgetSelection[]
): Promise<HighlightBudgetSelection[]> {
  if (selections.length === 0) {
    return selections;
  }

  const monthlyIds = selections
    .filter((selection) => selection.budget_type === 'monthly')
    .map((selection) => selection.budget_id);
  const weeklyIds = selections
    .filter((selection) => selection.budget_type === 'weekly')
    .map((selection) => selection.budget_id);

  const missingIds = new Set<string>();

  if (monthlyIds.length > 0) {
    const { data, error } = await supabase
      .from('budgets')
      .select('id')
      .eq('user_id', userId)
      .in('id', monthlyIds);
    if (error) throw error;
    const existing = new Set((data ?? []).map((row) => String(row.id)));
    for (const selection of selections) {
      if (selection.budget_type === 'monthly' && !existing.has(String(selection.budget_id))) {
        missingIds.add(String(selection.id));
      }
    }
  }

  if (weeklyIds.length > 0) {
    const { data, error } = await supabase
      .from('budgets_weekly')
      .select('id')
      .eq('user_id', userId)
      .in('id', weeklyIds);
    if (error) throw error;
    const existing = new Set((data ?? []).map((row) => String(row.id)));
    for (const selection of selections) {
      if (selection.budget_type === 'weekly' && !existing.has(String(selection.budget_id))) {
        missingIds.add(String(selection.id));
      }
    }
  }

  if (missingIds.size === 0) {
    return selections;
  }

  const { error: deleteError } = await supabase
    .from('user_highlight_budgets')
    .delete()
    .eq('user_id', userId)
    .in('id', Array.from(missingIds));
  if (deleteError) throw deleteError;

  return selections.filter((selection) => !missingIds.has(String(selection.id)));
}

async function fetchHighlightSelections(userId: string): Promise<HighlightBudgetSelection[]> {
  const { data, error } = await supabase
    .from('user_highlight_budgets')
    .select('id,user_id,budget_type,budget_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const selections = (data ?? []) as HighlightBudgetSelection[];
  return removeMissingHighlightSelections(userId, selections);
}

export async function listHighlightBudgets(): Promise<HighlightBudgetSelection[]> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  return fetchHighlightSelections(userId);
}

export interface ToggleHighlightInput {
  type: HighlightBudgetType;
  id: UUID;
}

export interface ToggleHighlightResult {
  highlighted: boolean;
  highlights: HighlightBudgetSelection[];
}

export async function toggleHighlight(input: ToggleHighlightInput): Promise<ToggleHighlightResult> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  const existing = await fetchHighlightSelections(userId);
  const matched = existing.find(
    (row) => row.budget_type === input.type && String(row.budget_id) === String(input.id)
  );

  if (matched) {
    const { error } = await supabase
      .from('user_highlight_budgets')
      .delete()
      .eq('user_id', userId)
      .eq('id', matched.id);
    if (error) throw error;
    return {
      highlighted: false,
      highlights: existing.filter((row) => row.id !== matched.id),
    };
  }

  if (existing.length >= 2) {
    const err = new Error('Maks. 2 highlight');
    (err as { code?: string }).code = 'LIMIT_REACHED';
    throw err;
  }

  const insertResponse = await supabase
    .from('user_highlight_budgets')
    .insert({
      user_id: userId,
      budget_type: input.type,
      budget_id: input.id,
    })
    .select('id,user_id,budget_type,budget_id');

  if (insertResponse.error) {
    const message = (insertResponse.error.message ?? '').toLowerCase();
    if (message.includes('max') && message.includes('highlight')) {
      const err = new Error('Maks. 2 highlight');
      (err as { code?: string }).code = 'LIMIT_REACHED';
      throw err;
    }
    throw insertResponse.error;
  }

  const insertedRows = Array.isArray(insertResponse.data)
    ? (insertResponse.data as HighlightBudgetSelection[])
    : insertResponse.data
    ? [insertResponse.data as HighlightBudgetSelection]
    : [];

  const inserted = insertedRows[0];
  if (!inserted) {
    throw new Error('Gagal menandai highlight');
  }

  return {
    highlighted: true,
    highlights: [...existing, inserted],
  };
}

export async function upsertBudget(input: UpsertBudgetInput): Promise<void> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);

  // Pastikan benar-benar logged-in (punya token) sebelum menulis ke cloud
  try {
    await getUserToken();
  } catch (error) {
    if (error instanceof Error && error.message === 'Not signed in') {
      throw new Error('Silakan login untuk menyimpan anggaran');
    }
    throw error;
  }

  const payload = {
    p_category_id: input.category_id,
    p_amount_planned: Number(input.amount_planned ?? 0),
    p_period_month: toMonthStart(input.period), // 'YYYY-MM-01'
    p_carryover_enabled: Boolean(input.carryover_enabled),
    p_notes: input.notes ?? null,
  };

  const { error } = await supabase.rpc('bud_upsert', payload);
  if (error) {
    if (error.message === 'Unauthorized' || error.code === '401' || error.code === 'PGRST301') {
      throw new Error('Silakan login untuk menyimpan anggaran');
    }
    const msg = (error.message || '').toLowerCase();
    if (error.code === '404' || msg.includes('bud_upsert')) {
      throw new Error('Fungsi bud_upsert belum tersedia, jalankan migrasi SQL di server');
    }
    throw error;
  }
}

export async function deleteBudget(id: UUID): Promise<void> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  const { error } = await supabase.from('budgets').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}

export function mergeBudgetsWithSpent(budgets: BudgetRow[], spentMap: Record<string, number>): BudgetWithSpent[] {
  return budgets.map((budget) => {
    const spent = spentMap[budget.category_id] ?? 0;
    return {
      ...budget,
      spent,
      remaining: Number(budget.amount_planned ?? 0) - spent,
    };
  });
}

export function buildSummary(rows: BudgetWithSpent[]): BudgetSummary {
  const planned = rows.reduce((acc, row) => acc + Number(row.amount_planned ?? 0), 0);
  const spent = rows.reduce((acc, row) => acc + Number(row.spent ?? 0), 0);
  const remaining = planned - spent;
  const percentage = planned > 0 ? Math.min(spent / planned, 1) : 0;
  return {
    planned,
    spent,
    remaining,
    percentage,
  };
}
