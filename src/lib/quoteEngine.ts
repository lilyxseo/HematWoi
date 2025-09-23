const IDR = new Intl.NumberFormat('id-ID');
const MONTH_FORMAT = new Intl.DateTimeFormat('id-ID', { month: 'long' });
const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
});

const LARGE_TX_THRESHOLD = 500_000;
const LOW_BALANCE_THRESHOLD = 50_000;
const UPCOMING_SUB_WINDOW_DAYS = 7;
const CACHE_TTL_MS = 5 * 60 * 1000;

const HIGHLIGHT_KEYS = new Set([
  'total',
  'amount',
  'pct',
  'left',
  'streak',
  'count',
  'goal',
]);

interface TransactionLike {
  id?: string;
  date?: string;
  type?: string;
  amount?: number;
  merchant?: string | null;
  title?: string | null;
  notes?: string | null;
  category?: string | null;
  category_id?: string | null;
  account?: string | null;
}

interface BudgetLike {
  id?: string;
  name?: string | null;
  planned?: number;
  rollover_in?: number;
  activity?: {
    actual?: number;
  } | null;
  category_id?: string | null;
  category_name?: string | null;
  label?: string | null;
  actual?: number;
  spent?: number;
}

interface GoalLike {
  id?: string;
  title?: string;
  name?: string;
  status?: string;
  target_amount?: number;
  saved_amount?: number;
}

interface SubscriptionLike {
  id?: string;
  name?: string;
  vendor?: string | null;
  amount?: number;
  next_due_date?: string | null;
  due_date?: string | null;
  anchor_date?: string | null;
}

interface AccountLike {
  id?: string;
  name?: string;
  balance?: number;
}

export interface DashboardSignals {
  weeklyRepeats: Array<{
    merchant: string;
    count: number;
    total: number;
  }>;
  nearBudget: Array<{
    category: string;
    pct: number;
  }>;
  overBudget: Array<{
    category: string;
    pct: number;
  }>;
  largeTx?: {
    merchant: string;
    amount: number;
  } | null;
  streak: number;
  noSpendToday: boolean;
  goalTop?: {
    goal: string;
    pct: number;
    amountLeft: number;
  } | null;
  upcomingSub?: {
    merchant: string;
    amount: number;
    date: Date;
  } | null;
  roundUp?: {
    amount: number;
    goal?: string;
  } | null;
  weeklyTop?: {
    category: string;
    total: number;
  } | null;
  quietCats: Array<{
    category: string;
    pct: number;
  }>;
  netMonth?: {
    amount: number;
    monthLabel: string;
  } | null;
  lowBalance?: {
    account: string;
    left: number;
  } | null;
  lastExpense?: {
    merchant?: string;
    amount?: number;
  } | null;
}

export interface QuoteResult {
  group: string;
  text: string;
  template: string;
  vars: Record<string, string>;
}

const FALLBACK_SIGNALS: DashboardSignals = {
  weeklyRepeats: [],
  nearBudget: [],
  overBudget: [],
  largeTx: null,
  streak: 0,
  noSpendToday: false,
  goalTop: null,
  upcomingSub: null,
  roundUp: null,
  weeklyTop: null,
  quietCats: [],
  netMonth: null,
  lowBalance: null,
  lastExpense: null,
};

