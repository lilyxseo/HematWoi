import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

type WebhookBody = {
  id?: string | number;
  message_id?: string | number;
  msg_id?: string | number;
  sender?: string;
  phone?: string;
  number?: string;
  device?: string;
  message?: string;
  text?: string;
  msg?: string;
  from_me?: boolean;
  fromMe?: boolean;
  isMe?: boolean;
  status?: boolean | string;
  key?: { fromMe?: boolean };
  data?: {
    id?: string | number;
    message_id?: string | number;
    sender?: string;
    phone?: string;
    number?: string;
    device?: string;
    message?: string;
    text?: string;
    msg?: string;
    from_me?: boolean;
    fromMe?: boolean;
    isMe?: boolean;
    [key: string]: JsonValue;
  };
  [key: string]: JsonValue;
};

type ParsedTransaction = {
  categoryName: string;
  accountName: string;
  amount: number;
  title: string;
  date: string;
};
type ParsedTransactionError = { error: "INVALID_DATE" };


type ParsedSmartTransaction = {
  accountName: string | null;
  amount: number;
  title: string;
  date: string;
};
type NaturalTransactionType = "income" | "expense" | "transfer";
type ParsedNaturalTransaction = {
  type: NaturalTransactionType;
  accountName: string | null;
  amount: number;
  title: string;
  date: string;
};

type ParsedTransfer = {
  amount: number;
  fromAccountName: string;
  toAccountName: string;
};
type DebtType = "debt" | "receivable";
type DebtAction = "tambah" | "bayar";
type ParsedDebtCommand = {
  action: DebtAction;
  debtType: DebtType;
  partyName: string;
  amount: number;
  accountName: string;
  date: string;
};
type EditField = "amount" | "title" | "category" | "account" | "date";
type ParsedEditTransactionCommand = {
  number: number;
  field: EditField;
  value: string | number;
};

type BalanceSummary = {
  cash: number;
  nonCash: number;
  total: number;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    balance: number;
  }>;
};

