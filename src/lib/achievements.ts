import { supabase } from './supabase';

export type AchievementCode =
  | 'STREAK_7'
  | 'BUDGET_OK_1M'
  | 'SAVE_1M'
  | 'NO_EATOUT_14'
  | 'IMPORT_100';

export interface StoredAchievement {
  code: AchievementCode;
  title: string;
  earned_at: string;
}

export interface BadgeDefinition {
  code: AchievementCode;
  title: string;
  description: string;
  emoji: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    code: 'STREAK_7',
    title: 'Streak 7 Hari',
    description: 'Catat transaksi setiap hari selama 7 hari berturut-turut.',
    emoji: '🔥',
  },
  {
    code: 'BUDGET_OK_1M',
    title: 'Budget Aman',
    description: 'Tidak ada kategori anggaran yang over-budget di bulan ini.',
    emoji: '🛡️',
  },
  {
    code: 'SAVE_1M',
    title: 'Tabungan 1Juta',
    description: 'Selisih pemasukan dan pengeluaran bulan ini minimal Rp1.000.000.',
    emoji: '💰',
  },
  {
    code: 'NO_EATOUT_14',
    title: 'Tanpa Jajan Luar',
    description: '14 hari tanpa transaksi di kategori “Makan Luar”.',
    emoji: '🥗',
  },
  {
    code: 'IMPORT_100',
    title: 'Import Master',
    description: 'Berhasil impor sedikitnya 100 transaksi melalui CSV.',
    emoji: '📥',
  },
];

const BADGE_DEFINITION_MAP = new Map<AchievementCode, BadgeDefinition>(
  BADGE_DEFINITIONS.map((badge) => [badge.code, badge]),
);

export interface EvaluationHints {
  /**
   * Jika dievaluasi setelah proses impor CSV, isi dengan total transaksi
   * yang berhasil dimasukkan agar rule IMPORT_100 dapat divalidasi tanpa
   * perlu membaca riwayat tambahan.
   */
  recentImportCount?: number;
}

interface EvaluationContext {
  userId: string;
  now: Date;
  hints: EvaluationHints;
  cache: Record<string, Promise<any>>;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeAchievements(value: unknown): StoredAchievement[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const code = typeof (item as any).code === 'string' ? (item as any).code.toUpperCase() : null;
      const title = typeof (item as any).title === 'string' ? (item as any).title : null;
      const earnedAt = typeof (item as any).earned_at === 'string' ? (item as any).earned_at : null;
      if (!code || !earnedAt || !title) {
        return null;
      }
      if (!BADGE_DEFINITION_MAP.has(code as AchievementCode)) {
        return null;
      }
      const parsedDate = new Date(earnedAt);
      if (Number.isNaN(parsedDate.getTime())) {
        return null;
      }
      return {
        code: code as AchievementCode,
        title,
        earned_at: parsedDate.toISOString(),
      } satisfies StoredAchievement;
    })
    .filter((item): item is StoredAchievement => Boolean(item));
}

export async function fetchUserAchievements(userId: string): Promise<StoredAchievement[]> {
  if (!userId) {
    return [];
  }
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('achievements')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      if ((error as { code?: string }).code === 'PGRST116') {
        return [];
      }
      throw error;
    }
    return normalizeAchievements(data?.achievements ?? []);
    } catch (_error) {
      return [];
    }
  }

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

async function getRecentTransactionDates(ctx: EvaluationContext): Promise<string[]> {
  if (!ctx.cache.recentDates) {
    ctx.cache.recentDates = (async () => {
      const end = endOfDay(ctx.now);
      const start = startOfDay(addDays(ctx.now, -6));
      const { data, error } = await supabase
        .from('transactions')
        .select('date')
        .eq('user_id', ctx.userId)
        .is('deleted_at', null)
        .gte('date', start.toISOString())
        .lte('date', end.toISOString());
      if (error) throw error;
      return (data ?? [])
        .map((row) => (typeof row?.date === 'string' ? row.date.slice(0, 10) : null))
        .filter((value): value is string => Boolean(value));
    })();
  }
  return ctx.cache.recentDates;
}

interface MonthlySummary {
  income: number;
  expense: number;
}

async function getMonthlySummary(ctx: EvaluationContext): Promise<MonthlySummary> {
  if (!ctx.cache.monthlySummary) {
    ctx.cache.monthlySummary = (async () => {
      const start = startOfMonth(ctx.now);
      const end = startOfNextMonth(ctx.now);
      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount')
        .eq('user_id', ctx.userId)
        .is('deleted_at', null)
        .gte('date', start.toISOString())
        .lt('date', end.toISOString());
      if (error) throw error;
      let income = 0;
      let expense = 0;
      for (const row of data ?? []) {
        const type = typeof row?.type === 'string' ? row.type : '';
        const amount = Number.parseFloat(row?.amount as any);
        if (!Number.isFinite(amount)) continue;
        if (type === 'income') {
          income += amount;
        } else if (type === 'expense') {
          expense += amount;
        }
      }
      return { income, expense } satisfies MonthlySummary;
    })();
  }
  return ctx.cache.monthlySummary;
}