function startOfWeek(date: Date): Date {
  const clone = new Date(date);
  const day = clone.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  clone.setDate(clone.getDate() + diff);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

function startOfMonth(date: Date): Date {
  const clone = new Date(date);
  clone.setDate(1);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

function endOfMonth(date: Date): Date {
  const start = startOfMonth(date);
  return new Date(start.getFullYear(), start.getMonth() + 1, 1);
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatNumber(value: number | undefined | null): string {
  if (!value) return '0';
  return IDR.format(Math.round(value));
}

function normalizeName(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    if (candidate && String(candidate).trim()) {
      return String(candidate).trim();
    }
  }
  return 'Item ini';
}

function sanitizeBudgetName(budget: BudgetLike): string {
  return normalizeName(
    budget.name,
    budget.label,
    budget.category_name,
    budget.category_id ? `Kategori ${budget.category_id.slice(0, 4)}` : null,
  );
}

function calculateBudgetActual(budget: BudgetLike): number {
  if (typeof budget.activity?.actual === 'number') return budget.activity.actual;
  if (typeof budget.actual === 'number') return budget.actual;
  if (typeof budget.spent === 'number') return budget.spent;
  return 0;
}

function calculateBudgetPlanned(budget: BudgetLike): number {
  const planned = typeof budget.planned === 'number' ? budget.planned : 0;
  const rollover = typeof budget.rollover_in === 'number' ? budget.rollover_in : 0;
  return planned + rollover;
}

function uniqueKey(value: string): string {
  return value.toLowerCase();
}

function computeRoundUp(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const rounded = Math.ceil(amount / 1000) * 1000;
  const diff = rounded - amount;
  if (diff <= 0 || diff >= 1000) return 0;
  return diff;
}

export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    if (value == null) return `{${key}}`;
    return String(value);
  });
}

