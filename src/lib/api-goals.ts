import { supabase } from './supabase';
import { getCurrentUserId } from './session';
import { remove as removeSync } from './sync/SyncEngine';

export type GoalStatus = 'active' | 'paused' | 'achieved' | 'archived';
export type GoalPriority = 'low' | 'normal' | 'high' | 'urgent';

type SortKey = 'newest' | 'oldest' | 'deadline' | 'amount';
type DateField = 'created_at' | 'due_date';

export interface GoalMilestone {
  label: string;
  amount: number;
}

export interface GoalRecord {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  target_amount: number;
  saved_amount: number;
  start_date: string;
  due_date: string | null;
  priority: GoalPriority;
  status: GoalStatus;
  category_id: string | null;
  color: string;
  icon: string | null;
  milestones: GoalMilestone[];
  created_at: string;
  updated_at: string;
}

export interface GoalEntryRecord {
  id: string;
  goal_id: string;
  user_id: string;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
}

export interface GoalFilters {
  q?: string;
  status?: GoalStatus | 'all';
  priority?: GoalPriority | 'all';
  dateField?: DateField;
  dateFrom?: string | null;
  dateTo?: string | null;
  categoryId?: string | null | 'all';
  sort?: SortKey;
}

export interface GoalsSummary {
  totalActive: number;
  totalSavedThisMonth: number;
  nearestRemaining: number | null;
  onTrackPercentage: number;
  onTrackCount: number;
  totalTracked: number;
}

export interface ListGoalsResponse {
  items: GoalRecord[];
  summary: GoalsSummary;
}

export interface GoalPayload {
  title: string;
  description?: string | null;
  target_amount: number;
  start_date?: string;
  due_date?: string | null;
  priority?: GoalPriority;
  status?: GoalStatus;
  category_id?: string | null;
  color?: string | null;
  icon?: string | null;
  milestones?: GoalMilestone[];
}

export interface GoalEntryPayload {
  amount: number;
  date?: string;
  note?: string | null;
}

const GOALS_SELECT_COLUMNS =
  'id,user_id,title,description,target_amount,saved_amount,start_date,due_date,priority,status,category_id,color,icon,milestones,created_at,updated_at';

const isDevelopment = Boolean(
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'),
);

function logDevError(scope: string, error: unknown) {
  if (isDevelopment) {
    // eslint-disable-next-line no-console
    console.error(`[HW][goals-api] ${scope}`, error);
  }
}

function throwFormatted(scope: string, error: unknown, fallback: string): never {
  logDevError(scope, error);
  if (error instanceof Error && error.message) {
    const wrapped = new Error(error.message);
    (wrapped as { cause?: unknown }).cause = error.cause ?? error;
    throw wrapped;
  }
  throw new Error(fallback);
}

function sanitizeIlike(value?: string | null) {
  if (!value) return '';
  return String(value).replace(/[%_,()]/g, (match) => `\\${match}`);
}

function toNum(value: unknown): number | undefined {
  if (value === '' || value == null) return undefined;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed.replace(/[^0-9.+-]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toISODate(value?: string | null): string | null {
  if (!value) return null;
  const isoSource = value.includes('T') ? value : `${value}T00:00:00Z`;
  const date = new Date(isoSource);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toISODateEnd(value?: string | null): string | null {
  if (!value) return null;
  const isoSource = value.includes('T') ? value : `${value}T23:59:59Z`;
  const date = new Date(isoSource);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeColor(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
      return trimmed.toUpperCase();
    }
  }
  return '#3898F8';
}

function normalizeMilestones(value: unknown): GoalMilestone[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const labelValue = typeof (item as { label?: unknown }).label === 'string'
        ? (item as { label?: string }).label?.trim() ?? ''
        : '';
      const amountValue = toNum((item as { amount?: unknown }).amount);
      if (!labelValue || amountValue === undefined) return null;
      return {
        label: labelValue.slice(0, 80),
        amount: Number(Math.max(0, amountValue).toFixed(2)),
      } satisfies GoalMilestone;
    })
    .filter((item): item is GoalMilestone => Boolean(item))
    .sort((a, b) => a.amount - b.amount);
}

