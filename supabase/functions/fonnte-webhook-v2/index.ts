import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

type WebhookBody = {
  id?: string | number;
  message_id?: string | number;
  msg_id?: string | number;
  sender?: string;
  participant?: string;
  author?: string;
  from?: string;
  group?: string;
  group_id?: string;
  groupId?: string;
  chat?: string;
  chat_id?: string;
  chatId?: string;
  member?: string;
  memberlid?: string;
  senderlid?: string;
  memberNumber?: string;
  pushNameNumber?: string;
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
    participant?: string;
    author?: string;
    from?: string;
    group?: string;
    group_id?: string;
    groupId?: string;
    chat?: string;
    chat_id?: string;
    chatId?: string;
    member?: string;
    memberlid?: string;
    senderlid?: string;
    memberNumber?: string;
    pushNameNumber?: string;
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
  id: string;
  categoryId: string | null;
  categoryNames: string[];
  planned: number;
  used: number;
  remaining: number;
  percentage: number;
  periodMonth: string;
  createdAt: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FONNTE_TOKEN = Deno.env.get("FONNTE_TOKEN") ?? "";
const FONNTE_DEVICE = Deno.env.get("FONNTE_DEVICE") ?? "";

function isGroupPrivateDebugEnabled(): boolean {
  return String(Deno.env.get("GROUP_REPLY_DEBUG_PRIVATE") ?? "false").toLowerCase() === "true";
}

const BOT_PREFIXES = ["🤖", "✅", "❌", "⚠️", "💰", "ℹ️", "📊", "📚", "🏦", "📌", "🗑️", "🧾", "🎯", "🔁", "🏓", "📋", "📆", "🗓️", "📘"];
const MENU_COMMANDS = new Set(["menu", "help", "bantuan", ".menu"]);
const LOW_BALANCE_WARNING = 100000;
const MAX_SMART_WARNINGS = 3;
const warningCache = new Map<string, number>();

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
  "tambah",
  "edit",
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
  "menu", "help", "bantuan", ".menu", "contoh", "saldo", "summary", "history", "riwayat", "budget", "tambah budget", "edit budget", "hapus budget", "hutang",
  "tambah hutang", "tambah piutang", "bayar hutang", "bayar piutang", "tf", "ai", "minggu ini", "bulan ini",
  "top kategori", "cashflow", "kategori", "tambah kategori", "edit kategori", "hapus kategori", "akun", "info", "ping", "hapus", "undo",
]);


const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type SmartWarningContext = {
  userId: string;
  date: string;
  amount: number;
  categoryName: string;
};