export function getDashboardSignals({
  fromTx = [],
  budgets = [],
  goals = [],
  subs = [],
  accounts = [],
}: {
  fromTx?: TransactionLike[];
  budgets?: BudgetLike[];
  goals?: GoalLike[];
  subs?: SubscriptionLike[];
  accounts?: AccountLike[];
}): DashboardSignals {
  if (!Array.isArray(fromTx)) {
    return { ...FALLBACK_SIGNALS };
  }

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const monthStart = startOfMonth(now);
  const nextMonthStart = endOfMonth(now);

  const txs = fromTx
    .map((tx) => {
      const dateObj = parseDate(tx.date);
      return dateObj
        ? {
            ...tx,
            dateObj,
          }
        : null;
    })
    .filter((tx): tx is TransactionLike & { dateObj: Date } => Boolean(tx));

  const monthTxs = txs.filter(
    (tx) => tx.dateObj >= monthStart && tx.dateObj < nextMonthStart,
  );
  const weekTxs = txs.filter((tx) => tx.dateObj >= weekStart && tx.dateObj < weekEnd);
  const weekExpenses = weekTxs.filter((tx) => tx.type === 'expense');
  const monthExpenses = monthTxs.filter((tx) => tx.type === 'expense');
  const monthIncomes = monthTxs.filter((tx) => tx.type === 'income');

  const weeklyRepeatMap = new Map<string, { merchant: string; count: number; total: number }>();
  for (const tx of weekExpenses) {
    const merchant = normalizeName(tx.merchant, tx.title, tx.notes);
    const key = uniqueKey(merchant);
    if (!weeklyRepeatMap.has(key)) {
      weeklyRepeatMap.set(key, { merchant, count: 0, total: 0 });
    }
    const entry = weeklyRepeatMap.get(key)!;
    entry.count += 1;
    entry.total += Math.abs(Number(tx.amount ?? 0));
  }
  const weeklyRepeats = Array.from(weeklyRepeatMap.values())
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.total - a.total);

  const budgetSignals = Array.isArray(budgets)
    ? budgets.map((budget) => {
        const planned = calculateBudgetPlanned(budget);
        const actual = calculateBudgetActual(budget);
        const pct = planned > 0 ? (actual / planned) * 100 : 0;
        return {
          category: sanitizeBudgetName(budget),
          pct: Number.isFinite(pct) ? pct : 0,
        };
      })
    : [];

  const overBudget = budgetSignals
    .filter((budget) => budget.pct >= 100)
    .sort((a, b) => b.pct - a.pct);
  const nearBudget = budgetSignals
    .filter((budget) => budget.pct >= 80 && budget.pct < 100)
    .sort((a, b) => b.pct - a.pct);
  const quietCats = budgetSignals
    .filter((budget) => budget.pct > 0 && budget.pct < 20)
    .sort((a, b) => a.pct - b.pct);

  const largeTx = monthExpenses
    .filter((tx) => Math.abs(Number(tx.amount ?? 0)) >= LARGE_TX_THRESHOLD)
    .sort((a, b) => Math.abs(Number(b.amount ?? 0)) - Math.abs(Number(a.amount ?? 0)))[0];

  const dateKeys = new Set<string>();
  for (const tx of txs) {
    const key = tx.dateObj.toDateString();
    dateKeys.add(key);
  }
  let streak = 0;
  while (true) {
    const probe = new Date(now);
    probe.setDate(now.getDate() - streak);
    if (!dateKeys.has(probe.toDateString())) break;
    streak += 1;
  }

  const todayKey = now.toDateString();
  const noSpendToday = !monthExpenses.some((tx) => tx.dateObj.toDateString() === todayKey);

  const goalCandidates = Array.isArray(goals)
    ? goals
        .map((goal) => {
          const title = normalizeName(goal.title, goal.name, 'Goal');
          const target = Number(goal.target_amount ?? 0);
          const saved = Number(goal.saved_amount ?? 0);
          const pct = target > 0 ? (saved / target) * 100 : 0;
          const amountLeft = Math.max(target - saved, 0);
          const status = goal.status ?? 'active';
          return {
            goal: title,
            pct: Number.isFinite(pct) ? pct : 0,
            amountLeft,
            status,
          };
        })
        .filter((goal) => goal.status !== 'archived')
    : [];
  const goalTop = goalCandidates
    .filter((goal) => goal.pct > 0 || goal.amountLeft > 0)
    .sort((a, b) => b.pct - a.pct)[0];

  const upcomingCandidates = Array.isArray(subs)
    ? subs
        .map((sub) => {
          const due = parseDate(sub.next_due_date ?? sub.due_date ?? sub.anchor_date);
          if (!due) return null;
          const merchant = normalizeName(sub.name, sub.vendor);
          const amount = Math.abs(Number(sub.amount ?? 0));
          return { merchant, amount, date: due };
        })
        .filter((item): item is { merchant: string; amount: number; date: Date } => Boolean(item))
    : [];
  const upcomingWindowEnd = new Date(now);
  upcomingWindowEnd.setDate(now.getDate() + UPCOMING_SUB_WINDOW_DAYS);
  const upcomingSub = upcomingCandidates
    .filter((item) => item.date >= now && item.date <= upcomingWindowEnd)
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  const latestExpense = monthExpenses
    .slice()
    .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime())[0];
  const roundUp = latestExpense
    ? (() => {
        const remainder = computeRoundUp(Math.abs(Number(latestExpense.amount ?? 0)));
        if (remainder >= 100) {
          return {
            amount: remainder,
            goal: goalTop?.goal,
          };
        }
        return null;
      })()
    : null;

  const weeklyCategoryMap = new Map<string, { label: string; total: number }>();
  for (const tx of weekExpenses) {
    const category = normalizeName(tx.category, tx.notes, 'Pengeluaran');
    const key = uniqueKey(category);
    const prev = weeklyCategoryMap.get(key);
    if (prev) {
      prev.total += Math.abs(Number(tx.amount ?? 0));
    } else {
      weeklyCategoryMap.set(key, {
        label: category,
        total: Math.abs(Number(tx.amount ?? 0)),
      });
    }
  }
  let weeklyTop: DashboardSignals['weeklyTop'] = null;
  for (const entry of weeklyCategoryMap.values()) {
    if (!weeklyTop || entry.total > weeklyTop.total) {
      weeklyTop = {
        category: entry.label,
        total: entry.total,
      };
    }
  }

  const incomeTotal = monthIncomes.reduce((sum, tx) => sum + Math.abs(Number(tx.amount ?? 0)), 0);
  const expenseTotal = monthExpenses.reduce(
    (sum, tx) => sum + Math.abs(Number(tx.amount ?? 0)),
    0,
  );
  const netMonth = {
    amount: incomeTotal - expenseTotal,
    monthLabel: MONTH_FORMAT.format(now),
  };

  const lowBalanceCandidate = Array.isArray(accounts)
    ? accounts
        .map((account) => ({
          account: normalizeName(account.name, 'Akun'),
          left: Number(account.balance ?? 0),
        }))
        .filter((account) => account.left > 0 && account.left < LOW_BALANCE_THRESHOLD)
        .sort((a, b) => a.left - b.left)[0]
    : null;

  const lastExpense = latestExpense
    ? {
        merchant: normalizeName(
          latestExpense.merchant,
          latestExpense.title,
          latestExpense.notes,
        ),
        amount: Math.abs(Number(latestExpense.amount ?? 0)),
      }
    : null;

  return {
    weeklyRepeats,
    nearBudget,
    overBudget,
    largeTx: largeTx
      ? {
          merchant: normalizeName(largeTx.merchant, largeTx.title, largeTx.notes),
          amount: Math.abs(Number(largeTx.amount ?? 0)),
        }
      : null,
    streak,
    noSpendToday,
    goalTop: goalTop
      ? {
          goal: goalTop.goal,
          pct: goalTop.pct,
          amountLeft: goalTop.amountLeft,
        }
      : null,
    upcomingSub: upcomingSub ?? null,
    roundUp,
    weeklyTop,
    quietCats,
    netMonth,
    lowBalance: lowBalanceCandidate ?? null,
    lastExpense,
  };
}

