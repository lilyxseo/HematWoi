import { formatCurrency } from "./format";

const LARGE_TX_THRESHOLD = 500_000;
const LOW_BALANCE_THRESHOLD = 50_000;
const UPCOMING_WINDOW_DAYS = 7;
const CACHE_WINDOW_MS = 5 * 60 * 1000;

const signalCache = new Map();

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
}

function endOfWeek(date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function toISODateKey(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toMonthKey(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 7);
}

function daysBetween(dateA, dateB) {
  if (!dateA || !dateB) return Number.POSITIVE_INFINITY;
  const start = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate());
  const end = new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate());
  const diff = end.getTime() - start.getTime();
  return Math.round(diff / 86_400_000);
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolveMerchant(tx) {
  return (
    tx?.merchant_name ||
    tx?.merchant ||
    tx?.title ||
    tx?.notes ||
    tx?.note ||
    tx?.description ||
    "Tempat favorit"
  );
}

function resolveCategory(budget) {
  return (
    budget?.category ||
    budget?.category_name ||
    budget?.category_label ||
    budget?.name ||
    budget?.title ||
    null
  );
}

function resolveAccountName(account) {
  return account?.name || account?.label || account?.account || account?.account_name || null;
}

function resolveAccountBalance(account) {
  if (!account) return null;
  const fields = [
    account.balance,
    account.amount,
    account.available,
    account.current_balance,
    account.current,
  ];
  const value = fields.find((val) => Number.isFinite(Number(val)));
  return value != null ? Number(value) : null;
}

function resolveGoal(goal) {
  if (!goal) return null;
  const target =
    safeNumber(
      goal.target_amount ?? goal.target ?? goal.targetAmount ?? goal.goal ?? goal.planned ?? 0,
      0,
    );
  const saved = safeNumber(goal.saved_amount ?? goal.saved ?? goal.balance ?? goal.progress ?? 0, 0);
  if (target <= 0) return null;
  const name = goal.name || goal.title || goal.label || "Goal";
  const pct = Math.min(200, Math.round((saved / target) * 100));
  const remaining = Math.max(target - saved, 0);
  return {
    id: goal.id ?? name,
    goal: name,
    pct,
    saved,
    target,
    remaining,
  };
}

function resolveSubscription(sub) {
  if (!sub) return null;
  const name = sub.name || sub.title || sub.merchant || sub.vendor || "Langganan";
  const amount = safeNumber(sub.amount ?? sub.price ?? sub.nominal ?? 0, 0);

  let due = null;
  const directDate =
    sub.next_due_date ||
    sub.next_charge_date ||
    sub.charge_date ||
    sub.date ||
    sub.next_date ||
    sub.expected_date ||
    null;
  if (directDate) {
    const parsed = new Date(directDate);
    if (!Number.isNaN(parsed.getTime())) {
      due = parsed;
    }
  }

  if (!due && sub.due_date) {
    const parsed = new Date(sub.due_date);
    if (!Number.isNaN(parsed.getTime())) {
      due = parsed;
    }
  }

  if (!due && sub.dueDay) {
    const today = new Date();
    const [month, day] = String(sub.dueDay)
      .split("-")
      .map((part) => Number(part));
    if (Number.isFinite(month) && Number.isFinite(day)) {
      let guess = new Date(today.getFullYear(), month - 1, day);
      if (guess < today) {
        guess = new Date(today.getFullYear() + 1, month - 1, day);
      }
      due = guess;
    } else if (Number.isFinite(day)) {
      let guess = new Date(today.getFullYear(), today.getMonth(), day);
      if (guess < today) {
        guess = new Date(today.getFullYear(), today.getMonth() + 1, day);
      }
      due = guess;
    }
  }

  if (!due && sub.period && sub.anchor_date) {
    const anchor = new Date(sub.anchor_date);
    if (!Number.isNaN(anchor.getTime())) {
      due = anchor;
    }
  }

  if (!due && sub.period && sub.created_at) {
    const anchor = new Date(sub.created_at);
    if (!Number.isNaN(anchor.getTime())) {
      due = anchor;
    }
  }

  return {
    name,
    amount,
    due,
  };
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat("id-ID", { month: "long" }).format(date);
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function buildFingerprint({ fromTx = [], budgets = [], goals = [], subs = [], accounts = [] }) {
  const parts = [];
  const take = (list, mapper) =>
    list
      .slice(0, 12)
      .map((item) => mapper(item))
      .join("|");

  parts.push(`tx:${fromTx.length}:${take(fromTx, (t) => `${t.id ?? ""}-${t.date ?? ""}-${t.amount ?? ""}`)}`);
  parts.push(
    `budgets:${budgets.length}:${take(budgets, (b) => `${b.id ?? ""}-${b.month ?? ""}-${b.category ?? b.category_name ?? ""}`)}`,
  );
  parts.push(`goals:${goals.length}:${take(goals, (g) => `${g.id ?? ""}-${g.updated_at ?? g.saved ?? 0}`)}`);
  parts.push(`subs:${subs.length}:${take(subs, (s) => `${s.id ?? ""}-${s.next_due_date ?? s.dueDay ?? ""}`)}`);
  parts.push(`accounts:${accounts.length}:${take(accounts, (a) => `${a.id ?? ""}-${a.balance ?? a.amount ?? 0}`)}`);
  return parts.join("::");
}

function selectFallback(transactions = []) {
  if (!transactions.length) {
    return { merchant: "Boba", amount: 0 };
  }
  const sorted = [...transactions].sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    return db - da;
  });
  const tx = sorted.find((item) => item.type === "expense") || sorted[0];
  return {
    merchant: resolveMerchant(tx),
    amount: safeNumber(tx.amount, 0),
  };
}