type BudgetInfo = {
  categoryNames: string[];
  planned: number;
  used: number;
  remaining: number;
  percentage: number;
};
type BudgetPeriodType = "monthly";
type BudgetPeriodKey = "current" | "previous" | "next";
type BudgetPeriodCommand = { periodType: BudgetPeriodType; period: BudgetPeriodKey };
type BudgetPeriodRange = {
  start: string;
  end: string;
  periodMonth: string;
  periodType: BudgetPeriodType;
  period: BudgetPeriodKey;
};
type BudgetPeriodItem = {
  categoryNames: string[];
  planned: number;
  used: number;
  remaining: number;
  percentage: number;
  createdAt: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FONNTE_TOKEN = Deno.env.get("FONNTE_TOKEN") ?? "";

const BOT_PREFIXES = ["🤖", "✅", "❌", "⚠️", "💰", "ℹ️", "📊", "📚", "🏦", "📌", "🗑️", "🧾", "🎯", "🔁", "🏓", "📋", "📆", "🗓️", "📘"];
const MENU_COMMANDS = new Set(["menu", "help", "bantuan", ".menu"]);

const SMART_TRANSACTION_BLOCKED_COMMANDS = new Set([
  "menu",
  "help",
  "bantuan",
  ".menu",
  "contoh",
  "saldo",
  "summary",
  "history",
  "budget",
  "hutang",
  "piutang",
  "tf",
  "ai",
  "minggu",
  "bulan",
  "top",
  "cashflow",
  "hapus",
  "akun",
  "kategori",
  "info",
  "ping",
]);
const NATURAL_RESERVED_COMMANDS = new Set([
  "menu", "help", "bantuan", ".menu", "contoh", "saldo", "summary", "history", "riwayat", "budget", "hutang",
  "tambah hutang", "tambah piutang", "bayar hutang", "bayar piutang", "tf", "ai", "minggu ini", "bulan ini",
  "top kategori", "cashflow", "kategori", "akun", "info", "ping", "hapus", "undo",
]);


const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function isAISuggestionNumber(text: string): boolean {
  return /^(10|[1-9])$/.test(text.trim());
}

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const noPlus = trimmed.startsWith("+62") ? trimmed.slice(1) : trimmed;
  const digits = noPlus.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

function extractSender(body: WebhookBody): string {
  const raw = String(
    body.sender ?? body.phone ?? body.number ?? body.data?.sender ?? body.data?.phone ?? body.data?.number ?? "",
  );
  return normalizePhone(raw);
}

function extractMessage(body: WebhookBody): string {
  return String(body.message ?? body.text ?? body.msg ?? body.data?.message ?? body.data?.text ?? body.data?.msg ?? "").trim();
}

function extractDevice(body: WebhookBody): string {
  const raw = String(body.device ?? body.data?.device ?? "");
  return normalizePhone(raw);
}

function extractWaMessageId(body: WebhookBody, sender: string, message: string): string {
  const raw =
    body.id ??
    body.message_id ??
    body.msg_id ??
    body.data?.id ??
    body.data?.message_id ??
    `${sender}-${message}-${Date.now()}`;
  return String(raw);
}

function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatSignedIDR(amount: number): string {
  if (amount < 0) return `Minus ${formatIDR(Math.abs(amount))}`;
  return formatIDR(amount);
}

function findBestCategoryMatch(question: string, categories: Array<Record<string, JsonValue>>): Record<string, JsonValue> | null {
  const q = normalizeText(question);
  if (!q) return null;
  const normalized = categories
    .map((c) => ({ row: c, name: normalizeText(String(c.name ?? "")) }))
    .filter((c) => c.name.length > 0);
  const exact = normalized.find((c) => c.name === q);
  if (exact) return exact.row;
  const contains = normalized.find((c) => q.includes(c.name));
  if (contains) return contains.row;
  const partial = normalized.find((c) => c.name.includes(q) || q.split(" ").some((w) => w.length >= 3 && c.name.includes(w)));
  return partial?.row ?? null;
}

function findBestAccountMatch(question: string, accounts: Array<Record<string, JsonValue>>): Record<string, JsonValue> | null {
  const q = normalizeText(question);
  if (!q) return null;
  const normalized = accounts
    .map((a) => ({ row: a, name: normalizeText(String(a.name ?? "")) }))
    .filter((a) => a.name.length > 0);
  const exact = normalized.find((a) => a.name === q);
  if (exact) return exact.row;
  const contains = normalized.find((a) => q.includes(a.name));
  if (contains) return contains.row;
  return normalized.find((a) => a.name.includes(q))?.row ?? null;
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^0-9]/g, "");
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function parseOptionalDateToken(raw: string): string | null {
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const now = new Date();
  const jakartaNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const year = jakartaNow.getFullYear();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isDateToken(token: string): boolean {
  return /^\d{1,2}\/\d{1,2}$/.test(token.trim());
}

function parseCustomDateToken(token: string): string | null {
  const match = token.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(day) || !Number.isInteger(month)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const now = new Date();
  const jakartaNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const year = jakartaNow.getFullYear();
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== (month - 1) ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getTodayJakarta(): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(now);
}

function getMonthStart(date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" });
  const ym = fmt.format(date);
  return `${ym}-01`;
}

function getNextMonthStart(date = new Date()): string {
  const jakarta = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const next = new Date(jakarta.getFullYear(), jakarta.getMonth() + 1, 1);
  const y = String(next.getFullYear());
  const m = String(next.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function getWeekStartJakarta(date = new Date()): string {
  const jakarta = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const day = jakarta.getDay();
  const offset = day === 0 ? 6 : day - 1;
  jakarta.setDate(jakarta.getDate() - offset);
  const y = String(jakarta.getFullYear());
  const m = String(jakarta.getMonth() + 1).padStart(2, "0");
  const d = String(jakarta.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getNextWeekStartJakarta(date = new Date()): string {
  const weekStart = new Date(`${getWeekStartJakarta(date)}T00:00:00+07:00`);
  weekStart.setDate(weekStart.getDate() + 7);
  const y = String(weekStart.getFullYear());
  const m = String(weekStart.getMonth() + 1).padStart(2, "0");
  const d = String(weekStart.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function replyWhatsApp(target: string, message: string): Promise<void> {
  if (!FONNTE_TOKEN || !target || !message) return;
  const form = new FormData();
  form.append("target", target);
  form.append("message", message);

  await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: { Authorization: FONNTE_TOKEN },
    body: form,
  });
}

async function logMessage(input: {
  wa_message_id: string;
  phone: string;
  user_id: string | null;
  raw_text: string;
  parsed: Record<string, JsonValue>;
  status: "success" | "failed";
  error_message: string | null;
}): Promise<void> {
  const { error } = await supabase.from("whatsapp_message_logs").insert(input);
  if (error) console.error("[LOG_MESSAGE_ERROR]", error);
}

async function getWaUser(phone: string): Promise<{ user_id: string } | null> {
  const { data, error } = await supabase
    .from("whatsapp_users")
    .select("user_id")
    .eq("phone", phone)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findCategory(userId: string, name: string): Promise<{ id: string; name: string; type: string } | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,type")
    .eq("user_id", userId)
    .ilike("name", name.trim())
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findAccount(userId: string, name: string): Promise<{ id: string; name: string; type: string } | null> {
  const { data, error } = await getAccountsBaseQuery(userId, "id,name,type")
    .ilike("name", name.trim())
    .maybeSingle();
  if (error) throw error;
  return data;
}

function getAccountsBaseQuery(userId: string, columns = "*") {
  console.log("[ACCOUNT QUERY]", {
    userId,
  });

  return supabase
    .from("accounts")
    .select(columns)
    .eq("user_id", userId);
}


async function getRealtimeBalanceSummary(userId: string): Promise<BalanceSummary> {
  const { data, error } = await supabase.rpc("get_account_type_balances", { p_user_id: userId });
  if (error) throw new Error(`RPC_BALANCE_FAILED: ${error.message}`);
  console.log("[RPC BALANCE]", data);

  const { data: accountRows, error: accountError } = await getAccountsBaseQuery(userId, "id,name,type");
  if (accountError) throw accountError;

  const row = Array.isArray(data) ? (data[0] ?? {}) : (data ?? {});
  const cashBalance = Number((row as Record<string, JsonValue>).cash_balance ?? 0);
  const nonCashBalance = Number((row as Record<string, JsonValue>).non_cash_balance ?? 0);
  const totalBalance = Number((row as Record<string, JsonValue>).total_balance ?? cashBalance + nonCashBalance);

  const accountMap = new Map<string, { id: string; name: string; type: string; balance: number }>();
  for (const account of (accountRows ?? []) as Array<Record<string, JsonValue>>) {
    const accountId = String(account.id ?? "");
    if (!accountId) continue;
    accountMap.set(accountId, {
      id: accountId,
      name: String(account.name ?? "-"),
      type: String(account.type ?? "non_cash"),
      balance: 0,
    });
  }

  for (const item of (Array.isArray(data) ? data : [data]) as Array<Record<string, JsonValue>>) {
    const accountId = String(item.account_id ?? item.id ?? "");
    if (!accountId || !accountMap.has(accountId)) continue;
    const current = accountMap.get(accountId)!;
    accountMap.set(accountId, { ...current, balance: Number(item.balance ?? item.current_balance ?? 0) });
  }

  if (Array.isArray(data) && data.length > 1) {
    let cash = 0;
    let nonCash = 0;
    for (const item of data as Array<Record<string, JsonValue>>) {
      const type = String(item.type ?? item.account_type ?? "").toLowerCase();
      const amount = Number(item.balance ?? item.total ?? 0);
      if (type.includes("non")) nonCash += amount;
      else if (type.includes("cash")) cash += amount;
    }
    if (cash || nonCash) return { cash, nonCash, total: cash + nonCash, accounts: [...accountMap.values()] };
  }

  return { cash: cashBalance, nonCash: nonCashBalance, total: totalBalance, accounts: [...accountMap.values()] };
}

async function getRpcBalanceData(userId: string): Promise<Array<Record<string, JsonValue>>> {
  const { data, error } = await supabase.rpc("get_account_type_balances", { p_user_id: userId });
  if (error) throw new Error(`RPC_BALANCE_FAILED: ${error.message}`);
  console.log("[RPC BALANCE RAW]", data);
  if (!data) return [];
  return Array.isArray(data) ? data as Array<Record<string, JsonValue>> : [data as Record<string, JsonValue>];
}


type AiIntent = "SPENDING_TOP" | "SPENDING_CATEGORY" | "BUDGET_STATUS" | "BALANCE_SAFETY" | "SUBSCRIPTION_SUMMARY" | "DEBT_STATUS" | "GOAL_PROGRESS" | "BUY_DECISION" | "ACCOUNT_EXPENSE" | "ACCOUNT_BALANCE" | "TITLE_TOTAL" | "TRANSACTION_COUNT" | "ACCOUNT_USAGE" | "TITLE_FREQUENCY" | "TOP_CATEGORY" | "CATEGORY_FREQUENCY" | "BOROS_CHECK" | "CASHFLOW" | "UNKNOWN";
type AiSuggestionItem = { no: number; question: string };
type AiSuggestionSession = {
  id: string;
  created_at: string;
  parsed: {
    command?: string;
    sessionId?: string;
    suggestions?: AiSuggestionItem[];
    active?: boolean;
  };
};

const AI_SUGGESTION_COMMANDS = new Set(["ai", "ai help", "ai menu", "ai contoh", "tanya ai"]);
const AI_SUGGESTION_SESSION_TTL_MS = 10 * 60 * 1000;
const AI_STATIC_SUGGESTIONS: string[] = [
  "berapa transaksi minggu ini",
  "berapa pengeluaran seabank",
  "sisa budget makan",
  "kategori paling sering",
  "merchant paling sering",
  "berapa pengeluaran hari ini",
  "berapa pengeluaran makan minggu ini",
  "akun cash sering dipakai untuk apa",
  "apakah bulan ini boros",
  "sisa budget motor",
  "berapa total es budeh bulan ini",
  "saldo seabank",
  "transaksi terakhir",
  "top kategori bulan ini",
];

function shuffleArray<T>(arr: T[]): T[] {
  const cloned = [...arr];
  for (let i = cloned.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

async function getLastAISuggestionSession(
  userId: string,
  phone: string,
): Promise<{ session: AiSuggestionSession | null; isExpired: boolean }> {
  const { data: logs, error } = await supabase
    .from("whatsapp_message_logs")
    .select("id,created_at,parsed")
    .eq("user_id", userId)
    .eq("phone", phone)
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;

  const session = ((logs ?? []) as AiSuggestionSession[]).find((log) =>
    log.parsed?.command === "ai_suggestion" && log.parsed?.active !== false
  ) ?? null;
  if (!session) return { session: null, isExpired: false };

  const isExpired = Date.now() - new Date(session.created_at).getTime() > AI_SUGGESTION_SESSION_TTL_MS;
  if (isExpired) return { session: null, isExpired: true };

  return { session, isExpired: false };
}

async function handleAISuggestionPick(
  userId: string,
  phone: string,
  numberText: string,
): Promise<{ reply: string; parsedLog: Record<string, JsonValue> }> {
  const selectedNumber = Number(numberText);
  const { session, isExpired } = await getLastAISuggestionSession(userId, phone);
  if (isExpired) {
    return {
      reply: ["⚠️ Sesi AI sudah habis.", "", "Ketik:", "ai"].join("\n"),
      parsedLog: { command: "ai_suggestion_pick", number: selectedNumber, question: null, session: "expired" },
    };
  }

  if (!session) {
    return {
      reply: ["⚠️ Belum ada daftar pertanyaan AI.", "", "Ketik:", "ai"].join("\n"),
      parsedLog: { command: "ai_suggestion_pick", number: selectedNumber, question: null, session: "missing" },
    };
  }

  const suggestions = Array.isArray(session.parsed?.suggestions) ? session.parsed.suggestions : [];
  const selected = suggestions.find((item) => Number(item.no) === selectedNumber);
  if (!selected) {
    return {
      reply: ["⚠️ Nomor pertanyaan tidak tersedia.", "", "Pilih nomor dari daftar AI terakhir."].join("\n"),
      parsedLog: { command: "ai_suggestion_pick", number: selectedNumber, question: null, sourceSessionId: session.parsed?.sessionId ?? null },
    };
  }

  const selectedQuestion = String(selected.question ?? "").trim();
  const ai = await handleAiQuestion(userId, selectedQuestion);
  return {
    reply: ai.reply,
    parsedLog: {
      command: "ai_suggestion_pick",
      number: selectedNumber,
      question: selectedQuestion,
      sourceSessionId: session.parsed?.sessionId ?? null,
      intent: ai.intent,
      keyword: ai.keyword ?? null,
      period: ai.period ?? null,
    },
  };
}

type PeriodType = "month" | "week";

function getMonthRangeJakarta(
  date = new Date(),
): { start: string; end: string; label: string; daysInPeriod: number; daysPassed: number; daysRemaining: number } {
  const jakarta = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const year = jakarta.getFullYear();
  const month = jakarta.getMonth();
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const next = new Date(year, month + 1, 1);
  const end = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
  const daysInPeriod = new Date(year, month + 1, 0).getDate();
  const daysPassed = jakarta.getDate();
  const daysRemaining = Math.max(0, daysInPeriod - daysPassed);
  return { start, end, label: "bulan ini", daysInPeriod, daysPassed, daysRemaining };
}

function getWeekRangeJakarta(
  date = new Date(),
): { start: string; end: string; label: string; daysInPeriod: number; daysPassed: number; daysRemaining: number } {
  const start = getWeekStartJakarta(date);
  const end = getNextWeekStartJakarta(date);
  const jakarta = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const day = jakarta.getDay();
  const passed = day === 0 ? 7 : day;
  return { start, end, label: "minggu ini", daysInPeriod: 7, daysPassed: passed, daysRemaining: Math.max(0, 7 - passed) };
}



type TransactionSummary = {
  income: number;
  expense: number;
  net: number;
  transactionCount: number;
  topExpenseCategoryName: string;
  topExpenseCategoryAmount: number;
};

function getPreviousMonthRangeJakarta(
  date = new Date(),
): { start: string; end: string; label: string; daysInPeriod: number; daysPassed: number; daysRemaining: number } {
  const jakarta = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const year = jakarta.getFullYear();
  const month = jakarta.getMonth();
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);
  const daysInPeriod = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
  const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
  return { start, end, label: "bulan lalu", daysInPeriod, daysPassed: daysInPeriod, daysRemaining: 0 };
}

async function getTransactionSummaryByRange(userId: string, start: string, end: string): Promise<TransactionSummary> {
  const { data: txs, error } = await supabase
    .from("transactions")
    .select("amount,type,category_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("date", start)
    .lt("date", end);
  if (error) throw error;

  let income = 0;
  let expense = 0;
  const catMap = new Map<string, number>();

  for (const tx of (txs ?? []) as Array<Record<string, JsonValue>>) {
    const amount = Number(tx.amount ?? 0);
    const type = String(tx.type ?? "");
    if (type === "income") income += amount;
    if (type === "expense") {
      expense += amount;
      const cid = String(tx.category_id ?? "");
      if (cid) catMap.set(cid, (catMap.get(cid) ?? 0) + amount);
    }
  }

  let topExpenseCategoryName = "-";
  let topExpenseCategoryAmount = 0;
  if (catMap.size > 0) {
    const [topId, topAmount] = [...catMap.entries()].sort((a, b) => b[1] - a[1])[0];
    const { data: cat } = await supabase.from("categories").select("name").eq("id", topId).maybeSingle();
    topExpenseCategoryName = String(cat?.name ?? "-");
    topExpenseCategoryAmount = Number(topAmount ?? 0);
  }

  return {
    income,
    expense,
    net: income - expense,
    transactionCount: (txs ?? []).length,
    topExpenseCategoryName,
    topExpenseCategoryAmount,
  };
}

async function getTopExpenseCategoriesByRange(userId: string, start: string, end: string, limit = 5): Promise<Array<{ name: string; total: number }>> {
  const { data: txs, error } = await supabase
    .from("transactions")
    .select("amount,category_id")
    .eq("user_id", userId)
    .eq("type", "expense")
    .is("deleted_at", null)
    .gte("date", start)
    .lt("date", end);
  if (error) throw error;

  const map = new Map<string, number>();
  for (const tx of (txs ?? []) as Array<Record<string, JsonValue>>) {
    const cid = String(tx.category_id ?? "");
    if (!cid) continue;
    map.set(cid, (map.get(cid) ?? 0) + Number(tx.amount ?? 0));
  }

  const ids = [...map.keys()];
  const nameMap = new Map<string, string>();
  if (ids.length > 0) {
    const { data: cats } = await supabase.from("categories").select("id,name").in("id", ids);
    for (const c of (cats ?? []) as Array<Record<string, JsonValue>>) {
      nameMap.set(String(c.id), String(c.name ?? "-"));
    }
  }

  return [...map.entries()]
    .map(([id, total]) => ({ name: nameMap.get(id) ?? "-", total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

function buildQuickStatsReply(type: "weekly" | "monthly" | "top_category", summary: TransactionSummary | null, topCategories: Array<{ name: string; total: number }>, daysPassed = 0): string {
  if (type === "top_category") {
    if (topCategories.length === 0) return "🏆 *Top Kategori Bulan Ini*\n\nBelum ada pengeluaran bulan ini.";
    return [
      "🏆 *Top Kategori Bulan Ini*",
      "",
      ...topCategories.map((row, i) => `${i + 1}. ${row.name} — ${formatIDR(row.total)}`),
    ].join("\n");
  }

  if (!summary) return "⚠️ Data statistik tidak tersedia.";

  const title = type === "weekly" ? "📊 *Minggu Ini*" : "📊 *Bulan Ini*";
  const lines = [
    title,
    "",
    `Pemasukan: ${formatIDR(summary.income)}`,
    `Pengeluaran: ${formatIDR(summary.expense)}`,
    `Selisih: ${formatIDR(summary.net)}`,
    `Transaksi: ${summary.transactionCount} data`,
  ];

  if (type === "monthly") {
    const avgDaily = daysPassed > 0 ? summary.expense / daysPassed : 0;
    lines.push(`Rata-rata/hari: ${formatIDR(avgDaily)}`);
  }

  lines.push("", "Kategori terbesar:", `${summary.topExpenseCategoryName} — ${formatIDR(summary.topExpenseCategoryAmount)}`);

  if (type === "weekly") lines.push("", summary.net >= 0 ? "✅ Minggu ini masih positif." : "⚠️ Pengeluaran minggu ini lebih besar dari pemasukan.");
  return lines.join("\n");
}

function buildCashflowReply(current: TransactionSummary, previous: TransactionSummary): string {
  const change = previous.expense === 0
    ? (current.expense > 0 ? 100 : 0)
    : ((current.expense - previous.expense) / previous.expense) * 100;
  const trend = change >= 0 ? "naik" : "turun";
  return [
    "📈 *Cashflow*",
    "",
    "Bulan Ini:",
    `Pemasukan: ${formatIDR(current.income)}`,
    `Pengeluaran: ${formatIDR(current.expense)}`,
    `Selisih: ${formatIDR(current.net)}`,
    "",
    "Bulan Lalu:",
    `Pemasukan: ${formatIDR(previous.income)}`,
    `Pengeluaran: ${formatIDR(previous.expense)}`,
    `Selisih: ${formatIDR(previous.net)}`,
    "",
    `Pengeluaran ${trend}: ${Math.abs(change).toFixed(1)}%`,
  ].join("\n");
}
function extractPeriod(text: string): PeriodType {
  if (/(minggu|pekan)/i.test(text)) return "week";
  return "month";
}

function detectAiIntent(question: string): AiIntent {
  const q = normalizeText(question);
  if (/(sisa\s+budget|budget|aman|hampir habis|over budget)/.test(q)) return "BUDGET_STATUS";
  if (/(top kategori|kategori paling boros|kategori terbesar|pengeluaran terbesar kategori|kategori paling besar)/.test(q)) return "TOP_CATEGORY";
  if (/(apakah bulan ini boros|bulan ini boros|apakah saya boros|boros)/.test(q)) return "BOROS_CHECK";
  if (/(kategori paling sering|kategori yang paling sering|kategori paling banyak)/.test(q)) return "CATEGORY_FREQUENCY";
  if (/(pengeluaran|total)/.test(q) && /(kategori|category|jajan)/.test(q)) return "SPENDING_CATEGORY";
  if (/saldo/.test(q)) return "ACCOUNT_BALANCE";
  if (/(pengeluaran|total)/.test(q) && /akun/.test(q)) return "ACCOUNT_EXPENSE";
  if (/akun/.test(q) && /sering dipakai/.test(q)) return "ACCOUNT_USAGE";
  if (/(seberapa sering|berapa kali|frekuensi)/.test(q)) return "TITLE_FREQUENCY";
  if (/cashflow/.test(q)) return "CASHFLOW";
  if (/(pengeluaran|total)/.test(q)) return "TITLE_TOTAL";
  if (/(kategori|category|jajan)/.test(q)) return "SPENDING_CATEGORY";
  if (/(paling boros|pengeluaran terbesar|terbesar apa|top kategori)/.test(q)) return "SPENDING_TOP";
  if (/transaksi terakhir/.test(q)) return "UNKNOWN";
  if (/transaksi/.test(q) && /(berapa|jumlah|hitung)/.test(q)) return "TRANSACTION_COUNT";
  if (/(aman|boleh).*(beli)/.test(q) || /(beli).*(\d|rb|ribu|jt|juta)/.test(q)) return "BUY_DECISION";
  if (/(saldo).*aman|cukup sampai (akhir bulan|gajian)/.test(q)) return "BALANCE_SAFETY";
  if (/(subscription|langganan)/.test(q)) return "SUBSCRIPTION_SUMMARY";
  if (/(hutang|piutang)/.test(q)) return "DEBT_STATUS";
  if (/(goal|goals|target|progress)/.test(q)) return "GOAL_PROGRESS";
  return "UNKNOWN";
}

function detectPeriodFromQuestion(question: string): { label: "hari ini" | "minggu ini" | "bulan ini" | "bulan lalu"; startDate: string; endDate: string } {
  const q = normalizeText(question);
  if (/hari ini/.test(q)) {
    const today = getTodayJakarta();
    const next = new Date(`${today}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const endDate = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
    return { label: "hari ini", startDate: today, endDate };
  }
  if (/minggu ini|pekan ini/.test(q)) {
    const p = getWeekRangeJakarta();
    return { label: "minggu ini", startDate: p.start, endDate: p.end };
  }
  if (/bulan lalu/.test(q)) {
    const p = getPreviousMonthRangeJakarta();
    return { label: "bulan lalu", startDate: p.start, endDate: p.end };
  }
  const p = getMonthRangeJakarta();
  return { label: "bulan ini", startDate: p.start, endDate: p.end };
}

async function getDynamicAISuggestions(userId: string): Promise<string[]> {
  const { data: txs, error: txError } = await supabase
    .from("transactions")
    .select("title,category_id,account_id,amount,type,date,inserted_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("inserted_at", { ascending: false })
    .limit(200);
  if (txError) throw txError;
  const rows = (txs ?? []) as Array<Record<string, JsonValue>>;
  if (rows.length === 0) return [];

  const categoryIds = Array.from(new Set(rows.map((r) => String(r.category_id ?? "")).filter(Boolean)));
  const accountIds = Array.from(new Set(rows.map((r) => String(r.account_id ?? "")).filter(Boolean)));
  const { data: categories } = categoryIds.length > 0 ? await supabase.from("categories").select("id,name").in("id", categoryIds) : { data: [] };
  const { data: accounts } = accountIds.length > 0 ? await supabase.from("accounts").select("id,name").in("id", accountIds) : { data: [] };

  const catMap = new Map<string, string>();
  for (const c of (categories ?? []) as Array<Record<string, JsonValue>>) catMap.set(String(c.id ?? ""), String(c.name ?? "").trim());
  const accMap = new Map<string, string>();
  for (const a of (accounts ?? []) as Array<Record<string, JsonValue>>) accMap.set(String(a.id ?? ""), String(a.name ?? "").trim());

  const categoryCount = new Map<string, number>();
  const accountCount = new Map<string, number>();
  const titleCount = new Map<string, number>();
  for (const tx of rows) {
    const catName = catMap.get(String(tx.category_id ?? ""));
    const accountName = accMap.get(String(tx.account_id ?? ""));
    const title = String(tx.title ?? "").trim().toLowerCase();
    if (catName) categoryCount.set(catName, (categoryCount.get(catName) ?? 0) + 1);
    if (accountName) accountCount.set(accountName, (accountCount.get(accountName) ?? 0) + 1);
    if (title && title.length >= 3) titleCount.set(title, (titleCount.get(title) ?? 0) + 1);
  }

  const topCategories = [...categoryCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
  const topAccounts = [...accountCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
  const topTitles = [...titleCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name]) => name);

  const out: string[] = [];
  for (const category of topCategories) {
    out.push(`berapa pengeluaran ${category} bulan ini`, `sisa budget ${category}?`, `apakah budget ${category} aman?`, `berapa pengeluaran ${category} minggu ini`);
  }
  for (const account of topAccounts) {
    out.push(`pengeluaran ${account} minggu ini berapa?`, `pengeluaran ${account} bulan ini berapa?`, `saldo ${account} berapa?`, `akun ${account} sering dipakai untuk apa?`);
  }
  for (const title of topTitles) {
    out.push(`berapa total ${title} bulan ini?`, `seberapa sering saya transaksi ${title}?`, `berapa pengeluaran ${title} minggu ini?`);
  }
  return out;
}

async function getRandomAISuggestions(userId: string, count = 10): Promise<AiSuggestionItem[]> {
  const dynamic = await getDynamicAISuggestions(userId);
  const uniquePool = Array.from(new Set([...AI_STATIC_SUGGESTIONS, ...dynamic].map((q) => q.trim()).filter(Boolean)))
    .filter((q) => detectAiIntent(q) !== "UNKNOWN");
  return shuffleArray(uniquePool).slice(0, count).map((question, idx) => ({ no: idx + 1, question }));
}

function buildAISuggestionMessage(suggestions: AiSuggestionItem[]): string {
  const lines = suggestions.map((s) => `${s.no}. ${s.question.charAt(0).toUpperCase()}${s.question.slice(1)}${/[?!.]$/.test(s.question) ? "" : "?"}`);
  return [
    "🤖 *AI Finance Assistant*",
    "",
    "Pilih pertanyaan atau ketik bebas:",
    "",
    ...lines,
    "",
    "Balas angka:",
    "1",
    "",
    "Atau tanya langsung:",
    "berapa jajan bulan ini",
  ].join("\n");
}

function extractAmountFromText(text: string): number {
  const q = normalizeText(text);
  const m = q.match(/(\d+[\d.,]*)\s*(rb|ribu|jt|juta|k)?/i);
  if (!m) return 0;
  const base = Number(m[1].replace(/[^\d]/g, ""));
  if (!Number.isFinite(base) || base <= 0) return 0;
  const unit = (m[2] ?? "").toLowerCase();
  if (unit === "rb" || unit === "ribu" || unit === "k") return base * 1000;
  if (unit === "jt" || unit === "juta") return base * 1000000;
  return base;
}

async function getCategoryExpenseTotal(userId: string, question: string): Promise<{ categoryName: string | null; total: number; periodLabel: string }> {
  const period = extractPeriod(question) === "week" ? getWeekRangeJakarta() : getMonthRangeJakarta();
  const { data: categories, error: catErr } = await supabase.from("categories").select("id,name").eq("user_id", userId).eq("type", "expense");
  if (catErr) throw catErr;

  const q = normalizeText(question);
  let selected: Record<string, JsonValue> | null = null;
  for (const c of (categories ?? []) as Array<Record<string, JsonValue>>) {
    const name = normalizeText(String(c.name ?? ""));
    if (name && q.includes(name)) {
      selected = c;
      break;
    }
  }
  if (!selected) return { categoryName: null, total: 0, periodLabel: period.label };

  const { data: txs, error: txErr } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("type", "expense")
    .eq("category_id", String(selected.id))
    .is("deleted_at", null)
    .gte("date", period.start)
    .lt("date", period.end);
  if (txErr) throw txErr;

  const total = (txs ?? []).reduce((a, b: Record<string, JsonValue>) => a + Number(b.amount ?? 0), 0);
  return { categoryName: String(selected.name ?? "-"), total, periodLabel: period.label };
}

async function getTopExpenseCategories(userId: string): Promise<Array<{ name: string; total: number }>> {
  const period = getMonthRangeJakarta();
  const { data: txs, error } = await supabase
    .from("transactions")
    .select("amount,category_id")
    .eq("user_id", userId)
    .eq("type", "expense")
    .is("deleted_at", null)
    .gte("date", period.start)
    .lt("date", period.end);
  if (error) throw error;

  const map = new Map<string, number>();
  for (const tx of (txs ?? []) as Array<Record<string, JsonValue>>) {
    const cid = String(tx.category_id ?? "");
    if (!cid) continue;
    map.set(cid, (map.get(cid) ?? 0) + Number(tx.amount ?? 0));
  }

  const ids = [...map.keys()];
  const nameMap = new Map<string, string>();
  if (ids.length > 0) {
    const { data: cats } = await supabase.from("categories").select("id,name").in("id", ids);
    for (const c of (cats ?? []) as Array<Record<string, JsonValue>>) {
      nameMap.set(String(c.id), String(c.name));
    }
  }

  return [...map.entries()]
    .map(([id, total]) => ({ name: nameMap.get(id) ?? "-", total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);
}

async function getBalanceSafety(userId: string): Promise<{ total: number; avgDaily: number; safeDays: number; daysRemaining: number }> {
  const balance = await getRealtimeBalanceSummary(userId);
  const period = getMonthRangeJakarta();
  const { data: txs, error } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("type", "expense")
    .is("deleted_at", null)
    .gte("date", period.start)
    .lt("date", period.end);
  if (error) throw error;
  const totalExpense = (txs ?? []).reduce((a, b: Record<string, JsonValue>) => a + Number(b.amount ?? 0), 0);
  const avgDaily = period.daysPassed > 0 ? totalExpense / period.daysPassed : 0;
  const safeDays = avgDaily > 0 ? Math.floor(balance.total / avgDaily) : 999;
  return { total: balance.total, avgDaily, safeDays, daysRemaining: period.daysRemaining };
}

async function getSubscriptionSummary(userId: string): Promise<{ monthlyCharge: number; activeNames: string[] }> {
  const period = getMonthRangeJakarta();
  const { data: subs, error: sErr } = await supabase.from("subscriptions").select("id,name,is_active,status").eq("user_id", userId);
  if (sErr) throw sErr;

  const active = (subs ?? []).filter((s: Record<string, JsonValue>) => s.is_active === true || String(s.status ?? "").toLowerCase() === "active");
  const activeIds = active.map((s: Record<string, JsonValue>) => String(s.id));
  let monthlyCharge = 0;

  if (activeIds.length > 0) {
    const { data: charges, error: cErr } = await supabase
      .from("subscription_charges")
      .select("amount,subscription_id,charge_date,date")
      .eq("user_id", userId)
      .in("subscription_id", activeIds)
      .gte("charge_date", period.start)
      .lt("charge_date", period.end);
    if (cErr) throw cErr;
    monthlyCharge = (charges ?? []).reduce((a, c: Record<string, JsonValue>) => a + Number(c.amount ?? 0), 0);
  }

  return { monthlyCharge, activeNames: active.map((s: Record<string, JsonValue>) => String(s.name ?? "-")) };
}

async function getDebtStatus(userId: string): Promise<Array<{ name: string; remaining: number; type: string }>> {
  const { data: debts, error } = await supabase
    .from("debts")
    .select("id,name,person_name,counterparty_name,type,amount,total_amount,is_paid,status,remaining_amount")
    .eq("user_id", userId);
  if (error) throw error;

  return (debts ?? [])
    .filter((d: Record<string, JsonValue>) => !(d.is_paid === true || String(d.status ?? "").toLowerCase() === "paid"))
    .map((d: Record<string, JsonValue>) => ({
      name: String(d.name ?? d.person_name ?? d.counterparty_name ?? "-"),
      remaining: Number(d.remaining_amount ?? d.amount ?? d.total_amount ?? 0),
      type: String(d.type ?? "debt"),
    }));
}

async function getGoalProgress(userId: string, question: string): Promise<Array<{ name: string; target: number; current: number; percentage: number }>> {
  const { data: goals, error } = await supabase.from("goals").select("id,name,target_amount,amount_target,current_amount").eq("user_id", userId);
  if (error) throw error;

  const q = normalizeText(question);
  const filtered = (goals ?? []).filter((g: Record<string, JsonValue>) => q.includes(normalizeText(String(g.name ?? ""))) || /goals|goal|progress|target/.test(q));
  const rows = filtered.length > 0 ? filtered : (goals ?? []);
  const goalIds = rows.map((g: Record<string, JsonValue>) => String(g.id));
  const progressMap = new Map<string, number>();

  if (goalIds.length > 0) {
    const { data: entries } = await supabase.from("goal_entries").select("goal_id,amount").in("goal_id", goalIds).eq("user_id", userId);
    for (const e of (entries ?? []) as Array<Record<string, JsonValue>>) {
      progressMap.set(String(e.goal_id), (progressMap.get(String(e.goal_id)) ?? 0) + Number(e.amount ?? 0));
    }
  }

  return rows.map((g: Record<string, JsonValue>) => {
    const target = Number(g.target_amount ?? g.amount_target ?? 0);
    const current = Number(g.current_amount ?? progressMap.get(String(g.id)) ?? 0);
    return { name: String(g.name ?? "-"), target, current, percentage: target > 0 ? (current / target) * 100 : 0 };
  });
}

async function getBuyDecision(userId: string, question: string): Promise<{ amount: number; verdict: string; reason: string }> {
  const amount = extractAmountFromText(question);
  const safety = await getBalanceSafety(userId);
  const projectedNeed = safety.avgDaily * safety.daysRemaining;
  const after = safety.total - amount;
  if (amount <= 0) return { amount: 0, verdict: "hati-hati", reason: "Nominal belum terbaca" };
  if (after >= projectedNeed * 1.2) return { amount, verdict: "aman", reason: "Saldo setelah beli masih lebih dari kebutuhan sampai akhir bulan" };
  if (after >= projectedNeed) return { amount, verdict: "hati-hati", reason: "Masih cukup, tapi tipis untuk sisa bulan ini" };
  return { amount, verdict: "tidak disarankan", reason: "Berisiko mengganggu kebutuhan sampai akhir bulan" };
}

async function handleAiFinanceChat(userId: string, question: string): Promise<{ reply: string; intent: AiIntent; keyword?: string | null; period?: string }> {
  const q = normalizeText(question);
  const period = detectPeriodFromQuestion(question);
  let intent = detectAiIntent(question);
  const { data: categories } = await supabase.from("categories").select("id,name").eq("user_id", userId).eq("type", "expense");
  const balanceSummary = await getRealtimeBalanceSummary(userId);
  const categoryList = (categories ?? []) as Array<Record<string, JsonValue>>;
  const accountList = balanceSummary.accounts as Array<Record<string, JsonValue>>;
  const matchedCategory = findBestCategoryMatch(question, categoryList);
  const matchedAccount = findBestAccountMatch(question, accountList);
  const extractEntityKeyword = (text: string): string => {
    let k = text.replace(/\?/g, "");
    k = k.replace(/^.*(total|pengeluaran|transaksi|beli)\s+/i, "");
    k = k.replace(/\b(saya|untuk|dari|di|pada)\b/gi, "");
    k = k.replace(/\b(hari ini|minggu ini|bulan ini|bulan lalu)\b/gi, "");
    return k.trim();
  };
  const extractTitleKeyword = (text: string): string => {
    const cleaned = normalizeText(text).replace(/\?/g, "").trim();
    const match = cleaned.match(/(?:transaksi|beli|jajan|total)\s+(.+)$/i);
    if (!match) return "";
    return match[1]
      .replace(/\b(saya|untuk|dari|di|pada)\b/gi, "")
      .replace(/\b(hari ini|minggu ini|bulan ini|bulan lalu)\b/gi, "")
      .trim();
  };
  const titleFrequencyKeyword = /(seberapa sering|berapa kali|frekuensi)/.test(q) ? extractTitleKeyword(question) : "";
  const isTopCategoryQuestion = /(top kategori|kategori paling|kategori terbesar|pengeluaran terbesar kategori)/.test(q);
  const isBorosQuestion = /(apakah bulan ini boros|bulan ini boros|apakah saya boros|boros)/.test(q);
  const isCategoryFrequencyQuestion = /(kategori paling sering|kategori yang paling sering|kategori paling banyak)/.test(q);

  // Priority:
  // 1 BUDGET_STATUS, 2 TOP_CATEGORY, 3 BOROS_CHECK, 4 CATEGORY_FREQUENCY, 5 ACCOUNT_BALANCE,
  // 6 ACCOUNT_USAGE, 7 CATEGORY_EXPENSE, 8 ACCOUNT_EXPENSE, 9 TITLE_FREQUENCY, 10 TITLE_TOTAL,
  // 11 TRANSACTION_COUNT, 12 CASHFLOW, 13 fallback
  if (/(budget|sisa budget|aman|hampir habis|over budget)/.test(q)) intent = "BUDGET_STATUS";
  else if (isTopCategoryQuestion) intent = "TOP_CATEGORY";
  else if (isBorosQuestion) intent = "BOROS_CHECK";
  else if (isCategoryFrequencyQuestion) intent = "CATEGORY_FREQUENCY";
  else if (/saldo/.test(q)) intent = "ACCOUNT_BALANCE";
  else if (/akun/.test(q) && /sering dipakai/.test(q)) intent = "ACCOUNT_USAGE";
  else if (/(pengeluaran|total)/.test(q) && matchedCategory) intent = "SPENDING_CATEGORY";
  else if (/(pengeluaran|total)/.test(q) && matchedAccount) intent = "ACCOUNT_EXPENSE";
  else if (/(seberapa sering|berapa kali|frekuensi)/.test(q) && titleFrequencyKeyword) intent = "TITLE_FREQUENCY";
  else if (/(pengeluaran|total)/.test(q) && !isTopCategoryQuestion && !isBorosQuestion && !isCategoryFrequencyQuestion) intent = "TITLE_TOTAL";
  else if (/transaksi/.test(q) && /(berapa|jumlah|hitung)/.test(q) && !titleFrequencyKeyword) intent = "TRANSACTION_COUNT";
  else if (/cashflow/.test(q)) intent = "CASHFLOW";
  else intent = "UNKNOWN";
  const keywordForLog = intent === "TITLE_FREQUENCY" ? titleFrequencyKeyword : extractEntityKeyword(question);
  console.log("[AI ENTITY DETECT]", {
    question,
    detectedCategory: matchedCategory ? String(matchedCategory.name ?? "-") : null,
    detectedAccount: matchedAccount ? String(matchedAccount.name ?? "-") : null,
    detectedMerchant: keywordForLog || null,
    intent,
  });
  console.log("[AI INTENT]", { question, intent, keyword: keywordForLog, period: period.label });
  console.log({ command: "ai_question", question, intent, period: period.label });

  if (intent === "UNKNOWN") {
      return {
      intent,
      keyword: keywordForLog || null,
      period: period.label,
      reply: [
        "🤖 Saya belum paham pertanyaan itu.",
        "",
        "Ketik *ai* untuk melihat contoh pertanyaan.",
      ].join("\n"),
    };
  }
  if (intent === "TOP_CATEGORY") {
    const tops = await getTopExpenseCategoriesByRange(userId, period.startDate, period.endDate, 5);
    if (tops.length === 0) return { intent, period: period.label, reply: "🤖 *AI Finance Chat*\n\nBelum ada pengeluaran bulan ini." };
    const lines = tops.map((row, i) => `${i + 1}. ${row.name} — ${formatIDR(row.total)}`).join("\n");
    return { intent, period: period.label, reply: `🤖 *AI Finance Chat*\n\n🏆 Top kategori ${period.label}:\n\n${lines}` };
  }
  if (intent === "CATEGORY_FREQUENCY") {
    const { data: txs, error } = await supabase.from("transactions").select("category_id").eq("user_id", userId).eq("type", "expense").is("deleted_at", null).gte("date", period.startDate).lt("date", period.endDate);
    if (error) throw error;
    const freqMap = new Map<string, number>();
    for (const tx of (txs ?? []) as Array<Record<string, JsonValue>>) {
      const cid = String(tx.category_id ?? "");
      if (!cid) continue;
      freqMap.set(cid, (freqMap.get(cid) ?? 0) + 1);
    }
    const ids = [...freqMap.keys()];
    const { data: cats } = ids.length > 0 ? await supabase.from("categories").select("id,name").in("id", ids) : { data: [] };
    const nameMap = new Map<string, string>();
    for (const cat of (cats ?? []) as Array<Record<string, JsonValue>>) nameMap.set(String(cat.id ?? ""), String(cat.name ?? "-"));
    const lines = [...freqMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count], i) => `${i + 1}. ${nameMap.get(id) ?? "-"} — ${count} transaksi`);
    return { intent, period: period.label, reply: `🤖 *AI Finance Chat*\n\nKategori paling sering ${period.label}:\n\n${lines.join("\n") || "Belum ada pengeluaran bulan ini."}` };
  }
  if (intent === "BOROS_CHECK") {
    const summary = await getTransactionSummaryByRange(userId, period.startDate, period.endDate);
    const monthRange = getMonthRangeJakarta();
    const daysPassed = Math.max(1, monthRange.daysPassed);
    const avgDailyExpense = summary.expense / daysPassed;
    const projectedExpense = avgDailyExpense * monthRange.daysInPeriod;
    const ratio = summary.income > 0 ? summary.expense / summary.income : null;
    let status = "✅ Bulan ini masih aman.";
    if (ratio !== null) {
      if (ratio >= 0.9) status = "⚠️ Bulan ini mulai boros.";
      else if (ratio >= 0.7) status = "⚠️ Perlu hati-hati, pengeluaran mulai tinggi.";
    } else {
      const balance = await getRealtimeBalanceSummary(userId);
      if (balance.total < projectedExpense) status = "⚠️ Bulan ini mulai boros.";
      else status = "⚠️ Income belum tercatat, tapi saldo masih relatif aman.";
    }
    const topCategorySuggestion = summary.topExpenseCategoryName && summary.topExpenseCategoryName !== "-" ? summary.topExpenseCategoryName : "kategori terbesar";
    return {
      intent,
      period: period.label,
      reply: `🤖 *AI Finance Chat*\n\n📊 Analisa ${period.label}:\n\nPemasukan: ${formatIDR(summary.income)}\nPengeluaran: ${formatIDR(summary.expense)}\nSelisih: ${formatIDR(summary.net)}\nRata-rata/hari: ${formatIDR(avgDailyExpense)}\n\nStatus:\n${status}\n\nSaran:\nCoba tekan kategori terbesar: ${topCategorySuggestion}.\nEstimasi pengeluaran sampai akhir bulan: ${formatIDR(projectedExpense)}`,
    };
  }
  if (intent === "ACCOUNT_BALANCE") {
    const rpcRows = await getRpcBalanceData(userId);
    const summaryRow = (rpcRows[0] ?? {}) as Record<string, JsonValue>;
    const hasSummaryShape = rpcRows.length > 0 && (
      "cash_balance" in summaryRow || "non_cash_balance" in summaryRow || "total_balance" in summaryRow
    );
    const detailRows = rpcRows.filter((row) => ("account_id" in row) || ("account_name" in row) || ("balance" in row));
    const rpcShape = detailRows.length > 0 ? "detail" : hasSummaryShape ? "summary" : "unknown";

    if (/saldo total|total saldo|saldo semua/.test(q)) {
      const cashBalance = Number(summaryRow.cash_balance ?? 0);
      const nonCashBalance = Number(summaryRow.non_cash_balance ?? 0);
      const totalBalance = Number(summaryRow.total_balance ?? (cashBalance + nonCashBalance));
      return { intent, keyword: null, period: period.label, reply: `🤖 *AI Finance Chat*\n\nSaldo Total:\n${formatIDR(totalBalance)}` };
    }
    if (/saldo cash/.test(q)) {
      const cashBalance = Number(summaryRow.cash_balance ?? 0);
      return { intent, keyword: "cash", period: period.label, reply: `🤖 *AI Finance Chat*\n\nSaldo Cash:\n${formatIDR(cashBalance)}` };
    }
    if (/saldo non cash|saldo noncash|saldo dana|saldo e-?wallet|saldo bank/.test(q)) {
      const nonCashBalance = Number(summaryRow.non_cash_balance ?? 0);
      return { intent, keyword: "non_cash", period: period.label, reply: `🤖 *AI Finance Chat*\n\nSaldo Non Cash:\n${formatIDR(nonCashBalance)}` };
    }
    if (!matchedAccount) return { intent: "UNKNOWN", keyword: null, period: period.label, reply: "🤖 *AI Finance Chat*\n\nAkun belum ketemu di pertanyaan kamu." };

    const accountName = String(matchedAccount.name ?? "-");
    const matchedAccountId = String(matchedAccount.id ?? "");
    const normalizedAccountName = normalizeText(accountName);
    const matchedRpc = detailRows.find((row) => {
      const rpcAccountId = String(row.account_id ?? row.id ?? "");
      const rpcAccountName = normalizeText(String(row.account_name ?? row.name ?? ""));
      return (matchedAccountId && rpcAccountId === matchedAccountId) ||
        (rpcAccountName && (rpcAccountName.includes(normalizedAccountName) || normalizedAccountName.includes(rpcAccountName)));
    });
    const foundInRpc = Boolean(matchedRpc);
    console.log("[AI BALANCE ACCOUNT]", { question, accountName, rpcShape, foundInRpc });

    if (!matchedRpc) {
      return {
        intent,
        keyword: accountName,
        period: period.label,
        reply: `🤖 *AI Finance Chat*\n\nSaldo detail akun ${accountName} belum tersedia dari RPC saldo.\n\nGunakan command:\nsaldo`,
      };
    }

    const accountBalance = Number((matchedRpc as Record<string, JsonValue>).balance ?? (matchedRpc as Record<string, JsonValue>).current_balance ?? 0);
    return { intent, keyword: accountName, period: period.label, reply: `🤖 *AI Finance Chat*\n\nSaldo ${accountName}:\n${formatSignedIDR(accountBalance)}` };
  }
  if (intent === "TRANSACTION_COUNT") {
    const { count, error } = await supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null).gte("date", period.startDate).lt("date", period.endDate);
    if (error) throw error;
    return { intent, keyword: null, period: period.label, reply: `🤖 *AI Finance Chat*\n\nTransaksi ${period.label}:\n${count ?? 0} data` };
  }
  if (intent === "ACCOUNT_USAGE") {
    if (!matchedAccount) return { intent: "UNKNOWN", keyword: null, period: period.label, reply: "🤖 *AI Finance Chat*\n\nAkun belum ketemu di pertanyaan kamu." };
    const { data: txs, error } = await supabase.from("transactions").select("amount,category_id").eq("user_id", userId).eq("account_id", String(matchedAccount.id)).eq("type", "expense").is("deleted_at", null).gte("date", period.startDate).lt("date", period.endDate);
    if (error) throw error;
    const totals = new Map<string, number>();
    for (const tx of (txs ?? []) as Array<Record<string, JsonValue>>) totals.set(String(tx.category_id ?? ""), (totals.get(String(tx.category_id ?? "")) ?? 0) + Number(tx.amount ?? 0));
    const ids = [...totals.keys()].filter(Boolean);
    const { data: catRows } = ids.length > 0 ? await supabase.from("categories").select("id,name").in("id", ids) : { data: [] };
    const cmap = new Map<string, string>();
    for (const c of (catRows ?? []) as Array<Record<string, JsonValue>>) cmap.set(String(c.id), String(c.name ?? "-"));
    const lines = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, total], i) => `${i + 1}. ${cmap.get(id) ?? "-"} — ${formatIDR(total)}`);
    return { intent, keyword: String(matchedAccount.name ?? "-"), period: period.label, reply: `🤖 *AI Finance Chat*\n\nAkun ${String(matchedAccount.name ?? "-")} paling sering dipakai untuk:\n\n${lines.join("\n") || "-"}` };
  }
  if (intent === "TITLE_FREQUENCY" || intent === "TITLE_TOTAL") {
    const keyword = intent === "TITLE_FREQUENCY" ? titleFrequencyKeyword : extractEntityKeyword(question);
    if (!keyword) return { intent: "UNKNOWN", keyword: null, period: period.label, reply: "🤖 *AI Finance Chat*\n\nSaya belum paham pertanyaan itu." };
    const { data: txs, error } = await supabase.from("transactions").select("amount").eq("user_id", userId).eq("type", "expense").is("deleted_at", null).ilike("title", `%${keyword}%`).gte("date", period.startDate).lt("date", period.endDate);
    if (error) throw error;
    const total = (txs ?? []).reduce((acc, it: Record<string, JsonValue>) => acc + Number(it.amount ?? 0), 0);
    const count = (txs ?? []).length;
    if (intent === "TITLE_FREQUENCY") {
      if (count === 0) return { intent, keyword, period: period.label, reply: `🤖 *AI Finance Chat*\n\nBelum ada transaksi "${keyword}" ${period.label}.` };
      const avg = count > 0 ? total / count : 0;
      return { intent, keyword, period: period.label, reply: `🤖 *AI Finance Chat*\n\nTransaksi "${keyword}" ${period.label}:\n${count} kali\nTotal: ${formatIDR(total)}\nRata-rata: ${formatIDR(avg)}` };
    }
    return { intent: "TITLE_TOTAL", keyword, period: period.label, reply: `🤖 *AI Finance Chat*\n\nTotal pengeluaran "${keyword}" ${period.label}:\n${formatIDR(total)}\nJumlah transaksi: ${count} data` };
  }
  if (intent === "ACCOUNT_EXPENSE") {
    if (!matchedAccount) return { intent: "UNKNOWN", keyword: null, period: period.label, reply: "🤖 *AI Finance Chat*\n\nAkun belum ketemu di pertanyaan kamu." };
    const { data: txs, error } = await supabase.from("transactions").select("amount").eq("user_id", userId).eq("account_id", String(matchedAccount.id)).eq("type", "expense").is("deleted_at", null).gte("date", period.startDate).lt("date", period.endDate);
    if (error) throw error;
    const total = (txs ?? []).reduce((a, b: Record<string, JsonValue>) => a + Number(b.amount ?? 0), 0);
    return { intent, keyword: String(matchedAccount.name ?? "-"), period: period.label, reply: `🤖 *AI Finance Chat*\n\nPengeluaran dari ${String(matchedAccount.name ?? "-")} ${period.label}:\n${formatIDR(total)}` };
  }

  if (intent === "SPENDING_TOP") {
    const tops = await getTopExpenseCategories(userId);
    const lines = tops.length > 0 ? tops.map((t, i) => `${i + 1}. ${t.name} — ${formatIDR(t.total)}`).join("\n") : "Belum ada pengeluaran bulan ini.";
    return { intent, reply: `🤖 *AI Finance Chat*\n\nBulan ini pengeluaran terbesar kamu ada di:\n\n${lines}` };
  }
  if (intent === "CASHFLOW") {
    const current = await getTransactionSummaryByRange(userId, getMonthRangeJakarta().start, getMonthRangeJakarta().end);
    const previous = await getTransactionSummaryByRange(userId, getPreviousMonthRangeJakarta().start, getPreviousMonthRangeJakarta().end);
    return { intent, period: period.label, reply: `🤖 *AI Finance Chat*\n\n${buildCashflowReply(current, previous)}` };
  }

  if (intent === "SPENDING_CATEGORY") {
    const res = await getCategoryExpenseTotal(userId, question);
    if (!res.categoryName) {
      const keyword = extractEntityKeyword(question);
      if (matchedAccount) {
        const { data: txs } = await supabase.from("transactions").select("amount").eq("user_id", userId).eq("account_id", String(matchedAccount.id)).eq("type", "expense").is("deleted_at", null).gte("date", period.startDate).lt("date", period.endDate);
        const total = (txs ?? []).reduce((a, b: Record<string, JsonValue>) => a + Number(b.amount ?? 0), 0);
        return { intent: "ACCOUNT_EXPENSE", reply: `🤖 *AI Finance Chat*\n\nPengeluaran dari ${String(matchedAccount.name ?? "-")} ${period.label}:\n${formatIDR(total)}` };
      }
      if (keyword) {
        const { data: txs } = await supabase.from("transactions").select("amount").eq("user_id", userId).eq("type", "expense").is("deleted_at", null).ilike("title", `%${keyword}%`).gte("date", period.startDate).lt("date", period.endDate);
        const total = (txs ?? []).reduce((a, b: Record<string, JsonValue>) => a + Number(b.amount ?? 0), 0);
        return { intent: "TITLE_TOTAL", reply: `🤖 *AI Finance Chat*\n\nTotal pengeluaran "${keyword}" ${period.label}:\n${formatIDR(total)}\nJumlah transaksi: ${(txs ?? []).length} data` };
      }
      return { intent: "UNKNOWN", reply: "🤖 *AI Finance Chat*\n\nSaya belum paham pertanyaan itu." };
    }
    return { intent, reply: `🤖 *AI Finance Chat*\n\nPengeluaran *${res.categoryName}* ${res.periodLabel}: *${formatIDR(res.total)}*` };
  }

  if (intent === "BUDGET_STATUS") {
    const budgetCategory = matchedCategory ? String(matchedCategory.name ?? "").trim() : question.replace(/^.*budget\s+/i, "").replace(/(sisa|aman|tidak|berapa|apakah|\?)/gi, "").trim();
    const monthly = budgetCategory ? await getMonthlyBudgetInfo(userId, budgetCategory) : null;
    if (!monthly) return { intent, reply: "🤖 *AI Finance Chat*\n\nBudget kategori itu belum ditemukan." };
    const used = monthly.used;
    const limit = monthly.planned;
    const remaining = monthly.remaining;
    const pct = monthly.percentage;
    if (remaining < 0) {
      return { intent, reply: `🤖 *AI Finance Chat*\n\n🚨 Budget ${budgetCategory} sudah melewati limit.\n\nTerpakai:\n${formatIDR(used)} / ${formatIDR(limit)}\n\nSisa:\n${formatSignedIDR(remaining)}\nPersen: ${pct.toFixed(1)}%` };
    }
    if (pct >= 80) {
      return { intent, reply: `🤖 *AI Finance Chat*\n\n⚠️ Budget ${budgetCategory} hampir habis.\n\nTerpakai:\n${formatIDR(used)} / ${formatIDR(limit)}\n\nSisa:\n${formatIDR(remaining)}\nPersen: ${pct.toFixed(1)}%` };
    }
    return { intent, reply: `🤖 *AI Finance Chat*\n\nBudget ${budgetCategory} masih aman.\n\nTerpakai:\n${formatIDR(used)} / ${formatIDR(limit)}\n\nSisa:\n${formatIDR(remaining)}\nPersen: ${pct.toFixed(1)}%` };
  }

  if (intent === "BALANCE_SAFETY") {
    const s = await getBalanceSafety(userId);
    const status = s.safeDays >= s.daysRemaining ? "Aman" : "Perlu hemat";
    return {
      intent,
      reply: `🤖 *AI Finance Chat*\n\n${status}.\nEstimasi hari aman: *${s.safeDays} hari*\nSisa hari bulan ini: *${s.daysRemaining} hari*\nRata-rata harian: *${formatIDR(s.avgDaily)}*`,
    };
  }

  if (intent === "SUBSCRIPTION_SUMMARY") {
    const s = await getSubscriptionSummary(userId);
    const names = s.activeNames.length > 0 ? s.activeNames.map((n, i) => `${i + 1}. ${n}`).join("\n") : "-";
    return { intent, reply: `🤖 *AI Finance Chat*\n\nSubscription aktif:\n${names}\n\nTotal charge bulan ini: *${formatIDR(s.monthlyCharge)}*` };
  }

  if (intent === "DEBT_STATUS") {
    const rows = await getDebtStatus(userId);
    const lines = rows.length > 0 ? rows.map((r, i) => `${i + 1}. ${r.name} (${r.type}) — ${formatIDR(r.remaining)}`).join("\n") : "Tidak ada hutang/piutang aktif.";
    return { intent, reply: `🤖 *AI Finance Chat*\n\n${lines}` };
  }

  if (intent === "GOAL_PROGRESS") {
    const rows = await getGoalProgress(userId, question);
    const lines = rows.length > 0
      ? rows.slice(0, 3).map((g, i) => `${i + 1}. ${g.name} — ${g.percentage.toFixed(1)}% (${formatIDR(g.current)} / ${formatIDR(g.target)})`).join("\n")
      : "Belum ada goals.";
    return { intent, reply: `🤖 *AI Finance Chat*\n\nProgress goals:\n${lines}` };
  }

  const b = await getBuyDecision(userId, question);
  return { intent, reply: `🤖 *AI Finance Chat*\n\n${b.verdict.toUpperCase()} untuk beli ${formatIDR(b.amount)}.\nAlasan: ${b.reason}` };
}

async function handleAiQuestion(userId: string, question: string): Promise<{ reply: string; intent: AiIntent; keyword?: string | null; period?: string }> {
  return await handleAiFinanceChat(userId, question);
}

function normalizeHistoryTitle(text: string): { normalized: string; words: string[] } {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/gi, " ").replace(/\s+/g, " ").trim();
  return { normalized, words: normalized ? normalized.split(" ") : [] };
}

function parseSmartTransactionMessage(message: string): ParsedSmartTransaction | ParsedTransactionError | null {
  const parts = message.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  const firstToken = normalizeText(parts[0] ?? "");
  if (SMART_TRANSACTION_BLOCKED_COMMANDS.has(firstToken)) return null;

  let txDate = getTodayJakarta();
  let workParts = [...parts];
  const lastToken = workParts[workParts.length - 1];

  if (isDateToken(lastToken)) {
    const parsedDate = parseCustomDateToken(lastToken);
    if (!parsedDate) return { error: "INVALID_DATE" };
    txDate = parsedDate;
    workParts = workParts.slice(0, -1);
  }

  if (workParts.length < 2) return null;

  let amountIndex = -1;
  for (let i = workParts.length - 1; i >= 1; i--) {
    if (parseAmount(workParts[i]) > 0) {
      amountIndex = i;
      break;
    }
  }

  if (amountIndex < 1) return null;
  const amount = parseAmount(workParts[amountIndex]);
  if (amount <= 0) return null;

  const title = workParts.slice(0, amountIndex).join(" ").trim();
  if (!title) return null;
  const trailingTokens = workParts.slice(amountIndex + 1);
  const accountName = trailingTokens.length > 0 ? trailingTokens.join(" ") : null;
  return { title, amount, accountName, date: txDate };
}

function isReservedCommand(message: string): boolean {
  const normalized = normalizeText(message);
  if (!normalized) return true;
  if (NATURAL_RESERVED_COMMANDS.has(normalized)) return true;
  for (const command of NATURAL_RESERVED_COMMANDS) {
    if (normalized.startsWith(`${command} `)) return true;
  }
  return false;
}

function detectNaturalTransactionType(message: string): NaturalTransactionType | null {
  const normalized = normalizeText(message);
  const incomeKeywords = ["gaji", "gajian", "dibayar", "dapat", "bonus", "masuk", "terima", "pemasukan"];
  const expenseKeywords = ["beli", "bayar", "jajan", "makan", "minum", "isi", "topup", "keluar", "pakai", "pake"];
  const transferKeywords = ["pindah", "transfer"];

  if (transferKeywords.some((keyword) => normalized.includes(keyword))) return "transfer";
  if (incomeKeywords.some((keyword) => normalized.includes(keyword))) return "income";
  if (expenseKeywords.some((keyword) => normalized.includes(keyword))) return "expense";
  return null;
}

function extractNaturalAmountFromText(message: string): number {
  const compact = message.toLowerCase().replace(/\s+/g, "");
  const withUnit = compact.match(/rp?(\d+[.,]?\d*)(rb|ribu|k|jt|juta)\b|(\d+[.,]?\d*)(rb|ribu|k|jt|juta)\b/i);
  if (withUnit) {
    const rawNumber = (withUnit[1] || withUnit[3] || "").replace(",", ".");
    const unit = (withUnit[2] || withUnit[4] || "").toLowerCase();
    const base = Number(rawNumber);
    if (!Number.isFinite(base) || base <= 0) return 0;
    if (unit === "rb" || unit === "ribu" || unit === "k") return Math.round(base * 1000);
    if (unit === "jt" || unit === "juta") return Math.round(base * 1000000);
  }

  const numeric = message.match(/rp?\s?(\d{1,3}(?:[.,]\d{3})+|\d+)/i);
  if (!numeric) return 0;
  const cleaned = numeric[1].replace(/[.,]/g, "");
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount);
}

const NATURAL_NOISE_WORDS = [
  "tadi",
  "barusan",
  "baru",
  "hari",
  "ini",
  "beli",
  "bayar",
  "jajan",
  "makan",
  "minum",
  "isi",
  "topup",
  "top",
  "up",
  "pakai",
  "pake",
  "pakaiin",
  "dari",
  "via",
  "lewat",
  "ke",
  "masuk",
  "keluar",
  "dibayar",
  "dapat",
  "terima",
  "gaji",
  "gajian",
  "bonus",
  "uang",
  "buat",
  "untuk",
  "di",
  "deh",
  "dong",
  "nih",
];

function cleanNaturalTitle(message: string, amount: number, accountNames: string[]): string {
  const fallbackTitle = message.toLowerCase().replace(/\s+/g, " ").trim();
  let title = ` ${fallbackTitle} `;

  for (const accountName of accountNames) {
    title = title.replace(new RegExp(`\\b${accountName.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " ");
  }
  if (amount > 0) {
    const amountStr = String(amount);
    title = title.replace(new RegExp(`\\b${amountStr}\\b`, "g"), " ");
  }

  title = title
    .replace(/rp\s?\d[\d.,]*/gi, " ")
    .replace(/\b\d+[.,]?\d*\s?(rb|ribu|k|jt|juta)\b/gi, " ")
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, " ");

  for (const noiseWord of NATURAL_NOISE_WORDS) {
    title = title.replace(new RegExp(`\\b${noiseWord}\\b`, "gi"), " ");
  }

  const cleanedTitle = title.replace(/\s+/g, " ").trim();
  return cleanedTitle || fallbackTitle;
}

function extractAccountFromNaturalText(message: string, accounts: Array<{ id: string; name: string; type: string }>): { id: string; name: string; type: string } | null {
  const normalized = ` ${normalizeText(message)} `;
  const sorted = [...accounts].sort((a, b) => b.name.length - a.name.length);
  for (const account of sorted) {
    const pattern = new RegExp(`\\b${account.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(normalized)) return account;
  }
  return null;
}

function parseNaturalTransactionMessage(
  message: string,
  accounts: Array<{ id: string; name: string; type: string }>,
): ParsedNaturalTransaction | ParsedTransactionError | null {
  if (isReservedCommand(message)) return null;

  let date = getTodayJakarta();
  const parts = message.trim().split(/\s+/).filter(Boolean);
  const lastToken = parts[parts.length - 1] ?? "";
  if (isDateToken(lastToken)) {
    const parsedDate = parseCustomDateToken(lastToken);
    if (!parsedDate) return { error: "INVALID_DATE" };
    date = parsedDate;
  }

  const type = detectNaturalTransactionType(message);
  if (!type || type === "transfer") return null;
  const amount = extractNaturalAmountFromText(message);
  if (amount <= 0) return null;
  const account = extractAccountFromNaturalText(message, accounts);
  const accountNames = accounts.map((a) => a.name);
  const title = cleanNaturalTitle(message, amount, accountNames);
  if (!title) return null;
  return { type, accountName: account?.name ?? null, amount, title, date };
}

function findBestCategoryFromHistory(inputTitle: string, rows: Array<Record<string, JsonValue>>): { categoryId: string; score: number } | null {
  const input = normalizeHistoryTitle(inputTitle);
  if (!input.normalized) return null;

  let best: { categoryId: string; score: number } | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const title = String(row.title ?? "");
    const categoryId = String(row.category_id ?? "").trim();
    if (!title || !categoryId) continue;

    const history = normalizeHistoryTitle(title);
    if (!history.normalized) continue;

    let score = 0;
    if (history.normalized === input.normalized) score = 100;
    else if (history.normalized.includes(input.normalized)) score = 80;
    else if (input.normalized.includes(history.normalized)) score = 70;

    const overlapCount = input.words.filter((word) => history.words.includes(word)).length;
    score += overlapCount * 10;
    score += Math.max(0, 5 - i * 0.05);

    if (!best || score > best.score) {
      best = { categoryId, score };
    }
  }

  if (!best || best.score < 30) return null;
  return best;
}

async function findCategoryByTransactionHistory(userId: string, title: string): Promise<{ id: string; name: string; type: string } | null> {
  const { data, error } = await supabase
    .from("transactions")
    .select("title,category_id,type,inserted_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .not("category_id", "is", null)
    .not("title", "is", null)
    .in("type", ["income", "expense"])
    .order("inserted_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const best = findBestCategoryFromHistory(title, (data ?? []) as Array<Record<string, JsonValue>>);
  if (!best) return null;

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id,name,type")
    .eq("id", best.categoryId)
    .eq("user_id", userId)
    .maybeSingle();
  if (categoryError) throw categoryError;
  return category;
}

async function getUserRecentTransactionsForLearning(userId: string): Promise<Array<Record<string, JsonValue>>> {
  const { data, error } = await supabase
    .from("transactions")
    .select("title,category_id,account_id,type,inserted_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .not("account_id", "is", null)
    .not("title", "is", null)
    .in("type", ["income", "expense"])
    .order("inserted_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Array<Record<string, JsonValue>>;
}

function findBestAccountFromHistory(
  inputTitle: string,
  categoryId: string | null,
  txType: NaturalTransactionType | null,
  rows: Array<Record<string, JsonValue>>,
): { accountId: string; score: number } | null {
  const input = normalizeHistoryTitle(inputTitle);
  if (!input.normalized) return null;

  let best: { accountId: string; score: number } | null = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const historyTitle = String(row.title ?? "");
    const accountId = String(row.account_id ?? "").trim();
    if (!historyTitle || !accountId) continue;

    const history = normalizeHistoryTitle(historyTitle);
    if (!history.normalized) continue;

    let score = 0;
    if (history.normalized === input.normalized) score += 100;
    if (history.normalized.includes(input.normalized)) score += 80;
    if (input.normalized.includes(history.normalized)) score += 70;
    score += input.words.filter((word) => history.words.includes(word)).length * 10;
    if (categoryId && String(row.category_id ?? "") === categoryId) score += 40;
    if (txType && String(row.type ?? "") === txType) score += 20;
    score += Math.max(0, 10 - i * 0.05);

    if (!best || score > best.score) best = { accountId, score };
  }

  if (!best || best.score < 30) return null;
  return best;
}

async function findAccountByTransactionHistory(
  userId: string,
  title: string,
  categoryId: string | null,
  txType: NaturalTransactionType | null,
): Promise<{ id: string; name: string; type: string } | null> {
  const rows = await getUserRecentTransactionsForLearning(userId);
  const best = findBestAccountFromHistory(title, categoryId, txType, rows);
  if (!best) return null;

  const { data, error } = await getAccountsBaseQuery(userId, "id,name,type,user_id")
    .eq("id", best.accountId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: String(data.id), name: String(data.name), type: String(data.type ?? "") };
}

function parseTransactionMessage(message: string): ParsedTransaction | ParsedTransactionError | null {
  const parts = message.trim().split(/\s+/);
  if (parts.length < 3) return null;

  let txDate = getTodayJakarta();
  let workParts = [...parts];
  const lastToken = workParts[workParts.length - 1];

  if (isDateToken(lastToken)) {
    const parsedDate = parseCustomDateToken(lastToken);
    if (!parsedDate) return { error: "INVALID_DATE" };
    txDate = parsedDate;
    workParts = workParts.slice(0, -1);
  }

  if (workParts.length < 3) return null;

  const categoryName = workParts[0];
  const accountName = workParts[workParts.length - 1];
  let amountIndex = -1;

  for (let i = workParts.length - 2; i >= 1; i--) {
    if (parseAmount(workParts[i]) > 0) {
      amountIndex = i;
      break;
    }
  }

  if (amountIndex < 1) return null;
  const amount = parseAmount(workParts[amountIndex]);
  if (amount <= 0) return null;

  const titleParts = workParts.slice(1, amountIndex);
  const title = titleParts.length > 0 ? titleParts.join(" ") : categoryName;

  return { categoryName, accountName, amount, title, date: txDate };
}

function parseTransferMessage(message: string): ParsedTransfer | null {
  const parts = message.trim().split(/\s+/);
  if (parts.length !== 4) return null;
  if (normalizeText(parts[0]) !== "tf") return null;
  const amount = parseAmount(parts[1]);
  if (amount <= 0) return null;
  return { amount, fromAccountName: parts[2], toAccountName: parts[3] };
}

function parseDebtCommand(message: string): ParsedDebtCommand | null {
  const parts = message.trim().split(/\s+/);
  if (parts.length < 5) return null;
  const action = normalizeText(parts[0]);
  const debtWord = normalizeText(parts[1]);
  if ((action !== "tambah" && action !== "bayar") || (debtWord !== "hutang" && debtWord !== "piutang")) return null;
  const debtType: DebtType = debtWord === "hutang" ? "debt" : "receivable";

  let date = getTodayJakarta();
  let workParts = [...parts];
  const maybeDate = parseOptionalDateToken(workParts[workParts.length - 1]);
  if (maybeDate) {
    date = maybeDate;
    workParts = workParts.slice(0, -1);
  }

  if (workParts.length < 5) return null;
  const accountName = workParts[workParts.length - 1];
  const core = workParts.slice(2, -1);
  const amountIndex = core.findIndex((p) => parseAmount(p) > 0);
  if (amountIndex <= 0) return null;

  const partyName = core.slice(0, amountIndex).join(" ").trim();
  const amount = parseAmount(core[amountIndex]);
  if (!partyName || amount <= 0) return null;

  return { action: action as DebtAction, debtType, partyName, amount, accountName, date };
}

function parseEditTransactionCommand(rawMessage: string): ParsedEditTransactionCommand | null {
  const parts = rawMessage.trim().split(/\s+/);
  if (parts.length < 3 || normalizeText(parts[0]) !== "edit") return null;
  const number = Number(parts[1]);
  if (!Number.isInteger(number) || number < 1) return null;
  const rest = parts.slice(2);
  if (rest.length === 0) return null;

  const firstToken = normalizeText(rest[0]);
  if (firstToken === "judul" || firstToken === "title") {
    const titleValue = rest.slice(1).join(" ").trim();
    if (!titleValue) return null;
    return { number, field: "title", value: titleValue };
  }
  if (firstToken === "kategori") {
    const categoryValue = rest.slice(1).join(" ").trim();
    if (!categoryValue) return null;
    return { number, field: "category", value: categoryValue };
  }
  if (firstToken === "akun") {
    const accountValue = rest.slice(1).join(" ").trim();
    if (!accountValue) return null;
    return { number, field: "account", value: accountValue };
  }
  if (firstToken === "tanggal") {
    const dateValue = rest[1] ?? "";
    if (!dateValue) return null;
    return { number, field: "date", value: dateValue };
  }

  const amount = parseAmount(rest.join(" "));
  if (amount <= 0) return null;
  return { number, field: "amount", value: amount };
}

async function getLastHistoryTransactions(userId: string, phone: string): Promise<Array<Record<string, JsonValue>>> {
  const { data, error } = await supabase
    .from("whatsapp_message_logs")
    .select("parsed")
    .eq("user_id", userId)
    .eq("phone", phone)
    .eq("status", "success")
    .eq("parsed->>command", "history")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const parsed = (data?.parsed ?? null) as Record<string, JsonValue> | null;
  return (parsed?.displayedTransactions ?? []) as Array<Record<string, JsonValue>>;
}

function findDisplayedTransactionByNumber(displayedTransactions: Array<Record<string, JsonValue>>, number: number): Record<string, JsonValue> | null {
  return displayedTransactions.find((item) => Number(item.no ?? 0) === number) ?? null;
}

async function handleEditTransaction(userId: string, phone: string, rawMessage: string): Promise<{ reply: string; parsedLog: Record<string, JsonValue> }> {
  const parsedEdit = parseEditTransactionCommand(rawMessage);
  if (!parsedEdit) {
    return { reply: "⚠️ Format edit tidak valid.\n\nContoh:\nedit 3 15000", parsedLog: { command: "edit_transaction_failed", reason: "invalid_format" } };
  }
  const displayedTransactions = await getLastHistoryTransactions(userId, phone);
  if (displayedTransactions.length === 0) {
    return { reply: "⚠️ Belum ada history terakhir.\n\nKirim *history* dulu lalu pilih nomor transaksi.\nContoh:\nedit 3 15000", parsedLog: { command: "edit_transaction_failed", reason: "history_not_found" } };
  }
  const selectedTransaction = findDisplayedTransactionByNumber(displayedTransactions, parsedEdit.number);
  if (!selectedTransaction) {
    return { reply: "⚠️ Nomor history tidak ditemukan.\n\nKirim *history* dulu lalu pilih nomor transaksi.\nContoh:\nedit 3 15000", parsedLog: { command: "edit_transaction_failed", reason: "number_not_found", number: parsedEdit.number } };
  }

  const transactionId = String(selectedTransaction.id ?? "");
  const { data: txRow, error: txError } = await supabase
    .from("transactions")
    .select("id,title,amount,type,date,category_id,account_id,to_account_id")
    .eq("id", transactionId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (txError) throw txError;
  if (!txRow) return { reply: "⚠️ Transaksi ini sudah tidak aktif atau sudah dihapus.", parsedLog: { command: "edit_transaction_failed", reason: "transaction_not_found", transactionId } };

  const txType = String(txRow.type ?? "expense");
  if (txType === "transfer" && parsedEdit.field === "account") {
    return { reply: "⚠️ Edit akun transfer belum didukung.", parsedLog: { command: "edit_transaction_failed", reason: "transfer_account_not_supported", transactionId } };
  }

  if (parsedEdit.field === "amount") {
    const oldValue = Number(txRow.amount ?? 0);
    const newValue = Number(parsedEdit.value);
    const { error } = await supabase.from("transactions").update({ amount: newValue }).eq("id", transactionId).eq("user_id", userId);
    if (error) throw error;
    return { reply: [`✅ Nominal transaksi diperbarui`, "", `No: ${parsedEdit.number}`, `Judul: ${String(txRow.title ?? "-")}`, `Nominal lama: ${formatIDR(oldValue)}`, `Nominal baru: ${formatIDR(newValue)}`].join("\n"), parsedLog: { command: "edit_transaction", transactionId, field: "amount", oldValue, newValue } };
  }
  if (parsedEdit.field === "title") {
    const oldValue = String(txRow.title ?? "-");
    const newValue = String(parsedEdit.value);
    const { error } = await supabase.from("transactions").update({ title: newValue }).eq("id", transactionId).eq("user_id", userId);
    if (error) throw error;
    return { reply: [`✅ Judul transaksi diperbarui`, "", `No: ${parsedEdit.number}`, `Judul lama: ${oldValue}`, `Judul baru: ${newValue}`].join("\n"), parsedLog: { command: "edit_transaction", transactionId, field: "title", oldValue, newValue } };
  }
  if (parsedEdit.field === "category") {
    const categoryInput = String(parsedEdit.value);
    const category = await findCategory(userId, categoryInput);
    if (!category) return { reply: `⚠️ Kategori tidak ditemukan: ${categoryInput}`, parsedLog: { command: "edit_transaction_failed", reason: "category_not_found", transactionId, field: "category", value: categoryInput } };
    const oldValue = String(selectedTransaction.categoryName ?? "-");
    const { error } = await supabase.from("transactions").update({ category_id: category.id, type: category.type }).eq("id", transactionId).eq("user_id", userId);
    if (error) throw error;
    return { reply: [`✅ Kategori transaksi diperbarui`, "", `No: ${parsedEdit.number}`, `Kategori lama: ${oldValue}`, `Kategori baru: ${category.name}`].join("\n"), parsedLog: { command: "edit_transaction", transactionId, field: "category", oldValue, newValue: category.name } };
  }
  if (parsedEdit.field === "account") {
    const accountInput = String(parsedEdit.value);
    const account = await findAccount(userId, accountInput);
    if (!account) return { reply: `❌ Akun *${accountInput}* tidak ditemukan.`, parsedLog: { command: "edit_transaction_failed", reason: "account_not_found", transactionId, field: "account", value: accountInput } };
    const oldValue = String(selectedTransaction.accountName ?? "-");
    const { error } = await supabase.from("transactions").update({ account_id: account.id }).eq("id", transactionId).eq("user_id", userId);
    if (error) throw error;
    return { reply: [`✅ Akun transaksi diperbarui`, "", `No: ${parsedEdit.number}`, `Akun lama: ${oldValue}`, `Akun baru: ${account.name}`].join("\n"), parsedLog: { command: "edit_transaction", transactionId, field: "account", oldValue, newValue: account.name } };
  }
  const dateInput = String(parsedEdit.value);
  const newDate = parseCustomDateToken(dateInput);
  if (!newDate) return { reply: "⚠️ Format tanggal tidak valid.\n\nGunakan format:\n31/05", parsedLog: { command: "edit_transaction_failed", reason: "invalid_date", transactionId, value: dateInput } };
  const oldValue = String(txRow.date ?? "-");
  const { error } = await supabase.from("transactions").update({ date: newDate }).eq("id", transactionId).eq("user_id", userId);
  if (error) throw error;
  return { reply: [`✅ Tanggal transaksi diperbarui`, "", `No: ${parsedEdit.number}`, `Tanggal lama: ${oldValue}`, `Tanggal baru: ${newDate}`].join("\n"), parsedLog: { command: "edit_transaction", transactionId, field: "date", oldValue, newValue: newDate } };
}

async function handleEditLastTransactionAccount(userId: string, normalized: string): Promise<{ reply: string; parsedLog: Record<string, JsonValue> }> {
  const accountNameInput = normalized.replace(/^edit akun\s+/, "").trim();
  if (!accountNameInput) {
    return { reply: "⚠️ Nama akun belum diisi.\n\nContoh:\nedit akun cash", parsedLog: { command: "edit_account_failed", reason: "missing_account_name" } };
  }

  const { data: lastTx, error: lastTxError } = await supabase
    .from("transactions")
    .select("id,title,type,account_id,notes")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .ilike("notes", "%WhatsApp%")
    .order("inserted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastTxError) throw lastTxError;
  if (!lastTx) {
    return { reply: "⚠️ Tidak ada transaksi WhatsApp yang bisa diubah.", parsedLog: { command: "edit_account_failed", reason: "last_transaction_not_found" } };
  }

  if (String(lastTx.type ?? "") === "transfer") {
    return { reply: "⚠️ Edit akun belum mendukung transaksi transfer.", parsedLog: { command: "edit_account_failed", reason: "transfer_not_supported" } };
  }

  const newAccount = await findAccount(userId, accountNameInput);
  if (!newAccount) {
    return { reply: `❌ Akun *${accountNameInput}* tidak ditemukan.`, parsedLog: { command: "edit_account_failed", reason: "account_not_found", accountName: accountNameInput } };
  }

  const oldAccountId = String(lastTx.account_id ?? "");
  const { data: oldAccount } = await supabase.from("accounts").select("name").eq("id", oldAccountId).eq("user_id", userId).maybeSingle();
  const oldAccountName = String(oldAccount?.name ?? "-");

  const { error: updateError } = await supabase
    .from("transactions")
    .update({ account_id: newAccount.id })
    .eq("id", String(lastTx.id))
    .eq("user_id", userId);
  if (updateError) throw updateError;

  return {
    reply: [
      "✅ Akun transaksi terakhir diperbarui",
      "",
      `Judul: ${String(lastTx.title ?? "-")}`,
      `Akun lama: ${oldAccountName}`,
      `Akun baru: ${newAccount.name}`,
    ].join("\n"),
    parsedLog: { command: "edit_account", transactionId: String(lastTx.id), oldAccountName, newAccountName: newAccount.name },
  };
}

async function getOpenDebts(userId: string): Promise<Array<Record<string, JsonValue>>> {
  const { data, error } = await supabase
    .from("debts")
    .select("id,type,party_name,amount,paid_total,status")
    .eq("user_id", userId)
    .eq("status", "ongoing")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<Record<string, JsonValue>>;
}

async function findOpenDebtByParty(userId: string, debtType: DebtType, partyName: string): Promise<Record<string, JsonValue> | null> {
  const { data, error } = await supabase
    .from("debts")
    .select("id,type,party_name,amount,paid_total,status")
    .eq("user_id", userId)
    .eq("type", debtType)
    .eq("status", "ongoing")
    .ilike("party_name", partyName)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Record<string, JsonValue> | null;
}

async function createDebtPayment(input: {
  userId: string;
  debtId: string;
  accountId: string;
  transactionId: string;
  amount: number;
  date: string;
  notes: string;
}): Promise<void> {
  const { error } = await supabase.from("debt_payments").insert({
    debt_id: input.debtId,
    user_id: input.userId,
    account_id: input.accountId,
    transaction_id: input.transactionId,
    amount: input.amount,
    date: input.date,
    notes: input.notes,
  });
  if (error) throw error;
}

async function handleDebtCommand(userId: string, rawMessage: string, normalized: string): Promise<{ reply: string; parsedLog: Record<string, JsonValue> }> {
  if (normalized === "hutang") {
    const rows = await getOpenDebts(userId);
    if (rows.length === 0) return { reply: "💳 Belum ada hutang/piutang aktif.", parsedLog: { command: "debt", action: "list" } };
    const lines = rows.map((row, i) => {
      const amount = Number(row.amount ?? 0);
      const paid = Number(row.paid_total ?? 0);
      const remaining = Math.max(0, amount - paid);
      const label = String(row.type ?? "debt") === "receivable" ? "Piutang" : "Hutang";
      return `${i + 1}. ${label} - ${String(row.party_name ?? "-")}\n   Total: ${formatIDR(amount)}\n   Dibayar: ${formatIDR(paid)}\n   Sisa: ${formatIDR(remaining)}`;
    });
    return { reply: `💳 *Hutang & Piutang*\n\n${lines.join("\n\n")}`, parsedLog: { command: "debt", action: "list" } };
  }

  const parsed = parseDebtCommand(rawMessage);
  if (!parsed) {
    return {
      reply: ["⚠️ Format hutang/piutang salah.", "", "Contoh:", "• tambah hutang shopee 100000 seabank", "• bayar hutang shopee 25000 seabank", "• tambah piutang andi 50000 cash", "• bayar piutang andi 50000 cash"].join("\n"),
      parsedLog: { command: "debt", action: "invalid" },
    };
  }

  const account = await findAccount(userId, parsed.accountName);
  if (!account) {
    return {
      reply: `⚠️ Akun tidak ditemukan: ${parsed.accountName}`,
      parsedLog: { command: "debt", action: parsed.action, debtType: parsed.debtType, partyName: parsed.partyName, amount: parsed.amount, accountName: parsed.accountName },
    };
  }

  if (parsed.action === "tambah") {
    const { error: debtErr } = await supabase.from("debts").insert({
      user_id: userId,
      type: parsed.debtType,
      party_name: parsed.partyName,
      title: `${parsed.debtType === "debt" ? "Hutang" : "Piutang"} ${parsed.partyName}`,
      date: parsed.date,
      amount: parsed.amount,
      paid_total: 0,
      status: "ongoing",
      notes: `WhatsApp: ${rawMessage}`,
    });
    if (debtErr) throw debtErr;

    const { error: txErr } = await supabase.from("transactions").insert({
      user_id: userId,
      date: parsed.date,
      type: "expense",
      account_id: account.id,
      amount: parsed.amount,
      title: `${parsed.debtType === "debt" ? "Tambah hutang" : "Tambah piutang"} ${parsed.partyName}`,
      notes: parsed.debtType === "debt" ? `WhatsApp debt add: ${rawMessage}` : `WhatsApp receivable add: ${rawMessage}`,
    });
    if (txErr) throw txErr;

    return {
      reply: [`✅ ${parsed.debtType === "debt" ? "Hutang" : "Piutang"} berhasil dicatat`, "", `Nama: ${parsed.partyName}`, `Nominal: ${formatIDR(parsed.amount)}`, `Akun: ${account.name}`].join("\n"),
      parsedLog: { command: "debt", action: "tambah", debtType: parsed.debtType, partyName: parsed.partyName, amount: parsed.amount, accountName: parsed.accountName },
    };
  }

  const debt = await findOpenDebtByParty(userId, parsed.debtType, parsed.partyName);
  if (!debt) {
    return {
      reply: "⚠️ Data hutang/piutang tidak ditemukan.",
      parsedLog: { command: "debt", action: "bayar", debtType: parsed.debtType, partyName: parsed.partyName, amount: parsed.amount, accountName: parsed.accountName },
    };
  }

  const totalAmount = Number(debt.amount ?? 0);
  const paidTotal = Number(debt.paid_total ?? 0);
  const remaining = Math.max(0, totalAmount - paidTotal);
  if (parsed.amount > remaining) {
    return {
      reply: `⚠️ Nominal melebihi sisa hutang.\n\nSisa hutang: ${formatIDR(remaining)}`,
      parsedLog: { command: "debt", action: "bayar", debtType: parsed.debtType, partyName: parsed.partyName, amount: parsed.amount, accountName: parsed.accountName },
    };
  }

  const txType = parsed.debtType === "debt" ? "expense" : "income";
  const { data: paymentTx, error: paymentTxErr } = await supabase.from("transactions").insert({
    user_id: userId,
    date: parsed.date,
    type: txType,
    account_id: account.id,
    amount: parsed.amount,
    title: `${parsed.debtType === "debt" ? "Bayar hutang" : "Bayar piutang"} ${String(debt.party_name ?? parsed.partyName)}`,
    notes: parsed.debtType === "debt" ? `WhatsApp debt payment: ${rawMessage}` : `WhatsApp receivable payment: ${rawMessage}`,
  }).select("id").single();
  if (paymentTxErr) throw paymentTxErr;

  await createDebtPayment({
    userId,
    debtId: String(debt.id),
    accountId: account.id,
    transactionId: String(paymentTx.id),
    amount: parsed.amount,
    date: parsed.date,
    notes: `WhatsApp: ${rawMessage}`,
  });

  const newPaidTotal = paidTotal + parsed.amount;
  const newRemaining = Math.max(0, totalAmount - newPaidTotal);
  const nextStatus = newRemaining === 0 ? "paid" : "ongoing";
  const { error: updateDebtErr } = await supabase.from("debts").update({ paid_total: newPaidTotal, status: nextStatus }).eq("id", String(debt.id)).eq("user_id", userId);
  if (updateDebtErr) throw updateDebtErr;

  const isDebt = parsed.debtType === "debt";
  return {
    reply: [
      `✅ Pembayaran ${isDebt ? "hutang" : "piutang"} tercatat`,
      "",
      `Nama: ${String(debt.party_name ?? parsed.partyName)}`,
      `${isDebt ? "Dibayar" : "Diterima"}: ${formatIDR(parsed.amount)}`,
      `Sisa: ${formatIDR(newRemaining)}`,
      `Akun: ${account.name}`,
      `Status: ${nextStatus === "paid" ? "Lunas" : "Berjalan"}`,
    ].join("\n"),
    parsedLog: { command: "debt", action: "bayar", debtType: parsed.debtType, partyName: parsed.partyName, amount: parsed.amount, accountName: parsed.accountName },
  };
}

async function getMonthlyBudgetInfo(userId: string, categoryName: string, date?: string): Promise<BudgetInfo | null> {
  const category = await findCategory(userId, categoryName);
  if (!category) return null;

  const dateRef = date ? new Date(`${date}T00:00:00+07:00`) : new Date();
  const monthStart = getMonthStart(dateRef);
  const nextMonthStart = getNextMonthStart(dateRef);

  const { data: directBudgets, error: directErr } = await supabase
    .from("budgets")
    .select("id,amount_planned,planned,category_id")
    .eq("user_id", userId)
    .eq("category_id", category.id)
    .or(`period_month.eq.${monthStart},month.eq.${monthStart}`);
  if (directErr) throw directErr;

  let budgetId: string | null = null;
  let planned = 0;
  let categoryIds: string[] = [category.id];

  if (directBudgets && directBudgets.length > 0) {
    const b = directBudgets[0] as Record<string, JsonValue>;
    budgetId = String(b.id);
    planned = Number(b.amount_planned ?? b.planned ?? 0);
  } else {
    const { data: links, error: linkErr } = await supabase
      .from("budget_categories")
      .select("budget_id")
      .eq("category_id", category.id);
    if (linkErr) throw linkErr;
    const budgetIds = (links ?? []).map((v: Record<string, JsonValue>) => String(v.budget_id));
    if (budgetIds.length === 0) return null;

    const { data: budgets, error: budgetErr } = await supabase
      .from("budgets")
      .select("id,amount_planned,planned")
      .eq("user_id", userId)
      .in("id", budgetIds)
      .or(`period_month.eq.${monthStart},month.eq.${monthStart}`)
      .limit(1);
    if (budgetErr) throw budgetErr;
    if (!budgets || budgets.length === 0) return null;

    const b = budgets[0] as Record<string, JsonValue>;
    budgetId = String(b.id);
    planned = Number(b.amount_planned ?? b.planned ?? 0);
  }

  if (!budgetId) return null;

  const { data: multiCats, error: multiErr } = await supabase
    .from("budget_categories")
    .select("category_id")
    .eq("budget_id", budgetId);
  if (multiErr) throw multiErr;

  const linked = (multiCats ?? []).map((v: Record<string, JsonValue>) => String(v.category_id));
  if (linked.length > 0) categoryIds = [...new Set([...categoryIds, ...linked])];

  const { data: catNamesData } = await supabase.from("categories").select("name").in("id", categoryIds);
  const categoryNames = (catNamesData ?? []).map((v: Record<string, JsonValue>) => String(v.name));

  const { data: txs, error: txErr } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("type", "expense")
    .is("to_account_id", null)
    .is("deleted_at", null)
    .gte("date", monthStart)
    .lt("date", nextMonthStart)
    .in("category_id", categoryIds);
  if (txErr) throw txErr;

  const used = (txs ?? []).reduce((acc, item: Record<string, JsonValue>) => acc + Number(item.amount ?? 0), 0);
  const remaining = planned - used;
  const percentage = planned > 0 ? (used / planned) * 100 : 0;

  return { categoryNames, planned, used, remaining, percentage };
}

async function getWeeklyBudgetInfo(userId: string, categoryName: string, date?: string): Promise<BudgetInfo | null> {
  const category = await findCategory(userId, categoryName);
  if (!category) return null;

  const dateRef = date ? new Date(`${date}T00:00:00+07:00`) : new Date();
  const weekStart = getWeekStartJakarta(dateRef);
  const nextWeekStart = getNextWeekStartJakarta(dateRef);

  let budgetId: string | null = null;
  let planned = 0;
  let categoryIds: string[] = [category.id];
  const { data: directBudget, error: directErr } = await supabase
    .from("budgets_weekly")
    .select("id,user_id,category_id,name,planned_amount,week_start,month_start,created_at")
    .eq("user_id", userId)
    .eq("category_id", category.id)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (directErr) throw directErr;

  if (directBudget) {
    budgetId = String((directBudget as Record<string, JsonValue>).id ?? "");
    planned = Number((directBudget as Record<string, JsonValue>).planned_amount ?? 0);
  }

  const { data: mappedRows, error: mappedErr } = await supabase
    .from("weekly_budget_categories")
    .select("budget_weekly_id,category_id")
    .eq("user_id", userId)
    .eq("category_id", category.id);
  if (mappedErr) throw mappedErr;

  if (!budgetId) {
    const mappedBudgetIds = [...new Set((mappedRows ?? [])
      .map((row: Record<string, JsonValue>) => String(row.budget_weekly_id ?? ""))
      .filter(Boolean))];

    if (mappedBudgetIds.length > 0) {
      const { data: mappedBudget, error: mappedBudgetErr } = await supabase
        .from("budgets_weekly")
        .select("id,user_id,category_id,name,planned_amount,week_start,month_start,created_at")
        .eq("user_id", userId)
        .eq("week_start", weekStart)
        .in("id", mappedBudgetIds)
        .maybeSingle();
      if (mappedBudgetErr) throw mappedBudgetErr;

      if (mappedBudget) {
        budgetId = String((mappedBudget as Record<string, JsonValue>).id ?? "");
        planned = Number((mappedBudget as Record<string, JsonValue>).planned_amount ?? 0);
      }
    }
  }

  if (!budgetId) return null;

  const { data: linkedRows, error: linkedErr } = await supabase
    .from("weekly_budget_categories")
    .select("category_id")
    .eq("user_id", userId)
    .eq("budget_weekly_id", budgetId);
  if (linkedErr) throw linkedErr;

  const linkedCategoryIds = (linkedRows ?? [])
    .map((row: Record<string, JsonValue>) => String(row.category_id ?? ""))
    .filter(Boolean);

  if (linkedCategoryIds.length > 0) {
    categoryIds = [...new Set([...categoryIds, ...linkedCategoryIds])];
  }

  const { data: categoryNameRows } = await supabase
    .from("categories")
    .select("id,name")
    .in("id", categoryIds);

  const categoryNames = (categoryNameRows ?? [])
    .map((row: Record<string, JsonValue>) => String(row.name ?? ""))
    .filter(Boolean);

  const { data: txRows, error: txErr } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("type", "expense")
    .is("deleted_at", null)
    .is("to_account_id", null)
    .in("category_id", categoryIds)
    .gte("date", weekStart)
    .lt("date", nextWeekStart);
  if (txErr) throw txErr;

  const used = (txRows ?? []).reduce(
    (sum: number, tx: Record<string, JsonValue>) => sum + Number(tx.amount ?? 0),
    0,
  );

  const remaining = planned - used;
  const percentage = planned > 0 ? (used / planned) * 100 : 0;

  return {
    categoryNames: categoryNames.length > 0 ? categoryNames : [category.name],
    planned,
    used,
    remaining,
    percentage,
  };
}


function buildCombinedBudgetLines(monthlyBudget: BudgetInfo | null, weeklyBudget: BudgetInfo | null): string[] {
  const lines: string[] = [];

  if (monthlyBudget) {
    lines.push("📆 Budget Bulanan");
    lines.push(`• Terpakai: ${formatIDR(monthlyBudget.used)} / ${formatIDR(monthlyBudget.planned)}`);
    lines.push(`• Sisa: ${formatIDR(monthlyBudget.remaining)}`);
    if (monthlyBudget.percentage >= 80) lines.push(`⚠️ Budget bulanan hampir habis (${monthlyBudget.percentage.toFixed(1)}%)`);
  }

  if (weeklyBudget) {
    if (lines.length > 0) lines.push("");
    lines.push("🗓️ Budget Mingguan");
    lines.push(`• Terpakai: ${formatIDR(weeklyBudget.used)} / ${formatIDR(weeklyBudget.planned)}`);
    lines.push(`• Sisa: ${formatIDR(weeklyBudget.remaining)}`);
    if (weeklyBudget.percentage >= 80) lines.push(`⚠️ Budget mingguan hampir habis (${weeklyBudget.percentage.toFixed(1)}%)`);
  }

  return lines;
}

function parseBudgetPeriodCommand(text: string): BudgetPeriodCommand | null {
  const normalized = normalizeText(text);
  const map: Record<string, BudgetPeriodCommand> = {
    "budget bulan ini": { periodType: "monthly", period: "current" },
    "budget bulan lalu": { periodType: "monthly", period: "previous" },
    "budget bulan besok": { periodType: "monthly", period: "next" },
    "budget now": { periodType: "monthly", period: "current" },
    "budget prev": { periodType: "monthly", period: "previous" },
    "budget next": { periodType: "monthly", period: "next" },
  };
  return map[normalized] ?? null;
}

function getBudgetPeriodRange(periodType: BudgetPeriodType, period: BudgetPeriodKey): BudgetPeriodRange {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const target = new Date(now);
  target.setMonth(target.getMonth() + (period === "previous" ? -1 : period === "next" ? 1 : 0));

  const start = getMonthStart(target);
  const end = getNextMonthStart(target);
  return { start, end, periodMonth: start, periodType, period };
}

async function getMonthlyBudgetsByPeriod(userId: string, range: BudgetPeriodRange): Promise<BudgetPeriodItem[]> {
  const { data, error } = await supabase.from("budgets")
    .select("id,user_id,name,amount_planned,planned,category_id,period_month,month,created_at")
    .eq("user_id", userId)
    .or(`period_month.eq.${range.periodMonth},month.eq.${range.periodMonth}`);
  if (error) throw error;
  const rows = (data ?? []) as Array<Record<string, JsonValue>>;
  if (rows.length === 0) return [];

  const budgetIds = rows.map((r) => String(r.id ?? "")).filter(Boolean);
  const { data: links } = await supabase.from("budget_categories").select("budget_id,category_id").in("budget_id", budgetIds);
  const linkMap = new Map<string, string[]>();
  for (const row of (links ?? []) as Array<Record<string, JsonValue>>) {
    const bid = String(row.budget_id ?? "");
    const cid = String(row.category_id ?? "");
    if (!bid || !cid) continue;
    linkMap.set(bid, [...(linkMap.get(bid) ?? []), cid]);
  }

  const allCategoryIds = new Set<string>();
  const budgetCategoryMap = new Map<string, string[]>();
  for (const row of rows) {
    const bid = String(row.id ?? "");
    const direct = String(row.category_id ?? "");
    const linked = linkMap.get(bid) ?? [];
    const merged = [...new Set([...(direct ? [direct] : []), ...linked])];
    budgetCategoryMap.set(bid, merged);
    for (const cid of merged) allCategoryIds.add(cid);
  }

  const categoryIdList = [...allCategoryIds];
  const { data: categories } = categoryIdList.length > 0
    ? await supabase.from("categories").select("id,name").in("id", categoryIdList)
    : { data: [] as Array<Record<string, JsonValue>> };
  const categoryNameMap = new Map((categories ?? []).map((c: Record<string, JsonValue>) => [String(c.id), String(c.name)]));

  const { data: txs, error: txErr } = categoryIdList.length > 0
    ? await supabase.from("transactions").select("amount,category_id")
      .eq("user_id", userId).eq("type", "expense").is("deleted_at", null).is("to_account_id", null)
      .gte("date", range.start).lt("date", range.end).in("category_id", categoryIdList)
    : { data: [], error: null };
  if (txErr) throw txErr;
  const txSumByCategory = new Map<string, number>();
  for (const tx of (txs ?? []) as Array<Record<string, JsonValue>>) {
    const cid = String(tx.category_id ?? "");
    if (!cid) continue;
    txSumByCategory.set(cid, (txSumByCategory.get(cid) ?? 0) + Number(tx.amount ?? 0));
  }

  return rows
    .map((row) => {
      const planned = Number(row.amount_planned ?? row.planned ?? 0);
      if (planned <= 0) return null;
      const bid = String(row.id ?? "");
      const categoryIds = budgetCategoryMap.get(bid) ?? [];
      const used = categoryIds.reduce((sum, cid) => sum + (txSumByCategory.get(cid) ?? 0), 0);
      return {
        categoryNames: categoryIds.map((cid) => categoryNameMap.get(cid) ?? "-").filter(Boolean),
        planned,
        used,
        remaining: planned - used,
        percentage: planned > 0 ? Math.round((used / planned) * 100) : 0,
        createdAt: String(row.created_at ?? ""),
      };
    })
    .filter((v): v is BudgetPeriodItem => Boolean(v))
    .sort((a, b) => (b.planned - a.planned) || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
}

function buildBudgetPeriodMessage(command: BudgetPeriodCommand, monthly: BudgetPeriodItem[]): string {
  if (monthly.length === 0) return "📊 Belum ada budget bulanan untuk periode ini.";
  const titleMap: Record<BudgetPeriodType, Record<BudgetPeriodKey, string>> = {
    monthly: { current: "📊 *Budget Bulan Ini*", previous: "📊 *Budget Bulan Lalu*", next: "📊 *Budget Bulan Besok*" },
  };
  const lines: string[] = [titleMap[command.periodType][command.period], ""];
  monthly.forEach((b, i) => {
    lines.push(`${i + 1}. ${b.categoryNames.join(", ")}`);
    lines.push(`💰 Budget: ${formatIDR(b.planned)}`);
    lines.push(`📉 Terpakai: ${formatIDR(b.used)}`);
    lines.push(`💵 Sisa: ${formatIDR(b.remaining)}`);
    lines.push(`📈 Progress: ${b.percentage}%`);
    if (b.percentage >= 100) lines.push("🚨 Budget terlampaui");
    else if (b.percentage >= 80) lines.push("⚠️ Hampir habis");
    lines.push("");
  });
  return lines.join("\n").trim();
}

function buildMenuMessage(): string {
  return [
    "📋 *Menu HematWoi*",
    "",
    "💰 *Keuangan*",
    "• saldo",
    "• summary",
    "• history",
    "🎯 *Budget*",
    "• budget jajan",
    "• budget bulan ini",
    "• budget bulan lalu",
    "• budget bulan besok",
    "• minggu ini",
    "• bulan ini",
    "• top kategori",
    "• cashflow",
    "",
    "➕ *Transaksi*",
    "• catat transaksi",
    "• catat natural",
    "• smart akun otomatis",
    "• transfer",
    "• hutang / piutang",
    "• edit transaksi",
    "",
    "🤖 *AI Assistant*",
    "• ai",
    "• 🤖 ai → buka AI Finance Assistant",
    "• pilih nomor pertanyaan",
    "• tanya bebas",
    "",
    "🧾 *Data*",
    "• kategori",
    "• akun",
    "• info",
    "",
    "⚙️ *Lainnya*",
    "• hapus",
    "• ping",
    "• contoh",
    "",
    "Ketik *contoh* untuk melihat cara penggunaan.",
  ].join("\n");
}

function buildExampleMessage(): string {
  return [
    "📘 *Contoh Penggunaan HematWoi*",
    "",
    "➕ *Catat Transaksi*",
    "• jajan 10000 cash",
    "• jajan kopi 10000 cash",
    "• jajan kopi 10000 cash 31/05",
    "",
    "🤖 *Smart Auto Category*",
    "• kopi 10000 cash",
    "• mixue 25000 cash",
    "• bensin 20000 cash 31/05",
    "",
    "🤖 *Smart Auto Account*",
    "• kopi 20rb",
    "• momoyo 20000",
    "• tadi beli momoyo 20rb",
    "• edit akun cash",
    "• edit 3 15000",
    "",
    "🎯 *Budget*",
    "• budget jajan",
    "• budget bulan ini",
    "• budget bulan lalu",
    "• budget bulan besok",
    "",
    "🗣️ *Bahasa Natural*",
    "• tadi beli kopi 20rb pake cash",
    "• beli bensin 50rb cash",
    "• dibayar freelance 500rb ke seabank",
    "• gajian 3000000 masuk seabank",
    "• tadi beli kopi 20rb cash 31/05",
    "",
    "Catatan:",
    "Bot akan menebak kategori dari histori transaksi.",
    "Jika akun tidak ditulis, bot akan menebak akun dari history transaksi.",
    "Kalau salah, gunakan: edit akun namaAkun",
    "Jika belum ada histori yang cocok, gunakan format lengkap:",
    "• jajan kopi 10000 cash",
    "",
    "🔁 *Transfer*",
    "• tf 50000 cash seabank",
    "",
    "📚 *History*",
    "• history",
    "• history 31/05",
    "• history jajan 31/05",
    "• hapus 3",
    "",
    "Setelah menampilkan history, kamu bisa hapus berdasarkan nomor:",
    "hapus 3",
    "",
    "✏️ *Edit Transaksi*",
    "• edit 3 15000",
    "• edit 3 judul kopi susu",
    "• edit 3 kategori makan",
    "• edit 3 akun cash",
    "• edit 3 tanggal 31/05",
    "",
    "Catatan: Gunakan nomor dari history terakhir.",
    "",
    "🎯 *Budget*",
    "• budget jajan",
    "",
    "💳 *Hutang / Piutang*",
    "• hutang",
    "• tambah hutang shopee 100000 seabank",
    "• bayar hutang shopee 25000 seabank",
    "• tambah piutang andi 50000 cash",
    "• bayar piutang andi 50000 cash",
    "",
    "📊 *Statistik Cepat*",
    "• minggu ini",
    "• bulan ini",
    "• top kategori",
    "• cashflow",
    "",
    "🤖 *AI Query*",
    "• ai",
    "• 🤖 ai → buka AI Finance Assistant",
    "• pilih nomor 1-10",
    "• berapa jajan bulan ini",
    "• saldo cash",
    "• merchant paling sering",
    "",
    "🗓️ *Tanggal Opsional*",
    "Format tanggal:",
    "• DD/MM",
    "",
    "Contoh:",
    "• 31/05",
    "• 01/06",
  ].join("\n");
}

function isBotReply(body: WebhookBody, sender: string, device: string, message: string): boolean {
  const statusText = String(body.status ?? "").toLowerCase();
  const text = message.toLowerCase();
  const hasBotPrefix = BOT_PREFIXES.some((prefix) => message.startsWith(prefix));

  return Boolean(
    body.from_me === true ||
      body.fromMe === true ||
      body.isMe === true ||
      body.key?.fromMe === true ||
      body.data?.from_me === true ||
      body.data?.fromMe === true ||
      body.data?.isMe === true ||
      statusText === "sent" ||
      statusText === "delivered" ||
      statusText === "read" ||
      (sender && device && sender === device) ||
      text.includes("sent via fonnte.com") ||
      hasBotPrefix,
  );
}

Deno.serve(async (req: Request) => {
  let sender = "";
  let message = "";
  let waMessageId = "";
  let userId: string | null = null;
  let canReplyOnError = false;

  try {
    if (req.method !== "POST") return json({ ok: true, ignored: true, reason: "method not allowed" });

    const body = (await req.json()) as WebhookBody;
    sender = extractSender(body);
    message = extractMessage(body);
    const device = extractDevice(body);
    waMessageId = extractWaMessageId(body, sender, message);

    if (isBotReply(body, sender, device, message)) {
      return json({ ok: true, ignored: true, reason: "bot/self reply" });
    }

    canReplyOnError = Boolean(sender);

    const { data: duplicate, error: duplicateError } = await supabase
      .from("whatsapp_message_logs")
      .select("id")
      .eq("wa_message_id", waMessageId)
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) return json({ ok: true, duplicate: true });

    const waUser = await getWaUser(sender);
    if (!waUser) {
      await logMessage({
        wa_message_id: waMessageId,
        phone: sender,
        user_id: null,
        raw_text: message,
        parsed: { command: "unknown" },
        status: "failed",
        error_message: "WA user not found",
      });
      await replyWhatsApp(sender, "❌ Nomor belum terdaftar di HematWoi.");
      return json({ ok: true, handled: true, reason: "user not found" });
    }

    userId = waUser.user_id;
    const normalized = normalizeText(message);

    let reply = "";
    let parsedLog: Record<string, JsonValue> = { command: normalized.split(" ")[0] ?? "" };

    if (MENU_COMMANDS.has(normalized)) {
      reply = buildMenuMessage();
    } else if (normalized === "contoh") {
      reply = buildExampleMessage();
      parsedLog = { command: "contoh" };
    } else if (normalized === "ping") {
      reply = "🏓 pong";
    } else if (/^edit\s+\d+(\s|$)/.test(normalized)) {
      const editResult = await handleEditTransaction(userId, sender, message);
      reply = editResult.reply;
      parsedLog = editResult.parsedLog;
    } else if (normalized.startsWith("edit akun")) {
      const editResult = await handleEditLastTransactionAccount(userId, normalized);
      reply = editResult.reply;
      parsedLog = editResult.parsedLog;
    } else if (
      normalized === "hutang" ||
      normalized.startsWith("tambah hutang") ||
      normalized.startsWith("tambah piutang") ||
      normalized.startsWith("bayar hutang") ||
      normalized.startsWith("bayar piutang")
    ) {
      const debtRes = await handleDebtCommand(userId, message, normalized);
      reply = debtRes.reply;
      parsedLog = debtRes.parsedLog;
    } else if (AI_SUGGESTION_COMMANDS.has(normalized)) {
      const suggestions = await getRandomAISuggestions(userId, 10);
      reply = buildAISuggestionMessage(suggestions);
      parsedLog = { command: "ai_suggestion", sessionId: crypto.randomUUID(), suggestions, active: true };
    } else if (isAISuggestionNumber(normalized)) {
      const aiPick = await handleAISuggestionPick(userId, sender, normalized);
      reply = aiPick.reply;
      parsedLog = aiPick.parsedLog;
    } else if (normalized.startsWith("ai ")) {
      const question = message.trim().replace(/^ai\s+/i, "").trim();
      const ai = await handleAiQuestion(userId, question);
      parsedLog = { command: "ai_question", intent: ai.intent, question, keyword: ai.keyword ?? null, period: ai.period ?? null };
      reply = ai.reply;
    } else if (normalized === "minggu ini") {
      const weekRange = getWeekRangeJakarta();
      const summary = await getTransactionSummaryByRange(userId, weekRange.start, weekRange.end);
      reply = buildQuickStatsReply("weekly", summary, [], weekRange.daysPassed);
      parsedLog = { command: "quick_stats", type: "weekly" };
    } else if (normalized === "bulan ini") {
      const monthRange = getMonthRangeJakarta();
      const summary = await getTransactionSummaryByRange(userId, monthRange.start, monthRange.end);
      reply = buildQuickStatsReply("monthly", summary, [], monthRange.daysPassed);
      parsedLog = { command: "quick_stats", type: "monthly" };
    } else if (normalized === "top kategori") {
      const monthRange = getMonthRangeJakarta();
      const topCategories = await getTopExpenseCategoriesByRange(userId, monthRange.start, monthRange.end, 5);
      reply = buildQuickStatsReply("top_category", null, topCategories);
      parsedLog = { command: "quick_stats", type: "top_category" };
    } else if (normalized === "cashflow") {
      const currentRange = getMonthRangeJakarta();
      const previousRange = getPreviousMonthRangeJakarta();
      const current = await getTransactionSummaryByRange(userId, currentRange.start, currentRange.end);
      const previous = await getTransactionSummaryByRange(userId, previousRange.start, previousRange.end);
      reply = buildCashflowReply(current, previous);
      parsedLog = { command: "quick_stats", type: "cashflow" };
    } else if (normalized === "saldo") {
      const b = await getRealtimeBalanceSummary(userId);
      reply = ["💰 Saldo HematWoi", "", `Cash: ${formatIDR(b.cash)}`, `Non Cash: ${formatIDR(b.nonCash)}`, `Total: ${formatIDR(b.total)}`].join("\n");
    } else if (normalized === "summary") {
      const today = getTodayJakarta();
      const { data: txs, error } = await supabase
        .from("transactions")
        .select("amount,type,category_id")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .eq("date", today);
      if (error) throw error;

      let income = 0;
      let expense = 0;
      const catMap = new Map<string, number>();

      for (const tx of (txs ?? []) as Array<Record<string, JsonValue>>) {
        const amount = Number(tx.amount ?? 0);
        const type = String(tx.type ?? "");
        if (type === "income") income += amount;
        if (type === "expense") {
          expense += amount;
          const cid = String(tx.category_id ?? "");
          if (cid) catMap.set(cid, (catMap.get(cid) ?? 0) + amount);
        }
      }

      let biggestCategory = "-";
      if (catMap.size > 0) {
        const [topId] = [...catMap.entries()].sort((a, b) => b[1] - a[1])[0];
        const { data: cat } = await supabase.from("categories").select("name").eq("id", topId).maybeSingle();
        biggestCategory = cat?.name ?? "-";
      }

      reply = [
        "📊 Summary Hari Ini",
        `Pemasukan: ${formatIDR(income)}`,
        `Pengeluaran: ${formatIDR(expense)}`,
        `Kategori terbesar: ${biggestCategory}`,
      ].join("\n");
    } else if (normalized.startsWith("riwayat")) {
      reply = "⚠️ Command sudah diganti.\n\nGunakan:\nhistory";
    } else if (normalized.startsWith("history")) {
      const arg = normalized.replace(/^history\s*/, "").trim();
      const tokens = arg ? arg.split(/\s+/).filter(Boolean) : [];
      let categoryName = "";
      let targetDate: string | null = null;
      const lastToken = tokens[tokens.length - 1] ?? "";

      if (lastToken && isDateToken(lastToken)) {
        const parsedDate = parseCustomDateToken(lastToken);
        if (!parsedDate) {
          reply = "⚠️ Format tanggal tidak valid.\n\nGunakan format:\n31/05";
        } else {
          targetDate = parsedDate;
          tokens.pop();
        }
      }

      const remainingArg = tokens.join(" ").trim();
      if (!reply) {
        if (remainingArg === "hari ini") {
          targetDate = getTodayJakarta();
        } else if (remainingArg) {
          categoryName = remainingArg;
        }
      }

      parsedLog = { command: "history", categoryName, targetDate };

      let query = supabase
        .from("transactions")
        .select("id,title,amount,type,date,category_id,account_id,to_account_id")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("inserted_at", { ascending: false })
        .limit(5);

      if (targetDate) {
        query = query.eq("date", targetDate);
      }

      let categoryLabel = "";
      if (!reply && categoryName) {
        const cat = await findCategory(userId, categoryName);
        if (!cat) {
          reply = `⚠️ Kategori tidak ditemukan: ${categoryName}`;
        } else {
          query = query.eq("category_id", cat.id);
          categoryLabel = cat.name;
        }
      }

      if (!reply) {
        const { data: txRows, error: txErr } = await query;
        if (txErr) throw txErr;

        const transactions = (txRows ?? []) as Array<Record<string, JsonValue>>;
        if (transactions.length === 0) {
          reply = "📚 Tidak ada history transaksi.";
        } else {
          const categoryIds = [...new Set(transactions.map((tx) => String(tx.category_id ?? "")).filter(Boolean))];
          const accountIds = [...new Set(
            transactions
              .flatMap((tx) => [String(tx.account_id ?? ""), String(tx.to_account_id ?? "")])
              .filter(Boolean),
          )];

          const categoryMap = new Map<string, string>();
          const accountMap = new Map<string, string>();

          if (categoryIds.length > 0) {
            const { data: categoryRows } = await supabase.from("categories").select("id,name").in("id", categoryIds);
            for (const row of (categoryRows ?? []) as Array<Record<string, JsonValue>>) {
              categoryMap.set(String(row.id), String(row.name));
            }
          }

          if (accountIds.length > 0) {
            const { data: accountRows } = await supabase.from("accounts").select("id,name").in("id", accountIds);
            for (const row of (accountRows ?? []) as Array<Record<string, JsonValue>>) {
              accountMap.set(String(row.id), String(row.name));
            }
          }

          const displayedTransactions: JsonValue[] = [];
          const lines = transactions.map((tx, i) => {
            const no = i + 1;
            const type = String(tx.type ?? "expense");
            const amount = Number(tx.amount ?? 0);
            const txId = String(tx.id ?? "");
            const txDate = String(tx.date ?? "");
            const categoryName = categoryMap.get(String(tx.category_id ?? "")) ?? "-";
            const accountName = accountMap.get(String(tx.account_id ?? "")) ?? "-";
            const title = String(tx.title ?? "-");
            if (type === "transfer") {
              const fromName = accountMap.get(String(tx.account_id ?? "")) ?? "-";
              const toName = accountMap.get(String(tx.to_account_id ?? "")) ?? "-";
              displayedTransactions.push({
                no,
                id: txId,
                title,
                amount,
                type,
                date: txDate,
                categoryName,
                accountName,
                toAccountName: toName,
              });
              return `${no}. ${txDate}\n   Transfer ${fromName} → ${toName}\n   ↔ ${formatIDR(amount)}`;
            }
            const sign = type === "income" ? "+" : "-";
            displayedTransactions.push({
              no,
              id: txId,
              title,
              amount,
              type,
              date: txDate,
              categoryName,
              accountName,
            });
            return `${no}. ${txDate}\n   ${categoryName} - ${title}\n   ${sign} ${formatIDR(amount)} via ${accountName}`;
          });

          const headerLines = ["📚 *History Transaksi*"];
          if (targetDate) {
            const [year, month, day] = targetDate.split("-");
            headerLines.push(`Tanggal: ${day}/${month}/${year}`);
          }
          if (categoryLabel) {
            headerLines.push(`Kategori: ${categoryLabel.charAt(0).toUpperCase()}${categoryLabel.slice(1)}`);
          }
          parsedLog = { command: "history", categoryName, targetDate, displayedTransactions };
          const header = headerLines.length > 1 ? `${headerLines.join("\n")}\n` : headerLines[0];
          reply = `${header}\n\n${lines.join("\n\n")}`;
        }
      }
    } else if (/^hapus\s+\d+$/.test(normalized)) {
      const number = Number(normalized.replace(/^hapus\s+/, "").trim());
      parsedLog = { command: "hapus_history", number };

      if (!Number.isInteger(number) || number < 1 || number > 5) {
        reply = "⚠️ Nomor history tidak valid.\n\nPilih nomor dari hasil history terakhir.";
      } else {
        const displayedTransactions = await getLastHistoryTransactions(userId, sender);
        if (displayedTransactions.length === 0) {
          reply = "⚠️ Belum ada history terakhir.\n\nKirim *history* dulu, lalu gunakan:\nhapus 3";
        } else {
          const selectedTransaction = findDisplayedTransactionByNumber(displayedTransactions, number);
          if (!selectedTransaction) {
            reply = "⚠️ Nomor history tidak ditemukan.\n\nKirim *history* dulu, lalu pilih nomor yang ingin dihapus.\nContoh: hapus 3";
          } else {
            const transactionId = String(selectedTransaction.id ?? "");
            const { data: deletedTx, error: deleteError } = await supabase
              .from("transactions")
              .update({ deleted_at: new Date().toISOString() })
              .eq("id", transactionId)
              .eq("user_id", userId)
              .is("deleted_at", null)
              .select("id")
              .maybeSingle();
            if (deleteError) throw deleteError;

            if (!deletedTx) {
              reply = "⚠️ Transaksi ini sudah tidak aktif atau sudah dihapus.";
            } else {
              parsedLog = { command: "hapus_history", number, transactionId, deletedTransaction: selectedTransaction };
              const type = String(selectedTransaction.type ?? "expense");
              const date = String(selectedTransaction.date ?? "-");
              const amount = Number(selectedTransaction.amount ?? 0);

              if (type === "transfer") {
                const fromName = String(selectedTransaction.accountName ?? "-");
                const toName = String(selectedTransaction.toAccountName ?? "-");
                reply = [
                  "🗑️ Transfer berhasil dihapus",
                  "",
                  `No: ${number}`,
                  `Tanggal: ${date}`,
                  `Transfer: ${fromName} → ${toName}`,
                  `Nominal: ${formatIDR(amount)}`,
                ].join("\n");
              } else {
                reply = [
                  "🗑️ Transaksi berhasil dihapus",
                  "",
                  `No: ${number}`,
                  `Tanggal: ${date}`,
                  `Kategori: ${String(selectedTransaction.categoryName ?? "-")}`,
                  `Judul: ${String(selectedTransaction.title ?? "-")}`,
                  `Nominal: ${formatIDR(amount)}`,
                  `Akun: ${String(selectedTransaction.accountName ?? "-")}`,
                ].join("\n");
              }
            }
          }
        }
      }
    } else if (parseBudgetPeriodCommand(normalized)) {
      const periodCommand = parseBudgetPeriodCommand(normalized) as BudgetPeriodCommand;
      const range = getBudgetPeriodRange(periodCommand.periodType, periodCommand.period);
      const monthlyBudgets = await getMonthlyBudgetsByPeriod(userId, range);
      reply = buildBudgetPeriodMessage(periodCommand, monthlyBudgets);
      parsedLog = { command: "budget_period", periodType: "monthly", period: periodCommand.period };
    } else if (normalized.startsWith("budget ")) {
      const categoryName = normalized.replace(/^budget\s+/, "").trim();
      const [monthlyBudget, weeklyBudget] = await Promise.all([
        getMonthlyBudgetInfo(userId, categoryName),
        getWeeklyBudgetInfo(userId, categoryName),
      ]);

      if (!monthlyBudget && !weeklyBudget) {
        reply = `📊 Budget untuk kategori *${categoryName}* belum ada.`;
      } else {
        const categoryLabel =
          monthlyBudget?.categoryNames?.[0] ??
          weeklyBudget?.categoryNames?.[0] ??
          categoryName;

        const budgetLines = buildCombinedBudgetLines(monthlyBudget, weeklyBudget);

        reply = [
          "📊 *Info Budget*",
          `Kategori: ${categoryLabel}`,
          "",
          ...budgetLines,
        ].join("\n");
      }
    } else if (normalized === "kategori") {
      const { data, error } = await supabase.from("categories").select("name,type").eq("user_id", userId).order("name");
      if (error) throw error;
      const lines = (data ?? []).map((c: Record<string, JsonValue>, i: number) => `${i + 1}. ${String(c.name)} (${String(c.type)})`);
      reply = `🧾 Daftar Kategori\n${lines.length > 0 ? lines.join("\n") : "Belum ada kategori."}`;
    } else if (normalized === "akun") {
      const { data, error } = await supabase.from("accounts").select("name,type").eq("user_id", userId).order("name");
      if (error) throw error;
      const lines = (data ?? []).map((a: Record<string, JsonValue>, i: number) => `${i + 1}. ${String(a.name)} (${String(a.type)})`);
      reply = `🏦 Daftar Akun\n${lines.length > 0 ? lines.join("\n") : "Belum ada akun."}`;
    } else if (normalized === "info") {
      const today = getTodayJakarta();
      const [{ count: accountCount }, { count: categoryCount }, { count: txCount }] = await Promise.all([
        supabase.from("accounts").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("categories").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("transactions").select("user_id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null).eq("date", today),
      ]);

      reply = [
        "ℹ️ Info HematWoi",
        `Jumlah akun: ${accountCount ?? 0}`,
        `Jumlah kategori: ${categoryCount ?? 0}`,
        `Total transaksi hari ini: ${txCount ?? 0}`,
      ].join("\n");
    } else if (normalized === "hapus" || normalized === "undo") {
      const { data: lastTx, error } = await supabase
        .from("transactions")
        .select("amount")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("inserted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      if (!lastTx) {
        reply = "ℹ️ Tidak ada transaksi yang bisa dihapus.";
      } else {
        const { error: updateError } = await supabase
          .from("transactions")
          .update({ deleted_at: new Date().toISOString() })
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("inserted_at", { ascending: false })
          .limit(1);
        if (updateError) throw updateError;
        reply = `🗑️ Transaksi terakhir berhasil dihapus.\nNominal: ${formatIDR(Number((lastTx as Record<string, JsonValue>).amount ?? 0))}`;
      }
    } else {
      const transfer = parseTransferMessage(normalized);
      if (transfer) {
        parsedLog = { command: "tf", amount: transfer.amount, from: transfer.fromAccountName, to: transfer.toAccountName };

        const fromAccount = await findAccount(userId, transfer.fromAccountName);
        const toAccount = await findAccount(userId, transfer.toAccountName);
        if (!fromAccount || !toAccount) {
          reply = "❌ Akun transfer tidak ditemukan.";
        } else {
          const { error } = await supabase.from("transactions").insert({
            user_id: userId,
            date: getTodayJakarta(),
            type: "transfer",
            account_id: fromAccount.id,
            to_account_id: toAccount.id,
            amount: transfer.amount,
            title: `Transfer ${fromAccount.name} ke ${toAccount.name}`,
            notes: `WhatsApp: ${message}`,
          });
          if (error) throw error;

          reply = [
            "✅ Transfer tercatat",
            `Nominal: ${formatIDR(transfer.amount)}`,
            `Dari: ${fromAccount.name}`,
            `Ke: ${toAccount.name}`,
          ].join("\n");
        }
      } else {
        const tx = parseTransactionMessage(normalized);
        if (tx && "error" in tx && tx.error === "INVALID_DATE") {
          reply = ["⚠️ Format tanggal tidak valid.", "", "Gunakan format:", "31/05"].join("\n");
        } else if (tx && !("error" in tx)) {
          parsedLog = { command: "transaction", category: tx.categoryName, account: tx.accountName, amount: tx.amount, title: tx.title };
          const category = await findCategory(userId, tx.categoryName);
          const account = await findAccount(userId, tx.accountName);

          if (!category) {
            const smartTx = parseSmartTransactionMessage(normalized);
            if (smartTx && !("error" in smartTx)) {
              const smartAccount = smartTx.accountName
                ? await findAccount(userId, smartTx.accountName)
                : await findAccountByTransactionHistory(userId, smartTx.title, null, null);
              if (smartTx.accountName && !smartAccount) {
                reply = `❌ Akun *${smartTx.accountName}* tidak ditemukan.`;
              } else if (!smartAccount) {
                reply = ["⚠️ Akun otomatis tidak ditemukan.", "", "Gunakan format:", "momoyo 20000 seabank", "", "Setelah itu sistem bisa belajar dari history."].join("\n");
              } else {
                const smartCategory = await findCategoryByTransactionHistory(userId, smartTx.title);
                if (!smartCategory) {
                  parsedLog = { command: "smart_transaction_failed", title: smartTx.title, amount: smartTx.amount, accountName: smartTx.accountName, reason: "category_not_found" };
                  reply = ["⚠️ Kategori otomatis tidak ditemukan.", "", "Gunakan format lengkap:", "jajan kopi 10000 cash", "", "Atau buat dulu transaksi dengan kategori agar sistem bisa belajar."].join("\n");
                } else {
                  parsedLog = { command: "smart_transaction", title: smartTx.title, amount: smartTx.amount, categoryName: smartCategory.name, accountName: smartAccount.name, accountSource: smartTx.accountName ? "manual" : "history" };
                  const smartType = smartCategory.type === "income" ? "income" : "expense";
                  const { error } = await supabase.from("transactions").insert({ user_id: userId, date: smartTx.date, type: smartType, category_id: smartCategory.id, account_id: smartAccount.id, amount: smartTx.amount, title: smartTx.title, notes: `WhatsApp: ${message}` });
                  if (error) throw error;
                  const b = await getRealtimeBalanceSummary(userId);
                  const lines = [smartType === "income" ? "✅ Pemasukan tercatat" : "✅ Pengeluaran tercatat", "", `Kategori: ${smartCategory.name}`, `Judul: ${smartTx.title}`, `Nominal: ${formatIDR(smartTx.amount)}`, `Akun: ${smartAccount.name}`];
                  if (smartTx.accountName) lines.push("", "🤖 Kategori otomatis dari history.");
                  else lines.push("", "🤖 Kategori & akun otomatis dari history.", "Kalau akun salah, ketik:", `edit akun ${smartAccount.name}`);
                  if (smartType === "expense") {
                    lines.push("", "💰 Saldo Saat Ini", `Cash: ${formatIDR(b.cash)}`, `Non Cash: ${formatIDR(b.nonCash)}`, `Total: ${formatIDR(b.total)}`);
                  }
                  reply = lines.join("\n");
                }
              }
            } else {
              reply = `❌ Kategori *${tx.categoryName}* tidak ditemukan.`;
            }
          } else if (!account) {
            reply = `❌ Akun *${tx.accountName}* tidak ditemukan.`;
          } else {
            const type = category.type === "income" ? "income" : "expense";

            const { error } = await supabase.from("transactions").insert({
              user_id: userId,
              date: tx.date,
              type,
              category_id: category.id,
              account_id: account.id,
              amount: tx.amount,
              title: tx.title,
              notes: `WhatsApp: ${message}`,
            });
            if (error) throw error;

            const b = await getRealtimeBalanceSummary(userId);
            const baseLines = [
              type === "income" ? "✅ Pemasukan tercatat" : "✅ Pengeluaran tercatat",
              "",
              `Tanggal: ${tx.date}`,
              `Kategori: ${category.name}`,
              `Judul: ${tx.title}`,
              `Nominal: ${formatIDR(tx.amount)}`,
              `Akun: ${account.name}`,
              "",
              "💰 Saldo Saat Ini",
              `Cash: ${formatIDR(b.cash)}`,
              `Non Cash: ${formatIDR(b.nonCash)}`,
              `Total: ${formatIDR(b.total)}`,
            ];

            if (type === "expense") {
              const [monthlyBudget, weeklyBudget] = await Promise.all([
                getMonthlyBudgetInfo(userId, category.name, tx.date),
                getWeeklyBudgetInfo(userId, category.name, tx.date),
              ]);

              const budgetLines = buildCombinedBudgetLines(monthlyBudget, weeklyBudget);

              if (budgetLines.length > 0) {
                baseLines.push("", ...budgetLines);
              }
            }

            reply = baseLines.join("\n");
          }
        } else {
          const smartTx = parseSmartTransactionMessage(normalized);
          if (!smartTx) {
            const { data: accountRows, error: accountErr } = await getAccountsBaseQuery(userId, "id,name,type");
            if (accountErr) throw accountErr;
            const accounts = (accountRows ?? []) as Array<{ id: string; name: string; type: string }>;
            const naturalTx = parseNaturalTransactionMessage(normalized, accounts);
            if (!naturalTx) {
              reply = "❌ Format tidak dikenali. Ketik menu untuk bantuan.";
            } else if ("error" in naturalTx && naturalTx.error === "INVALID_DATE") {
              reply = ["⚠️ Format tanggal tidak valid.", "", "Gunakan format:", "31/05"].join("\n");
            } else {
              const category = await findCategoryByTransactionHistory(userId, naturalTx.title);
              if (!category) {
                parsedLog = { command: "natural_transaction_failed", reason: "category_not_found", title: naturalTx.title, amount: naturalTx.amount, accountName: naturalTx.accountName };
                reply = ["⚠️ Kategori otomatis tidak ditemukan.", "", "Gunakan format lengkap:", "jajan kopi 20000 cash", "", "Setelah itu sistem bisa belajar dari histori."].join("\n");
              } else {
                const finalType = naturalTx.type === "income" ? "income" : "expense";
                if (category.type !== finalType) {
                  const forcedCategory = await supabase
                    .from("categories")
                    .select("id,name,type")
                    .eq("user_id", userId)
                    .eq("type", finalType)
                    .order("name")
                    .limit(1)
                    .maybeSingle();
                  if (forcedCategory.error) throw forcedCategory.error;
                  if (forcedCategory.data) {
                    category.id = forcedCategory.data.id;
                    category.name = forcedCategory.data.name;
                    category.type = forcedCategory.data.type;
                  }
                }
                const account = naturalTx.accountName
                  ? accounts.find((a) => a.name.toLowerCase() === naturalTx.accountName!.toLowerCase()) ?? null
                  : await findAccountByTransactionHistory(userId, naturalTx.title, category.id, finalType);
                if (naturalTx.accountName && !account) {
                  reply = ["⚠️ Akun tidak ditemukan.", "", "Sebutkan akun di pesan.", "Contoh:", "beli kopi 20rb cash"].join("\n");
                } else if (!account) {
                  reply = ["⚠️ Akun otomatis tidak ditemukan.", "", "Gunakan format:", "momoyo 20000 seabank", "", "Setelah itu sistem bisa belajar dari history."].join("\n");
                } else {
                  const { error } = await supabase.from("transactions").insert({
                    user_id: userId,
                    date: naturalTx.date,
                    type: finalType,
                    category_id: category.id,
                    account_id: account.id,
                    amount: naturalTx.amount,
                    title: naturalTx.title,
                    notes: `WhatsApp natural: ${message}`,
                  });
                  if (error) throw error;
                  parsedLog = { command: "natural_transaction", type: finalType, title: naturalTx.title, amount: naturalTx.amount, accountName: account.name, categoryName: category.name, date: naturalTx.date, accountSource: naturalTx.accountName ? "manual" : "history" };
                  const b = await getRealtimeBalanceSummary(userId);
                  const lines = [
                    finalType === "income" ? "✅ Pemasukan tercatat" : "✅ Pengeluaran tercatat",
                    "",
                    `Tanggal: ${naturalTx.date}`,
                    `Kategori: ${category.name}`,
                    `Judul: ${naturalTx.title}`,
                    `Nominal: ${formatIDR(naturalTx.amount)}`,
                    `Akun: ${account.name}`,
                    "",
                    "🤖 Diproses dari bahasa natural.",
                    ...(naturalTx.accountName
                      ? []
                      : ["", "🤖 Akun otomatis dari history.", "Kalau salah, ketik:", `edit akun ${account.name}`]),
                    "",
                    "💰 Saldo Saat Ini",
                    `Cash: ${formatIDR(b.cash)}`,
                    `Non Cash: ${formatIDR(b.nonCash)}`,
                    `Total: ${formatIDR(b.total)}`,
                  ];
                  if (finalType === "expense") {
                    const [monthlyBudget, weeklyBudget] = await Promise.all([
                      getMonthlyBudgetInfo(userId, category.name, naturalTx.date),
                      getWeeklyBudgetInfo(userId, category.name, naturalTx.date),
                    ]);
                    const budgetLines = buildCombinedBudgetLines(monthlyBudget, weeklyBudget);
                    if (budgetLines.length > 0) lines.push("", ...budgetLines);
                  }
                  reply = lines.join("\n");
                }
              }
            }
          } else if ("error" in smartTx && smartTx.error === "INVALID_DATE") {
            reply = ["⚠️ Format tanggal tidak valid.", "", "Gunakan format:", "31/05"].join("\n");
          } else {
            const account = smartTx.accountName
              ? await findAccount(userId, smartTx.accountName)
              : await findAccountByTransactionHistory(userId, smartTx.title, null, null);
            if (smartTx.accountName && !account) {
              reply = `❌ Akun *${smartTx.accountName}* tidak ditemukan.`;
            } else if (!account) {
              reply = ["⚠️ Akun otomatis tidak ditemukan.", "", "Gunakan format:", "momoyo 20000 seabank", "", "Setelah itu sistem bisa belajar dari history."].join("\n");
            } else {
              const category = await findCategoryByTransactionHistory(userId, smartTx.title);
              if (!category) {
                parsedLog = { command: "smart_transaction_failed", title: smartTx.title, amount: smartTx.amount, accountName: smartTx.accountName, reason: "category_not_found" };
                reply = ["⚠️ Kategori otomatis tidak ditemukan.", "", "Gunakan format lengkap:", "jajan kopi 10000 cash", "", "Atau buat dulu transaksi dengan kategori agar sistem bisa belajar."].join("\n");
              } else {
                parsedLog = { command: "smart_transaction", title: smartTx.title, amount: smartTx.amount, categoryName: category.name, accountName: account.name, accountSource: smartTx.accountName ? "manual" : "history" };
                const type = category.type === "income" ? "income" : "expense";
                const { error } = await supabase.from("transactions").insert({ user_id: userId, date: smartTx.date, type, category_id: category.id, account_id: account.id, amount: smartTx.amount, title: smartTx.title, notes: `WhatsApp: ${message}` });
                if (error) throw error;
                const b = await getRealtimeBalanceSummary(userId);
                const lines = [type === "income" ? "✅ Pemasukan tercatat" : "✅ Pengeluaran tercatat", "", `Kategori: ${category.name}`, `Judul: ${smartTx.title}`, `Nominal: ${formatIDR(smartTx.amount)}`, `Akun: ${account.name}`];
                if (smartTx.accountName) lines.push("", "🤖 Kategori otomatis dari history.");
                else lines.push("", "🤖 Kategori & akun otomatis dari history.", "Kalau akun salah, ketik:", `edit akun ${account.name}`);
                if (type === "expense") lines.push("", "💰 Saldo Saat Ini", `Cash: ${formatIDR(b.cash)}`, `Non Cash: ${formatIDR(b.nonCash)}`, `Total: ${formatIDR(b.total)}`);
                reply = lines.join("\n");
              }
            }
          }
        }
      }
    }

    await replyWhatsApp(sender, reply);
    await logMessage({
      wa_message_id: waMessageId,
      phone: sender,
      user_id: userId,
      raw_text: message,
      parsed: parsedLog,
      status: "success",
      error_message: null,
    });

    return json({ ok: true, handled: true });
  } catch (error) {
    console.error("[FONNTE FATAL ERROR]", error);

    if (sender && canReplyOnError) {
      try {
        const errorMessage = error instanceof Error ? error.message : String(error ?? "");
        if (errorMessage.includes("RPC_BALANCE_FAILED")) await replyWhatsApp(sender, "⚠️ Gagal mengambil saldo realtime.");
        else await replyWhatsApp(sender, "❌ Terjadi error pada sistem. Coba lagi beberapa saat.");
      } catch (_e) {
      }
    }

    try {
      if (waMessageId || sender || message) {
        await logMessage({
          wa_message_id: waMessageId || `${sender}-${message || "empty"}-${Date.now()}`,
          phone: sender || "",
          user_id: userId,
          raw_text: message || "",
          parsed: { fallback: true },
          status: "failed",
          error_message: String(error),
        });
      }
    } catch (_logError) {
    }

    return json({ ok: false, handled: true, error: String(error) });
  }
});