const TEMPLATE_GROUPS = {
  'weekly-repeats': [
    'Minggu ini ketemu {merchant} {count}×. Dompet: tolong… (total Rp {total}).',
    '{merchant} lagi {count}×? Kamu fans garis keras ya 😆 (total Rp {total}).',
    'Radar cemilan bunyi! {merchant} muncul {count}×, total Rp {total}.',
    'Boba itu manis, cicilan nggak. {merchant} {count}×, Rp {total} 👀.',
    'Kita dukung—asal nabung juga. {merchant} {count}× (Rp {total}).',
  ],
  'near-budget': [
    'Kategori {category} sudah {pct}%. Remnya dicoba dulu, ya 🛑',
    '{category} tinggal dikit lagi. Aku pasang mode hemat? 😉',
    "Dompet bisik: 'pelan-pelan di {category}' ({pct}%).",
    'Check engine: {category} {pct}%. Pit stop dulu?',
  ],
  'over-budget': [
    'Waduh, {category} tembus {pct}%. Kita susun misi penyelamatan? 🚑',
    '{category} sudah lewat garis finish ({pct}%). Gas tabungannya pelan2 dulu.',
    'Alarm dompet: {category} over budget. Mau aku bantu cari pos pengganti?',
    'Overtime di {category} nih. Kita evaluasi bareng?',
  ],
  'large-transaction': [
    'Transaksi jumbo Rp {amount}. Perlu dipecah (split) biar rapi?',
    'Wuih, Rp {amount} sekali gesek. Ini belanja bahagia atau upgrade hidup? 😄',
    'Rp {amount} terdeteksi. Simpen nota ya—biar histori kinclong.',
    'Belanja besar masuk. Mau tandai sebagai one-off?',
  ],
  streak: [
    'Kamu catat {streak} hari berturut-turut. Konsisten parah! 💪',
    'Mantap! {streak} hari non-stop. Dompet auto sayang.',
    'Nyaris jadi atlet pencatat: {streak} hari. Keep it rolling!',
    'Streak {streak} hari! Aku kasih confetti virtual 🎉',
  ],
  'no-spend': [
    'Hari ini nggak belanja. Dompet tepuk tangan 👏',
    'No-spend day! Mari rayakan dengan… tidak belanja lagi 😁',
    'Kosong belanja, penuh bahagia. Nice!',
    'Dompet istirahat. Kamu hebat.',
  ],
  goal: [
    'Goal {goal} sudah {pct}%. Dikit lagi, ayo sprint! 🏁',
    'Kabar baik! {goal} tembus {pct}%. Mau auto-transfer Rp {amount}?',
    '{goal} tercapai! 🎉 Bikin goal baru atau upgrade target?',
    'Progres {goal} sehat ({pct}%). Aku jaga ritmenya ya.',
  ],
  subscription: [
    'Inget ya, {merchant} bakal tagih Rp {amount} {date}. Masih kepake?',
    'Langganan {merchant} datang {date}. Pause dulu atau lanjut?',
    'Reminder: {merchant} (Rp {amount}). Mau auto-siapkan dana?',
    'Tagihan {merchant} sebentar lagi. Biar aman, parkir duitnya?',
  ],
  'round-up': [
    'Receh Rp {amount} nganggur. Aku sweep ke tabungan?',
    'Biar estetik, bulatkan transaksi—lebihkan Rp {amount} ke {goal}?',
    'Ada sisa Rp {amount}. Auto-nabungkan?',
  ],
  'weekly-summary': [
    'Minggu ini top spend: {category} (Rp {total}). Mau batasin minggu depan?',
    'Saldo mingguan aman. Aku siapin challenge mini hemat?',
    'Highlights minggu ini siap! Spoiler: {merchant} sering lewat 😜',
    'Rekap beres. Kita bikin rencana pekanan bareng?',
  ],
  'quiet-category': [
    '{category} sepi bulan ini. Mau kecilkan anggarannya?',
    'Budget {category} nganggur. Pindahin ke {goal}?',
    '{category} adem ayem. Geser dikit ke tabungan?',
  ],
  'net-cashflow': [
    'Net {month}: Rp {amount}. Dompet senyum simpul 😌',
    'Arus kas {month} aman. Mau lock in ke {goal}?',
    'Bulan ini cuan Rp {amount}. Saatnya celebrate murah meriah?',
  ],
  'low-balance': [
    'Saldo akun {account} tinggal Rp {left}. Isi bensin dikit?',
    '{account} menipis (Rp {left}). Transfer dari akun lain?',
  ],
  fallback: [
    '{merchant} memanggil… dompet menangis—tapi bahagia.',
    'Minum boba: +10 joy, -Rp {amount} balance. Worth it?',
    'Kopi itu perlu, over-budget tidak. Santuy ya ☕',
  ],
};