async function getBudgetStatusRows(ctx: EvaluationContext): Promise<any[]> {
  if (!ctx.cache.budgetStatus) {
    ctx.cache.budgetStatus = (async () => {
      const selectColumns = 'pct, period_month, month, period, user_id';
      const { data, error } = await supabase
        .from('v_budget_status_month')
        .select(selectColumns)
        .eq('user_id', ctx.userId);
      if (error) {
        const code = (error as { code?: string }).code;
        if (code === '42703') {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('v_budget_status_month')
            .select(selectColumns);
          if (fallbackError) {
            throw fallbackError;
          }
          return Array.isArray(fallbackData) ? fallbackData : [];
        }
        throw error;
      }
      return Array.isArray(data) ? data : [];
    })();
  }
  return ctx.cache.budgetStatus;
}

async function getEatOutCategoryIds(ctx: EvaluationContext): Promise<string[]> {
  if (!ctx.cache.eatOutCategories) {
    ctx.cache.eatOutCategories = (async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', ctx.userId)
        .is('deleted_at', null)
        .ilike('name', '%makan luar%');
      if (error) throw error;
      return (data ?? [])
        .map((row) => (typeof row?.id === 'string' ? row.id : null))
        .filter((value): value is string => Boolean(value));
    })();
  }
  return ctx.cache.eatOutCategories;
}

function parseMonthKey(value: unknown): string | null {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const cleaned = value.length >= 7 ? value.slice(0, 7) : value;
  if (/^\d{4}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.slice(0, 7);
  }
  return null;
}

async function checkStreakSeven(ctx: EvaluationContext): Promise<boolean> {
  const dates = await getRecentTransactionDates(ctx);
  if (dates.length < 7) return false;
  const dateSet = new Set(dates);
  for (let offset = 0; offset < 7; offset += 1) {
    const day = addDays(ctx.now, -offset);
    const key = formatDateKey(day);
    if (!dateSet.has(key)) {
      return false;
    }
  }
  return true;
}

async function checkBudgetOk(ctx: EvaluationContext): Promise<boolean> {
  const rows = await getBudgetStatusRows(ctx);
  if (!rows.length) {
    return true;
  }
  const currentMonth = ctx.now.toISOString().slice(0, 7);
  for (const row of rows) {
    const monthKey =
      parseMonthKey((row as any).period_month) ??
      parseMonthKey((row as any).month) ??
      parseMonthKey((row as any).period);
    if (monthKey && monthKey !== currentMonth) {
      continue;
    }
    let pct = Number.parseFloat((row as any).pct ?? 0);
    if (!Number.isFinite(pct)) {
      pct = 0;
    }
    if (pct > 0 && pct <= 1) {
      pct *= 100;
    }
    if (pct >= 100.0001) {
      return false;
    }
  }
  return true;
}

async function checkMonthlySavings(ctx: EvaluationContext): Promise<boolean> {
  const { income, expense } = await getMonthlySummary(ctx);
  const net = income - expense;
  return net >= 1_000_000;
}

async function checkNoEatOut(ctx: EvaluationContext): Promise<boolean> {
  const categoryIds = await getEatOutCategoryIds(ctx);
  if (categoryIds.length === 0) {
    return true;
  }
  const end = endOfDay(ctx.now);
  const start = startOfDay(addDays(ctx.now, -13));
  const query = supabase
    .from('transactions')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', ctx.userId)
    .is('deleted_at', null)
    .gte('date', start.toISOString())
    .lte('date', end.toISOString());
  const { count, error } = categoryIds.length
    ? await query.in('category_id', categoryIds)
    : await query;
  if (error) throw error;
  return (count ?? 0) === 0;
}

function checkImportHundred(ctx: EvaluationContext): boolean {
  const total = ctx.hints.recentImportCount ?? 0;
  return Number.isFinite(total) && total >= 100;
}

const BADGE_EVALUATORS: Record<AchievementCode, (ctx: EvaluationContext) => Promise<boolean> | boolean> = {
  STREAK_7: checkStreakSeven,
  BUDGET_OK_1M: checkBudgetOk,
  SAVE_1M: checkMonthlySavings,
  NO_EATOUT_14: checkNoEatOut,
  IMPORT_100: (ctx) => Promise.resolve(checkImportHundred(ctx)),
};

export async function evaluateBadges(
  userId: string,
  hints: EvaluationHints = {},
): Promise<StoredAchievement[]> {
  if (!userId) {
    return [];
  }
  try {
    const existing = await fetchUserAchievements(userId);
    const existingCodes = new Set(existing.map((item) => item.code));
    const ctx: EvaluationContext = {
      userId,
      now: new Date(),
      hints,
      cache: {},
    };
    const newlyEarned: StoredAchievement[] = [];

    await Promise.all(
      BADGE_DEFINITIONS.map(async (badge) => {
        if (existingCodes.has(badge.code)) {
          return;
        }
        const evaluator = BADGE_EVALUATORS[badge.code];
        if (!evaluator) {
          return;
        }
        try {
          const earned = await evaluator(ctx);
          if (earned) {
            newlyEarned.push({
              code: badge.code,
              title: badge.title,
              earned_at: new Date().toISOString(),
            });
          }
        } catch (_error) {
          // Swallow evaluation errors to keep console clean.
        }
      }),
    );

    if (!newlyEarned.length) {
      return [];
    }

    const updated = [...existing, ...newlyEarned];
    const { error } = await supabase
      .from('user_profiles')
      .update({ achievements: updated })
      .eq('id', userId);
    if (error) {
      throw error;
    }
    return newlyEarned;
  } catch (_error) {
    // Ignore evaluation errors to avoid noisy console output.
    return [];
  }
}
