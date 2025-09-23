import { supabase } from './supabase';
import { getCurrentUserId } from './session';
import EventBus from './eventBus';

export interface BadgeRecord {
  code: string;
  title: string;
  earned_at: string;
}

interface RawBadgeRecord {
  code?: unknown;
  title?: unknown;
  earned_at?: unknown;
}

interface BadgeEvaluationResult {
  earned: BadgeRecord[];
  all: BadgeRecord[];
}

interface BadgeEventContext {
  importedCount?: number;
}

interface BadgeMetrics {
  hasSevenDayStreak: boolean;
  monthNet: number;
  hasOverBudget: boolean;
  hadEatOutLast14Days: boolean;
  importedCount: number;
}

interface BadgeDefinition {
  code: string;
  title: string;
  description: string;
  requires: Array<'transactions' | 'budget'>;
  check: (metrics: BadgeMetrics) => boolean;
}

export const BADGE_DEFINITIONS: readonly BadgeDefinition[] = [
  {
    code: 'STREAK_7',
    title: 'Streak 7 Hari',
    description: 'Catat transaksi selama tujuh hari berturut-turut.',
    requires: ['transactions'],
    check: (metrics) => metrics.hasSevenDayStreak,
  },
  {
    code: 'BUDGET_OK_1M',
    title: 'Anggaran Aman',
    description: 'Tidak ada kategori yang over-budget bulan ini.',
    requires: ['budget'],
    check: (metrics) => !metrics.hasOverBudget,
  },
  {
    code: 'SAVE_1M',
    title: 'Tabungan 1 Juta',
    description: 'Selisih pemasukan dan pengeluaran bulan ini minimal Rp1.000.000.',
    requires: ['transactions'],
    check: (metrics) => metrics.monthNet >= 1_000_000,
  },
  {
    code: 'NO_EATOUT_14',
    title: 'Tanpa Makan Luar',
    description: 'Empat belas hari tanpa transaksi kategori “Makan Luar”.',
    requires: ['transactions'],
    check: (metrics) => !metrics.hadEatOutLast14Days,
  },
  {
    code: 'IMPORT_100',
    title: 'Master Import',
    description: 'Berhasil mengimpor 100 transaksi dalam satu proses CSV.',
    requires: [],
    check: (metrics) => metrics.importedCount >= 100,
  },
] as const;

let pendingContext: BadgeEventContext | null = null;

function storePendingContext(context: BadgeEventContext | undefined) {
  if (!context) return;
  pendingContext = { ...(pendingContext ?? {}), ...context };
}

function toDateOnlyString(date: Date): string {
  const iso = new Date(date).toISOString();
  return iso.slice(0, 10);
}

function parseBadgeRecord(raw: RawBadgeRecord): BadgeRecord | null {
  const code = typeof raw.code === 'string' ? raw.code : null;
  const title = typeof raw.title === 'string' ? raw.title : null;
  const earnedAt = typeof raw.earned_at === 'string' ? raw.earned_at : null;
  if (!code || !title || !earnedAt) {
    return null;
  }
  return { code, title, earned_at: earnedAt };
}

function normalizeAchievements(value: unknown): BadgeRecord[] {
  if (!Array.isArray(value)) return [];
  const result: BadgeRecord[] = [];
  for (const item of value as RawBadgeRecord[]) {
    const parsed = parseBadgeRecord(item);
    if (parsed) {
      result.push(parsed);
    }
  }
  return result;
}

async function fetchAchievements(userId: string): Promise<BadgeRecord[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('achievements')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return normalizeAchievements(data?.achievements);
}

function safeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

async function computeMetrics(
  userId: string,
  pendingBadges: BadgeDefinition[],
  context: BadgeEventContext,
): Promise<BadgeMetrics> {
  const now = new Date();
  const todayIso = toDateOnlyString(now);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const streakStart = new Date(now);
  streakStart.setUTCDate(streakStart.getUTCDate() - 30);
  const eatOutThreshold = new Date(now);
  eatOutThreshold.setUTCDate(eatOutThreshold.getUTCDate() - 13);

  let hasSevenDayStreak = false;
  let monthIncome = 0;
  let monthExpense = 0;
  let hadEatOutLast14Days = false;

  const needsTransactions = pendingBadges.some((badge) => badge.requires.includes('transactions'));
  const needsBudget = pendingBadges.some((badge) => badge.requires.includes('budget'));

  if (needsTransactions) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('date, type, amount, category:category_id(name)')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .in('type', ['income', 'expense', 'transfer'])
        .gte('date', toDateOnlyString(streakStart))
        .lte('date', todayIso)
        .order('date', { ascending: false });
      if (!error && Array.isArray(data)) {
        const daySet = new Set<string>();
        const monthStartIso = toDateOnlyString(monthStart);
        const eatOutStartIso = toDateOnlyString(eatOutThreshold);
        for (const row of data) {
          const rawDate = (row as { date?: string | null }).date;
          if (typeof rawDate !== 'string') continue;
          const day = rawDate.slice(0, 10);
          if (!day) continue;
          daySet.add(day);
          if (day >= monthStartIso) {
            const amount = safeNumber((row as { amount?: unknown }).amount);
            const type = (row as { type?: unknown }).type;
            if (type === 'income') {
              monthIncome += amount;
            } else if (type === 'expense') {
              monthExpense += amount;
            }
          }
          if (!hadEatOutLast14Days && day >= eatOutStartIso) {
            const categoryName = ((row as any).category?.name ?? '') as string;
            if (categoryName && categoryName.toLowerCase().trim() === 'makan luar') {
              hadEatOutLast14Days = true;
            }
          }
        }
        hasSevenDayStreak = true;
        for (let i = 0; i < 7; i += 1) {
          const check = new Date(now);
          check.setUTCDate(check.getUTCDate() - i);
          if (!daySet.has(toDateOnlyString(check))) {
            hasSevenDayStreak = false;
            break;
          }
        }
      }
    } catch {
      hasSevenDayStreak = false;
      monthIncome = 0;
      monthExpense = 0;
      hadEatOutLast14Days = false;
    }
  }

  let hasOverBudget = false;
  if (needsBudget) {
    try {
      const { data, error } = await supabase
        .from('v_budget_status_month')
        .select('pct');
      if (!error && Array.isArray(data)) {
        hasOverBudget = data.some((row: any) => {
          const pctRaw = row?.pct;
          const pctValue = safeNumber(pctRaw);
          const normalized = pctValue > 1 ? pctValue : pctValue * 100;
          return normalized >= 100;
        });
      }
    } catch {
      hasOverBudget = false;
    }
  }

  return {
    hasSevenDayStreak,
    monthNet: monthIncome - monthExpense,
    hasOverBudget,
    hadEatOutLast14Days,
    importedCount: context.importedCount ?? 0,
  };
}