interface QuoteCandidate {
  group: keyof typeof TEMPLATE_GROUPS;
  templateVars: Record<string, string>;
  uniqueKey?: string;
}

const PRIORITY_ORDER: Array<keyof typeof TEMPLATE_GROUPS> = [
  'over-budget',
  'near-budget',
  'weekly-repeats',
  'large-transaction',
  'low-balance',
  'subscription',
  'net-cashflow',
  'weekly-summary',
  'streak',
  'no-spend',
  'quiet-category',
  'round-up',
  'goal',
  'fallback',
];

function pickRandom<T>(items: T[], rng: () => number): T {
  if (!items.length) {
    throw new Error('Cannot pick from empty list');
  }
  const index = Math.floor(rng() * items.length);
  return items[Math.max(0, Math.min(items.length - 1, index))];
}

function buildCandidates(signals: DashboardSignals): Record<string, QuoteCandidate[]> {
  const monthName = MONTH_FORMAT.format(new Date());
  const candidates: Record<string, QuoteCandidate[]> = {
    'over-budget': signals.overBudget.map((item) => ({
      group: 'over-budget',
      uniqueKey: uniqueKey(item.category),
      templateVars: {
        category: item.category,
        pct: formatNumber(Math.round(item.pct)),
      },
    })),
    'near-budget': signals.nearBudget.map((item) => ({
      group: 'near-budget',
      uniqueKey: uniqueKey(item.category),
      templateVars: {
        category: item.category,
        pct: formatNumber(Math.round(item.pct)),
      },
    })),
    'weekly-repeats': signals.weeklyRepeats.map((item) => ({
      group: 'weekly-repeats',
      uniqueKey: uniqueKey(item.merchant),
      templateVars: {
        merchant: item.merchant,
        count: formatNumber(item.count),
        total: formatNumber(item.total),
      },
    })),
    'large-transaction': signals.largeTx
      ? [
          {
            group: 'large-transaction',
            uniqueKey: uniqueKey(signals.largeTx.merchant),
            templateVars: {
              merchant: signals.largeTx.merchant,
              amount: formatNumber(signals.largeTx.amount),
            },
          },
        ]
      : [],
    streak:
      signals.streak >= 2
        ? [
            {
              group: 'streak',
              uniqueKey: 'streak',
              templateVars: { streak: formatNumber(signals.streak) },
            },
          ]
        : [],
    'no-spend': signals.noSpendToday
      ? [
          {
            group: 'no-spend',
            uniqueKey: 'no-spend',
            templateVars: {},
          },
        ]
      : [],
    goal:
      signals.goalTop && (signals.goalTop.pct >= 10 || signals.goalTop.amountLeft > 0)
        ? [
            {
              group: 'goal',
              uniqueKey: uniqueKey(signals.goalTop.goal),
              templateVars: {
                goal: signals.goalTop.goal,
                pct: formatNumber(Math.round(signals.goalTop.pct)),
                amount: formatNumber(Math.max(0, Math.round(signals.goalTop.amountLeft))),
              },
            },
          ]
        : [],
    subscription: signals.upcomingSub
      ? [
          {
            group: 'subscription',
            uniqueKey: uniqueKey(signals.upcomingSub.merchant),
            templateVars: {
              merchant: signals.upcomingSub.merchant,
              amount: formatNumber(signals.upcomingSub.amount),
              date: SHORT_DATE_FORMAT.format(signals.upcomingSub.date),
            },
          },
        ]
      : [],
    'round-up': signals.roundUp
      ? [
          {
            group: 'round-up',
            uniqueKey: 'round-up',
            templateVars: {
              amount: formatNumber(signals.roundUp.amount),
              goal: signals.roundUp.goal ?? 'tabungan',
            },
          },
        ]
      : [],
    'weekly-summary': signals.weeklyTop
      ? [
          {
            group: 'weekly-summary',
            uniqueKey: uniqueKey(signals.weeklyTop.category),
            templateVars: {
              category: signals.weeklyTop.category,
              total: formatNumber(signals.weeklyTop.total),
              merchant: signals.weeklyRepeats[0]?.merchant ?? signals.weeklyTop.category,
            },
          },
        ]
      : [],
    'quiet-category': signals.quietCats.map((item) => ({
      group: 'quiet-category',
      uniqueKey: uniqueKey(item.category),
      templateVars: {
        category: item.category,
        goal: signals.goalTop?.goal ?? 'tabungan',
        pct: formatNumber(Math.round(item.pct)),
      },
    })),
    'net-cashflow': signals.netMonth && Math.abs(signals.netMonth.amount) >= 1000
      ? [
          {
            group: 'net-cashflow',
            uniqueKey: 'net-cashflow',
            templateVars: {
              month: signals.netMonth.monthLabel ?? monthName,
              amount: formatNumber(Math.round(signals.netMonth.amount)),
              goal: signals.goalTop?.goal ?? 'tabungan',
            },
          },
        ]
      : [],
    'low-balance': signals.lowBalance
      ? [
          {
            group: 'low-balance',
            uniqueKey: uniqueKey(signals.lowBalance.account),
            templateVars: {
              account: signals.lowBalance.account,
              left: formatNumber(Math.round(signals.lowBalance.left)),
            },
          },
        ]
      : [],
    fallback: [
      {
        group: 'fallback',
        uniqueKey: 'fallback',
        templateVars: {
          merchant: signals.lastExpense?.merchant ?? 'boba',
          amount: formatNumber(Math.max(0, Math.round(signals.lastExpense?.amount ?? 0))),
        },
      },
    ],
  };

  return candidates;
}