function mapGoalRow(row: Record<string, any>): GoalRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: row.title ?? '',
    description: row.description ?? null,
    target_amount: Number(row.target_amount ?? 0),
    saved_amount: Number(row.saved_amount ?? 0),
    start_date: row.start_date ?? row.created_at ?? new Date().toISOString(),
    due_date: row.due_date ?? null,
    priority: (row.priority as GoalPriority) ?? 'normal',
    status: (row.status as GoalStatus) ?? 'active',
    category_id: row.category_id ?? null,
    color: normalizeColor(row.color),
    icon: row.icon ?? null,
    milestones: normalizeMilestones(row.milestones ?? []),
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

function mapEntryRow(row: Record<string, any>): GoalEntryRecord {
  return {
    id: String(row.id),
    goal_id: String(row.goal_id),
    user_id: String(row.user_id),
    amount: Number(row.amount ?? 0),
    date: row.date ?? row.created_at ?? new Date().toISOString(),
    note: row.note ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

function daysBetween(start: string | null | undefined, end: Date): number {
  if (!start) return 1;
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return 1;
  const diff = end.getTime() - startDate.getTime();
  const days = Math.floor(diff / 86400000);
  return Math.max(1, days || 0);
}

function calculateDaysLeft(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  return Math.max(0, diff);
}

function isGoalOnTrack(goal: GoalRecord): boolean {
  if (goal.status !== 'active') return false;
  if (goal.target_amount <= 0) return false;
  if (goal.saved_amount >= goal.target_amount) return true;

  const daysLeft = calculateDaysLeft(goal.due_date);
  if (daysLeft == null || daysLeft === 0) {
    return goal.saved_amount >= goal.target_amount;
  }

  const remaining = Math.max(goal.target_amount - goal.saved_amount, 0);
  const requiredPerDay = remaining / Math.max(daysLeft, 1);
  const daysElapsed = daysBetween(goal.start_date, new Date());
  const averagePerDay = goal.saved_amount / Math.max(daysElapsed, 1);
  return averagePerDay + 1e-6 >= requiredPerDay;
}

function getMonthRange(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return {
    from: start.toISOString(),
    toExclusive: next.toISOString(),
  };
}

async function computeSummary(userId: string, goals: GoalRecord[]): Promise<GoalsSummary> {
  try {
    const activeGoals = goals.filter((goal) => goal.status === 'active');
    const trackedGoals = activeGoals.length;
    const onTrackCount = activeGoals.filter(isGoalOnTrack).length;

    const nearestGoal = goals
      .filter((goal) => goal.status !== 'archived' && goal.status !== 'achieved')
      .map((goal) => ({
        goal,
        due: goal.due_date ? new Date(goal.due_date).getTime() : Number.POSITIVE_INFINITY,
        remaining: Math.max(goal.target_amount - goal.saved_amount, 0),
      }))
      .sort((a, b) => {
        if (a.due === b.due) {
          return a.remaining - b.remaining;
        }
        return a.due - b.due;
      })[0];

    const monthRange = getMonthRange(new Date());
    const { data: monthEntries, error: monthError } = await supabase
      .from('goal_entries')
      .select('amount')
      .eq('user_id', userId)
      .gte('date', monthRange.from)
      .lt('date', monthRange.toExclusive);
    if (monthError) throw monthError;

    const totalSavedThisMonth = (monthEntries ?? []).reduce((acc, row) => acc + Number(row.amount ?? 0), 0);

    return {
      totalActive: activeGoals.length,
      totalSavedThisMonth: Number(totalSavedThisMonth.toFixed(2)),
      nearestRemaining: nearestGoal ? Number(nearestGoal.remaining.toFixed(2)) : null,
      onTrackCount,
      totalTracked: trackedGoals,
      onTrackPercentage:
        trackedGoals > 0 ? Math.round((onTrackCount / trackedGoals) * 100) : 100,
    };
  } catch (error) {
    logDevError('summary', error);
    return {
      totalActive: goals.filter((goal) => goal.status === 'active').length,
      totalSavedThisMonth: 0,
      nearestRemaining: null,
      onTrackCount: 0,
      totalTracked: goals.filter((goal) => goal.status === 'active').length,
      onTrackPercentage: goals.filter((goal) => goal.status === 'active').length > 0 ? 0 : 100,
    };
  }
}

async function getUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Pengguna belum masuk.');
  }
  return userId;
}