export function getDashboardSignals({
  fromTx = [],
  budgets = [],
  goals = [],
  subs = [],
  accounts = [],
  now = new Date(),
  largeTxThreshold = LARGE_TX_THRESHOLD,
  lowBalanceThreshold = LOW_BALANCE_THRESHOLD,
} = {}) {
  const fingerprint = buildFingerprint({ fromTx, budgets, goals, subs, accounts });
  const cached = signalCache.get(fingerprint);
  const nowTs = Date.now();
  if (cached && nowTs - cached.ts < CACHE_WINDOW_MS) {
    return cached.payload;
  }

  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const monthKey = toMonthKey(now);

  const weeklyMerchant = new Map();
  const weeklyByCategory = new Map();
  const monthExpenseByCategory = new Map();
  const monthIncome = { total: 0 };
  const monthExpense = { total: 0 };
  const daySet = new Set();
  let hasExpenseToday = false;

  let largestTx = null;
  let lastExpenseTx = null;

  for (const tx of Array.isArray(fromTx) ? fromTx : []) {
    const dateKey = toISODateKey(tx.date);
    if (dateKey) {
      daySet.add(dateKey);
      if (toISODateKey(tx.date) === toISODateKey(now)) {
        hasExpenseToday = true;
      }
    }
    const amount = safeNumber(tx.amount, 0);
    const txDate = new Date(tx.date || 0);
    const isExpense = tx.type === "expense";

    if (!Number.isNaN(txDate.getTime()) && isExpense) {
      if (!largestTx || amount > largestTx.amount) {
        largestTx = {
          merchant: resolveMerchant(tx),
          amount,
          date: txDate,
          category: tx.category || tx.category_name || null,
          account: tx.account_name || tx.account || null,
        };
      }
      if (!lastExpenseTx || txDate > lastExpenseTx.date) {
        lastExpenseTx = {
          merchant: resolveMerchant(tx),
          amount,
          date: txDate,
        };
      }
    }

    if (Number.isNaN(txDate.getTime())) continue;

    if (txDate >= weekStart && txDate <= weekEnd && isExpense) {
      const merchant = resolveMerchant(tx);
      const prev = weeklyMerchant.get(merchant) || { merchant, count: 0, total: 0 };
      prev.count += 1;
      prev.total += amount;
      weeklyMerchant.set(merchant, prev);

      const categoryKey = tx.category || tx.category_name || "Lainnya";
      const catPrev = weeklyByCategory.get(categoryKey) || { category: categoryKey, total: 0 };
      catPrev.total += amount;
      weeklyByCategory.set(categoryKey, catPrev);
    }

    const month = toMonthKey(txDate);
    if (month === monthKey) {
      if (isExpense) {
        const categoryKey = tx.category || tx.category_name || "Lainnya";
        const prev = monthExpenseByCategory.get(categoryKey) || { category: categoryKey, total: 0 };
        prev.total += amount;
        monthExpenseByCategory.set(categoryKey, prev);
        monthExpense.total += amount;
      } else if (tx.type === "income") {
        monthIncome.total += amount;
      }
    }
  }

  const weeklyRepeats = Array.from(weeklyMerchant.values())
    .filter((item) => item.count >= 2)
    .sort((a, b) => b.total - a.total || b.count - a.count)
    .slice(0, 5);

  const weeklyTop =
    Array.from(weeklyByCategory.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 1)[0] || null;

  const noSpendToday = !hasExpenseToday;

  const sortedDays = Array.from(daySet)
    .map((key) => new Date(key))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  let streak = 0;
  if (sortedDays.length) {
    streak = 1;
    for (let i = 1; i < sortedDays.length; i += 1) {
      const diff = daysBetween(sortedDays[i], sortedDays[i - 1]);
      if (diff === 1) {
        streak += 1;
      } else {
        break;
      }
    }
  }

  const budgetsThisMonth = (Array.isArray(budgets) ? budgets : []).filter((b) => {
    if (!b) return false;
    const bMonth = b.month ? String(b.month).slice(0, 7) : monthKey;
    return !monthKey || bMonth === monthKey;
  });

  const budgetSignals = budgetsThisMonth
    .map((budget) => {
      const category = resolveCategory(budget);
      if (!category) return null;
      const planned = safeNumber(
        budget.amount_planned ?? budget.limit ?? budget.cap ?? budget.amount ?? budget.planned ?? 0,
        0,
      );
      if (planned <= 0) return null;
      const actual = monthExpenseByCategory.get(category)?.total ?? safeNumber(budget.actual ?? budget.used ?? 0, 0);
      const pct = planned > 0 ? Math.round((actual / planned) * 100) : 0;
      return {
        id: budget.id ?? category,
        category,
        planned,
        actual,
        pct,
      };
    })
    .filter(Boolean);

  const overBudget = budgetSignals
    .filter((item) => item.pct >= 100)
    .sort((a, b) => b.pct - a.pct);

  const nearBudget = budgetSignals
    .filter((item) => item.pct >= 80 && item.pct < 100)
    .sort((a, b) => b.pct - a.pct);

  const quietCats = budgetSignals
    .filter((item) => item.pct > 0 && item.pct < 20)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5);

  const goalCandidates = (Array.isArray(goals) ? goals : [])
    .map((goal) => resolveGoal(goal))
    .filter(Boolean)
    .sort((a, b) => b.pct - a.pct || a.remaining - b.remaining);
  const goalTop = goalCandidates[0] || null;

  const subsCandidates = (Array.isArray(subs) ? subs : [])
    .map((item) => resolveSubscription(item))
    .filter((item) => item && item.due)
    .map((item) => ({ ...item, days: daysBetween(now, item.due) }))
    .filter((item) => item.days >= 0 && item.days <= UPCOMING_WINDOW_DAYS)
    .sort((a, b) => a.due - b.due);
  const upcomingSub = subsCandidates[0] || null;

  const roundUp = (() => {
    if (!lastExpenseTx) return null;
    const remainder = lastExpenseTx.amount % 1000;
    if (remainder <= 0 || remainder >= 900) return null;
    const suggestion = 1000 - remainder;
    if (suggestion < 100) return null;
    return {
      amount: suggestion,
      goal: goalTop?.goal ?? null,
    };
  })();

  const netMonth = (() => {
    const net = monthIncome.total - monthExpense.total;
    if (!Number.isFinite(net) || (monthIncome.total === 0 && monthExpense.total === 0)) return null;
    return {
      month: formatMonthLabel(now),
      amount: net,
    };
  })();

  const lowBalance = (() => {
    const list = (Array.isArray(accounts) ? accounts : [])
      .map((account) => {
        const name = resolveAccountName(account);
        const balance = resolveAccountBalance(account);
        if (name && balance != null) {
          return { account: name, left: balance };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.left - b.left);
    const candidate = list.find((item) => item.left < lowBalanceThreshold);
    return candidate || null;
  })();

  const payload = {
    weeklyRepeats,
    nearBudget,
    overBudget,
    largeTx:
      largestTx && largestTx.amount >= (Number.isFinite(largeTxThreshold) ? largeTxThreshold : LARGE_TX_THRESHOLD)
        ? largestTx
        : null,
    streak,
    noSpendToday,
    goalTop,
    upcomingSub,
    roundUp,
    weeklyTop,
    quietCats,
    netMonth,
    lowBalance,
    fallback: selectFallback(fromTx),
  };

  signalCache.set(fingerprint, { ts: nowTs, payload });
  return payload;
}

const TEMPLATE_GROUPS = {
  weeklyRepeats: [
    "Minggu ini ketemu {merchant} {count}×. Dompet: tolong… (total Rp {total}).",
    "{merchant} lagi {count}×? Kamu fans garis keras ya 😆 (total Rp {total}).",
    "Radar cemilan bunyi! {merchant} muncul {count}×, total Rp {total}.",
    "Boba itu manis, cicilan nggak. {merchant} {count}×, Rp {total} 👀.",
    "Kita dukung—asal nabung juga. {merchant} {count}× (Rp {total}).",
  ],
  nearBudget: [
    "Kategori {category} sudah {pct}%. Remnya dicoba dulu, ya 🛑",
    "{category} tinggal dikit lagi. Aku pasang mode hemat? 😉",
    "Dompet bisik: ‘pelan-pelan di {category}’ ({pct}%).",
    "Check engine: {category} {pct}%. Pit stop dulu?",
  ],
  overBudget: [
    "Waduh, {category} tembus {pct}%. Kita susun misi penyelamatan? 🚑",
    "{category} sudah lewat garis finish ({pct}%). Gas tabungannya pelan2 dulu.",
    "Alarm dompet: {category} over budget. Mau aku bantu cari pos pengganti?",
    "Overtime di {category} nih. Kita evaluasi bareng?",
  ],
  largeTx: [
    "Transaksi jumbo Rp {amount}. Perlu dipecah (split) biar rapi?",
    "Wuih, Rp {amount} sekali gesek. Ini belanja bahagia atau upgrade hidup? 😄",
    "Rp {amount} terdeteksi. Simpen nota ya—biar histori kinclong.",
    "Belanja besar masuk. Mau tandai sebagai one-off?",
  ],
  streak: [
    "Kamu catat {streak} hari berturut-turut. Konsisten parah! 💪",
    "Mantap! {streak} hari non-stop. Dompet auto sayang.",
    "Nyaris jadi atlet pencatat: {streak} hari. Keep it rolling!",
    "Streak {streak} hari! Aku kasih confetti virtual 🎉",
  ],
  noSpendToday: [
    "Hari ini nggak belanja. Dompet tepuk tangan 👏",
    "No-spend day! Mari rayakan dengan… tidak belanja lagi 😁",
    "Kosong belanja, penuh bahagia. Nice!",
    "Dompet istirahat. Kamu hebat.",
  ],
  goal: [
    "Goal {goal} sudah {pct}%. Dikit lagi, ayo sprint! 🏁",
    "Kabar baik! {goal} tembus {pct}%. Mau auto-transfer Rp {amount}?",
    "{goal} tercapai! 🎉 Bikin goal baru atau upgrade target?",
    "Progres {goal} sehat ({pct}%). Aku jaga ritmenya ya.",
  ],
  subscription: [
    "Inget ya, {merchant} bakal tagih Rp {amount} {date}. Masih kepake?",
    "Langganan {merchant} datang {date}. Pause dulu atau lanjut?",
    "Reminder: {merchant} (Rp {amount}). Mau auto-siapkan dana?",
    "Tagihan {merchant} sebentar lagi. Biar aman, parkir duitnya?",
  ],
  roundUp: [
    "Receh Rp {amount} nganggur. Aku sweep ke tabungan?",
    "Biar estetik, bulatkan transaksi—lebihkan Rp {amount} ke {goal}?",
    "Ada sisa Rp {amount}. Auto-nabungkan?",
  ],
  weeklySummary: [
    "Minggu ini top spend: {category} (Rp {total}). Mau batasin minggu depan?",
    "Saldo mingguan aman. Aku siapin challenge mini hemat?",
    "Highlights minggu ini siap! Spoiler: {merchant} sering lewat 😜",
    "Rekap beres. Kita bikin rencana pekanan bareng?",
  ],
  quiet: [
    "{category} sepi bulan ini. Mau kecilkan anggarannya?",
    "Budget {category} nganggur. Pindahin ke {goal}?",
    "{category} adem ayem. Geser dikit ke tabungan?",
  ],
  net: [
    "Net {month}: Rp {amount}. Dompet senyum simpul 😌",
    "Arus kas {month} aman. Mau lock in ke {goal}?",
    "Bulan ini cuan Rp {amount}. Saatnya celebrate murah meriah?",
  ],
  lowBalance: [
    "Saldo akun {account} tinggal Rp {left}. Isi bensin dikit?",
    "{account} menipis (Rp {left}). Transfer dari akun lain?",
  ],
  humor: [
    "{merchant} memanggil… dompet menangis—tapi bahagia.",
    "Minum boba: +10 joy, -Rp {amount} balance. Worth it?",
    "Kopi itu perlu, over-budget tidak. Santuy ya ☕",
  ],
};

function pickRandom(list = []) {
  if (!list.length) return "";
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

export function fillTemplate(template, vars) {
  if (typeof template !== "string") return "";
  const merged = vars || {};
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = merged[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

const PRIORITY = [
  "overBudget",
  "nearBudget",
  "weeklyRepeats",
  "largeTx",
  "lowBalance",
  "upcomingSub",
  "netMonth",
  "weeklyTop",
  "streak",
  "noSpendToday",
  "quietCats",
  "roundUp",
  "goalTop",
  "humor",
];

const GROUP_META = {
  overBudget: { id: "#3", templateKey: "overBudget", emphasis: ["pct"] },
  nearBudget: { id: "#2", templateKey: "nearBudget", emphasis: ["pct"] },
  weeklyRepeats: { id: "#1", templateKey: "weeklyRepeats", emphasis: ["total"] },
  largeTx: { id: "#4", templateKey: "largeTx", emphasis: ["amount"] },
  streak: { id: "#5", templateKey: "streak", emphasis: [] },
  noSpendToday: { id: "#6", templateKey: "noSpendToday", emphasis: [] },
  goalTop: { id: "#7", templateKey: "goal", emphasis: ["pct", "amount"] },
  upcomingSub: { id: "#8", templateKey: "subscription", emphasis: ["amount", "date"] },
  roundUp: { id: "#9", templateKey: "roundUp", emphasis: ["amount"] },
  weeklyTop: { id: "#10", templateKey: "weeklySummary", emphasis: ["total"] },
  quietCats: { id: "#11", templateKey: "quiet", emphasis: [] },
  netMonth: { id: "#12", templateKey: "net", emphasis: ["amount"] },
  lowBalance: { id: "#13", templateKey: "lowBalance", emphasis: ["left"] },
  humor: { id: "#14", templateKey: "humor", emphasis: ["amount"] },
};

function toCurrency(value) {
  return formatCurrency(value ?? 0, "IDR");
}

export function generateQuotes(signals = {}, { max = 3 } = {}) {
  const results = [];
  const usedCategories = new Set();
  const usedMerchants = new Set();

  function pushQuote(key, vars, candidate = {}) {
    const meta = GROUP_META[key];
    if (!meta) return;
    const template = pickRandom(TEMPLATE_GROUPS[meta.templateKey]);
    const text = fillTemplate(template, vars);
    const emphasis = (meta.emphasis || [])
      .map((field) => vars[field])
      .filter((value) => typeof value === "string" && value.trim() !== "");
    results.push({
      group: meta.id,
      text,
      emphasis,
      source: candidate,
    });
  }

  for (const key of PRIORITY) {
    if (results.length >= max) break;

    switch (key) {
      case "overBudget": {
        for (const item of signals.overBudget || []) {
          if (results.length >= max) break;
          if (usedCategories.has(item.category)) continue;
          pushQuote(key, {
            category: item.category,
            pct: String(item.pct),
          }, item);
          usedCategories.add(item.category);
        }
        break;
      }
      case "nearBudget": {
        for (const item of signals.nearBudget || []) {
          if (results.length >= max) break;
          if (usedCategories.has(item.category)) continue;
          pushQuote(key, {
            category: item.category,
            pct: String(item.pct),
          }, item);
          usedCategories.add(item.category);
        }
        break;
      }
      case "weeklyRepeats": {
        for (const item of signals.weeklyRepeats || []) {
          if (results.length >= max) break;
          if (usedMerchants.has(item.merchant)) continue;
          pushQuote(key, {
            merchant: item.merchant,
            count: String(item.count),
            total: toCurrency(item.total),
          }, item);
          usedMerchants.add(item.merchant);
        }
        break;
      }
      case "largeTx": {
        if (signals.largeTx && !usedMerchants.has(signals.largeTx.merchant)) {
          pushQuote(key, {
            amount: toCurrency(signals.largeTx.amount),
          }, signals.largeTx);
          usedMerchants.add(signals.largeTx.merchant);
        }
        break;
      }
      case "lowBalance": {
        if (signals.lowBalance) {
          pushQuote(key, {
            account: signals.lowBalance.account,
            left: toCurrency(signals.lowBalance.left),
          }, signals.lowBalance);
        }
        break;
      }
      case "upcomingSub": {
        if (signals.upcomingSub && !usedMerchants.has(signals.upcomingSub.name)) {
          pushQuote(key, {
            merchant: signals.upcomingSub.name,
            amount: toCurrency(signals.upcomingSub.amount),
            date: signals.upcomingSub.due ? formatShortDate(signals.upcomingSub.due) : "segera",
          }, signals.upcomingSub);
          usedMerchants.add(signals.upcomingSub.name);
        }
        break;
      }
      case "netMonth": {
        if (signals.netMonth) {
          pushQuote(key, {
            month: signals.netMonth.month,
            amount: toCurrency(signals.netMonth.amount),
            goal: signals.goalTop?.goal ?? "tabungan",
          }, signals.netMonth);
        }
        break;
      }
      case "weeklyTop": {
        if (signals.weeklyTop) {
          if (usedCategories.has(signals.weeklyTop.category)) break;
          pushQuote(key, {
            category: signals.weeklyTop.category,
            total: toCurrency(signals.weeklyTop.total),
            merchant: signals.weeklyRepeats?.[0]?.merchant ?? signals.fallback?.merchant ?? "merchant favorit",
          }, signals.weeklyTop);
          usedCategories.add(signals.weeklyTop.category);
        }
        break;
      }
      case "streak": {
        if (signals.streak >= 3) {
          pushQuote(key, {
            streak: String(signals.streak),
          }, { streak: signals.streak });
        }
        break;
      }
      case "noSpendToday": {
        if (signals.noSpendToday) {
          pushQuote(key, {});
        }
        break;
      }
      case "quietCats": {
        for (const item of signals.quietCats || []) {
          if (results.length >= max) break;
          if (usedCategories.has(item.category)) continue;
          pushQuote(key, {
            category: item.category,
            goal: signals.goalTop?.goal ?? "goal lain",
          }, item);
          usedCategories.add(item.category);
        }
        break;
      }
      case "roundUp": {
        if (signals.roundUp) {
          pushQuote(key, {
            amount: toCurrency(signals.roundUp.amount),
            goal: signals.roundUp.goal ?? "tabungan",
          }, signals.roundUp);
        }
        break;
      }
      case "goalTop": {
        if (signals.goalTop) {
          const vars = {
            goal: signals.goalTop.goal,
            pct: String(signals.goalTop.pct),
            amount: toCurrency(Math.max(0, signals.goalTop.target - signals.goalTop.saved)),
          };
          pushQuote(key, vars, signals.goalTop);
        }
        break;
      }
      case "humor": {
        if (results.length >= max) break;
        const fallback = signals.fallback || { merchant: "Boba", amount: 0 };
        pushQuote(key, {
          merchant: fallback.merchant,
          amount: toCurrency(fallback.amount),
        }, fallback);
        break;
      }
      default:
        break;
    }
  }

  if (!results.length) {
    const fallback = signals.fallback || { merchant: "Boba", amount: 0 };
    pushQuote("humor", {
      merchant: fallback.merchant,
      amount: toCurrency(fallback.amount),
    }, fallback);
  }

  return results.slice(0, max);
}

export const QUOTE_ENGINE_CONSTANTS = {
  LARGE_TX_THRESHOLD,
  LOW_BALANCE_THRESHOLD,
  UPCOMING_WINDOW_DAYS,
  CACHE_WINDOW_MS,
};