export function generateQuotes(
  signals: DashboardSignals,
  options: { max?: number; random?: () => number } = {},
): QuoteResult[] {
  const rng = options.random ?? Math.random;
  const maxQuotes = options.max ?? 3;
  if (!signals) {
    return generateQuotes({ ...FALLBACK_SIGNALS }, options);
  }

  const candidates = buildCandidates(signals);
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
      const text = fillTemplate(template, candidate.templateVars);
      results.push({
        group,
        text,
        template,
        vars: candidate.templateVars,
      });
      if (candidate.uniqueKey) usedKeys.add(candidate.uniqueKey);
    }
  }

  if (!results.length) {
    const template = TEMPLATE_GROUPS.fallback[0];
    const vars = {
      merchant: signals.lastExpense?.merchant ?? 'boba',
      amount: formatNumber(Math.max(0, Math.round(signals.lastExpense?.amount ?? 0))),
    };
    results.push({
      group: 'fallback',
      text: fillTemplate(template, vars),
      template,
      vars,
    });
  }

  return results.slice(0, maxQuotes);
}

interface QuoteEngineSources {
  transactions: TransactionLike[];
  budgets: BudgetLike[];
  goals: GoalLike[];
  subscriptions: SubscriptionLike[];
  accounts: AccountLike[];
}