async function getAverageExpense30Days(userId: string, date: string): Promise<number> {
  const end = new Date(`${date}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  let q = supabase.from("transactions").select("amount").eq("user_id", userId).eq("type", "expense").gte("date", start.toISOString().slice(0, 10)).lte("date", date);
  q = await applyTransactionNotDeleted(q);
  const { data } = await q;
  const vals = (data ?? []).map((r: Record<string, JsonValue>) => Number(r.amount ?? 0)).filter((v) => v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}
async function getTodayExpense(userId: string, date: string): Promise<number> {
  let q = supabase.from("transactions").select("amount").eq("user_id", userId).eq("type", "expense").eq("date", date);
  q = await applyTransactionNotDeleted(q);
  const { data } = await q;
  return (data ?? []).reduce((s: number, r: Record<string, JsonValue>) => s + Number(r.amount ?? 0), 0);
}
async function getTodayCategoryExpense(userId: string, categoryName: string, date: string): Promise<number> {
  const category = await findCategory(userId, categoryName);
  if (!category) return 0;
  let q = supabase.from("transactions").select("amount").eq("user_id", userId).eq("type", "expense").eq("date", date).eq("category_id", category.id);
  q = await applyTransactionNotDeleted(q);
  const { data } = await q;
  return (data ?? []).reduce((s: number, r: Record<string, JsonValue>) => s + Number(r.amount ?? 0), 0);
}
async function getWeeklyAverageExpense(userId: string, date: string): Promise<number> {
  const end = new Date(`${date}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  let q = supabase.from("transactions").select("amount,date").eq("user_id", userId).eq("type", "expense").gte("date", start.toISOString().slice(0, 10)).lte("date", date);
  q = await applyTransactionNotDeleted(q);
  const { data } = await q;
  const dayMap = new Map<string, number>();
  for (const r of (data ?? []) as Array<Record<string, JsonValue>>) {
    const d = String(r.date ?? "");
    dayMap.set(d, (dayMap.get(d) ?? 0) + Number(r.amount ?? 0));
  }
  const total = [...dayMap.values()].reduce((a, b) => a + b, 0);
  return dayMap.size > 0 ? total / dayMap.size : 0;
}
async function getCurrentBudgetUsage(userId: string, categoryName: string, date: string): Promise<BudgetInfo | null> {
  return await getMonthlyBudgetInfo(userId, categoryName, date);
}
async function getCurrentBalance(userId: string): Promise<number> {
  const b = await getRealtimeBalanceSummary(userId);
  return b.total;
}
function isRecentWarning(userId: string, date: string, key: string): boolean {
  const cacheKey = `${userId}|${date}|${key}`;
  const now = Date.now();
  const last = warningCache.get(cacheKey) ?? 0;
  if (now - last < 24 * 60 * 60 * 1000) return true;
  warningCache.set(cacheKey, now);
  return false;
}
async function buildSmartWarnings(input: SmartWarningContext): Promise<string[]> {
  const [avg30, todayExpense, todayCategory, weeklyAvg, budget, balance] = await Promise.all([
    getAverageExpense30Days(input.userId, input.date),
    getTodayExpense(input.userId, input.date),
    getTodayCategoryExpense(input.userId, input.categoryName, input.date),
    getWeeklyAverageExpense(input.userId, input.date),
    getCurrentBudgetUsage(input.userId, input.categoryName, input.date),
    getCurrentBalance(input.userId),
  ]);
  let txCountQuery = supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", input.userId).eq("type", "expense").eq("date", input.date);
  txCountQuery = await applyTransactionNotDeleted(txCountQuery);
  const { count: txCount } = await txCountQuery;

  const prioritized: Array<{ key: string; priority: number; message: string }> = [];
  if (budget && budget.percentage > 100) prioritized.push({ key: `budget-over-${input.categoryName}`, priority: 1, message: `🚨 Budget ${input.categoryName} sudah melewati limit.` });
  else if (budget && budget.percentage >= 80) prioritized.push({ key: `budget-near-${input.categoryName}`, priority: 1, message: `⚠️ Budget ${input.categoryName} sudah terpakai ${Math.round(budget.percentage)}%.` });
  if (balance < LOW_BALANCE_WARNING) prioritized.push({ key: "low-balance", priority: 2, message: "⚠️ Saldo mulai menipis." });
  if (weeklyAvg > 0 && todayExpense > weeklyAvg * 2) prioritized.push({ key: "spending-spike", priority: 3, message: "⚠️ Pengeluaran hari ini jauh di atas rata-rata mingguan." });
  if (todayExpense > 0 && todayCategory > todayExpense * 0.5) prioritized.push({ key: `category-dominant-${input.categoryName}`, priority: 4, message: `⚠️ Pengeluaran hari ini didominasi kategori ${input.categoryName}.` });
  if (avg30 > 0 && input.amount > avg30 * 2) prioritized.push({ key: "large-transaction", priority: 5, message: "⚠️ Pengeluaran ini jauh lebih besar dari rata-rata transaksi kamu." });
  if ((txCount ?? 0) > 15) prioritized.push({ key: "high-frequency", priority: 6, message: "📌 Aktivitas transaksi hari ini cukup tinggi." });

  return prioritized
    .sort((a, b) => a.priority - b.priority)
    .filter((w) => !isRecentWarning(input.userId, input.date, w.key))
    .slice(0, MAX_SMART_WARNINGS)
    .map((w) => w.message);
}

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function getMessageContextKey(input: { isGroup: boolean; sender: string; chatTarget: string }): string {
  return input.isGroup ? `${input.sender}|${input.chatTarget}` : input.sender;
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

function buildFonnteTargets(target: string): string[] {
  const value = String(target || "").trim();
  const targets: string[] = [];

  if (!value) return targets;

  const noGus = value.replace("@g.us", "");
  const noWhatsappNet = value.replace("@s.whatsapp.net", "").replace("@c.us", "");

  if (value.includes("@g.us")) {
    targets.push(value);
    targets.push(noGus);
    targets.push(`${noGus}@g.us`);
  } else {
    targets.push(value);
    targets.push(noWhatsappNet.replace(/[^\d]/g, ""));
  }

  return [...new Set(targets.filter(Boolean))];
}


const groupIdCache = new Map<string, string>();

function buildPossibleGroupTargets(groupId: string): string[] {
  const raw = String(groupId || "").trim();

  const clean = raw
    .replace("@g.us", "")
    .replace(/[^\d-]/g, "");

  const candidates = [
    raw,
    clean,
    `${clean}@g.us`,
  ];

  return [...new Set(candidates.filter(Boolean))];
}

function extractLid(body: any): string | null {
  const lid =
    body?.memberlid ||
    body?.senderlid ||
    body?.data?.memberlid ||
    body?.data?.senderlid ||
    null;

  if (!lid) return null;

  return String(lid).trim();
}

function isGroupJid(raw: string): boolean {
  return /@g\.us$/i.test(raw.trim());
}

function normalizeSenderLikeValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (isGroupJid(trimmed)) {
    const beforeAt = trimmed.split("@")[0] ?? "";
    const participantInGroup = beforeAt.split("-")[0] ?? "";
    return normalizePhone(participantInGroup);
  }

  if (/@s\.whatsapp\.net$/i.test(trimmed) || /@c\.us$/i.test(trimmed)) {
    return normalizePhone(trimmed.split("@")[0] ?? "");
  }

  return normalizePhone(trimmed);
}

function extractRawGroupId(body: WebhookBody): string {
  const candidates = [
    body.group,
    body.group_id,
    body.groupId,
    body.chat,
    body.chat_id,
    body.chatId,
    body.from,
    isGroupJid(String(body.sender ?? "")) ? body.sender : "",
    body.data?.group,
    body.data?.group_id,
    body.data?.groupId,
    body.data?.chat,
    body.data?.chat_id,
    body.data?.chatId,
    body.data?.from,
    isGroupJid(String(body.data?.sender ?? "")) ? body.data?.sender : "",
  ].map((v) => String(v ?? "").trim()).filter(Boolean);

  return candidates.find((raw) => isGroupJid(raw)) ?? "";
}

function extractRawParticipant(body: WebhookBody): string {
  const candidates = [
    body.member,
    body.memberlid,
    body.participant,
    body.author,
    body.memberNumber,
    body.phone,
    body.number,
    body.pushNameNumber,
    !isGroupJid(String(body.sender ?? "")) ? body.sender : "",
    body.data?.member,
    body.data?.memberlid,
    body.data?.participant,
    body.data?.author,
    body.data?.memberNumber,
    body.data?.phone,
    body.data?.number,
    body.data?.pushNameNumber,
    !isGroupJid(String(body.data?.sender ?? "")) ? body.data?.sender : "",
  ].map((v) => String(v ?? "").trim()).filter(Boolean);

  return candidates[0] ?? "";
}

function extractParticipant(body: WebhookBody): string {
  return normalizeSenderLikeValue(extractRawParticipant(body));
}

function extractSenderForLookup(body: WebhookBody): string {
  const participant = extractParticipant(body);
  if (participant) return participant;

  const candidates = [
    body.sender,
    body.from,
    body.phone,
    body.number,
    body.data?.sender,
    body.data?.phone,
    body.data?.number,
  ].map((v) => String(v ?? "").trim()).filter(Boolean);

  for (const raw of candidates) {
    if (!isGroupJid(raw)) return normalizeSenderLikeValue(raw);
  }
  return "";
}

function extractSender(body: WebhookBody): string {
  return extractSenderForLookup(body);
}

function isGroupMessage(body: WebhookBody): boolean {
  const candidates = [
    body.sender,
    body.from,
    body.chat,
    body.group,
    body.group_id,
    body.chat_id,
    body.data?.sender,
    body.data?.from,
    body.data?.chat,
    body.data?.group,
    body.data?.group_id,
    body.data?.chat_id,
  ].map((v) => String(v ?? "").trim()).filter(Boolean);

  return candidates.some((raw) => isGroupJid(raw));
}

function extractChatTarget(body: WebhookBody): string {
  const groupId = extractRawGroupId(body);
  if (groupId) return groupId;

  return extractSenderForLookup(body);
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
function bold(text: string): string { return `*${text}*`; }
function italic(text: string): string { return `_${text}_`; }
function line(): string { return "━━━━━━━━━━━━━━"; }
function money(value: number): string { return bold(formatIDR(value)); }
function section(title: string): string { return `${title}\n${line()}`; }
function item(label: string, value: string): string { return `• ${label}: ${bold(value)}`; }
function successTitle(text: string): string { return `✅ ${bold(text)}`; }
function errorTitle(text: string): string { return `❌ ${bold(text)}`; }
function warningTitle(text: string): string { return `⚠️ ${bold(text)}`; }
function infoTitle(text: string): string { return `ℹ️ ${bold(text)}`; }

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

function formatHistoryDate(date: string): string {
  const [year, month, day] = String(date).split("-");
  if (!year || !month || !day) return String(date || "-");
  return `${day}/${month}`;
}

async function getHistoryByAccount(
  userId: string,
  accountId: string,
  limit = 10,
): Promise<Array<Record<string, JsonValue>>> {
  const { data, error } = await supabase
    .from("transactions")
    .select("id,title,amount,type,date,category_id,account_id,to_account_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("account_id", accountId)
    .order("inserted_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Array<Record<string, JsonValue>>;
}

async function getHistoryByDateRange(
  userId: string,
  startDate: string | null,
  endDate: string | null,
  opts: { categoryId?: string; accountId?: string; limit?: number } = {},
): Promise<Array<Record<string, JsonValue>>> {
  let query = supabase.from("transactions")
    .select("id,title,amount,type,date,category_id,account_id,to_account_id,inserted_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("inserted_at", { ascending: false })
    .limit(opts.limit ?? 10);
  if (startDate && endDate) {
    query = query.gte("date", startDate).lte("date", endDate);
  }
  if (opts.categoryId) query = query.eq("category_id", opts.categoryId);
  if (opts.accountId) query = query.eq("account_id", opts.accountId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Array<Record<string, JsonValue>>;
}

async function detectHistoryEntity(userId: string, raw: string): Promise<{ entityType: "category" | "account" | null; entityName: string | null; categoryId?: string; accountId?: string }> {
  const text = normalizeText(raw);
  if (!text) return { entityType: null, entityName: null };
  const acc = await findAccount(userId, text);
  if (acc) return { entityType: "account", entityName: acc.name, accountId: acc.id };
  const cat = await findCategory(userId, text);
  if (cat) return { entityType: "category", entityName: cat.name, categoryId: cat.id };
  return { entityType: null, entityName: null };
}

async function getHistoryByTitle(
  userId: string,
  keyword: string,
  startDate: string | null,
  endDate: string | null,
  limit = 10,
): Promise<Array<Record<string, JsonValue>>> {
  console.log("[HISTORY TITLE SEARCH]", {
    keyword,
    startDate,
    endDate,
  });
  let query = supabase.from("transactions")
    .select("id,title,amount,type,date,category_id,account_id,to_account_id,inserted_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .ilike("title", `%${keyword}%`)
    .order("inserted_at", { ascending: false })
    .limit(limit);
  if (startDate && endDate) {
    query = query.gte("date", startDate).lte("date", endDate);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Array<Record<string, JsonValue>>;
}

function buildHistoryMessage(
  header: string,
  transactions: Array<Record<string, JsonValue>>,
  categoryMap: Map<string, string>,
  accountMap: Map<string, string>,
): { reply: string; displayedTransactions: JsonValue[] } {
  const displayedTransactions: JsonValue[] = [];
  const lines = transactions.map((tx, i) => {
    const no = i + 1;
    const type = String(tx.type ?? "expense");
    const amount = Number(tx.amount ?? 0);
    const txId = String(tx.id ?? "");
    const txDate = String(tx.date ?? "");
    const formattedDate = formatHistoryDate(txDate);
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
      return `${no}. ${formattedDate}\n   Transfer ${fromName} → ${toName}\n   ↔ ${formatIDR(amount)}`;
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
    return `${no}. ${formattedDate}\n   ${categoryName} - ${title}\n   ${sign} ${formatIDR(amount)}`;
  });
  return {
    reply: `${header}\n\n${line()}\n${lines.slice(0, 10).join("\n\n")}\n\n${line()}\nKetik *hapus 1* untuk menghapus nomor history.`,
    displayedTransactions: displayedTransactions.slice(0, 10),
  };
}

function buildHistoryTitleMessage(
  keyword: string,
  transactions: Array<Record<string, JsonValue>>,
  categoryMap: Map<string, string>,
  accountMap: Map<string, string>,
): { reply: string; displayedTransactions: JsonValue[] } {
  const displayedTransactions: JsonValue[] = [];
  const lines = transactions.slice(0, 10).map((tx, i) => {
    const no = i + 1;
    const type = String(tx.type ?? "expense");
    const amount = Number(tx.amount ?? 0);
    const txId = String(tx.id ?? "");
    const txDate = String(tx.date ?? "");
    const formattedDate = formatHistoryDate(txDate);
    const categoryName = categoryMap.get(String(tx.category_id ?? "")) ?? "-";
    const accountName = accountMap.get(String(tx.account_id ?? "")) ?? "-";
    const toAccountName = accountMap.get(String(tx.to_account_id ?? "")) ?? "-";
    const title = String(tx.title ?? "-");
    const sign = type === "income" ? "+" : type === "transfer" ? "↔" : "-";
    displayedTransactions.push({
      no,
      id: txId,
      title,
      amount,
      type,
      date: txDate,
      categoryName,
      accountName,
      toAccountName,
    });
    if (type === "transfer") {
      return `${no}. *${formattedDate}*\n   Transfer ${accountName} → ${toAccountName} — ${title}\n   ${sign} *${formatIDR(amount)}*`;
    }
    return `${no}. *${formattedDate}*\n   ${categoryName} — ${title}\n   ${sign} *${formatIDR(amount)}*`;
  });
  return {
    reply: `📚 *History Judul: ${keyword}*\n\n${line()}\n${lines.join("\n\n")}\n\n${line()}\nKetik *hapus 1* untuk menghapus nomor history.\nKetik *edit 1 01/06* untuk edit transaksi.`,
    displayedTransactions,
  };
}

function parseAmount(raw: string): number {
  const input = String(raw ?? "").trim();
  const suffixMatch = input.match(/(\d+(?:[.,]\d+)?)\s*(rb|rbu|ribu|k|jt|juta|m)\b/i);

  if (suffixMatch) {
    const numericValue = Number(suffixMatch[1].replace(",", "."));
    const suffix = suffixMatch[2].toLowerCase();
    const multiplier = ["rb", "rbu", "ribu", "k"].includes(suffix) ? 1000 : 1000000;
    const amount = Number.isFinite(numericValue) && numericValue > 0 ? Math.floor(numericValue * multiplier) : 0;
    console.log("[PARSE AMOUNT]", { input, amount });
    return amount;
  }

  const cleaned = input.replace(/[^0-9]/g, "");
  const value = Number(cleaned);
  const amount = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  console.log("[PARSE AMOUNT]", { input, amount });
  return amount;
}


type CalculatorToken = { type: "number"; value: number } | { type: "operator" | "paren"; value: string };

function getCalculatorExpressionText(text: string): string {
  return String(text ?? "").trim().replace(/^(calc|hitung)\s+/i, "").trim();
}

function containsDateOnlyPattern(text: string): boolean {
  const raw = String(text ?? "").trim();
  if (!raw) return false;

  const datePattern = /\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/g;
  if (!datePattern.test(raw)) return false;

  const withoutDates = raw.replace(datePattern, " ");
  return !/[+*x×/:]/i.test(withoutDates) && !/(^|\s)-(?!\s*$)/.test(withoutDates);
}

function isCalculatorExpression(text: string): boolean {
  const raw = String(text ?? "").trim();
  if (!raw) return false;
  if (/^(calc|hitung)(\s+|$)/i.test(raw)) return true;

  const nominalAmountPattern = /\d+(?:[.,]\d+)?\s*(?:rb|rbu|ribu|k|jt|juta|m)\b/gi;
  const withoutNominalAmounts = raw.replace(nominalAmountPattern, "1");
  if (/[a-zA-Z]{2,}/.test(withoutNominalAmounts)) return false;
  if (containsDateOnlyPattern(raw)) return false;
  if (!/[+\-*x×/:]/i.test(raw)) return false;

  const normalizedAmounts = raw.replace(nominalAmountPattern, "1");
  return /^[0-9\s+\-*x×/:().,]+$/i.test(normalizedAmounts);
}

function normalizeNumberToken(token: string): string {
  const input = String(token ?? "").toLowerCase().trim();
  if (!input) return input;

  if (/^\d{1,3}([.,]\d{3})+$/.test(input)) {
    return input.replace(/[.,]/g, "");
  }

  if (/^\d+(?:[.,]\d+)?\s*(?:rb|rbu|ribu|k|jt|juta|m)\b$/i.test(input)) {
    const amount = parseAmount(input);
    return amount > 0 ? String(amount) : input;
  }

  if (/^\d+(?:[.,]\d+)*$/.test(input)) {
    return input.replace(/\d{1,3}([.,]\d{3})+/g, (match) => match.replace(/[.,]/g, ""));
  }

  return input;
}

function normalizeCalculatorExpression(text: string): string | null {
  const expression = getCalculatorExpressionText(text);
  if (!expression) return null;

  const normalizedNumbers = expression.replace(/\d+(?:[.,]\d+)*(?:\s*(?:rb|rbu|ribu|k|jt|juta|m)\b)?/gi, (match) => {
    return normalizeNumberToken(match);
  });

  const normalizedOperators = normalizedNumbers
    .replace(/[x×]/gi, "*")
    .replace(/:/g, "/");

  if (!/^[0-9+\-*/().\s]+$/.test(normalizedOperators)) return null;
  if (!/[+\-*/]/.test(normalizedOperators)) return null;
  return normalizedOperators.replace(/\s+/g, " ").trim();
}

function tokenizeCalculatorExpression(expression: string): CalculatorToken[] | null {
  const compact = expression.replace(/\s+/g, "");
  const matches = compact.match(/\d+(?:\.\d+)?|[+\-*/()]/g);
  if (!matches || matches.join("") !== compact) return null;
  return matches.map((token) => {
    if (/^\d+(?:\.\d+)?$/.test(token)) return { type: "number", value: Number(token) };
    return { type: token === "(" || token === ")" ? "paren" : "operator", value: token };
  });
}

function calculateExpressionSafe(expression: string): number | null {
  const tokens = tokenizeCalculatorExpression(expression);
  if (!tokens) return null;
  let index = 0;

  const peek = () => tokens[index];
  const consume = () => tokens[index++];

  const parseFactor = (): number | null => {
    const token = peek();
    if (!token) return null;

    if (token.type === "operator" && (token.value === "+" || token.value === "-")) {
      consume();
      const value = parseFactor();
      if (value === null) return null;
      return token.value === "-" ? -value : value;
    }

    if (token.type === "number") {
      consume();
      return Number.isFinite(token.value) ? token.value : null;
    }

    if (token.type === "paren" && token.value === "(") {
      consume();
      const value = parseExpression();
      const close = consume();
      if (value === null || !close || close.type !== "paren" || close.value !== ")") return null;
      return value;
    }

    return null;
  };

  const parseTerm = (): number | null => {
    let value = parseFactor();
    if (value === null) return null;

    while (peek()?.type === "operator" && (peek()?.value === "*" || peek()?.value === "/")) {
      const operator = consume().value;
      const right = parseFactor();
      if (right === null) return null;
      if (operator === "/") {
        if (right === 0) throw new Error("DIVISION_BY_ZERO");
        value /= right;
      } else {
        value *= right;
      }
    }

    return value;
  };

  function parseExpression(): number | null {
    let value = parseTerm();
    if (value === null) return null;

    while (peek()?.type === "operator" && (peek()?.value === "+" || peek()?.value === "-")) {
      const operator = consume().value;
      const right = parseTerm();
      if (right === null) return null;
      value = operator === "+" ? value + right : value - right;
    }

    return value;
  }

  const result = parseExpression();
  if (result === null || index !== tokens.length || !Number.isFinite(result)) return null;
  return result;
}

function buildCalculatorReply(expression: string, result: number): string {
  return [
    "🧮 *Kalkulator HematWoi*",
    "",
    line(),
    getCalculatorExpressionText(expression),
    `= *${formatIDR(result)}*`,
  ].join("\n");
}

function buildCalculatorInvalidReply(): string {
  return [
    "⚠️ *Format Hitungan Tidak Valid*",
    "",
    "Contoh:",
    "• 20rb + 15rb",
    "• 100rb - 25rb",
    "• 50rb x 3",
    "• 1jt / 4",
  ].join("\n");
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

function buildDateRange(period: "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month"): { startDate: string; endDate: string; label: string } {
  if (period === "today") {
    const startDate = getTodayJakarta();
    const next = new Date(`${startDate}T00:00:00+07:00`);
    next.setDate(next.getDate() + 1);
    const endDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
    return { startDate, endDate, label: "hari ini" };
  }
  if (period === "yesterday") {
    const today = new Date(`${getTodayJakarta()}T00:00:00+07:00`);
    today.setDate(today.getDate() - 1);
    const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const endRef = new Date(`${startDate}T00:00:00+07:00`);
    endRef.setDate(endRef.getDate() + 1);
    const endDate = `${endRef.getFullYear()}-${String(endRef.getMonth() + 1).padStart(2, "0")}-${String(endRef.getDate()).padStart(2, "0")}`;
    return { startDate, endDate, label: "kemarin" };
  }
  if (period === "this_week") {
    const p = getWeekRangeJakarta();
    return { startDate: p.start, endDate: p.end, label: "minggu ini" };
  }
  if (period === "last_week") {
    const thisWeek = new Date(`${getWeekStartJakarta()}T00:00:00+07:00`);
    thisWeek.setDate(thisWeek.getDate() - 7);
    const startDate = `${thisWeek.getFullYear()}-${String(thisWeek.getMonth() + 1).padStart(2, "0")}-${String(thisWeek.getDate()).padStart(2, "0")}`;
    const endRef = new Date(`${startDate}T00:00:00+07:00`);
    endRef.setDate(endRef.getDate() + 7);
    const endDate = `${endRef.getFullYear()}-${String(endRef.getMonth() + 1).padStart(2, "0")}-${String(endRef.getDate()).padStart(2, "0")}`;
    return { startDate, endDate, label: "minggu lalu" };
  }
  if (period === "last_month") {
    const p = getPreviousMonthRangeJakarta();
    return { startDate: p.start, endDate: p.end, label: "bulan lalu" };
  }
  const p = getMonthRangeJakarta();
  return { startDate: p.start, endDate: p.end, label: "bulan ini" };
}

function parseNaturalDateRange(rawInput: string): { startDate: string | null; endDate: string | null; label: string | null; remainingText: string } {
  const input = normalizeText(rawInput);
  if (!input) return { startDate: null, endDate: null, label: null, remainingText: "" };
  const monthMap: Record<string, string> = {
    januari: "01", februari: "02", maret: "03", april: "04", mei: "05", juni: "06",
    juli: "07", agustus: "08", september: "09", oktober: "10", november: "11", desember: "12",
  };
  const toIsoDate = (dayRaw: string, monthRaw: string): string | null => {
    const day = Number(dayRaw);
    const month = Number(monthRaw);
    if (!Number.isInteger(day) || !Number.isInteger(month) || day < 1 || day > 31 || month < 1 || month > 12) return null;
    const year = Number(getTodayJakarta().split("-")[0]);
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== (month - 1) || dt.getUTCDate() !== day) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  const parseSingleDate = (text: string): string | null => {
    const slash = text.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (slash) return toIsoDate(slash[1], slash[2]);
    const dash = text.match(/^(\d{1,2})-(\d{1,2})$/);
    if (dash) return toIsoDate(dash[1], dash[2]);
    const monthName = text.match(/^(\d{1,2})\s+([a-z]+)$/);
    if (monthName) {
      const m = monthMap[monthName[2]];
      return m ? toIsoDate(monthName[1], m) : null;
    }
    return null;
  };

  const rangeMatch = input.match(/(.+?)\s*-\s*(.+)/);
  if (rangeMatch) {
    const d1 = parseSingleDate(rangeMatch[1].trim());
    const d2 = parseSingleDate(rangeMatch[2].trim());
    if (d1 && d2) {
      const [startDate, endRaw] = d1 <= d2 ? [d1, d2] : [d2, d1];
      const endRef = new Date(`${endRaw}T00:00:00+07:00`);
      endRef.setDate(endRef.getDate() + 1);
      const endDate = `${endRef.getFullYear()}-${String(endRef.getMonth() + 1).padStart(2, "0")}-${String(endRef.getDate()).padStart(2, "0")}`;
      return { startDate, endDate, label: `${formatHistoryDate(startDate)} - ${formatHistoryDate(endRaw)}`, remainingText: "" };
    }
  }
  const keywordRanges = [
    { pattern: /\bhari ini\b/, value: buildDateRange("today") },
    { pattern: /\bkemarin\b/, value: buildDateRange("yesterday") },
    { pattern: /\bminggu ini\b|\bpekan ini\b/, value: buildDateRange("this_week") },
    { pattern: /\bminggu lalu\b|\bpekan lalu\b/, value: buildDateRange("last_week") },
    { pattern: /\bbulan ini\b/, value: buildDateRange("this_month") },
    { pattern: /\bbulan lalu\b/, value: buildDateRange("last_month") },
  ];
  for (const item of keywordRanges) {
    if (item.pattern.test(input)) {
      return { ...item.value, remainingText: input.replace(item.pattern, "").trim() };
    }
  }
  const singleDateMatch = input.match(/(\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2}|\d{1,2}\s+[a-z]+)/);
  if (singleDateMatch) {
    const iso = parseSingleDate(singleDateMatch[1].trim());
    if (iso) {
      const endRef = new Date(`${iso}T00:00:00+07:00`);
      endRef.setDate(endRef.getDate() + 1);
      const endDate = `${endRef.getFullYear()}-${String(endRef.getMonth() + 1).padStart(2, "0")}-${String(endRef.getDate()).padStart(2, "0")}`;
      return { startDate: iso, endDate, label: formatHistoryDate(iso), remainingText: input.replace(singleDateMatch[1], "").trim() };
    }
  }
  return { startDate: null, endDate: null, label: null, remainingText: input };
}

type SmartSearchIntent =
  | "LAST_TRANSACTION"
  | "ACCOUNT_USAGE"
  | "FREQUENCY"
  | "LARGEST_TRANSACTION"
  | "TOTAL_BY_KEYWORD"
  | "CATEGORY_PERIOD";

function parseSearchPeriod(question: string): { startDate: string; endDate: string; label: string } {
  const text = normalizeText(question);
  const today = getTodayJakarta();
  const buildLastNDays = (days: number, label: string) => {
    const end = new Date(`${today}T00:00:00+07:00`);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    return {
      startDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
      endDate: today,
      label,
    };
  };
  if (/\b3 bulan terakhir\b/.test(text)) {
    const end = new Date(`${today}T00:00:00+07:00`);
    const start = new Date(end);
    start.setMonth(start.getMonth() - 3);
    start.setDate(start.getDate() + 1);
    return { startDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`, endDate: today, label: "3 bulan terakhir" };
  }
  if (/\b7 hari terakhir\b/.test(text)) return buildLastNDays(7, "7 hari terakhir");
  if (/\b30 hari terakhir\b/.test(text)) return buildLastNDays(30, "30 hari terakhir");
  if (/\bhari ini\b/.test(text)) return buildDateRange("today");
  if (/\bkemarin\b/.test(text)) return buildDateRange("yesterday");
  if (/\bminggu ini\b/.test(text)) return buildDateRange("this_week");
  if (/\bminggu lalu\b/.test(text)) return buildDateRange("last_week");
  if (/\bbulan lalu\b/.test(text)) return buildDateRange("last_month");
  return buildDateRange("this_month");
}

function detectSmartSearchIntent(question: string): SmartSearchIntent | null {
  const text = normalizeText(question);
  if (/(kapan terakhir|terakhir beli|terakhir transaksi|terakhir jajan)/.test(text)) return "LAST_TRANSACTION";
  if (/(dipakai buat apa|dipakai untuk apa|akun .+ buat apa)/.test(text)) return "ACCOUNT_USAGE";
  if (/(berapa kali|seberapa sering|frekuensi)/.test(text)) return "FREQUENCY";
  if (/(transaksi terbesar|pengeluaran terbesar|paling besar)/.test(text)) return "LARGEST_TRANSACTION";
  if (/(total|pengeluaran|beli)/.test(text)) return "TOTAL_BY_KEYWORD";
  return null;
}

function extractSearchKeyword(question: string): string {
  return normalizeText(question)
    .replace(/\b(kapan|terakhir|beli|transaksi|berapa kali|seberapa sering|frekuensi|dipakai|buat|untuk|apa|akun|total|pengeluaran|terbesar|paling besar|hari ini|kemarin|minggu ini|minggu lalu|bulan ini|bulan lalu|3 bulan terakhir|7 hari terakhir|30 hari terakhir)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function findLastTransactionByKeyword(userId: string, keyword: string): Promise<Record<string, JsonValue> | null> {
  let q = supabase.from("transactions").select("id,date,title,amount,category_id,account_id").eq("user_id", userId).eq("type", "expense").order("date", { ascending: false }).order("inserted_at", { ascending: false }).limit(5);
  q = await applyTransactionNotDeleted(q);
  const { data, error } = await q;
  if (error) throw error;
  const row = (data ?? []).find((x) => normalizeText(String((x as Record<string, JsonValue>).title ?? "")).includes(keyword));
  return (row as Record<string, JsonValue>) ?? null;
}
async function getTotalByKeyword(userId: string, keyword: string, period: { startDate: string; endDate: string }): Promise<{ total: number; count: number }> {
  let q = supabase.from("transactions").select("title,amount").eq("user_id", userId).eq("type", "expense").gte("date", period.startDate).lte("date", period.endDate);
  q = await applyTransactionNotDeleted(q);
  const { data, error } = await q;
  if (error) throw error;
  const matched = (data ?? []).filter((x) => normalizeText(String((x as Record<string, JsonValue>).title ?? "")).includes(keyword));
  return { total: matched.reduce((s, r) => s + Number((r as Record<string, JsonValue>).amount ?? 0), 0), count: matched.length };
}
async function getAccountUsageByPeriod(userId: string, accountId: string, period: { startDate: string; endDate: string }): Promise<Array<{ name: string; total: number }>> {
  let q = supabase.from("transactions").select("amount,category_id").eq("user_id", userId).eq("type", "expense").eq("account_id", accountId).gte("date", period.startDate).lte("date", period.endDate);
  q = await applyTransactionNotDeleted(q);
  const { data, error } = await q;
  if (error) throw error;
  const totals = new Map<string, number>();
  for (const row of (data ?? []) as Array<Record<string, JsonValue>>) totals.set(String(row.category_id ?? ""), (totals.get(String(row.category_id ?? "")) ?? 0) + Number(row.amount ?? 0));
  const ids = [...totals.keys()].filter(Boolean);
  const { data: categories } = ids.length > 0 ? await supabase.from("categories").select("id,name").in("id", ids) : { data: [] as Record<string, JsonValue>[] };
  const cmap = new Map((categories ?? []).map((c: Record<string, JsonValue>) => [String(c.id), String(c.name)]));
  return [...totals.entries()].map(([id, total]) => ({ name: cmap.get(id) ?? "Lainnya", total })).sort((a, b) => b.total - a.total).slice(0, 5);
}
async function getCategoryExpenseByPeriod(userId: string, categoryId: string, period: { startDate: string; endDate: string }): Promise<{ total: number; count: number }> {
  let q = supabase.from("transactions").select("amount").eq("user_id", userId).eq("type", "expense").eq("category_id", categoryId).gte("date", period.startDate).lte("date", period.endDate);
  q = await applyTransactionNotDeleted(q);
  const { data, error } = await q;
  if (error) throw error;
  return { total: (data ?? []).reduce((s, r) => s + Number((r as Record<string, JsonValue>).amount ?? 0), 0), count: (data ?? []).length };
}
async function getFrequencyByKeyword(userId: string, keyword: string, period: { startDate: string; endDate: string }): Promise<{ count: number; total: number }> {
  const res = await getTotalByKeyword(userId, keyword, period);
  return { count: res.count, total: res.total };
}
async function getLargestTransactionByPeriod(userId: string, period: { startDate: string; endDate: string }): Promise<Record<string, JsonValue> | null> {
  let q = supabase.from("transactions").select("id,date,title,amount,category_id").eq("user_id", userId).eq("type", "expense").gte("date", period.startDate).lte("date", period.endDate).order("amount", { ascending: false }).limit(1);
  q = await applyTransactionNotDeleted(q);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? [])[0] as Record<string, JsonValue>) ?? null;
}

async function replyWhatsApp(input: { target: string; message: string; memberlid?: string | null; senderlid?: string | null }): Promise<boolean> {
  const { target, message, memberlid = null, senderlid = null } = input;
  if (!FONNTE_TOKEN || !target || !message) return false;
  const isGroup = target.includes("@g.us");
  const normalizedMemberLid = memberlid ? String(memberlid).trim() : "";
  const normalizedSenderLid = senderlid ? String(senderlid).trim() : "";

  const targets = isGroup
    ? buildPossibleGroupTargets(target)
    : buildFonnteTargets(target);
  let lastResult = "";

  if (isGroup) {
    console.log("[GROUP LID DEBUG]", {
      memberlid: normalizedMemberLid || null,
      senderlid: normalizedSenderLid || null,
      targets,
    });
    console.log("[GROUP TARGET TRY]", {
      originalTarget: target,
      candidates: targets,
    });
  }

  if (!FONNTE_DEVICE) {
    console.warn("[FONNTE DEVICE WARNING]", {
      message: "FONNTE_DEVICE is empty, request will continue without explicit device.",
    });
  }

  console.log("[SEND WHATSAPP]", {
    originalTarget: target,
    targets,
    isGroup,
  });

  for (const finalTarget of targets) {
    const form = new FormData();
    form.append("target", finalTarget);
    form.append("message", message);
    if (FONNTE_DEVICE) {
      form.append("device", FONNTE_DEVICE);
    }

    console.log("[FONNTE SEND CONFIG]", {
      target: finalTarget,
      device: FONNTE_DEVICE,
    });

    try {
      const response = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: { Authorization: FONNTE_TOKEN },
        body: form,
      });
      const resultText = await response.text();
      lastResult = resultText;

      console.log("[FONNTE RESPONSE]", {
        target,
        finalTarget,
        status: response.status,
        result: resultText,
      });

      let parsed: { status?: boolean } | null = null;
      try {
        parsed = JSON.parse(resultText);
      } catch (_error) {
      }

      if (response.ok && parsed?.status === true) {
        if (isGroup) {
          groupIdCache.set(target, finalTarget);
          console.log("[GROUP TARGET SUCCESS]", {
            originalTarget: target,
            successTarget: finalTarget,
          });
          console.log("[GROUP TARGET CACHED]", {
            originalGroupId: target,
            finalTarget,
          });
        }
        return true;
      }
    } catch (error) {
      console.error("[FONNTE SEND ERROR]", { target, finalTarget, error });
    }
  }

  console.error("[FONNTE SEND FAILED ALL TARGETS]", {
    target,
    tried: targets,
    lastResult,
  });

  return false;
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

async function hasDeletedAtColumn(table: "categories" | "transactions" | "budgets" | "debts" | "receivables"): Promise<boolean> {
  const { error } = await supabase.from(table).select("deleted_at").limit(1);
  if (!error) return true;
  const message = String((error as Record<string, JsonValue>)?.message ?? "");
  if (message.toLowerCase().includes("deleted_at")) return false;
  throw error;
}

async function applyTransactionNotDeleted<T>(query: T): Promise<T> {
  const txHasDeletedAt = await hasDeletedAtColumn("transactions");
  if (!txHasDeletedAt) return query;
  return (query as { is: (col: string, val: null) => T }).is("deleted_at", null);
}

async function getCategoryList(userId: string): Promise<string> {
  const categoriesHasDeletedAt = await hasDeletedAtColumn("categories");
  let query = supabase.from("categories").select("name,type").eq("user_id", userId);
  if (categoriesHasDeletedAt) query = query.is("deleted_at", null);
  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, JsonValue>>;
  const expenses = rows
    .filter((c) => String(c.type ?? "").toLowerCase() === "expense")
    .map((c) => String(c.name ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "id"));
  const incomes = rows
    .filter((c) => String(c.type ?? "").toLowerCase() === "income")
    .map((c) => String(c.name ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "id"));

  const lines: string[] = ["🧾 Daftar Kategori", ""];
  lines.push("📤 Expense");
  lines.push(expenses.length > 0 ? expenses.map((name, i) => `${i + 1}. ${name}`).join("\n") : "-");
  lines.push("");
  lines.push("📥 Income");
  lines.push(incomes.length > 0 ? incomes.map((name, i) => `${i + 1}. ${name}`).join("\n") : "-");
  return lines.join("\n");
}

function formatCategoryName(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function invalidCategoryTypeReply(): string {
  return [
    "⚠️ *Tipe Kategori Tidak Valid*",
    "",
    "Gunakan:",
    "• income",
    "• expense",
  ].join("\n");
}

async function createCategory(userId: string, name: string, type: string): Promise<string> {
  const cleanName = name.trim();
  const cleanType = type.trim().toLowerCase();
  if (!cleanName) return "⚠️ Format tidak valid.\n\nGunakan:\ntambah kategori nama tipe";
  if (cleanType !== "income" && cleanType !== "expense") return invalidCategoryTypeReply();

  const existed = await findCategory(userId, cleanName);
  if (existed) return "❌ *Kategori Sudah Ada*";

  const payload: Record<string, JsonValue> = { user_id: userId, name: cleanName, type: cleanType };
  const { error } = await supabase.from("categories").insert(payload);
  if (error) throw error;
  return [
    "✅ *Kategori Berhasil Ditambahkan*",
    "",
    line(),
    `Nama: *${formatCategoryName(cleanName)}*`,
    `Tipe: *${cleanType}*`,
  ].join("\n");
}

async function updateCategory(userId: string, oldName: string, newName: string): Promise<string> {
  const oldTrim = oldName.trim();
  const newTrim = newName.trim();
  if (!oldTrim || !newTrim) return "⚠️ Format tidak valid.\n\nGunakan:\nedit kategori nama_lama nama_baru";
  const current = await findCategory(userId, oldTrim);
  if (!current) return "❌ *Kategori Tidak Ditemukan*";
  const duplicate = await findCategory(userId, newTrim);
  if (duplicate && String(duplicate.id) !== String(current.id)) return "❌ *Kategori Sudah Ada*";

  const { error } = await supabase.from("categories").update({ name: newTrim }).eq("id", current.id).eq("user_id", userId);
  if (error) throw error;
  return [
    "✏️ *Kategori Berhasil Diubah*",
    "",
    line(),
    `Sebelum: *${formatCategoryName(current.name)}*`,
    `Sesudah: *${formatCategoryName(newTrim)}*`,
  ].join("\n");
}

async function deleteCategory(userId: string, name: string): Promise<string> {
  const target = await findCategory(userId, name.trim());
  if (!target) return "❌ *Kategori Tidak Ditemukan*";

  const tables: Array<"transactions" | "budgets" | "debts" | "receivables"> = ["transactions", "budgets", "debts", "receivables"];
  for (const table of tables) {
    const hasDeletedAt = await hasDeletedAtColumn(table);
    let query = supabase.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId).eq("category_id", target.id);
    if (hasDeletedAt) query = query.is("deleted_at", null);
    const { count, error } = await query;
    if (error) throw error;
    if ((count ?? 0) > 0) return "❌ Kategori masih digunakan transaksi/budget.";
  }

  const categoriesHasDeletedAt = await hasDeletedAtColumn("categories");
  if (categoriesHasDeletedAt) {
    const { error } = await supabase.from("categories").update({ deleted_at: new Date().toISOString() }).eq("id", target.id).eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("categories").delete().eq("id", target.id).eq("user_id", userId);
    if (error) throw error;
  }
  return [
    "🗑️ *Kategori Berhasil Dihapus*",
    "",
    line(),
    `Nama: *${formatCategoryName(target.name)}*`,
  ].join("\n");
}

type CategoryCrudAction = "create" | "edit" | "delete" | "list" | "unknown";

function detectCategoryCrudAction(normalized: string): CategoryCrudAction {
  if (normalized.startsWith("tambah kategori ") || normalized.startsWith("kategori tambah ")) return "create";
  if (normalized.startsWith("edit kategori ") || normalized.startsWith("kategori edit ")) return "edit";
  if (normalized.startsWith("hapus kategori ") || normalized.startsWith("kategori hapus ")) return "delete";
  if (normalized === "kategori" || normalized === "list kategori") return "list";
  return "unknown";
}

async function handleCategoryCrud(userId: string, rawMessage: string, normalized: string): Promise<{ reply: string; parsedLog: Record<string, JsonValue> }> {
  const action = detectCategoryCrudAction(normalized);
  const payload = rawMessage.trim();
  console.log("[CATEGORY CRUD]", { action, userId, payload });

  if (action === "list") {
    const reply = await getCategoryList(userId);
    return { reply, parsedLog: { command: "category_crud", action } };
  }
  if (action === "create") {
    const match = rawMessage.trim().match(/^(?:tambah\s+kategori|kategori\s+tambah)\s+(.+?)\s+(\S+)$/i);
    if (!match) return { reply: "⚠️ Format tidak valid.\n\nGunakan:\ntambah kategori nama tipe", parsedLog: { command: "category_crud", action, categoryName: null, categoryType: null } };
    const categoryName = match[1].trim();
    const categoryType = match[2].trim().toLowerCase();
    const reply = await createCategory(userId, categoryName, categoryType);
    return { reply, parsedLog: { command: "category_crud", action, categoryName, categoryType } };
  }
  if (action === "edit") {
    const parts = rawMessage.trim().split(/\s+/);
    if (parts.length < 4) return { reply: "⚠️ Format tidak valid.\n\nGunakan:\nedit kategori nama_lama nama_baru", parsedLog: { command: "category_crud", action, categoryName: null, categoryType: null } };
    const oldName = parts[2];
    const newName = parts.slice(3).join(" ");
    const reply = await updateCategory(userId, oldName, newName);
    return { reply, parsedLog: { command: "category_crud", action, categoryName: oldName, categoryType: null } };
  }
  if (action === "delete") {
    const name = rawMessage.trim().replace(/^(?:hapus\s+kategori|kategori\s+hapus)\s+/i, "").trim();
    if (!name) return { reply: "⚠️ Format tidak valid.\n\nGunakan:\nhapus kategori nama", parsedLog: { command: "category_crud", action, categoryName: null, categoryType: null } };
    const reply = await deleteCategory(userId, name);
    return { reply, parsedLog: { command: "category_crud", action, categoryName: name, categoryType: null } };
  }
  return { reply: "⚠️ Command kategori tidak valid.", parsedLog: { command: "category_crud", action, categoryName: null, categoryType: null } };
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
  phone?: string;
  user_id?: string;
  parsed: {
    command?: string;
    sessionId?: string;
    suggestions?: AiSuggestionItem[];
    active?: boolean;
    context?: "group" | "personal";
    chatTarget?: string;
    participant?: string;
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
  input: { userId: string; contextKey: string; isGroup: boolean; chatTarget: string },
): Promise<{ session: AiSuggestionSession | null; isExpired: boolean }> {
  const { data: logs, error } = await supabase
    .from("whatsapp_message_logs")
    .select("id,created_at,phone,user_id,parsed")
    .eq("user_id", input.userId)
    .eq("phone", input.contextKey)
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  const isGroup = Boolean(input.isGroup);
  const groupTarget = String(input.chatTarget ?? "");
  const parsedLogs = (logs ?? []) as AiSuggestionSession[];
  const session = parsedLogs.find((log) => {
    if (log.parsed?.command !== "ai_suggestion" || log.parsed?.active === false) return false;
    if (isGroup) {
      return log.parsed?.context === "group" && String(log.parsed?.chatTarget ?? "") === groupTarget;
    }
    return log.parsed?.context === "personal" || !log.parsed?.context;
  }) ?? null;
  console.log("[AI SESSION SEARCH]", {
    isGroup,
    userId: input.userId,
    contextKey: input.contextKey,
    chatTarget: groupTarget,
    logsCount: logs?.length ?? 0,
    found: Boolean(session),
  });
  if (!session) return { session: null, isExpired: false };

  const isExpired = Date.now() - new Date(session.created_at).getTime() > AI_SUGGESTION_SESSION_TTL_MS;
  if (isExpired) return { session: null, isExpired: true };

  return { session, isExpired: false };
}

async function handleAISuggestionPick(
  userId: string,
  contextKey: string,
  numberText: string,
  options?: { isGroup?: boolean; chatTarget?: string; participant?: string },
): Promise<{ reply: string; parsedLog: Record<string, JsonValue> }> {
  const selectedNumber = Number(numberText);
  const { session, isExpired } = await getLastAISuggestionSession({
    userId,
    contextKey,
    isGroup: Boolean(options?.isGroup),
    chatTarget: String(options?.chatTarget ?? ""),
  });
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
      context: options?.isGroup ? "group" : "personal",
      chatTarget: options?.isGroup ? options?.chatTarget ?? null : null,
      participant: options?.isGroup ? options?.participant ?? null : null,
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

function detectPeriodFromQuestion(question: string): { label: string; startDate: string; endDate: string } {
  const parsed = parseNaturalDateRange(question);
  if (parsed.startDate && parsed.endDate && parsed.label) return { label: parsed.label, startDate: parsed.startDate, endDate: parsed.endDate };
  const p = buildDateRange("this_month");
  return { label: p.label, startDate: p.startDate, endDate: p.endDate };
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
    "_Pilih pertanyaan atau ketik bebas._",
    "",
    line(),
    ...lines,
    "",
    line(),
    `Balas angka: ${bold("1")}`,
    "",
    "Atau tanya langsung:",
    italic("ai pengeluaran cash minggu ini"),
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

async function getDebtStatusSummary(userId: string): Promise<Array<{ name: string; remaining: number; type: string }>> {
  const { data: debts, error } = await supabase
    .from("debts")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;

  return (debts ?? [])
    .filter((d: Record<string, JsonValue>) => isDebtRowOpen(d))
    .map((d: Record<string, JsonValue>) => ({
      name: getDebtName(d),
      remaining: getDebtRemainingAmount(d),
      type: getDebtKind(d) || "debt",
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
    k = k.replace(/\b(hari ini|kemarin|minggu ini|minggu lalu|bulan ini|bulan lalu)\b/gi, "");
    return k.trim();
  };
  const extractTitleKeyword = (text: string): string => {
    const cleaned = normalizeText(text).replace(/\?/g, "").trim();
    const match = cleaned.match(/(?:transaksi|beli|jajan|total)\s+(.+)$/i);
    if (!match) return "";
    return match[1]
      .replace(/\b(saya|untuk|dari|di|pada)\b/gi, "")
      .replace(/\b(hari ini|kemarin|minggu ini|minggu lalu|bulan ini|bulan lalu)\b/gi, "")
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
    const rows = await getDebtStatusSummary(userId);
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

  const originalTitle = workParts.slice(0, amountIndex).join(" ").trim();
  if (!originalTitle) return null;
  const trailingTokens = workParts.slice(amountIndex + 1);
  const accountName = trailingTokens.length > 0 ? trailingTokens.join(" ") : null;
  const title = cleanTransactionTitle(originalTitle, accountName ? [accountName] : []);
  console.log("[TITLE CLEAN]", { originalTitle, cleanedTitle: title });
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

function normalizeTitleText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s/]/gi, " ").replace(/\s+/g, " ").trim();
}

function isAmountToken(token: string): boolean {
  const normalized = token.toLowerCase().replace(/[()]/g, "").trim();
  if (!normalized) return false;
  return parseAmount(normalized) > 0 || /^rp?\s?\d[\d.,]*$/i.test(normalized);
}

function cleanTransactionTitle(originalTitle: string, accountNames: string[]): string {
  const fallbackTitle = normalizeTitleText(originalTitle);
  if (!fallbackTitle) return "";
  let title = ` ${fallbackTitle} `;

  for (const accountName of accountNames.sort((a, b) => b.length - a.length)) {
    const normalizedAccount = normalizeTitleText(accountName);
    if (!normalizedAccount) continue;
    const escaped = normalizedAccount.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    title = title.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ");
  }

  const tokens = title.split(/\s+/).filter(Boolean);
  const keptTokens = tokens.filter((token) => !isAmountToken(token) && !isDateToken(token) && !NATURAL_NOISE_WORDS.includes(token));
  const cleanedTitle = keptTokens.join(" ")
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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
  const originalTitle = message;
  const title = cleanTransactionTitle(originalTitle, accountNames);
  console.log("[TITLE CLEAN]", { originalTitle, cleanedTitle: title });
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

async function findCategoryByKeyword(userId: string, keyword: string): Promise<{ id: string; name: string; type: string } | null> {
  const normalizedKeyword = normalizeText(keyword).trim();
  if (!normalizedKeyword) return null;

  const { data, error } = await supabase
    .from("categories")
    .select("id,name,type")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw error;

  const categories = (data ?? []) as Array<Record<string, JsonValue>>;
  let match: { id: string; name: string; type: string } | null = null;

  for (const category of categories) {
    const categoryName = String(category.name ?? "").trim();
    const normalizedName = normalizeText(categoryName);
    if (!normalizedName) continue;
    if (normalizedName === normalizedKeyword) {
      match = { id: String(category.id), name: categoryName, type: String(category.type ?? "expense") };
      break;
    }
  }

  if (!match) {
    for (const category of categories) {
      const categoryName = String(category.name ?? "").trim();
      const normalizedName = normalizeText(categoryName);
      if (!normalizedName) continue;
      if (normalizedName.includes(normalizedKeyword) || normalizedKeyword.includes(normalizedName)) {
        match = { id: String(category.id), name: categoryName, type: String(category.type ?? "expense") };
        break;
      }
    }
  }

  console.log("[SMART CATEGORY KEYWORD]", {
    keyword: normalizedKeyword,
    matchedCategory: match ? { id: match.id, name: match.name, type: match.type } : null,
  });

  return match;
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

async function findBestAccountByCategoryHistory(userId: string, categoryId: string): Promise<{ id: string; name: string; type: string } | null> {
  const { data, error } = await supabase
    .from("transactions")
    .select("account_id,inserted_at")
    .eq("user_id", userId)
    .eq("category_id", categoryId)
    .not("account_id", "is", null)
    .is("deleted_at", null)
    .in("type", ["income", "expense"])
    .order("inserted_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, JsonValue>>;
  const scoreByAccount = new Map<string, number>();
  for (let i = 0; i < rows.length; i++) {
    const accountId = String(rows[i].account_id ?? "").trim();
    if (!accountId) continue;
    const recencyScore = Math.max(0, 20 - i * 0.2);
    const score = (scoreByAccount.get(accountId) ?? 0) + 100 + recencyScore;
    scoreByAccount.set(accountId, score);
  }

  let selectedAccountId: string | null = null;
  let bestScore = -1;
  for (const [accountId, score] of scoreByAccount.entries()) {
    if (score > bestScore) {
      bestScore = score;
      selectedAccountId = accountId;
    }
  }

  if (!selectedAccountId) {
    console.log("[SMART ACCOUNT CATEGORY HISTORY]", { categoryId, selectedAccount: null });
    return null;
  }

  const { data: account, error: accountError } = await getAccountsBaseQuery(userId, "id,name,type,user_id")
    .eq("id", selectedAccountId)
    .maybeSingle();
  if (accountError) throw accountError;
  const selectedAccount = account
    ? { id: String(account.id), name: String(account.name), type: String(account.type ?? "") }
    : null;

  console.log("[SMART ACCOUNT CATEGORY HISTORY]", { categoryId, selectedAccount });
  return selectedAccount;
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
  const originalTitle = titleParts.length > 0 ? titleParts.join(" ") : categoryName;
  const title = cleanTransactionTitle(originalTitle, [accountName]);
  console.log("[TITLE CLEAN]", { originalTitle, cleanedTitle: title });

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

function parseEditDateToken(raw: string): string | null {
  const input = raw.trim();
  if (!input) return null;

  const now = new Date();
  const jakartaNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const currentYear = jakartaNow.getFullYear();

  let day = 0;
  let month = 0;
  let year = currentYear;

  const isoMatch = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else {
    const slashMatch = input.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{4}))?$/);
    if (!slashMatch) return null;
    day = Number(slashMatch[1]);
    month = Number(slashMatch[2]);
    year = slashMatch[3] ? Number(slashMatch[3]) : currentYear;
  }

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;

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

function formatEditDateForReply(date: string): string {
  const [year, month, day] = String(date).split("-");
  if (!year || !month || !day) return String(date || "-");
  return `${day}/${month}/${year}`;
}

function parseEditTransactionCommand(rawMessage: string): ParsedEditTransactionCommand | null {
  const match = rawMessage.trim().match(/^edit\s+(\d+)\s+(.+)$/i);
  if (!match) return null;

  const number = Number(match[1]);
  if (!Number.isInteger(number) || number < 1) return null;

  const rawValue = match[2].trim();
  if (!rawValue) return null;

  const parts = rawValue.split(/\s+/);
  const firstToken = normalizeText(parts[0] ?? "");
  if (firstToken === "judul" || firstToken === "title") {
    const titleValue = parts.slice(1).join(" ").trim();
    if (!titleValue) return null;
    return { number, field: "title", value: titleValue };
  }
  if (firstToken === "kategori") {
    const categoryValue = parts.slice(1).join(" ").trim();
    if (!categoryValue) return null;
    return { number, field: "category", value: categoryValue };
  }
  if (firstToken === "akun") {
    const accountValue = parts.slice(1).join(" ").trim();
    if (!accountValue) return null;
    return { number, field: "account", value: accountValue };
  }
  if (firstToken === "tanggal") {
    const dateValue = parts.slice(1).join(" ").trim();
    if (!dateValue) return null;
    return { number, field: "date", value: dateValue };
  }

  if (parseEditDateToken(rawValue)) return { number, field: "date", value: rawValue };

  const amount = extractNaturalAmountFromText(rawValue);
  if (amount > 0) return { number, field: "amount", value: amount };

  return { number, field: "account", value: rawValue };
}

async function getLastHistoryLog(userId: string, phone: string): Promise<Record<string, JsonValue> | null> {
  const { data: logs, error } = await supabase
    .from("whatsapp_message_logs")
    .select("id,created_at,parsed")
    .eq("user_id", userId)
    .eq("phone", phone)
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;

  const historyLog = (logs ?? []).find((log) => {
    const parsed = (log.parsed ?? null) as Record<string, JsonValue> | null;
    return parsed?.command === "history" &&
      Array.isArray(parsed?.displayedTransactions) &&
      parsed.displayedTransactions.length > 0;
  }) as Record<string, JsonValue> | undefined;

  console.log("[LAST HISTORY LOG FOUND]", {
    found: Boolean(historyLog),
    count: Array.isArray((historyLog?.parsed as Record<string, JsonValue> | null)?.displayedTransactions)
      ? (((historyLog?.parsed as Record<string, JsonValue>).displayedTransactions as JsonValue[]).length)
      : 0,
  });

  return historyLog ?? null;
}

async function getLastHistoryTransactions(userId: string, phone: string): Promise<Array<Record<string, JsonValue>>> {
  const historyLog = await getLastHistoryLog(userId, phone);
  const parsed = (historyLog?.parsed ?? null) as Record<string, JsonValue> | null;
  return (parsed?.displayedTransactions ?? []) as Array<Record<string, JsonValue>>;
}

function findDisplayedTransactionByNumber(displayedTransactions: Array<Record<string, JsonValue>>, number: number): Record<string, JsonValue> | null {
  return displayedTransactions.find((item) => Number(item.no ?? 0) === number) ?? null;
}

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = String(error.message ?? "").toLowerCase();
  return error.code === "42703" || error.code === "PGRST204" || message.includes("column") || message.includes("schema cache");
}

async function updateTransactionDateField(transactionId: string, userId: string, newDate: string): Promise<string> {
  const dateFields = ["transaction_date", "date", "trx_date", "created_date"];
  let lastError: { message?: string } | null = null;

  for (const field of dateFields) {
    const { error } = await supabase
      .from("transactions")
      .update({ [field]: newDate })
      .eq("id", transactionId)
      .eq("user_id", userId);
    if (!error) return field;
    lastError = error;
    if (!isMissingColumnError(error)) throw error;
  }

  throw new Error(`TRANSACTION_DATE_FIELD_NOT_FOUND: ${lastError?.message ?? "No supported date field found"}`);
}

async function handleEditTransaction(userId: string, phone: string, rawMessage: string): Promise<{ reply: string; parsedLog: Record<string, JsonValue> }> {
  const parsedEdit = parseEditTransactionCommand(rawMessage);
  if (!parsedEdit) {
    return { reply: "⚠️ Format edit tidak valid.\n\nContoh:\nedit 1 15000", parsedLog: { command: "edit_transaction_failed", reason: "invalid_format" } };
  }

  console.log("[EDIT HISTORY]", {
    number: parsedEdit.number,
    value: parsedEdit.value,
    detectedType: parsedEdit.field,
  });

  const displayedTransactions = await getLastHistoryTransactions(userId, phone);
  if (displayedTransactions.length === 0) {
    return { reply: "⚠️ Belum ada history terakhir.\n\nKetik:\nhistory", parsedLog: { command: "edit_transaction_failed", reason: "history_not_found" } };
  }
  const selectedTransaction = findDisplayedTransactionByNumber(displayedTransactions, parsedEdit.number);
  if (!selectedTransaction) {
    return { reply: "⚠️ Nomor history tidak ditemukan.\n\nKetik:\nhistory", parsedLog: { command: "edit_transaction_failed", reason: "number_not_found", number: parsedEdit.number } };
  }

  const transactionId = String(selectedTransaction.id ?? "");
  const { data: txRow, error: txError } = await supabase
    .from("transactions")
    .select("id,title,amount,type,category_id,account_id,to_account_id")
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
    return {
      reply: [
        "✏️ Transaksi Berhasil Diedit",
        "",
        "━━━━━━━━━━━━━━",
        `No: ${parsedEdit.number}`,
        "Nominal Baru:",
        formatIDR(newValue),
      ].join("\n"),
      parsedLog: { command: "edit_transaction", transactionId, field: "amount", oldValue, newValue },
    };
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
    return {
      reply: [
        "✏️ Transaksi Berhasil Diedit",
        "",
        "━━━━━━━━━━━━━━",
        `No: ${parsedEdit.number}`,
        "Akun Baru:",
        account.name,
      ].join("\n"),
      parsedLog: { command: "edit_transaction", transactionId, field: "account", oldValue, newValue: account.name },
    };
  }
  const dateInput = String(parsedEdit.value);
  const newDate = parseEditDateToken(dateInput);
  console.log("[EDIT DATE PARSED]", {
    input: dateInput,
    parsedDate: newDate,
  });
  if (!newDate) return { reply: "⚠️ Format tanggal tidak valid.\n\nGunakan format:\n01/06\n01/06/2026\n2026-06-01", parsedLog: { command: "edit_transaction_failed", reason: "invalid_date", transactionId, value: dateInput } };
  const oldValue = String(selectedTransaction.date ?? "-");
  const updatedField = await updateTransactionDateField(transactionId, userId, newDate);
  return {
    reply: [
      "✏️ Transaksi Berhasil Diedit",
      "",
      "━━━━━━━━━━━━━━",
      `No: ${parsedEdit.number}`,
      `Kategori: ${String(selectedTransaction.categoryName ?? "-")}`,
      `Judul: ${String(txRow.title ?? selectedTransaction.title ?? "-")}`,
      "",
      "📅 Tanggal Baru:",
      formatEditDateForReply(newDate),
    ].join("\n"),
    parsedLog: { command: "edit_transaction", transactionId, field: "date", updatedField, oldValue, newValue: newDate },
  };
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

function isDebtRowOpen(row: Record<string, JsonValue>): boolean {
  const status = getDebtStatus(row);
  if (["paid", "lunas", "deleted", "hapus", "cancelled", "canceled", "closed"].includes(status)) return false;
  if (row.is_paid === true || row.deleted_at || row.is_active === false) return false;
  return true;
}

function rowHasDebtTypeField(row: Record<string, JsonValue>): boolean {
  return row.type !== undefined || row.kind !== undefined || row.debt_type !== undefined;
}

function isDebtTypeRow(row: Record<string, JsonValue>, type: "hutang" | "piutang"): boolean {
  const kind = getDebtKind(row);
  if (type === "hutang") return kind.includes("hutang") || kind.includes("debt") || kind.includes("payable");
  return kind.includes("piutang") || kind.includes("receivable");
}

async function getOpenDebts(userId: string): Promise<Array<Record<string, JsonValue>>> {
  const { data, error } = await supabase
    .from("debts")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, JsonValue>>).filter(isDebtRowOpen);
}

async function findOpenDebtByParty(userId: string, debtType: DebtType, partyName: string): Promise<Record<string, JsonValue> | null> {
  const { data, error } = await supabase
    .from("debts")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;

  const normalizedParty = normalizeText(partyName);
  const rows = ((data ?? []) as Array<Record<string, JsonValue>>).filter(isDebtRowOpen);
  return rows.find((row) => {
    const hasTypeField = rowHasDebtTypeField(row);
    if (hasTypeField && !isDebtTypeRow(row, debtType === "debt" ? "hutang" : "piutang")) return false;
    if (!hasTypeField && debtType !== "debt") return false;
    const names = [
      getDebtName(row),
      row.party_name,
      row.person_name,
      row.counterparty_name,
    ].map((value) => normalizeText(String(value ?? ""))).filter(Boolean);
    return names.some((name) => name.includes(normalizedParty) || normalizedParty.includes(name));
  }) ?? null;
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

function getDebtTotalAmount(row: any): number {
  return Number(
    row.total_amount ??
    row.amount ??
    row.nominal ??
    row.total ??
    row.value ??
    0,
  );
}

function getDebtPaidAmount(row: any): number {
  return Number(
    row.paid_amount ??
    row.paid ??
    row.amount_paid ??
    row.total_paid ??
    row.paid_total ??
    0,
  );
}

function getDebtRemainingAmount(row: any): number {
  const explicit = row.remaining_amount ?? row.remaining ?? row.sisa ?? row.balance;
  if (explicit !== undefined && explicit !== null) return Number(explicit);

  return Math.max(getDebtTotalAmount(row) - getDebtPaidAmount(row), 0);
}

function getDebtName(row: any): string {
  return String(
    row.name ??
    row.title ??
    row.label ??
    row.description ??
    row.note ??
    row.party_name ??
    row.person_name ??
    row.counterparty_name ??
    "-",
  );
}

function getDebtDueDate(row: any): string | null {
  return (
    row.due_date ??
    row.due_at ??
    row.dueDate ??
    row.jatuh_tempo ??
    row.deadline ??
    null
  );
}

function getDebtKind(row: any): string {
  return String(
    row.kind ??
    row.type ??
    row.debt_type ??
    row.category ??
    "",
  ).toLowerCase();
}

function getDebtStatus(row: any): string {
  return String(row.status ?? row.state ?? "").toLowerCase();
}

function formatDebtDateLocal(value: string): string {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw || "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

function formatDebtDueDate(row: any): string {
  const due = getDebtDueDate(row);
  if (!due) return "-";
  return formatDebtDateLocal(String(due));
}

async function findLastDisplayedDebtList(userId: string): Promise<Array<Record<string, JsonValue>> | null> {
  const { data, error } = await supabase
    .from("whatsapp_message_logs")
    .select("parsed,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  for (const row of (data ?? []) as Array<Record<string, JsonValue>>) {
    const parsed = row.parsed as Record<string, JsonValue> | null;
    if (!parsed || String(parsed.command ?? "") !== "hutang_list") continue;
    const displayedDebts = parsed.displayedDebts as JsonValue;
    if (Array.isArray(displayedDebts)) return displayedDebts as Array<Record<string, JsonValue>>;
  }
  return null;
}

async function updateDebtAmount(userId: string, debtId: string, amount: number): Promise<void> {
  const { data: row, error: rowError } = await supabase.from("debts").select("*").eq("id", debtId).eq("user_id", userId).maybeSingle();
  if (rowError) throw rowError;
  if (!row) throw new Error("Debt not found");
  const debtRow = row as Record<string, JsonValue>;
  const field = "total_amount" in debtRow
    ? "total_amount"
    : "amount" in debtRow
    ? "amount"
    : "nominal" in debtRow
    ? "nominal"
    : "total" in debtRow
    ? "total"
    : "value" in debtRow
    ? "value"
    : null;
  if (!field) throw new Error("DEBT_AMOUNT_FIELD_NOT_FOUND");
  console.log("[DEBT UPDATE FIELD]", { field, value: amount });
  const { error } = await supabase.from("debts").update({ [field]: amount }).eq("id", debtId).eq("user_id", userId);
  if (error) throw error;
}

async function softDeleteDebt(userId: string, debtId: string): Promise<void> {
  const { data: row, error: rowError } = await supabase.from("debts").select("*").eq("id", debtId).eq("user_id", userId).maybeSingle();
  if (rowError) throw rowError;
  if (!row) throw new Error("Debt not found");
  const debtRow = row as Record<string, JsonValue>;
  if ("deleted_at" in debtRow) {
    const { error } = await supabase.from("debts").update({ deleted_at: new Date().toISOString() }).eq("id", debtId).eq("user_id", userId);
    if (error) throw error;
    return;
  }
  if ("status" in debtRow) {
    const { error } = await supabase.from("debts").update({ status: "deleted" }).eq("id", debtId).eq("user_id", userId);
    if (error) throw error;
    return;
  }
  if ("is_active" in debtRow) {
    const { error } = await supabase.from("debts").update({ is_active: false }).eq("id", debtId).eq("user_id", userId);
    if (error) throw error;
    return;
  }
  throw new Error("DEBT_SAFE_DELETE_NOT_SUPPORTED");
}

async function handleDebtCommand(userId: string, rawMessage: string, normalized: string): Promise<{ reply: string; parsedLog: Record<string, JsonValue> }> {
  if (normalized === "hutang" || normalized === "piutang") {
    const type = normalized === "hutang" ? "hutang" : "piutang";
    let rows: Array<Record<string, JsonValue>> = [];
    try {
      rows = await getOpenDebts(userId);
    } catch (error) {
      console.error("[DEBT QUERY ERROR]", error);
      const message = error instanceof Error ? error.message : String(error);
      return { reply: `❌ *Gagal Mengambil Hutang*\n${message}`, parsedLog: { command: `${type}_list`, status: "query_error", error: message } };
    }

    console.log("[DEBT ROW SAMPLE]", rows?.[0]);
    const hasTypeField = rows.some(rowHasDebtTypeField);
    const filteredRows = type === "hutang"
      ? hasTypeField ? rows.filter((row) => isDebtTypeRow(row, "hutang")) : rows
      : hasTypeField ? rows.filter((row) => isDebtTypeRow(row, "piutang")) : [];

    console.log("[DEBT LIST BUILT]", { type, count: filteredRows.length });

    const title = type === "hutang" ? "💳 *Hutang Aktif*" : "📒 *Piutang Aktif*";
    const emptyText = type === "hutang" ? "ℹ️ Belum ada hutang aktif." : "ℹ️ Belum ada piutang aktif.";
    const command = type === "hutang" ? "hutang_list" : "piutang_list";
    if (filteredRows.length === 0) return { reply: `${title}\n\n━━━━━━━━━━━━━━\n${emptyText}`, parsedLog: { command, displayedDebts: [] } };

    const displayedDebts = filteredRows.map((row, i) => {
      const totalAmount = getDebtTotalAmount(row);
      const paidAmount = getDebtPaidAmount(row);
      const remainingAmount = getDebtRemainingAmount(row);
      const dueDate = formatDebtDueDate(row);
      console.log("[DEBT SCHEMA SAFE]", { totalAmount, paidAmount, remainingAmount, dueDate });
      return { no: i + 1, id: String(row.id ?? ""), name: getDebtName(row), totalAmount, paidAmount, remainingAmount, dueDate };
    });
    const lines = displayedDebts.map((item) => `${item.no}. *${item.name}*\n💰 Total: *${formatIDR(item.totalAmount)}*\n💸 Dibayar: *${formatIDR(item.paidAmount)}*\n🧾 Sisa: *${formatIDR(item.remainingAmount)}*\n📅 Jatuh Tempo: *${item.dueDate}*`);
    const editHint = type === "hutang" ? `\n\n━━━━━━━━━━━━━━\n✏️ Edit:\n• edit hutang 1 200rb\n• edit hutang 2 500000\n\n🗑️ Hapus:\n• hapus hutang 1` : "";
    return { reply: `${title}\n\n━━━━━━━━━━━━━━\n${lines.join("\n\n")}${editHint}`, parsedLog: { command, displayedDebts } };
  }

  const editMatch = normalized.match(/^edit\s+hutang\s+(\d+)\s+(.+)$/);
  if (editMatch) {
    const number = Number(editMatch[1]);
    const amount = parseAmount(editMatch[2]);
    console.log("[EDIT DEBT]", { number, amount });
    if (!Number.isFinite(amount) || amount <= 0) return { reply: "⚠️ Nominal tidak valid.", parsedLog: { command: "edit_hutang", status: "invalid_amount" } };
    const displayedDebts = await findLastDisplayedDebtList(userId);
    if (!displayedDebts) return { reply: "⚠️ *Belum Ada List Hutang*\n\nKetik:\n*hutang*", parsedLog: { command: "edit_hutang", status: "list_not_found" } };
    const selected = displayedDebts.find((item) => Number((item as Record<string, JsonValue>).no ?? 0) === number) as Record<string, JsonValue> | undefined;
    if (!selected) return { reply: "❌ *Nomor Hutang Tidak Ditemukan*", parsedLog: { command: "edit_hutang", status: "number_not_found", number } };
    try {
      await updateDebtAmount(userId, String(selected.id ?? ""), amount);
    } catch (error) {
      if (error instanceof Error && error.message === "DEBT_AMOUNT_FIELD_NOT_FOUND") {
        return { reply: "❌ Kolom nominal hutang tidak ditemukan.", parsedLog: { command: "edit_hutang", status: "field_not_found", number } };
      }
      throw error;
    }
    return { reply: `✏️ *Hutang Berhasil Diedit*\n\n━━━━━━━━━━━━━━\n📌 Nama: *${String(selected.name ?? "-")}*\n💰 Nominal Baru: *${formatIDR(amount)}*\n📅 Jatuh Tempo: *${String(selected.dueDate ?? "-")}*`, parsedLog: { command: "edit_hutang", status: "success", number, amount } };
  }

  const deleteMatch = normalized.match(/^hapus\s+hutang\s+(\d+)$/);
  if (deleteMatch) {
    const number = Number(deleteMatch[1]);
    console.log("[DELETE DEBT]", { number });
    const displayedDebts = await findLastDisplayedDebtList(userId);
    if (!displayedDebts) return { reply: "⚠️ *Belum Ada List Hutang*\n\nKetik:\n*hutang*", parsedLog: { command: "hapus_hutang", status: "list_not_found" } };
    const selected = displayedDebts.find((item) => Number((item as Record<string, JsonValue>).no ?? 0) === number) as Record<string, JsonValue> | undefined;
    if (!selected) return { reply: "❌ *Nomor Hutang Tidak Ditemukan*", parsedLog: { command: "hapus_hutang", status: "number_not_found", number } };
    try {
      await softDeleteDebt(userId, String(selected.id ?? ""));
    } catch (error) {
      if (error instanceof Error && error.message === "DEBT_SAFE_DELETE_NOT_SUPPORTED") {
        return { reply: "❌ Schema hutang belum mendukung hapus aman.", parsedLog: { command: "hapus_hutang", status: "schema_not_supported", number } };
      }
      throw error;
    }
    return { reply: `🗑️ *Hutang Berhasil Dihapus*\n\n━━━━━━━━━━━━━━\n📌 Nama: *${String(selected.name ?? "-")}*\n💰 Nominal: *${formatIDR(Number(selected.totalAmount ?? 0))}*`, parsedLog: { command: "hapus_hutang", status: "success", number } };
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

  const totalAmount = getDebtTotalAmount(debt);
  const paidTotal = getDebtPaidAmount(debt);
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
  const paidField = "paid_amount" in debt
    ? "paid_amount"
    : "paid" in debt
    ? "paid"
    : "amount_paid" in debt
    ? "amount_paid"
    : "total_paid" in debt
    ? "total_paid"
    : "paid_total" in debt
    ? "paid_total"
    : null;
  if (!paidField) {
    return { reply: "❌ Kolom pembayaran hutang tidak ditemukan di schema.", parsedLog: { command: "debt", action: "bayar", status: "payment_field_not_found" } };
  }
  console.log("[DEBT UPDATE FIELD]", { field: paidField, value: newPaidTotal });
  const debtUpdate: Record<string, JsonValue> = { [paidField]: newPaidTotal };
  if ("status" in debt) debtUpdate.status = nextStatus;
  const { error: updateDebtErr } = await supabase.from("debts").update(debtUpdate).eq("id", String(debt.id)).eq("user_id", userId);
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
    .select("*")
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
    planned = getBudgetAmount(b);
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
      .select("*")
      .eq("user_id", userId)
      .in("id", budgetIds)
      .or(`period_month.eq.${monthStart},month.eq.${monthStart}`)
      .limit(1);
    if (budgetErr) throw budgetErr;
    if (!budgets || budgets.length === 0) return null;

    const b = budgets[0] as Record<string, JsonValue>;
    budgetId = String(b.id);
    planned = getBudgetAmount(b);
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

function getBudgetAmount(row: Record<string, JsonValue>): number {
  return Number(row.amount_planned ?? row.planned ?? row.amount ?? row.total ?? 0);
}

function getBudgetPeriod(row: Record<string, JsonValue>): string {
  return String(row.period_month ?? row.month ?? "");
}

function getBudgetName(row: Record<string, JsonValue>): string {
  return String(row.name ?? row.label ?? "-");
}

function parseBudgetPeriodKey(text: string): BudgetPeriodKey | null {
  const normalized = normalizeText(text);
  if (["bulan ini", "bulan sekarang", "sekarang", "now"].includes(normalized)) return "current";
  if (["bulan lalu", "bulan kemarin", "kemarin", "prev", "previous"].includes(normalized)) return "previous";
  if (["bulan depan", "bulan besok", "bulan berikutnya", "besok", "berikutnya", "next"].includes(normalized)) return "next";
  return null;
}

function parseBudgetPeriodCommand(text: string): BudgetPeriodCommand | null {
  const normalized = normalizeText(text);
  if (normalized === "budget") return { periodType: "monthly", period: "current" };
  const periodText = normalized.replace(/^budget\s+/, "").trim();
  const period = parseBudgetPeriodKey(periodText);
  return period ? { periodType: "monthly", period } : null;
}

function getBudgetPeriodSource(text: string): "shortcut" | "explicit" {
  return normalizeText(text) === "budget" ? "shortcut" : "explicit";
}

function getBudgetPeriodDisplayName(period: BudgetPeriodKey): string {
  const labels: Record<BudgetPeriodKey, string> = { current: "Bulan Ini", previous: "Bulan Lalu", next: "Bulan Depan" };
  return labels[period];
}

function extractBudgetPeriodFromText(text: string): { period: BudgetPeriodKey; rest: string } {
  const normalized = normalizeText(text);
  const aliases: Array<{ phrase: string; period: BudgetPeriodKey }> = [
    { phrase: "bulan berikutnya", period: "next" },
    { phrase: "bulan sekarang", period: "current" },
    { phrase: "bulan kemarin", period: "previous" },
    { phrase: "bulan besok", period: "next" },
    { phrase: "bulan depan", period: "next" },
    { phrase: "bulan lalu", period: "previous" },
    { phrase: "bulan ini", period: "current" },
    { phrase: "berikutnya", period: "next" },
    { phrase: "sekarang", period: "current" },
    { phrase: "kemarin", period: "previous" },
    { phrase: "besok", period: "next" },
    { phrase: "next", period: "next" },
    { phrase: "prev", period: "previous" },
  ];
  for (const alias of aliases) {
    const re = new RegExp(`(?:^|\\s)${alias.phrase.replace(/ /g, "\\s+")}(?:$|\\s)`, "i");
    if (re.test(normalized)) {
      return { period: alias.period, rest: normalized.replace(re, " ").replace(/\s+/g, " ").trim() };
    }
  }
  return { period: "current", rest: normalized };
}

function getBudgetPeriodRange(periodType: BudgetPeriodType, period: BudgetPeriodKey): BudgetPeriodRange {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const target = new Date(now);
  target.setMonth(target.getMonth() + (period === "previous" ? -1 : period === "next" ? 1 : 0));

  const start = getMonthStart(target);
  const end = getNextMonthStart(target);
  return { start, end, periodMonth: start, periodType, period };
}

async function getMonthlyBudgetRowsForPeriod(userId: string, periodMonth: string): Promise<Array<Record<string, JsonValue>>> {
  const { data, error } = await supabase.from("budgets")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, JsonValue>>)
    .filter((row) => !row.deleted_at)
    .filter((row) => getBudgetPeriod(row) === periodMonth);
}

async function getMonthlyBudgetsByPeriod(userId: string, range: BudgetPeriodRange): Promise<BudgetPeriodItem[]> {
  const rows = await getMonthlyBudgetRowsForPeriod(userId, range.periodMonth);
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
      const planned = getBudgetAmount(row);
      if (planned <= 0) return null;
      const bid = String(row.id ?? "");
      const categoryIds = budgetCategoryMap.get(bid) ?? [];
      const used = categoryIds.reduce((sum, cid) => sum + (txSumByCategory.get(cid) ?? 0), 0);
      return {
        id: bid,
        categoryId: categoryIds[0] ?? null,
        categoryNames: categoryIds.length > 0 ? categoryIds.map((cid) => categoryNameMap.get(cid) ?? "-").filter(Boolean) : [getBudgetName(row)],
        planned,
        used,
        remaining: planned - used,
        percentage: planned > 0 ? Math.round((used / planned) * 100) : 0,
        periodMonth: getBudgetPeriod(row),
        createdAt: String(row.created_at ?? ""),
      };
    })
    .filter((v): v is BudgetPeriodItem => Boolean(v))
    .sort((a, b) => (b.planned - a.planned) || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
}

function getBudgetPeriodLabel(command: BudgetPeriodCommand): string {
  const titleMap: Record<BudgetPeriodType, Record<BudgetPeriodKey, string>> = {
    monthly: { current: "📊 *Budget Bulan Ini*", previous: "📊 *Budget Bulan Lalu*", next: "📊 *Budget Bulan Depan*" },
  };
  return titleMap[command.periodType][command.period];
}

function buildBudgetPeriodMessage(command: BudgetPeriodCommand, monthly: BudgetPeriodItem[]): string {
  const label = getBudgetPeriodLabel(command);
  if (monthly.length === 0) return [label, "", line(), "ℹ️ Belum ada budget untuk periode ini."].join("\n");

  const totalBudget = monthly.reduce((sum, b) => sum + b.planned, 0);
  const totalUsed = monthly.reduce((sum, b) => sum + b.used, 0);
  const totalRemaining = monthly.reduce((sum, b) => sum + b.remaining, 0);

  console.log("[BUDGET PERIOD SUMMARY]", {
    totalBudget,
    totalUsed,
    totalRemaining,
  });

  const lines: string[] = [
    label,
    "",
    line(),
    "💰 *Ringkasan*",
    `• Total Budget: ${money(totalBudget)}`,
    `• Terpakai: ${money(totalUsed)}`,
    `• Sisa: ${money(totalRemaining)}`,
    "",
    line(),
  ];
  monthly.forEach((b, i) => {
    lines.push(`${i + 1}. ${bold(b.categoryNames.join(", "))}`);
    lines.push(`   Budget: ${money(b.planned)}`);
    lines.push(`   Terpakai: ${money(b.used)}`);
    lines.push(`   Sisa: ${money(b.remaining)}`);
    lines.push(`   Progress: ${bold(`${b.percentage}%`)}`);
    if (b.percentage >= 100) lines.push("🚨 Budget terlampaui");
    else if (b.percentage >= 80) lines.push("⚠️ Hampir habis");
    lines.push("");
  });
  return lines.join("\n").trim();
}

function budgetDisplayItems(items: BudgetPeriodItem[]): JsonValue[] {
  return items.map((b, i) => ({
    no: i + 1,
    id: b.id,
    categoryId: b.categoryId,
    categoryName: b.categoryNames[0] ?? getBudgetName({}),
    categoryNames: b.categoryNames,
    planned: b.planned,
    used: b.used,
    remaining: b.remaining,
    percentage: b.percentage,
    periodMonth: b.periodMonth,
  }));
}

async function getLastBudgetLog(userId: string, phone: string): Promise<Record<string, JsonValue> | null> {
  const { data: logs, error } = await supabase
    .from("whatsapp_message_logs")
    .select("id,created_at,parsed")
    .eq("user_id", userId)
    .eq("phone", phone)
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;

  return ((logs ?? []) as Array<Record<string, JsonValue>>).find((log) => {
    const parsed = (log.parsed ?? null) as Record<string, JsonValue> | null;
    return parsed?.command === "budget_period" && Array.isArray(parsed?.displayedBudgets) && parsed.displayedBudgets.length > 0;
  }) ?? null;
}

async function getLastDisplayedBudgets(userId: string, phone: string): Promise<Array<Record<string, JsonValue>>> {
  const log = await getLastBudgetLog(userId, phone);
  const parsed = (log?.parsed ?? null) as Record<string, JsonValue> | null;
  return (parsed?.displayedBudgets ?? []) as Array<Record<string, JsonValue>>;
}

function findDisplayedBudgetByNumber(displayedBudgets: Array<Record<string, JsonValue>>, number: number): Record<string, JsonValue> | null {
  return displayedBudgets.find((item) => Number(item.no ?? 0) === number) ?? null;
}

function parseAddBudgetCommand(normalized: string): { categoryName: string; amount: number; period: BudgetPeriodKey } | null {
  if (!normalized.startsWith("tambah budget ")) return null;
  const body = normalized.replace(/^tambah\s+budget\s+/, "").trim();
  const extracted = extractBudgetPeriodFromText(body);
  const parts = extracted.rest.split(/\s+/).filter(Boolean);
  const amountIndex = parts.findIndex((part) => parseAmount(part) > 0);
  if (amountIndex <= 0) return { categoryName: parts.filter((_, i) => i !== amountIndex).join(" ").trim(), amount: 0, period: extracted.period };
  return { categoryName: parts.slice(0, amountIndex).join(" ").trim(), amount: parseAmount(parts[amountIndex]), period: extracted.period };
}

function parseEditBudgetCommand(normalized: string): { number: number | null; categoryName: string | null; amount: number } | null {
  if (!normalized.startsWith("edit budget ")) return null;
  const body = normalized.replace(/^edit\s+budget\s+/, "").trim();
  const parts = body.split(/\s+/).filter(Boolean);
  const amountIndex = parts.findIndex((part) => parseAmount(part) > 0);
  if (amountIndex < 0) return { number: null, categoryName: parts.join(" ").trim() || null, amount: 0 };
  const amount = parseAmount(parts[amountIndex]);
  const target = parts.slice(0, amountIndex).join(" ").trim();
  const number = /^\d+$/.test(target) ? Number(target) : null;
  return { number, categoryName: number ? null : target, amount };
}

function parseDeleteBudgetCommand(normalized: string): { number: number | null; categoryName: string | null } | null {
  if (!normalized.startsWith("hapus budget ")) return null;
  const target = normalized.replace(/^hapus\s+budget\s+/, "").trim();
  if (!target) return { number: null, categoryName: null };
  return /^\d+$/.test(target) ? { number: Number(target), categoryName: null } : { number: null, categoryName: target };
}

async function findBudgetByCategoryAndPeriod(userId: string, categoryId: string, periodMonth: string): Promise<Record<string, JsonValue> | null> {
  const rows = await getMonthlyBudgetRowsForPeriod(userId, periodMonth);
  const direct = rows.find((row) => String(row.category_id ?? "") === categoryId);
  if (direct) return direct;

  const budgetIds = rows.map((row) => String(row.id ?? "")).filter(Boolean);
  if (budgetIds.length === 0) return null;
  const { data: links, error } = await supabase
    .from("budget_categories")
    .select("budget_id")
    .eq("category_id", categoryId)
    .in("budget_id", budgetIds);
  if (error) throw error;
  const linkedBudgetId = String(((links ?? []) as Array<Record<string, JsonValue>>)[0]?.budget_id ?? "");
  return linkedBudgetId ? rows.find((row) => String(row.id ?? "") === linkedBudgetId) ?? null : null;
}

async function insertBudgetSafe(input: { userId: string; categoryId: string; categoryName: string; amount: number; periodMonth: string }): Promise<Record<string, JsonValue>> {
  const amountFields = ["amount_planned", "planned", "amount", "total"];
  const periodFields = ["period_month", "month"];
  let lastError: { message?: string } | null = null;
  for (const amountField of amountFields) {
    for (const periodField of periodFields) {
      for (const includeName of [true, false]) {
        const payload: Record<string, JsonValue> = { user_id: input.userId, category_id: input.categoryId, [amountField]: input.amount, [periodField]: input.periodMonth };
        if (includeName) payload.name = input.categoryName;
        const { data, error } = await supabase.from("budgets").insert(payload).select("*").single();
        if (!error && data) return data as Record<string, JsonValue>;
        lastError = error;
        if (!isMissingColumnError(error)) throw error;
      }
    }
  }
  throw new Error(`BUDGET_INSERT_FIELD_NOT_FOUND: ${lastError?.message ?? "No supported budget field found"}`);
}

async function updateBudgetAmountSafe(userId: string, budgetId: string, amount: number): Promise<string> {
  const amountFields = ["amount_planned", "planned", "amount", "total"];
  let lastError: { message?: string } | null = null;
  for (const amountField of amountFields) {
    const { error } = await supabase.from("budgets").update({ [amountField]: amount }).eq("id", budgetId).eq("user_id", userId);
    if (!error) return amountField;
    lastError = error;
    if (!isMissingColumnError(error)) throw error;
  }
  throw new Error(`BUDGET_UPDATE_FIELD_NOT_FOUND: ${lastError?.message ?? "No supported budget amount field found"}`);
}

async function deleteBudgetSafe(userId: string, budgetId: string): Promise<"soft" | "hard"> {
  if (await hasDeletedAtColumn("budgets")) {
    const { error } = await supabase.from("budgets").update({ deleted_at: new Date().toISOString() }).eq("id", budgetId).eq("user_id", userId);
    if (!error) return "soft";
    if (!isMissingColumnError(error)) throw error;
  }
  const { error: hardError } = await supabase.from("budgets").delete().eq("id", budgetId).eq("user_id", userId);
  if (hardError) throw hardError;
  return "hard";
}

async function handleAddBudgetCommand(userId: string, normalized: string): Promise<{ reply: string; parsedLog: Record<string, JsonValue> }> {
  const parsed = parseAddBudgetCommand(normalized);
  const categoryName = parsed?.categoryName ?? "";
  const amount = parsed?.amount ?? 0;
  const period = parsed?.period ?? "current";
  const periodMonth = getBudgetPeriodRange("monthly", period).periodMonth;
  console.log("[BUDGET CRUD]", { action: "add", categoryName, amount, periodMonth });

  if (!categoryName) return { reply: "⚠️ Format budget tidak valid.\n\nContoh:\n*tambah budget jajan 500rb bulan ini*", parsedLog: { command: "budget_crud", action: "add", status: "invalid_format" } };
  if (amount <= 0) return { reply: "⚠️ *Nominal Budget Tidak Valid*\n\nContoh:\n*tambah budget jajan 500rb bulan ini*", parsedLog: { command: "budget_crud", action: "add", status: "invalid_amount", categoryName } };
  const category = await findCategory(userId, categoryName);
  if (!category) return { reply: `❌ *Kategori Tidak Ditemukan*\n\nKategori: *${categoryName}*`, parsedLog: { command: "budget_crud", action: "add", status: "category_not_found", categoryName, amount, periodMonth } };
  const existing = await findBudgetByCategoryAndPeriod(userId, category.id, periodMonth);
  if (existing) return { reply: "⚠️ *Budget Sudah Ada*\n\nGunakan:\n*edit budget jajan 600rb*", parsedLog: { command: "budget_crud", action: "add", status: "already_exists", categoryName: category.name, amount, periodMonth } };
  await insertBudgetSafe({ userId, categoryId: category.id, categoryName: category.name, amount, periodMonth });
  return {
    reply: [`✅ *Budget Berhasil Ditambahkan*`, "", line(), `Kategori: *${category.name}*`, `Periode: *${getBudgetPeriodDisplayName(period)}*`, `Nominal: *${formatIDR(amount)}*`].join("\n"),
    parsedLog: { command: "budget_crud", action: "add", status: "success", categoryName: category.name, amount, periodMonth },
  };
}

async function resolveBudgetTarget(userId: string, phone: string, parsed: { number: number | null; categoryName: string | null }): Promise<{ budget: Record<string, JsonValue>; categoryName: string; period: BudgetPeriodKey; periodMonth: string } | null> {
  if (parsed.number) {
    const displayed = await getLastDisplayedBudgets(userId, phone);
    const selected = findDisplayedBudgetByNumber(displayed, parsed.number);
    if (!selected) return null;
    const budgetId = String(selected.id ?? "");
    const { data, error } = await supabase.from("budgets").select("*").eq("id", budgetId).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!data || (data as Record<string, JsonValue>).deleted_at) return null;
    const budgetRow = data as Record<string, JsonValue>;
    const periodMonth = String(selected.periodMonth ?? getBudgetPeriod(budgetRow));
    const period = periodMonth === getBudgetPeriodRange("monthly", "previous").periodMonth
      ? "previous"
      : periodMonth === getBudgetPeriodRange("monthly", "next").periodMonth
      ? "next"
      : "current";
    return { budget: budgetRow, categoryName: String(selected.categoryName ?? "-"), period, periodMonth };
  }
  const categoryName = parsed.categoryName ?? "";
  const category = categoryName ? await findCategory(userId, categoryName) : null;
  if (!category) return null;
  const period = "current";
  const periodMonth = getBudgetPeriodRange("monthly", period).periodMonth;
  const budget = await findBudgetByCategoryAndPeriod(userId, category.id, periodMonth);
  return budget ? { budget, categoryName: category.name, period, periodMonth } : null;
}

async function handleEditBudgetCommand(userId: string, phone: string, normalized: string): Promise<{ reply: string; parsedLog: Record<string, JsonValue> }> {
  const parsed = parseEditBudgetCommand(normalized);
  const categoryName = parsed?.categoryName ?? "";
  const amount = parsed?.amount ?? 0;
  const periodMonth = getBudgetPeriodRange("monthly", "current").periodMonth;
  console.log("[BUDGET CRUD]", { action: "edit", categoryName, amount, periodMonth });
  if (!parsed || amount <= 0) return { reply: "⚠️ *Nominal Budget Tidak Valid*\n\nContoh:\n*tambah budget jajan 500rb bulan ini*", parsedLog: { command: "budget_crud", action: "edit", status: "invalid_amount", categoryName } };
  const resolved = await resolveBudgetTarget(userId, phone, parsed);
  if (!resolved) return { reply: "ℹ️ *Budget Tidak Ditemukan*\n\nGunakan:\n*tambah budget jajan 500rb bulan ini*", parsedLog: { command: "budget_crud", action: "edit", status: "not_found", categoryName, amount, periodMonth } };
  await updateBudgetAmountSafe(userId, String(resolved.budget.id ?? ""), amount);
  return {
    reply: [`✏️ *Budget Berhasil Diubah*`, "", line(), `Kategori: *${resolved.categoryName}*`, `Nominal Baru: *${formatIDR(amount)}*`].join("\n"),
    parsedLog: { command: "budget_crud", action: "edit", status: "success", categoryName: resolved.categoryName, amount, periodMonth: resolved.periodMonth },
  };
}

async function handleDeleteBudgetCommand(userId: string, phone: string, normalized: string): Promise<{ reply: string; parsedLog: Record<string, JsonValue> }> {
  const parsed = parseDeleteBudgetCommand(normalized);
  const categoryName = parsed?.categoryName ?? "";
  const periodMonth = getBudgetPeriodRange("monthly", "current").periodMonth;
  console.log("[BUDGET CRUD]", { action: "delete", categoryName, amount: 0, periodMonth });
  if (!parsed) return { reply: "ℹ️ *Budget Tidak Ditemukan*\n\nGunakan:\n*tambah budget jajan 500rb bulan ini*", parsedLog: { command: "budget_crud", action: "delete", status: "invalid_format" } };
  const resolved = await resolveBudgetTarget(userId, phone, parsed);
  if (!resolved) return { reply: "ℹ️ *Budget Tidak Ditemukan*\n\nGunakan:\n*tambah budget jajan 500rb bulan ini*", parsedLog: { command: "budget_crud", action: "delete", status: "not_found", categoryName, periodMonth } };
  await deleteBudgetSafe(userId, String(resolved.budget.id ?? ""));
  return {
    reply: [`🗑️ *Budget Berhasil Dihapus*`, "", line(), `Kategori: *${resolved.categoryName}*`, `Periode: *${getBudgetPeriodDisplayName(resolved.period)}*`].join("\n"),
    parsedLog: { command: "budget_crud", action: "delete", status: "success", categoryName: resolved.categoryName, periodMonth: resolved.periodMonth },
  };
}


function buildMenuMessage(): string {
  return [
    "📋 *Menu HematWoi*",
    "_Asisten keuangan pribadi via WhatsApp_",
    "",
    line(),
    "💰 *Keuangan*",
    "• saldo",
    "• summary",
    "• history",
    "• budget bulan ini",
    "",
    "📚 *History*",
    "• history",
    "• history cash",
    "• history jajan",
    "• history es budeh",
    "• history 25/05",
    "• history cash 25/05",
    "• hapus 1",
    "• edit 1 15000",
    "",
    "🤖 *AI Assistant*",
    "• ai",
    "• ai pengeluaran cash minggu ini",
    "",
    "🧮 *Kalkulator*",
    "• 20rb + 15rb",
    "• 100rb - 25rb",
    "• 50rb x 3",
    "• 1jt / 4",
    "",
    "➕ *Catat Transaksi*",
    "• beli bensin 20rb",
    "• jajan kopi 15000 cash",
    "• tf 50000 cash seabank",
    "",
    "🎯 *Budget*",
    "• budget",
    "• budget bulan ini",
    "• budget bulan lalu",
    "• budget bulan depan",
    "• budget jajan",
    "• tambah budget jajan 500rb bulan ini",
    "• edit budget 1 600rb",
    "• hapus budget 1",
    "",
    "🧾 *Master Data*",
    "• kategori",
    "• tambah kategori motor expense",
    "• edit kategori motor kendaraan",
    "• hapus kategori motor",
    "• akun",
    "",
    "💳 *Hutang & Piutang*",
    "• hutang",
    "• piutang",
    "• edit hutang 1 200rb",
    "• hapus hutang 1",
    "• tambah hutang shopee 100000 seabank",
    "• bayar hutang shopee 50000 seabank",
    "",
    line(),
    "Ketik *contoh* untuk format lengkap.",
  ].join("\n");
}

function buildExampleMessage(): string {
  return [
    "🧪 *Contoh Penggunaan HematWoi*",
    "",
    line(),
    "➕ *Transaksi*",
    "• beli bensin 20rb",
    "• jajan kopi 15000 cash",
    "• makan naspad 13000 seabank 25/05",
    "",
    "🔁 *Transfer*",
    "• tf 50000 cash seabank",
    "",
    "📚 *History*",
    "• history es budeh",
    "• history beli oli",
    "• history momoyo bulan ini",
    "• hapus 1",
    "• edit 1 15000",
    "",
    "🤖 *AI*",
    "• ai",
    "• ai top kategori bulan ini",
    "• saldo cash",
    "• ai pengeluaran jajan minggu ini",
    "",
    "🎯 *Budget*",
    "• budget",
    "• budget bulan ini",
    "• budget bulan lalu",
    "• budget bulan depan",
    "• budget jajan",
    "• tambah budget jajan 500rb bulan ini",
    "• tambah budget makan 1jt bulan depan",
    "• edit budget 1 600rb",
    "• hapus budget 1",
    "",
    "🧾 *Kategori*",
    "• tambah kategori motor expense",
    "• edit kategori motor kendaraan",
    "• hapus kategori motor",
    "",
    "🧮 *Kalkulator*",
    "• hitung 20rb + 15rb",
    "• calc 100rb - 25rb",
    "• 50rb x 3",
    "",
    "💳 *Hutang / Piutang*",
    "• tambah hutang shopee 100000 seabank",
    "• bayar hutang shopee 50000 seabank",
  ].join("\n");
}

async function handleSmartSearch(userId: string, question: string): Promise<{ reply: string; parsedLog: Record<string, JsonValue> } | null> {
  const intent = detectSmartSearchIntent(question);
  if (!intent) return null;
  const period = parseSearchPeriod(question);
  const keyword = extractSearchKeyword(question);
  console.log("[SMART SEARCH]", { question, intent, keyword, period });

  if (intent === "LARGEST_TRANSACTION") {
    const largest = await getLargestTransactionByPeriod(userId, period);
    if (!largest) return { reply: "🔎 Smart Search\n\nBelum ada transaksi di periode ini.", parsedLog: { command: "smart_search", intent, period } };
    const { data: category } = await supabase.from("categories").select("name").eq("id", String(largest.category_id ?? "")).maybeSingle();
    return {
      reply: `🔎 Smart Search\n\nTransaksi terbesar ${period.label}:\n\n📅 ${formatHistoryDate(String(largest.date ?? ""))}\n${String(category?.name ?? "-")} - ${String(largest.title ?? "-")}\n${formatIDR(Number(largest.amount ?? 0))}`,
      parsedLog: { command: "smart_search", intent, keyword, period },
    };
  }

  const account = await findAccount(userId, keyword);
  if (intent === "ACCOUNT_USAGE" && account) {
    const rows = await getAccountUsageByPeriod(userId, account.id, period);
    if (rows.length === 0) return { reply: `🔎 Smart Search\n\nBelum ada transaksi ${account.name} untuk ${period.label}.`, parsedLog: { command: "smart_search", intent, keyword, period } };
    return {
      reply: `🔎 Smart Search\n\n${account.name} paling banyak dipakai untuk ${period.label}:\n\n${rows.map((r, i) => `${i + 1}. ${r.name} — ${formatIDR(r.total)}`).join("\n")}`,
      parsedLog: { command: "smart_search", intent, keyword, period },
    };
  }

  const category = await findCategory(userId, keyword);
  if (intent === "CATEGORY_PERIOD" && category) {
    const v = await getCategoryExpenseByPeriod(userId, category.id, period);
    return { reply: `🔎 Smart Search\n\nTotal pengeluaran kategori "${category.name}" ${period.label}:\n${formatIDR(v.total)}\n\nJumlah transaksi:\n${v.count} data`, parsedLog: { command: "smart_search", intent, keyword, period } };
  }

  if (intent === "LAST_TRANSACTION") {
    const tx = await findLastTransactionByKeyword(userId, keyword);
    if (!tx) return { reply: `🔎 Smart Search\n\nBelum ada transaksi "${keyword}" di data kamu.`, parsedLog: { command: "smart_search", intent, keyword, period } };
    const [{ data: cat }, { data: acc }] = await Promise.all([
      supabase.from("categories").select("name").eq("id", String(tx.category_id ?? "")).maybeSingle(),
      supabase.from("accounts").select("name").eq("id", String(tx.account_id ?? "")).maybeSingle(),
    ]);
    return { reply: `🔎 Smart Search\n\nTerakhir transaksi "${keyword}":\n\n📅 ${formatHistoryDate(String(tx.date ?? ""))}/${String(tx.date ?? "").slice(0, 4)}\nKategori: ${String(cat?.name ?? "-")}\nJudul: ${String(tx.title ?? "-")}\nNominal: ${formatIDR(Number(tx.amount ?? 0))}\nAkun: ${String(acc?.name ?? "-")}`, parsedLog: { command: "smart_search", intent, keyword, period } };
  }

  if (intent === "FREQUENCY") {
    const v = await getFrequencyByKeyword(userId, keyword, period);
    return { reply: `🔎 Smart Search\n\nTransaksi "${keyword}" ${period.label}:\n${v.count} kali\n\nTotal:\n${formatIDR(v.total)}`, parsedLog: { command: "smart_search", intent, keyword, period } };
  }

  const byCategory = category ? await getCategoryExpenseByPeriod(userId, category.id, period) : null;
  if (byCategory) {
    return { reply: `🔎 Smart Search\n\nTotal pengeluaran "${category!.name}" ${period.label}:\n${formatIDR(byCategory.total)}\n\nJumlah transaksi:\n${byCategory.count} data`, parsedLog: { command: "smart_search", intent: "CATEGORY_PERIOD", keyword, period } };
  }
  const total = await getTotalByKeyword(userId, keyword, period);
  return { reply: `🔎 Smart Search\n\nTotal pengeluaran "${keyword}" ${period.label}:\n${formatIDR(total.total)}\n\nJumlah transaksi:\n${total.count} data`, parsedLog: { command: "smart_search", intent: "TOTAL_BY_KEYWORD", keyword, period } };
}


function isPotentialBotCommand(message: string): boolean {
  const normalized = normalizeText(message);
  if (!normalized) return false;

  if (/^(10|[1-9])$/.test(message.trim())) return true;
  if (isCalculatorExpression(message)) return true;

  const validCommands = [
    "saldo", "summary", "history", "kategori", "akun", "budget", "ai", "ping", "info",
    "hutang", "piutang", "transfer", "tf", "tambah", "edit", "hapus", "undo", "menu", "help", "bantuan", "contoh",
  ];

  if (validCommands.some((cmd) => normalized === cmd || normalized.startsWith(`${cmd} `))) return true;
  if (/^(31\/05|\d{1,2}\/\d{1,2}|\d{1,2}\s+[a-z]+|minggu lalu|bulan ini)$/i.test(normalized)) return true;
  if (/^(halo|wkwk|oke|gas|siap|mantap)$/.test(normalized)) return false;

  const isTxPattern = /^(?:[a-zA-Z][\w-]*)(?:\s+[a-zA-Z][\w-]*)*\s+\d[\d.,]*\s+[a-zA-Z][\w-]*$/.test(normalized);
  if (isTxPattern) return true;

  return false;
}

function isBotReply(body: WebhookBody, sender: string, participant: string, device: string, message: string): boolean {
  const statusText = String(body.status ?? "").toLowerCase();
  const text = message.toLowerCase();
  const hasBotPrefix = BOT_PREFIXES.some((prefix) => message.startsWith(prefix));
  const botNumber = device;

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
      (participant && botNumber && participant === botNumber) ||
      text.includes("sent via fonnte.com") ||
      hasBotPrefix,
  );
}

Deno.serve(async (req: Request) => {
  let sender = "";
  let participant = "";
  let chatTarget = "";
  let message = "";
  let waMessageId = "";
  let userId: string | null = null;
  let canReplyOnError = false;

  try {
    if (req.method !== "POST") return json({ ok: true, ignored: true, reason: "method not allowed" });

    const body = (await req.json()) as WebhookBody;
    sender = extractSender(body);
    participant = extractParticipant(body);
    chatTarget = extractChatTarget(body);
    message = extractMessage(body);
    const device = extractDevice(body);
    waMessageId = extractWaMessageId(body, sender, message);

    if (isBotReply(body, sender, participant, device, message)) {
      return json({ ok: true, ignored: true, reason: "bot/self reply" });
    }

    canReplyOnError = Boolean(chatTarget || sender);

    const isGroup = isGroupMessage(body);
    if (isGroup && chatTarget) {
      groupIdCache.set(chatTarget, chatTarget);
    }
    console.log("[GROUP PAYLOAD KEYS]", Object.keys(body));
    console.log("[GROUP DATA KEYS]", body.data ? Object.keys(body.data) : []);
    console.log("[GROUP PAYLOAD DEBUG]", {
      rawSender: body.sender,
      rawFrom: body.from,
      rawParticipant: body.participant,
      rawAuthor: body.author,
      rawGroup: body.group,
      rawChat: body.chat,
      data: body.data,
    });

    const contextKey = getMessageContextKey({ isGroup, sender, chatTarget });
    const validCommand = isPotentialBotCommand(message);
    console.log("[REPLY ROUTE]", {
      isGroup,
      chatTarget,
      participant,
      willReplyTo: isGroup ? "group" : "personal",
    });
    console.log("[GROUP CHAT]", { isGroup, sender, participant, chatTarget, message, validCommand });
    if (isGroup) {
      console.log("[GROUP MEMBER PARSE]", {
        member: body.member,
        memberlid: body.memberlid,
        parsedParticipant: participant,
      });
    }

    if (isGroup && (!sender || !participant)) {
      console.log("[GROUP PAYLOAD COMPACT]", JSON.stringify(body));
      if (chatTarget) {
        await replyWhatsApp({ target: chatTarget, message: "⚠️ Bot menerima pesan grup, tapi nomor pengirim tidak terbaca.\n\nCek payload Fonnte: participant/author/sender." });
        await replyWhatsApp({ target: chatTarget, message: "⚠️ Tidak bisa membaca pengirim grup. Coba kirim ulang atau cek payload Fonnte." });
      }
      return json({ ok: true, handled: true, reason: "group participant not found" });
    }

    if (isGroup && !validCommand && !body.quoted && !body.context) {
      console.log("[GROUP SAFE MODE]", { message, validCommand, reason: "non-command-group-message" });
      return json({ ok: true, ignored: true, reason: "group-safe-mode" });
    }

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
        phone: contextKey,
        user_id: null,
        raw_text: message,
        parsed: { command: "unknown" },
        status: "failed",
        error_message: "WA user not found",
      });
      await replyWhatsApp({ target: chatTarget || sender, message: "❌ Nomor belum terdaftar di HematWoi." });
      return json({ ok: true, handled: true, reason: "user not found" });
    }

    userId = waUser.user_id;
    const normalized = normalizeText(message);

    let reply = "";
    let parsedLog: Record<string, JsonValue> = { command: normalized.split(" ")[0] ?? "" };

    if (isCalculatorExpression(message)) {
      console.log("[ROUTE MATCH]", { route: "calculator", normalized, isGroup, contextKey });
      const expression = normalizeCalculatorExpression(message);
      if (!expression) {
        reply = buildCalculatorInvalidReply();
        parsedLog = { command: "calculator", expression: getCalculatorExpressionText(message), result: null, status: "invalid" };
      } else {
        try {
          const result = calculateExpressionSafe(expression);
          if (result === null) {
            reply = buildCalculatorInvalidReply();
            parsedLog = { command: "calculator", expression: getCalculatorExpressionText(message), result: null, status: "invalid" };
          } else {
            reply = buildCalculatorReply(message, result);
            parsedLog = { command: "calculator", expression: getCalculatorExpressionText(message), result };
          }
        } catch (error) {
          if (error instanceof Error && error.message === "DIVISION_BY_ZERO") {
            reply = "❌ *Tidak Bisa Dibagi 0*";
            parsedLog = { command: "calculator", expression: getCalculatorExpressionText(message), result: null, status: "division_by_zero" };
          } else {
            throw error;
          }
        }
      }
    } else if (MENU_COMMANDS.has(normalized)) {
      console.log("[ROUTE MATCH]", { route: "menu", normalized, isGroup, contextKey });
      reply = buildMenuMessage();
    } else if (normalized === "contoh") {
      console.log("[ROUTE MATCH]", { route: "contoh", normalized, isGroup, contextKey });
      reply = buildExampleMessage();
      parsedLog = { command: "contoh" };
    } else if (normalized === "ping") {
      console.log("[ROUTE MATCH]", { route: "ping", normalized, isGroup, contextKey });
      reply = "🏓 pong";
    } else if (normalized === "saldo") {
      console.log("[ROUTE MATCH]", { route: "saldo", normalized, isGroup, contextKey });
      const b = await getRealtimeBalanceSummary(userId);
      reply = ["💰 *Saldo HematWoi*", "", line(), `• Cash: ${money(b.cash)}`, `• Non Cash: ${money(b.nonCash)}`, `• Total: ${money(b.total)}`, "", italic("Updated realtime dari RPC.")].join("\n");
    } else if (normalized === "summary") {
      console.log("[ROUTE MATCH]", { route: "summary", normalized, isGroup, contextKey });
      const today = getTodayJakarta();
      let summaryQuery = supabase
        .from("transactions")
        .select("amount,type,category_id")
        .eq("user_id", userId)
        .eq("date", today);
      summaryQuery = await applyTransactionNotDeleted(summaryQuery);
      const { data: txs, error } = await summaryQuery;
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
      const summaryLines = [
        "📊 *Summary Hari Ini*",
        "",
        line(),
        `💸 Pengeluaran: ${money(expense)}`,
        `💵 Pemasukan: ${money(income)}`,
        `🧾 Transaksi: ${bold(`${(txs ?? []).length} data`)}`,
        "",
        "🏆 *Kategori Terbesar*",
        `${biggestCategory} — ${money(catMap.size > 0 ? Math.max(...catMap.values()) : 0)}`,
        "",
        "💡 *Insight*",
        expense > income ? "Pengeluaran hari ini perlu dijaga." : "Pengeluaran hari ini masih terkontrol.",
      ];
      if (expense > 0) {
        const activeWarnings = await buildSmartWarnings({ userId, date: today, amount: 0, categoryName: biggestCategory === "-" ? "Lainnya" : biggestCategory });
        if (activeWarnings.length > 0) summaryLines.push("", "⚠️ Warning Aktif", ...activeWarnings.map((w) => `• ${w}`));
      }
      reply = summaryLines.join("\n");
    } else if (normalized === "info") {
      console.log("[ROUTE MATCH]", { route: "info", normalized, isGroup, contextKey });
      const today = getTodayJakarta();
      let txCountQuery = supabase.from("transactions").select("user_id", { count: "exact", head: true }).eq("user_id", userId).eq("date", today);
      txCountQuery = await applyTransactionNotDeleted(txCountQuery);
      const [{ count: accountCount }, { count: categoryCount }, { count: txCount }] = await Promise.all([
        supabase.from("accounts").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("categories").select("id", { count: "exact", head: true }).eq("user_id", userId),
        txCountQuery,
      ]);
      reply = ["ℹ️ Info HematWoi", `Jumlah akun: ${accountCount ?? 0}`, `Jumlah kategori: ${categoryCount ?? 0}`, `Total transaksi hari ini: ${txCount ?? 0}`].join("\n");
    } else if (normalized.startsWith("tambah budget ")) {
      const budgetRes = await handleAddBudgetCommand(userId, normalized);
      reply = budgetRes.reply;
      parsedLog = budgetRes.parsedLog;
    } else if (normalized.startsWith("edit budget ")) {
      const budgetRes = await handleEditBudgetCommand(userId, contextKey, normalized);
      reply = budgetRes.reply;
      parsedLog = budgetRes.parsedLog;
    } else if (normalized.startsWith("hapus budget ")) {
      const budgetRes = await handleDeleteBudgetCommand(userId, contextKey, normalized);
      reply = budgetRes.reply;
      parsedLog = budgetRes.parsedLog;
    } else if (parseBudgetPeriodCommand(normalized)) {
      const periodCommand = parseBudgetPeriodCommand(normalized) as BudgetPeriodCommand;
      const label = getBudgetPeriodLabel(periodCommand);
      console.log("[BUDGET PERIOD COMMAND]", {
        normalized,
        period: periodCommand.period,
        label,
      });
      const range = getBudgetPeriodRange(periodCommand.periodType, periodCommand.period);
      const monthlyBudgets = await getMonthlyBudgetsByPeriod(userId, range);
      const displayedBudgets = budgetDisplayItems(monthlyBudgets);
      console.log("[BUDGET DISPLAYED]", displayedBudgets);
      reply = buildBudgetPeriodMessage(periodCommand, monthlyBudgets);
      parsedLog = { command: "budget_period", period: periodCommand.period, source: getBudgetPeriodSource(normalized), displayedBudgets };
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
    } else if (/^edit\s+(\d+)\s+(.+)$/i.test(message.trim())) {
      console.log("[EDIT COMMAND DETECTED]", {
        message,
      });
      const editResult = await handleEditTransaction(userId, contextKey, message);
      reply = editResult.reply;
      parsedLog = editResult.parsedLog;
    } else if (AI_SUGGESTION_COMMANDS.has(normalized)) {
      console.log("[ROUTE MATCH]", { route: "ai_suggestion", normalized, isGroup, contextKey });
      console.log("[AI SESSION KEY]", { contextKey, isGroup, chatTarget });
      const suggestions = await getRandomAISuggestions(userId, 10);
      reply = buildAISuggestionMessage(suggestions);
      parsedLog = isGroup
        ? { command: "ai_suggestion", context: "group", chatTarget, participant, sessionId: crypto.randomUUID(), suggestions, active: true }
        : { command: "ai_suggestion", context: "personal", sessionId: crypto.randomUUID(), suggestions, active: true };
    } else if (isAISuggestionNumber(normalized)) {
      console.log("[ROUTE MATCH]", { route: "ai_pick_number", normalized, isGroup, contextKey });
      const aiPick = await handleAISuggestionPick(
        userId,
        contextKey,
        normalized,
        { isGroup, chatTarget, participant },
      );
      reply = aiPick.reply;
      parsedLog = aiPick.parsedLog;
    } else if (detectSmartSearchIntent(normalized)) {
      const smartSearch = await handleSmartSearch(userId, normalized);
      if (smartSearch) {
        reply = smartSearch.reply;
        parsedLog = smartSearch.parsedLog;
      }
    } else if (normalized.startsWith("edit akun")) {
      const editResult = await handleEditLastTransactionAccount(userId, normalized);
      reply = editResult.reply;
      parsedLog = editResult.parsedLog;
    } else if (
      normalized === "hutang" ||
      normalized === "piutang" ||
      normalized.startsWith("tambah hutang") ||
      normalized.startsWith("tambah piutang") ||
      normalized.startsWith("bayar hutang") ||
      normalized.startsWith("bayar piutang") ||
      /^edit\s+hutang\s+\d+\s+.+$/.test(normalized) ||
      /^hapus\s+hutang\s+\d+$/.test(normalized)
    ) {
      const debtRes = await handleDebtCommand(userId, message, normalized);
      reply = debtRes.reply;
      parsedLog = debtRes.parsedLog;
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
    } else if (normalized.startsWith("riwayat")) {
      reply = "⚠️ Command sudah diganti.\n\nGunakan:\nhistory";
    } else if (normalized.startsWith("history")) {
      console.log("[HISTORY COMMAND]", { normalized, userId, sender: contextKey });
      const rawInput = normalized.replace(/^history\s*/, "").trim();
      const parsedRange = parseNaturalDateRange(rawInput);
      const dateRange = parsedRange;
      const entityQuery = parsedRange.remainingText;
      const entity = await detectHistoryEntity(userId, entityQuery);
      const entityType = entity.entityType;
      const entityName = entity.entityName;
      const hasDateFilter = Boolean(dateRange.startDate && dateRange.endDate);
      const titleKeyword = entityQuery && !entityType ? entityQuery : "";
      const filterType = entityType ?? (titleKeyword ? "title" : hasDateFilter ? "date" : "all");
      const limit = 10;
      console.log("[DATE RANGE PARSER]", { rawInput, startDate: dateRange.startDate, endDate: dateRange.endDate, entityType, entityName });
      console.log("[HISTORY DETECTION]", {
        rawInput,
        entityType,
        entityName,
        filterType,
      });
      console.log("[HISTORY FILTER]", {
        rawInput,
        entityType,
        entityName,
        filterType,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        hasDateFilter,
      });

      if (titleKeyword) {
        const finalTransactions = await getHistoryByTitle(userId, titleKeyword, dateRange.startDate, dateRange.endDate, limit);
        console.log("[HISTORY RESULT]", { count: finalTransactions.length, filterType });
        if (finalTransactions.length === 0) {
          parsedLog = {
            command: "history",
            filterType: "title",
            filterValue: titleKeyword,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            entityType,
            entityName,
            displayedTransactions: [],
          };
          reply = `ℹ️ *Data Kosong*\n\nTidak ada history dengan judul:\n*${titleKeyword}*`;
        } else {
          const categoryIds = [...new Set(finalTransactions.map((tx) => String(tx.category_id ?? "")).filter(Boolean))];
          const accountIds = [...new Set(
            finalTransactions
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
          const { reply: historyReply, displayedTransactions } = buildHistoryTitleMessage(
            titleKeyword,
            finalTransactions,
            categoryMap,
            accountMap,
          );
          console.log("[HISTORY DISPLAYED TRANSACTIONS]", {
            count: displayedTransactions.length,
            ids: displayedTransactions.map((x) => (x as Record<string, JsonValue>).id),
          });
          parsedLog = {
            command: "history",
            filterType: "title",
            filterValue: titleKeyword,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            entityType,
            entityName,
            displayedTransactions,
          };
          reply = historyReply;
        }
      }
      if (!reply) {
        const finalTransactions = await getHistoryByDateRange(userId, dateRange.startDate, dateRange.endDate, {
          categoryId: entity.categoryId,
          accountId: entity.accountId,
          limit,
        });
        console.log("[HISTORY RESULT]", { count: finalTransactions.length, filterType });
        if (finalTransactions.length === 0) {
          reply = "📚 Tidak ada history transaksi.";
        } else {
          const categoryIds = [...new Set(finalTransactions.map((tx) => String(tx.category_id ?? "")).filter(Boolean))];
          const accountIds = [...new Set(
            finalTransactions
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
          const titleSuffix = [
            entityType === "account" && entityName ? `Akun ${entityName}` : "",
            entityType === "category" && entityName ? `Kategori ${entityName}` : "",
            !entityType ? "Transaksi" : "",
            dateRange.label ? dateRange.label.charAt(0).toUpperCase() + dateRange.label.slice(1) : "",
          ].filter(Boolean).join(" ");
          const headerLines = [`📚 *History ${titleSuffix}*`];
          const { reply: historyReply, displayedTransactions } = buildHistoryMessage(
            headerLines.join("\n"),
            finalTransactions,
            categoryMap,
            accountMap,
          );
          console.log("[HISTORY DISPLAYED TRANSACTIONS]", {
            count: displayedTransactions.length,
            ids: displayedTransactions.map((x) => (x as Record<string, JsonValue>).id),
          });
          parsedLog = { command: "history", filterType, startDate: dateRange.startDate, endDate: dateRange.endDate, entityType, entityName, displayedTransactions };
          reply = historyReply;
        }
      }
    } else if (/^hapus\s+(\d+)$/.test(normalized)) {
      const deleteMatch = normalized.match(/^hapus\s+(\d+)$/);
      const number = Number(deleteMatch?.[1] ?? 0);
      console.log("[DELETE FROM HISTORY]", {
        userId,
        phone: contextKey,
        number,
      });
      parsedLog = { command: "hapus_history", number };

      if (!Number.isInteger(number) || number < 1) {
        reply = "⚠️ Nomor history tidak valid.\n\nPilih nomor dari hasil history terakhir.";
      } else {
        const displayedTransactions = await getLastHistoryTransactions(userId, contextKey);
        if (displayedTransactions.length === 0) {
          reply = "⚠️ Belum ada history terakhir.\n\nKirim history dulu, lalu gunakan:\nhapus 3";
        } else {
          const selectedTransaction = findDisplayedTransactionByNumber(displayedTransactions, number);
          if (!selectedTransaction) {
            reply = "⚠️ Nomor history tidak ditemukan.";
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
    } else if (
      normalized === "kategori" ||
      normalized === "list kategori" ||
      normalized.startsWith("tambah kategori ") ||
      normalized.startsWith("edit kategori ") ||
      normalized.startsWith("hapus kategori ") ||
      normalized.startsWith("kategori tambah ") ||
      normalized.startsWith("kategori edit ") ||
      normalized.startsWith("kategori hapus ")
    ) {
      const categoryRes = await handleCategoryCrud(userId, message, normalized);
      reply = categoryRes.reply;
      parsedLog = categoryRes.parsedLog;
    } else if (normalized === "akun") {
      const { data, error } = await supabase.from("accounts").select("name,type").eq("user_id", userId).order("name");
      if (error) throw error;
      const lines = (data ?? []).map((a: Record<string, JsonValue>, i: number) => `${i + 1}. ${String(a.name)} — ${String(a.type)}`);
      reply = `🏦 *Daftar Akun*\n\n${line()}\n${lines.length > 0 ? lines.join("\n") : `${infoTitle("Data Kosong")}\n\nBelum ada akun.`}`;
    } else if (normalized === "hapus" || normalized === "undo") {
      let lastTxQuery = supabase
        .from("transactions")
        .select("id,title,amount,type,date")
        .eq("user_id", userId)
        .order("inserted_at", { ascending: false })
        .limit(1);
      lastTxQuery = await applyTransactionNotDeleted(lastTxQuery);
      const { data: lastTx, error } = await lastTxQuery.maybeSingle();
      if (error) throw error;

      if (!lastTx) {
        reply = "ℹ️ Tidak ada transaksi yang bisa dihapus.";
      } else {
        const { error: updateError } = await supabase
          .from("transactions")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", String((lastTx as Record<string, JsonValue>).id ?? ""))
          .eq("user_id", userId)
          .is("deleted_at", null);
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
              const keywordCategory = await findCategoryByKeyword(userId, smartTx.title);
              const smartCategory = keywordCategory ?? await findCategoryByTransactionHistory(userId, smartTx.title);
              const smartAccount = smartTx.accountName
                ? await findAccount(userId, smartTx.accountName)
                : smartCategory
                  ? await findBestAccountByCategoryHistory(userId, smartCategory.id) ?? await findAccountByTransactionHistory(userId, smartTx.title, smartCategory.id, null)
                  : await findAccountByTransactionHistory(userId, smartTx.title, null, null);
              if (smartTx.accountName && !smartAccount) {
                reply = `❌ Akun *${smartTx.accountName}* tidak ditemukan.`;
              } else if (!smartAccount) {
                reply = ["⚠️ Akun otomatis tidak ditemukan.", "", "Gunakan format:", "momoyo 20000 seabank", "", "Setelah itu sistem bisa belajar dari history."].join("\n");
              } else {
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
                  if (smartTx.accountName) lines.push("", keywordCategory ? "🤖 Kategori dikenali dari nama kategori." : "🤖 Kategori otomatis dari history.");
                  else if (keywordCategory) lines.push("", "🤖 Kategori dikenali dari nama kategori.", "🤖 Akun otomatis dari history kategori.", "Kalau akun salah, ketik:", `edit akun ${smartAccount.name}`);
                  else lines.push("", "🤖 Kategori & akun otomatis dari history.", "Kalau akun salah, ketik:", `edit akun ${smartAccount.name}`);
                  if (smartType === "expense") {
                    lines.push("", "💰 Saldo Saat Ini", `Cash: ${formatIDR(b.cash)}`, `Non Cash: ${formatIDR(b.nonCash)}`, `Total: ${formatIDR(b.total)}`);
                    const warnings = await buildSmartWarnings({ userId, date: smartTx.date, amount: smartTx.amount, categoryName: smartCategory.name });
                    console.log("[SMART WARNING]", { warnings, transactionAmount: smartTx.amount, categoryName: smartCategory.name });
                    if (warnings.length > 0) lines.push("", ...warnings);
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
              const warnings = await buildSmartWarnings({ userId, date: tx.date, amount: tx.amount, categoryName: category.name });
              console.log("[SMART WARNING]", { warnings, transactionAmount: tx.amount, categoryName: category.name });
              if (warnings.length > 0) baseLines.push("", ...warnings);
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
              const keywordCategory = await findCategoryByKeyword(userId, naturalTx.title);
              const category = keywordCategory ?? await findCategoryByTransactionHistory(userId, naturalTx.title);
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
                  : keywordCategory
                    ? await findBestAccountByCategoryHistory(userId, category.id) ?? await findAccountByTransactionHistory(userId, naturalTx.title, category.id, finalType)
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
                      : keywordCategory
                        ? ["", "🤖 Kategori dikenali dari nama kategori.", "🤖 Akun otomatis dari history kategori.", "Kalau salah, ketik:", `edit akun ${account.name}`]
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
                    const warnings = await buildSmartWarnings({ userId, date: naturalTx.date, amount: naturalTx.amount, categoryName: category.name });
                    console.log("[SMART WARNING]", { warnings, transactionAmount: naturalTx.amount, categoryName: category.name });
                    if (warnings.length > 0) lines.push("", ...warnings);
                  }
                  reply = lines.join("\n");
                }
              }
            }
          } else if ("error" in smartTx && smartTx.error === "INVALID_DATE") {
            reply = ["⚠️ Format tanggal tidak valid.", "", "Gunakan format:", "31/05"].join("\n");
          } else {
            const keywordCategory = await findCategoryByKeyword(userId, smartTx.title);
            const category = keywordCategory ?? await findCategoryByTransactionHistory(userId, smartTx.title);
            const account = smartTx.accountName
              ? await findAccount(userId, smartTx.accountName)
              : category
                ? await findBestAccountByCategoryHistory(userId, category.id) ?? await findAccountByTransactionHistory(userId, smartTx.title, category.id, null)
                : await findAccountByTransactionHistory(userId, smartTx.title, null, null);
            if (smartTx.accountName && !account) {
              reply = `❌ Akun *${smartTx.accountName}* tidak ditemukan.`;
            } else if (!account) {
              reply = ["⚠️ Akun otomatis tidak ditemukan.", "", "Gunakan format:", "momoyo 20000 seabank", "", "Setelah itu sistem bisa belajar dari history."].join("\n");
            } else {
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
                if (smartTx.accountName) lines.push("", keywordCategory ? "🤖 Kategori dikenali dari nama kategori." : "🤖 Kategori otomatis dari history.");
                else if (keywordCategory) lines.push("", "🤖 Kategori dikenali dari nama kategori.", "🤖 Akun otomatis dari history kategori.", "Kalau akun salah, ketik:", `edit akun ${account.name}`);
                else lines.push("", "🤖 Kategori & akun otomatis dari history.", "Kalau akun salah, ketik:", `edit akun ${account.name}`);
                if (type === "expense") {
                  lines.push("", "💰 Saldo Saat Ini", `Cash: ${formatIDR(b.cash)}`, `Non Cash: ${formatIDR(b.nonCash)}`, `Total: ${formatIDR(b.total)}`);
                  const warnings = await buildSmartWarnings({ userId, date: smartTx.date, amount: smartTx.amount, categoryName: category.name });
                  console.log("[SMART WARNING]", { warnings, transactionAmount: smartTx.amount, categoryName: category.name });
                  if (warnings.length > 0) lines.push("", ...warnings);
                }
                reply = lines.join("\n");
              }
            }
          }
        }
      }
    }

    const replyTarget = chatTarget || sender;
    if (isGroup) {
      console.log("[GROUP REPLY FLOW]", {
        groupTarget: chatTarget,
        participant,
        sender,
      });
    }
    const parsedLid = extractLid(body);
    const sent = await replyWhatsApp({
      target: replyTarget,
      message: reply,
      memberlid: body.memberlid ?? body.data?.memberlid ?? parsedLid,
      senderlid: body.senderlid ?? body.data?.senderlid ?? parsedLid,
    });
    if (!sent && isGroup) {
      console.error("[GROUP REPLY FAILED]", {
        chatTarget,
        participant,
        message,
      });

      if (isGroupPrivateDebugEnabled() && participant) {
        await replyWhatsApp({
          target: participant,
          message: "⚠️ Debug: bot belum bisa membalas grup ini karena target grup Fonnte tidak valid.",
        });
      }

      return json({ ok: true, groupReplyFailed: true });
    }
    await logMessage({
      wa_message_id: waMessageId,
      phone: contextKey,
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
        if (errorMessage.includes("RPC_BALANCE_FAILED")) await replyWhatsApp({ target: chatTarget || sender, message: "⚠️ Gagal mengambil saldo realtime." });
        else await replyWhatsApp({ target: chatTarget || sender, message: "❌ Terjadi error pada sistem. Coba lagi beberapa saat." });
      } catch (_e) {
      }
    }

    try {
      if (waMessageId || sender || message) {
        await logMessage({
          wa_message_id: waMessageId || `${sender}-${message || "empty"}-${Date.now()}`,
          phone: (sender && chatTarget && /@g\.us$/i.test(chatTarget) ? `${sender}|${chatTarget}` : sender) || "",
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