async function updateAchievements(
  userId: string,
  achievements: BadgeRecord[],
): Promise<void> {
  await supabase
    .from('user_profiles')
    .update({ achievements })
    .eq('id', userId);
}

export async function evaluateBadges(userId: string): Promise<BadgeEvaluationResult> {
  if (!userId) {
    return { earned: [], all: [] };
  }

  let achievements: BadgeRecord[];
  try {
    achievements = await fetchAchievements(userId);
  } catch {
    achievements = [];
  }

  const existingMap = new Map(achievements.map((item) => [item.code, item]));
  const pendingBadges = BADGE_DEFINITIONS.filter((badge) => !existingMap.has(badge.code));

  if (pendingBadges.length === 0) {
    const sorted = [...achievements].sort(
      (a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime(),
    );
    return { earned: [], all: sorted };
  }

  const context = pendingContext ?? {};
  pendingContext = null;

  let metrics: BadgeMetrics = {
    hasSevenDayStreak: false,
    monthNet: 0,
    hasOverBudget: false,
    hadEatOutLast14Days: false,
    importedCount: context.importedCount ?? 0,
  };

  try {
    metrics = await computeMetrics(userId, pendingBadges, context);
  } catch {
    metrics = {
      hasSevenDayStreak: false,
      monthNet: 0,
      hasOverBudget: false,
      hadEatOutLast14Days: false,
      importedCount: context.importedCount ?? 0,
    };
  }

  const earned: BadgeRecord[] = [];
  const now = new Date().toISOString();

  for (const badge of pendingBadges) {
    let satisfied = false;
    try {
      satisfied = badge.check(metrics);
    } catch {
      satisfied = false;
    }
    if (satisfied) {
      earned.push({ code: badge.code, title: badge.title, earned_at: now });
    }
  }

  if (earned.length > 0) {
    const updated = [...achievements, ...earned];
    try {
      await updateAchievements(userId, updated);
      achievements = updated;
    } catch {
      achievements = updated;
    }
  }

  const sorted = [...achievements].sort(
    (a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime(),
  );

  if (earned.length > 0) {
    EventBus.emit('achievements:updated', { earned, achievements: sorted });
  }

  return { earned, all: sorted };
}

export async function evaluateCurrentUserBadges(
  context?: BadgeEventContext,
): Promise<BadgeRecord[]> {
  if (context) {
    storePendingContext(context);
  }
  let userId: string | null = null;
  try {
    userId = await getCurrentUserId();
  } catch {
    userId = null;
  }
  if (!userId) {
    return [];
  }
  const result = await evaluateBadges(userId);
  if (result.earned.length > 0) {
    updateDailyMarker(userId);
  }
  return result.all;
}

export async function getUserAchievements(): Promise<BadgeRecord[]> {
  let userId: string | null = null;
  try {
    userId = await getCurrentUserId();
  } catch {
    userId = null;
  }
  if (!userId) return [];
  try {
    return await fetchAchievements(userId);
  } catch {
    return [];
  }
}

function getDailyKey(userId: string): string {
  return `hw:badge:last-eval:${userId}`;
}

function safeStorageGet(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

function updateDailyMarker(userId: string) {
  const today = toDateOnlyString(new Date());
  safeStorageSet(getDailyKey(userId), today);
}

export async function ensureDailyEvaluation(): Promise<BadgeRecord[]> {
  let userId: string | null = null;
  try {
    userId = await getCurrentUserId();
  } catch {
    userId = null;
  }
  if (!userId) return [];

  const today = toDateOnlyString(new Date());
  const key = getDailyKey(userId);
  const last = safeStorageGet(key);
  if (last !== today) {
    const result = await evaluateBadges(userId);
    safeStorageSet(key, today);
    return result.all;
  }
  return getUserAchievements();
}

export function onAchievementsUpdated(
  handler: (payload: { earned: BadgeRecord[]; achievements: BadgeRecord[] }) => void,
) {
  return EventBus.on('achievements:updated', handler);
}

export function recordBadgeContext(context: BadgeEventContext) {
  storePendingContext(context);
}