interface QuoteEngineCacheEntry {
  expiresAt: number;
  value: QuoteEnginePayload;
}

export interface QuoteEnginePayload {
  fetchedAt: number;
  sources: QuoteEngineSources;
  signals: DashboardSignals;
}

let quoteEngineCache: QuoteEngineCacheEntry | null = null;
let inflightPromise: Promise<QuoteEnginePayload> | null = null;

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function loadSources(): Promise<QuoteEngineSources> {
  const now = new Date();
  const monthPreset = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + UPCOMING_SUB_WINDOW_DAYS);

  const dateFrom = formatDateInput(weekStart);
  const dateTo = formatDateInput(weekEnd);

  const [transactionsRes, budgetsRes, goalsRes, subsRes, accountsRes] = await Promise.allSettled([
    import('./api').then(({ listTransactions }) =>
      listTransactions({ period: { preset: 'month', month: monthPreset }, pageSize: 500, sort: 'date-desc' }),
    ),
    import('./api-budgets').then(({ listBudgets }) =>
      listBudgets({ period: monthPreset, withActivity: true }).catch(() => []),
    ),
    import('./api-goals').then(({ listGoals }) =>
      listGoals({ status: 'active' }).catch(() => ({ items: [] })),
    ),
    import('./api-subscriptions').then(({ listSubscriptions }) =>
      listSubscriptions({ status: 'active', dueFrom: dateFrom, dueTo: dateTo }).catch(() => []),
    ),
    import('./api').then(({ listAccounts }) => listAccounts().catch(() => [])),
  ]);

  const transactions =
    transactionsRes.status === 'fulfilled'
      ? Array.isArray((transactionsRes.value as any)?.rows)
        ? ((transactionsRes.value as any).rows as TransactionLike[])
        : ((transactionsRes.value as unknown as TransactionLike[]) ?? [])
      : [];

  const budgets =
    budgetsRes.status === 'fulfilled'
      ? (budgetsRes.value as BudgetLike[])
      : [];

  const goals =
    goalsRes.status === 'fulfilled'
      ? ((goalsRes.value as { items?: GoalLike[] }).items ?? [])
      : [];

  const subscriptions =
    subsRes.status === 'fulfilled'
      ? (subsRes.value as SubscriptionLike[])
      : [];

  const accounts =
    accountsRes.status === 'fulfilled'
      ? (accountsRes.value as AccountLike[])
      : [];

  return { transactions, budgets, goals, subscriptions, accounts };
}

export async function loadQuoteEngine({ force = false } = {}): Promise<QuoteEnginePayload> {
  const now = Date.now();
  if (!force && quoteEngineCache && quoteEngineCache.expiresAt > now) {
    return quoteEngineCache.value;
  }
  if (!force && inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = (async () => {
    try {
      const sources = await loadSources();
      const signals = getDashboardSignals({
        fromTx: sources.transactions,
        budgets: sources.budgets,
        goals: sources.goals,
        subs: sources.subscriptions,
        accounts: sources.accounts,
      });
      const payload: QuoteEnginePayload = {
        fetchedAt: Date.now(),
        sources,
        signals,
      };
      quoteEngineCache = {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value: payload,
      };
      return payload;
    } catch (error) {
      if (typeof console !== 'undefined') {
        console.error('[HW][quotes] gagal memuat data quote', error);
      }
      const signals = getDashboardSignals({
        fromTx: [],
        budgets: [],
        goals: [],
        subs: [],
        accounts: [],
      });
      return {
        fetchedAt: Date.now(),
        sources: {
          transactions: [],
          budgets: [],
          goals: [],
          subscriptions: [],
          accounts: [],
        },
        signals,
      };
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}

export const highlightKeys = HIGHLIGHT_KEYS;