export async function listGoals(filters: GoalFilters = {}): Promise<ListGoalsResponse> {
  try {
    const userId = await getUserId();
    const {
      q = '',
      status = 'all',
      priority = 'all',
      dateField = 'created_at',
      dateFrom,
      dateTo,
      categoryId = 'all',
      sort = 'newest',
    } = filters;

    let query = supabase.from('goals').select(GOALS_SELECT_COLUMNS).eq('user_id', userId);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (priority !== 'all') {
      query = query.eq('priority', priority);
    }

    if (categoryId && categoryId !== 'all') {
      query = query.eq('category_id', categoryId);
    }

    const search = sanitizeIlike(q?.trim());
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
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
      case 'deadline':
        query = query
          .order('due_date', { ascending: true, nullsLast: true })
          .order('created_at', { ascending: false });
        break;
      case 'amount':
        query = query.order('target_amount', { ascending: false });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    const { data, error } = await query;
    if (error) throw error;

    const goals = (data ?? []).map(mapGoalRow);
    const summary = await computeSummary(userId, goals);

    return { items: goals, summary };
  } catch (error) {
    throwFormatted('listGoals', error, 'Gagal memuat goals');
    return {
      items: [],
      summary: {
        totalActive: 0,
        totalSavedThisMonth: 0,
        nearestRemaining: null,
        onTrackCount: 0,
        totalTracked: 0,
        onTrackPercentage: 0,
      },
    } as never;
  }
}

export async function getGoal(id: string): Promise<{ goal: GoalRecord | null; entries: GoalEntryRecord[] }>
{
  try {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('goals')
      .select(GOALS_SELECT_COLUMNS)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;

    const { data: entryRows, error: entryError } = await supabase
      .from('goal_entries')
      .select('*')
      .eq('goal_id', id)
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (entryError) throw entryError;

    return {
      goal: data ? mapGoalRow(data) : null,
      entries: (entryRows ?? []).map(mapEntryRow),
    };
  } catch (error) {
    throwFormatted('getGoal', error, 'Gagal memuat detail goal');
    return { goal: null, entries: [] } as never;
  }
}

export async function listGoalEntries(goalId: string): Promise<GoalEntryRecord[]> {
  try {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('goal_entries')
      .select('*')
      .eq('goal_id', goalId)
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapEntryRow);
  } catch (error) {
    throwFormatted('listGoalEntries', error, 'Gagal memuat setoran goal');
    return [] as never;
  }
}

