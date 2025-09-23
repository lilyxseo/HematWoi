import { EMPTY_SIGNALS, getDashboardSignals, type DashboardSignals } from './dashboardSignals';

const NUMBER_FORMAT = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

const CACHE_TTL_MS = 5 * 60 * 1000;

export type QuoteGroup =
  | 'over-budget'
  | 'near-budget'
  | 'weekly-repeats'
  | 'large-transaction'
  | 'net-cashflow'
  | 'weekly-top'
  | 'fallback';

export interface QuoteResult {
  group: QuoteGroup;
  text: string;
  template: string;
  vars: Record<string, string>;
}

interface QuoteCandidate {
  group: QuoteGroup;
  uniqueKey: string;
  vars: Record<string, string>;
}

const TEMPLATE_GROUPS: Record<QuoteGroup, string[]> = {
  'over-budget': [
    'Waduh, {category} tembus {pct}%. Saatnya tekan remnya dulu 🚨',
    '{category} sudah {pct}%. Yuk cek mana yang bisa dihemat?',
    'Alert! {category} sudah over budget ({pct}%). Mau ku bantu cari solusi?',
  ],
  'near-budget': [
    '{category} sudah menyentuh {pct}%. Rem tipis dulu ya 😉',
    'Kategori {category} di {pct}%. Mau alihin sebagian pos?',
    'Hati-hati, {category} tinggal sedikit lagi ({pct}%).',
  ],
  'weekly-repeats': [
    'Minggu ini ketemu {merchant} {count}×. Totalnya Rp {total}!',
    '{merchant} muncul {count}× minggu ini (Rp {total}). Fans garis keras nih 😄',
    'Radar belanja bunyi: {merchant} {count}×, total Rp {total}.',
  ],
  'large-transaction': [
    'Transaksi jumbo Rp {amount}. Mau tandai sebagai one-off?',
    'Rp {amount} sekali gesek di {merchant}. Worth it?',
    'Belanja besar Rp {amount}. Simpan nota biar histori rapi!',
  ],
  'net-cashflow': [
    'Cashflow {month}: Rp {amount}. Mau review bareng?',
    'Bulan {month} net Rp {amount}. Sudah sesuai harapan?',
    '{month} mencatat cashflow Rp {amount}. Next step apa nih?',
  ],
  'weekly-top': [
    'Kategori teratas minggu ini: {category} (Rp {total}).',
    '{category} jadi juara minggu ini dengan Rp {total}.',
    'Paling boros minggu ini: {category} senilai Rp {total}.',
  ],
  fallback: [
    'Dompet lagi santai, jadi aku kasih jokes aja: nabung itu kayak diet, niatnya besar godaannya lebih besar. 😄',
    'Belum ada insight panas. Santuy dulu sambil bikin kopi favorit ☕️',
    'Data sepi. Saatnya tarik napas, nikmati hari tanpa laporan berat 🙌',
  ],
};

const PRIORITY_ORDER: QuoteGroup[] = [
  'over-budget',
  'near-budget',
  'weekly-repeats',
  'large-transaction',
  'net-cashflow',
  'weekly-top',
  'fallback',
];

export const highlightKeys = new Set(['category', 'pct', 'merchant', 'count', 'total', 'amount', 'month']);

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gi, '-');
}

function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(Math.max(0, Math.round(value)));
}

function formatSignedNumber(value: number): string {
  const formatted = formatNumber(Math.abs(value));
  return value < 0 ? `-${formatted}` : formatted;
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

function buildCandidates(signals: DashboardSignals): Record<QuoteGroup, QuoteCandidate[]> {
  const candidates: Record<QuoteGroup, QuoteCandidate[]> = {
    'over-budget': signals.overBudget.map((item) => ({
      group: 'over-budget',
      uniqueKey: `over-${normalizeKey(item.category)}`,
      vars: {
        category: item.category,
        pct: formatNumber(item.pct),
      },
    })),
    'near-budget': signals.nearBudget.map((item) => ({
      group: 'near-budget',
      uniqueKey: `near-${normalizeKey(item.category)}`,
      vars: {
        category: item.category,
        pct: formatNumber(item.pct),
      },
    })),
    'weekly-repeats': signals.weeklyRepeats.map((item) => ({
      group: 'weekly-repeats',
      uniqueKey: `repeat-${normalizeKey(item.merchant)}`,
      vars: {
        merchant: item.merchant,
        count: formatNumber(item.count),
        total: formatNumber(item.total),
      },
    })),
    'large-transaction': signals.largeTransaction
      ? [
          {
            group: 'large-transaction',
            uniqueKey: `large-${normalizeKey(signals.largeTransaction.merchant)}`,
            vars: {
              merchant: signals.largeTransaction.merchant,
              amount: formatNumber(signals.largeTransaction.amount),
            },
          },
        ]
      : [],
    'net-cashflow': signals.netCashflow
      ? [
          {
            group: 'net-cashflow',
            uniqueKey: `net-${normalizeKey(signals.netCashflow.month)}`,
            vars: {
              month: signals.netCashflow.month,
              amount: formatSignedNumber(signals.netCashflow.amount),
            },
          },
        ]
      : [],
    'weekly-top': signals.weeklyTop
      ? [
          {
            group: 'weekly-top',
            uniqueKey: `top-${normalizeKey(signals.weeklyTop.category)}`,
            vars: {
              category: signals.weeklyTop.category,
              total: formatNumber(signals.weeklyTop.total),
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

function pickRandom<T>(items: T[], rng: () => number): T {
  if (!items.length) {
    throw new Error('Cannot pick from empty list');
  }
  const index = Math.floor(rng() * items.length);
  return items[Math.max(0, Math.min(items.length - 1, index))];
}

export function generateQuotes(
  signals: DashboardSignals | null,
  options: { max?: number; random?: () => number } = {},
): QuoteResult[] {
  const rng = options.random ?? Math.random;
  const maxQuotes = options.max ?? 3;
  const source = signals ?? { ...EMPTY_SIGNALS };
  const candidates = buildCandidates(source);
  const results: QuoteResult[] = [];
  const usedKeys = new Set<string>();

  for (const group of PRIORITY_ORDER) {
    if (results.length >= maxQuotes) break;
    const groupCandidates = candidates[group] ?? [];
    for (const candidate of groupCandidates) {
      if (results.length >= maxQuotes) break;
      if (candidate.uniqueKey && usedKeys.has(candidate.uniqueKey)) {
        continue;
      }
      const templates = TEMPLATE_GROUPS[group];
      if (!templates?.length) continue;
      const template = pickRandom(templates, rng);
      const text = fillTemplate(template, candidate.vars);
      results.push({ group, text, template, vars: candidate.vars });
      if (candidate.uniqueKey) usedKeys.add(candidate.uniqueKey);
    }
  }

  if (!results.length) {
    const template = pickRandom(TEMPLATE_GROUPS.fallback, rng);
    results.push({ group: 'fallback', text: template, template, vars: {} });
  }

  return results.slice(0, maxQuotes);
}

export interface QuoteEnginePayload {
  fetchedAt: number;
  signals: DashboardSignals;
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
      cache = { expiresAt: Date.now() + CACHE_TTL_MS, payload };
      return payload;
    } catch (error) {
      cache = null;
      return {
        fetchedAt: Date.now(),
        signals: { ...EMPTY_SIGNALS },
      };
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
