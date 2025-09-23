import { supabase } from './supabase';

const IDR = new Intl.NumberFormat('id-ID');
const PCT = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const MONTH_FORMAT = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });

const LARGE_TRANSACTION_THRESHOLD = 500_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface WeeklyRepeatSignal {
  merchant: string;
  count: number;
  total: number;
}

export interface BudgetStatusSignal {
  category: string;
  pct: number;
}

export interface LargeTransactionSignal {
  merchant: string;
  amount: number;
}

export interface NetCashflowSignal {
  month: string;
  amount: number;
}

export interface WeeklyTopCategorySignal {
  category: string;
  total: number;
}

export interface DashboardSignals {
  weeklyRepeats: WeeklyRepeatSignal[];
  largeTransactions: LargeTransactionSignal[];
  netCashflow: NetCashflowSignal | null;
  weeklyTopCategory: WeeklyTopCategorySignal | null;
  overBudget: BudgetStatusSignal[];
  nearBudget: BudgetStatusSignal[];
}

export interface QuoteResult {
  group: QuoteGroup;
  text: string;
  template: string;
  vars: Record<string, string>;
}

export interface QuoteEnginePayload {
  fetchedAt: number;
  signals: DashboardSignals;
}

type QuoteGroup =
  | 'over-budget'
  | 'near-budget'
  | 'weekly-repeats'
  | 'large-transaction'
  | 'net-cashflow'
  | 'weekly-top'
  | 'fallback';

interface QuoteCandidate {
  group: QuoteGroup;
  vars: Record<string, string>;
  uniqueKey?: string;
}

interface QueryConfig {
  limit?: number;
  orderBy?: { column: string; ascending?: boolean };
}

const EMPTY_SIGNALS: DashboardSignals = {
  weeklyRepeats: [],
  largeTransactions: [],
  netCashflow: null,
  weeklyTopCategory: null,
  overBudget: [],
  nearBudget: [],
};

const TEMPLATE_GROUPS: Record<QuoteGroup, string[]> = {
  'over-budget': [
    '{category} udah lewat target ({pct}). Saatnya rem darurat! 🚑',
    'Alert! {category} nyentuh {pct}. Yuk cek pos lain buat nutupin.',
    'Over budget di {category}: {pct}. Mau revisi rencananya?',
  ],
  'near-budget': [
    '{category} sudah {pct}. Mau ganti ke mode hemat dulu? 🛑',
    'Hampir penuh nih {category} ({pct}). Kita tahan bentar yuk.',
    'Si merah udah vilain {category} ({pct}). Gas remnya ya.',
  ],
  'weekly-repeats': [
    'Minggu ini ketemu {merchant} {count}× (Rp {total}). Ada diskon spesial apa tuh?',
    '{merchant} nongol {count}× minggu ini, total Rp {total}. Worth it kah?',
    '{merchant} jadi langganan {count}× dengan total Rp {total}.',
  ],
  'large-transaction': [
    'Ada transaksi jumbo Rp {amount}. Perlu cek lagi nggak?',
    'Gesek besar Rp {amount} terdeteksi. Mau ditandai khusus?',
    'Rp {amount} langsung meluncur keluar. Masih on track?',
  ],
  'net-cashflow': [
    'Arus kas {month} sebesar {amount}. Mau langsung parkirkan? 📈',
    '{month} ditutup dengan net {amount}. Strategi lanjut?',
    'Cashflow bulan {month}: {amount}. Saatnya atur aksi lanjut.',
  ],
  'weekly-top': [
    'Kategori teratas minggu ini: {category} (Rp {total}).',
    '{category} memimpin minggu ini dengan Rp {total}. Mau dikurangi?',
    'Belanja terbanyak minggu ini jatuh ke {category}: Rp {total}.',
  ],
  fallback: [
    'Dompet lagi santai. Yuk catat transaksi biar aku bisa kasih insight seru! 😄',
    'Belum ada data baru nih. Cobain catat transaksi dulu ya supaya aku bisa kasih quote cerdas.',
  ],
};