async function fetchGoalById(id: string, userId: string): Promise<GoalRecord | null> {
  const { data, error } = await supabase
    .from('goals')
    .select(GOALS_SELECT_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapGoalRow(data) : null;
}

function sanitizeMilestonesInput(milestones: GoalMilestone[] | undefined, targetAmount: number) {
  if (!Array.isArray(milestones)) return [];
  return milestones
    .map((item) => ({
      label: typeof item.label === 'string' ? item.label.trim().slice(0, 80) : '',
      amount: item.amount,
    }))
    .filter((item) => item.label && toNum(item.amount) !== undefined)
    .map((item) => ({
      label: item.label,
      amount: Number(Math.max(0, Math.min(targetAmount, Number(item.amount))).toFixed(2)),
    }))
    .sort((a, b) => a.amount - b.amount);
}

export async function createGoal(payload: GoalPayload): Promise<GoalRecord> {
  try {
    const userId = await getUserId();

    const targetValue = toNum(payload.target_amount);
    if (targetValue === undefined || targetValue <= 0) {
      throw new Error('Target tabungan tidak valid.');
    }

    const startDateIso = toISODate(payload.start_date ?? undefined) ?? new Date().toISOString();
    const dueDateIso = payload.due_date === undefined ? undefined : toISODate(payload.due_date);

    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      title: payload.title?.trim() ?? '',
      description: payload.description?.trim() || null,
      target_amount: Number(targetValue.toFixed(2)),
      start_date: startDateIso,
      priority: payload.priority ?? 'normal',
      status: payload.status ?? 'active',
      color: payload.color ? normalizeColor(payload.color) : undefined,
      icon: payload.icon?.trim() || null,
    };

    if (dueDateIso !== undefined) {
      insertPayload.due_date = dueDateIso;
    }

    if (payload.category_id !== undefined) {
      insertPayload.category_id = payload.category_id || null;
    }

    const milestones = sanitizeMilestonesInput(payload.milestones, targetValue);
    if (milestones.length > 0) {
      insertPayload.milestones = milestones;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('goals')
      .insert([insertPayload])
      .select('id')
      .single();

    if (insertError) throw insertError;
    const insertedId = inserted?.id;
    if (!insertedId) {
      throw new Error('Goal tidak ditemukan setelah dibuat.');
    }

    const created = await fetchGoalById(String(insertedId), userId);
    if (!created) {
      throw new Error('Goal tidak ditemukan setelah dibuat.');
    }

    return created;
  } catch (error) {
    throwFormatted('createGoal', error, 'Gagal menambahkan goal');
    return null as never;
  }
}

export async function updateGoal(id: string, patch: GoalPayload): Promise<GoalRecord> {
  try {
    const userId = await getUserId();
    const updates: Record<string, unknown> = {};

    if (patch.title !== undefined) updates.title = patch.title.trim();
    if (patch.description !== undefined) updates.description = patch.description?.trim() || null;

    const targetValue = toNum(patch.target_amount);
    if (targetValue !== undefined) {
      if (targetValue <= 0) {
        throw new Error('Target tabungan tidak valid.');
      }
      updates.target_amount = Number(targetValue.toFixed(2));
    }

    if (patch.start_date !== undefined) {
      updates.start_date = toISODate(patch.start_date) ?? new Date().toISOString();
    }

    if (patch.due_date !== undefined) {
      updates.due_date = patch.due_date ? toISODate(patch.due_date) : null;
    }

    if (patch.priority !== undefined) {
      updates.priority = patch.priority;
    }

    if (patch.status !== undefined) {
      updates.status = patch.status;
    }

    if (patch.category_id !== undefined) {
      updates.category_id = patch.category_id || null;
    }

    if (patch.color !== undefined) {
      updates.color = normalizeColor(patch.color);
    }

    if (patch.icon !== undefined) {
      updates.icon = patch.icon?.trim() || null;
    }

    if (patch.milestones !== undefined) {
      const existing = await fetchGoalById(id, userId);
      const targetAmount = targetValue ?? existing?.target_amount ?? 0;
      updates.milestones = sanitizeMilestonesInput(patch.milestones, targetAmount);
    }

    const { error: updateError } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId);
    if (updateError) throw updateError;

    const updated = await fetchGoalById(id, userId);
    if (!updated) {
      throw new Error('Goal tidak ditemukan.');
    }

    return updated;
  } catch (error) {
    throwFormatted('updateGoal', error, 'Gagal memperbarui goal');
    return null as never;
  }
}

export async function deleteGoal(id: string): Promise<void> {
  try {
    const userId = await getUserId();
    if (!navigator.onLine || window.__sync?.fakeOffline) {
      await removeSync('goals', id);
      return;
    }
    const { error } = await supabase.from('goals').delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
  } catch (error) {
    throwFormatted('deleteGoal', error, 'Gagal menghapus goal');
  }
}

export async function addEntry(goalId: string, payload: GoalEntryPayload): Promise<GoalEntryRecord> {
  try {
    const userId = await getUserId();
    const amountValue = toNum(payload.amount);
    if (amountValue === undefined || amountValue <= 0) {
      throw new Error('Nominal setoran tidak valid.');
    }

    const dateIso = toISODate(payload.date ?? undefined) ?? new Date().toISOString();
    const insertPayload = {
      goal_id: goalId,
      user_id: userId,
      amount: Number(amountValue.toFixed(2)),
      date: dateIso,
      note: payload.note?.trim() || null,
    };

    const { data, error } = await supabase
      .from('goal_entries')
      .insert([insertPayload])
      .select('*')
      .single();
    if (error) throw error;

    return mapEntryRow(data);
  } catch (error) {
    throwFormatted('addEntry', error, 'Gagal menambahkan setoran');
    return null as never;
  }
}

export async function deleteEntry(entryId: string): Promise<void> {
  try {
    const userId = await getUserId();
    const { error } = await supabase.from('goal_entries').delete().eq('id', entryId).eq('user_id', userId);
    if (error) throw error;
  } catch (error) {
    throwFormatted('deleteEntry', error, 'Gagal menghapus setoran');
  }
}