const PRIORITY_ORDER: QuoteGroup[] = [
  'over-budget',
  'near-budget',
  'weekly-repeats',
  'large-transaction',
  'net-cashflow',
  'weekly-top',
];

const highlightKeys = new Set(['total', 'amount', 'pct', 'count']);

function cloneEmptySignals(): DashboardSignals {
  return {
    weeklyRepeats: [],
    largeTransactions: [],
    netCashflow: null,
    weeklyTopCategory: null,
    overBudget: [],
    nearBudget: [],
  };
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return IDR.format(Math.round(Math.abs(value)));
}

function formatSignedCurrency(value: number): string {
  if (!Number.isFinite(value)) return 'Rp 0';
  const formatted = IDR.format(Math.round(Math.abs(value)));
  return value < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return IDR.format(Math.round(Math.max(value, 0)));
}

function formatPct(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${PCT.format(Math.round(value))}%`;
}

function parseNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function parseString(row: Record<string, unknown>, keys: string[], fallback: string): string {
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed) return trimmed;
    }
  }
  return fallback;
}

function parseMonthLabel(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const raw = row[key];
    if (!raw) continue;
    if (raw instanceof Date) {
      return MONTH_FORMAT.format(raw);
    }
    if (typeof raw === 'number') {
      const date = new Date(raw);
      if (!Number.isNaN(date.getTime())) return MONTH_FORMAT.format(date);
    }
    if (typeof raw === 'string') {
      const value = raw.trim();
      if (!value) continue;
      const iso = value.length === 7 ? `${value}-01` : value;
      const date = new Date(iso);
      if (!Number.isNaN(date.getTime())) {
        return MONTH_FORMAT.format(date);
      }
    }
  }
  return null;
}

function extractTimestamp(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const raw = row[key];
    if (!raw) continue;
    if (raw instanceof Date) {
      return raw.getTime();
    }
    if (typeof raw === 'number') {
      const date = new Date(raw);
      if (!Number.isNaN(date.getTime())) return date.getTime();
    }
    if (typeof raw === 'string') {
      const value = raw.trim();
      if (!value) continue;
      const iso = value.length === 7 ? `${value}-01` : value;
      const date = new Date(iso);
      if (!Number.isNaN(date.getTime())) {
        return date.getTime();
      }
    }
  }
  return null;
}

async function selectRows(view: string, config: QueryConfig = {}): Promise<Record<string, unknown>[]> {
  const client: any = supabase as any;
  if (!client || typeof client.from !== 'function') {
    return [];
  }
  let query = client.from(view).select('*');
  if (config.orderBy) {
    query = query.order(config.orderBy.column, {
      ascending: config.orderBy.ascending ?? false,
      nullsFirst: false,
    });
  }
  if (config.limit) {
    query = query.limit(config.limit);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

function uniqueKey(value: string): string {
  return value.toLowerCase();
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    return value != null ? String(value) : `{${key}}`;
  });
}

function pickRandom<T>(items: T[], rng: () => number): T {
  if (!items.length) {
    throw new Error('Cannot pick from empty list');
  }
  const index = Math.floor(rng() * items.length);
  return items[Math.max(0, Math.min(items.length - 1, index))];
}

function buildCandidates(signals: DashboardSignals): Record<QuoteGroup, QuoteCandidate[]> {
  const candidates: Record<QuoteGroup, QuoteCandidate[]> = {
    'over-budget': signals.overBudget.map((item) => ({
      group: 'over-budget',
      uniqueKey: uniqueKey(item.category),
      vars: {
        category: item.category,
        pct: formatPct(item.pct),
      },
    })),
    'near-budget': signals.nearBudget.map((item) => ({
      group: 'near-budget',
      uniqueKey: uniqueKey(item.category),
      vars: {
        category: item.category,
        pct: formatPct(item.pct),
      },
    })),
    'weekly-repeats': signals.weeklyRepeats.map((item) => ({
      group: 'weekly-repeats',
      uniqueKey: uniqueKey(item.merchant),
      vars: {
        merchant: item.merchant,
        count: formatCount(item.count),
        total: formatCurrency(item.total),
      },
    })),
    'large-transaction': signals.largeTransactions.map((item, index) => ({
      group: 'large-transaction',
      uniqueKey: uniqueKey(`${item.merchant}-${index}`),
      vars: {
        merchant: item.merchant,
        amount: formatCurrency(item.amount),
      },
    })),
    'net-cashflow': signals.netCashflow
      ? [
          {
            group: 'net-cashflow',
            uniqueKey: 'net-cashflow',
            vars: {
              month: signals.netCashflow.month,
              amount: formatSignedCurrency(signals.netCashflow.amount),
            },
          },
        ]
      : [],
    'weekly-top': signals.weeklyTopCategory
      ? [
          {
            group: 'weekly-top',
            uniqueKey: uniqueKey(signals.weeklyTopCategory.category),
            vars: {
              category: signals.weeklyTopCategory.category,
              total: formatCurrency(signals.weeklyTopCategory.total),
            },
          },
        ]
      : [],
    fallback: [
      {
        group: 'fallback',
        uniqueKey: 'fallback',
        vars: {},
      },
    ],
  };

  return candidates;
}

export async function getDashboardSignals(): Promise<DashboardSignals> {
  try {
    const [weeklyRepeatsRes, largeTxRes, cashflowRes, weeklyTopRes, budgetStatusRes] =
      await Promise.allSettled([
        selectRows('v_tx_weekly_merchant', { limit: 10 }),
        selectRows('v_tx_large_expenses_month', { limit: 10 }),
        selectRows('v_tx_monthly_cashflow', { limit: 6 }),
        selectRows('v_tx_weekly_top_category', { limit: 5 }),
        selectRows('v_budget_status_month', { limit: 20 }),
      ]);

    const weeklyRows = weeklyRepeatsRes.status === 'fulfilled' ? weeklyRepeatsRes.value : [];
    const largeRows = largeTxRes.status === 'fulfilled' ? largeTxRes.value : [];
    const cashflowRows = cashflowRes.status === 'fulfilled' ? cashflowRes.value : [];
    const topRows = weeklyTopRes.status === 'fulfilled' ? weeklyTopRes.value : [];
    const budgetRows = budgetStatusRes.status === 'fulfilled' ? budgetStatusRes.value : [];

    const weeklyRepeats = weeklyRows
      .map((row) => {
        const total = parseNumber(row, ['total_amount', 'total', 'sum_amount', 'amount']) ?? 0;
        const count = parseNumber(row, ['tx_count', 'count', 'frequency']) ?? 0;
        const merchant = parseString(row, ['merchant', 'merchant_name', 'name', 'title'], 'Merchant');
        return { merchant, count, total };
      })
      .filter((item) => item.count >= 2 && item.total > 0)
      .sort((a, b) => b.total - a.total);

    const largeTransactions = largeRows
      .map((row) => {
        const amount = parseNumber(row, ['amount', 'total_amount', 'value']) ?? 0;
        const merchant = parseString(row, ['merchant', 'merchant_name', 'name', 'notes'], 'Transaksi besar');
        return { merchant, amount: Math.abs(amount) };
      })
      .filter((item) => item.amount >= LARGE_TRANSACTION_THRESHOLD)
      .sort((a, b) => b.amount - a.amount);

    const cashflowCandidates = cashflowRows
      .map((row) => ({
        row,
        amount: parseNumber(row, ['net_amount', 'net', 'amount', 'total']) ?? null,
        ts: extractTimestamp(row, ['month', 'period', 'month_start', 'date']),
      }))
      .filter((item) => item.amount != null && Number.isFinite(item.amount as number))
      .sort((a, b) => (b.ts ?? -Infinity) - (a.ts ?? -Infinity));

    const cashflowRow = cashflowCandidates[0];
    const netCashflow = cashflowRow
      ? {
          month:
            parseMonthLabel(cashflowRow.row, ['month', 'period', 'month_start', 'date']) ??
            MONTH_FORMAT.format(new Date()),
          amount: cashflowRow.amount as number,
        }
      : null;

    const weeklyTopCandidates = topRows
      .map((row) => ({
        row,
        total: parseNumber(row, ['total_amount', 'total', 'amount']) ?? null,
      }))
      .filter((item) => item.total != null && (item.total as number) > 0)
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0));

    const weeklyTopRow = weeklyTopCandidates[0];
    const weeklyTopCategory = weeklyTopRow
      ? {
          category: parseString(weeklyTopRow.row, ['category', 'category_name', 'name', 'label'], 'Kategori'),
          total: weeklyTopRow.total as number,
        }
      : null;

    const budgets = budgetRows
      .map((row) => {
        const pct = parseNumber(row, ['pct', 'pct_used', 'percent', 'percentage']) ?? 0;
        const category = parseString(row, ['category', 'category_name', 'name', 'label'], 'Kategori');
        return { category, pct };
      })
      .filter((item) => Number.isFinite(item.pct));

    const overBudget = budgets
      .filter((item) => item.pct >= 100)
      .sort((a, b) => b.pct - a.pct);

    const nearBudget = budgets
      .filter((item) => item.pct >= 80 && item.pct < 100)
      .sort((a, b) => b.pct - a.pct);

    return {
      weeklyRepeats,
      largeTransactions,
      netCashflow,
      weeklyTopCategory,
      overBudget,
      nearBudget,
    };
  } catch {
    return cloneEmptySignals();
  }
}

export function generateQuotes(
  signals: DashboardSignals | null,
  options: { max?: number; random?: () => number } = {},
): QuoteResult[] {
  const rng = options.random ?? Math.random;
  const maxQuotes = Math.max(1, options.max ?? 3);
  const safeSignals = signals ?? EMPTY_SIGNALS;

  const candidates = buildCandidates(safeSignals);
  const usedKeys = new Set<string>();
  const results: QuoteResult[] = [];

  for (const group of PRIORITY_ORDER) {
    if (results.length >= maxQuotes) break;
    const groupCandidates = candidates[group] ?? [];
    for (const candidate of groupCandidates) {
      if (results.length >= maxQuotes) break;
      if (candidate.uniqueKey && usedKeys.has(candidate.uniqueKey)) {
        continue;
      }
      const templates = TEMPLATE_GROUPS[group];
      if (!templates || !templates.length) continue;
      const template = pickRandom(templates, rng);
      const text = fillTemplate(template, candidate.vars);
      results.push({
        group,
        text,
        template,
        vars: candidate.vars,
      });
      if (candidate.uniqueKey) usedKeys.add(candidate.uniqueKey);
    }
  }

  if (!results.length) {
    const group: QuoteGroup = 'fallback';
    const templates = TEMPLATE_GROUPS[group];
    const template = pickRandom(templates, rng);
    results.push({
      group,
      text: template,
      template,
      vars: {},
    });
  }

  return results.slice(0, maxQuotes);
}

let cache: { expiresAt: number; payload: QuoteEnginePayload } | null = null;
let inflight: Promise<QuoteEnginePayload> | null = null;

export async function loadQuoteEngine({ force = false } = {}): Promise<QuoteEnginePayload> {
  const now = Date.now();
  if (!force && cache && cache.expiresAt > now) {
    return cache.payload;
  }
  if (!force && inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const signals = await getDashboardSignals();
      const payload: QuoteEnginePayload = {
        fetchedAt: Date.now(),
        signals,
      };
      cache = {
        expiresAt: Date.now() + CACHE_TTL_MS,
        payload,
      };
      return payload;
    } catch {
      const payload: QuoteEnginePayload = {
        fetchedAt: Date.now(),
        signals: cloneEmptySignals(),
      };
      cache = {
        expiresAt: Date.now() + CACHE_TTL_MS,
        payload,
      };
      return payload;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export { highlightKeys };
