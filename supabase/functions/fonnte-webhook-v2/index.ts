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
};

type ParsedTransfer = {
  amount: number;
  fromAccountName: string;
  toAccountName: string;
};

type BalanceSummary = {
  cash: number;
  nonCash: number;
  total: number;
};

type BudgetInfo = {
  categoryNames: string[];
  planned: number;
  used: number;
  remaining: number;
  percentage: number;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FONNTE_TOKEN = Deno.env.get("FONNTE_TOKEN") ?? "";

const BOT_PREFIXES = ["🤖", "✅", "❌", "⚠️", "💰", "ℹ️", "📊", "📚", "🏦", "📌", "🗑️", "🧾", "🎯", "🔁", "🏓", "📋", "📆", "🗓️"];
const MENU_COMMANDS = new Set(["menu", "help", "bantuan", ".menu"]);

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

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^0-9]/g, "");
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
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
  const { data, error } = await supabase
    .from("accounts")
    .select("id,name,type")
    .eq("user_id", userId)
    .ilike("name", name.trim())
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getBalanceSummary(userId: string): Promise<BalanceSummary> {
  const { data, error } = await supabase.rpc("get_account_type_balances", { p_user_id: userId });
  if (error) throw error;

  const row = Array.isArray(data) ? (data[0] ?? {}) : (data ?? {});
  const cashBalance = Number((row as Record<string, JsonValue>).cash_balance ?? 0);
  const nonCashBalance = Number((row as Record<string, JsonValue>).non_cash_balance ?? 0);
  const totalBalance = Number((row as Record<string, JsonValue>).total_balance ?? cashBalance + nonCashBalance);

  if (Array.isArray(data) && data.length > 1) {
    let cash = 0;
    let nonCash = 0;
    for (const item of data as Array<Record<string, JsonValue>>) {
      const type = String(item.type ?? item.account_type ?? "").toLowerCase();
      const amount = Number(item.balance ?? item.total ?? 0);
      if (type.includes("non")) nonCash += amount;
      else if (type.includes("cash")) cash += amount;
    }
    if (cash || nonCash) return { cash, nonCash, total: cash + nonCash };
  }

  return { cash: cashBalance, nonCash: nonCashBalance, total: totalBalance };
}

function parseTransactionMessage(message: string): ParsedTransaction | null {
  const parts = message.trim().split(/\s+/);
  if (parts.length < 3) return null;

  const categoryName = parts[0];
  const accountName = parts[parts.length - 1];
  let amountIndex = -1;

  for (let i = parts.length - 2; i >= 1; i--) {
    if (parseAmount(parts[i]) > 0) {
      amountIndex = i;
      break;
    }
  }

  if (amountIndex < 1) return null;
  const amount = parseAmount(parts[amountIndex]);
  if (amount <= 0) return null;

  const titleParts = parts.slice(1, amountIndex);
  const title = titleParts.length > 0 ? titleParts.join(" ") : categoryName;

  return { categoryName, accountName, amount, title };
}

function parseTransferMessage(message: string): ParsedTransfer | null {
  const parts = message.trim().split(/\s+/);
  if (parts.length !== 4) return null;
  if (normalizeText(parts[0]) !== "tf") return null;
  const amount = parseAmount(parts[1]);
  if (amount <= 0) return null;
  return { amount, fromAccountName: parts[2], toAccountName: parts[3] };
}

async function getMonthlyBudgetInfo(userId: string, categoryName: string): Promise<BudgetInfo | null> {
  const category = await findCategory(userId, categoryName);
  if (!category) return null;

  const monthStart = getMonthStart();
  const nextMonthStart = getNextMonthStart();

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

async function getWeeklyBudgetInfo(userId: string, categoryName: string): Promise<BudgetInfo | null> {
  const category = await findCategory(userId, categoryName);
  if (!category) return null;

  const weekStart = getWeekStartJakarta();
  const nextWeekStart = getNextWeekStartJakarta();

  let budgetId: string | null = null;
  let planned = 0;
  let categoryIds: string[] = [category.id];

  // 1. Cek budget mingguan direct dari budgets_weekly.category_id
  const { data: directBudgets, error: directErr } = await supabase
    .from("budgets_weekly")
    .select("id,user_id,category_id,name,planned,amount_planned,amount,created_at")
    .eq("user_id", userId)
    .eq("category_id", category.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (directErr) {
    console.error("[WEEKLY BUDGET DIRECT ERROR]", directErr);
  }

  if (directBudgets && directBudgets.length > 0) {
    const b = directBudgets[0] as Record<string, JsonValue>;
    budgetId = String(b.id);
    planned = Number(b.planned ?? b.amount_planned ?? b.amount ?? 0);
  }

  // 2. Kalau direct tidak ada, cek multi kategori dari weekly_budget_categories
  if (!budgetId) {
    const { data: mappedRows, error: mappedErr } = await supabase
      .from("weekly_budget_categories")
      .select("budget_weekly_id,category_id")
      .eq("category_id", category.id);

    if (mappedErr) {
      console.error("[WEEKLY BUDGET MAP ERROR]", mappedErr);
    }

    const mappedBudgetIds = [...new Set((mappedRows ?? [])
      .map((row: Record<string, JsonValue>) => String(row.budget_weekly_id ?? ""))
      .filter(Boolean))];

    if (mappedBudgetIds.length > 0) {
      const { data: mappedBudgets, error: budgetErr } = await supabase
        .from("budgets_weekly")
        .select("id,user_id,category_id,name,planned,amount_planned,amount,created_at")
        .eq("user_id", userId)
        .in("id", mappedBudgetIds)
        .order("created_at", { ascending: false })
        .limit(1);

      if (budgetErr) {
        console.error("[WEEKLY BUDGET MAPPED ERROR]", budgetErr);
      }

      if (mappedBudgets && mappedBudgets.length > 0) {
        const b = mappedBudgets[0] as Record<string, JsonValue>;
        budgetId = String(b.id);
        planned = Number(b.planned ?? b.amount_planned ?? b.amount ?? 0);
      }
    }
  }

  if (!budgetId || planned <= 0) {
    console.log("[WEEKLY BUDGET NOT FOUND]", {
      categoryName,
      categoryId: category.id,
      budgetId,
      planned,
    });
    return null;
  }

  // 3. Ambil semua kategori yang terhubung ke budget mingguan ini
  const { data: linkedRows, error: linkedErr } = await supabase
    .from("weekly_budget_categories")
    .select("category_id")
    .eq("budget_weekly_id", budgetId);

  if (linkedErr) {
    console.error("[WEEKLY BUDGET LINKED ERROR]", linkedErr);
  }

  const linkedCategoryIds = (linkedRows ?? [])
    .map((row: Record<string, JsonValue>) => String(row.category_id ?? ""))
    .filter(Boolean);

  if (linkedCategoryIds.length > 0) {
    categoryIds = [...new Set([...categoryIds, ...linkedCategoryIds])];
  }

  // 4. Ambil nama kategori
  const { data: categoryNameRows } = await supabase
    .from("categories")
    .select("id,name")
    .in("id", categoryIds);

  const categoryNames = (categoryNameRows ?? [])
    .map((row: Record<string, JsonValue>) => String(row.name ?? ""))
    .filter(Boolean);

  // 5. Hitung pemakaian minggu berjalan
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

  if (txErr) {
    console.error("[WEEKLY BUDGET TX ERROR]", txErr);
    throw txErr;
  }

  const used = (txRows ?? []).reduce(
    (sum: number, tx: Record<string, JsonValue>) => sum + Number(tx.amount ?? 0),
    0,
  );

  const remaining = planned - used;
  const percentage = planned > 0 ? (used / planned) * 100 : 0;

  console.log("[WEEKLY BUDGET OK]", {
    categoryName,
    budgetId,
    planned,
    used,
    remaining,
    weekStart,
    nextWeekStart,
    categoryIds,
  });

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

function buildMenuMessage(): string {
  return [
    "📋 *Menu HematWoi*",
    "",
    "💰 *Cek Data*",
    "• saldo",
    "• summary",
    "• riwayat",
    "• info",
    "",
    "➕ *Catat Transaksi*",
    "• jajan 10000 cash",
    "• jajan beli kopi 10000 cash",
    "• gaji freelance 500000 seabank",
    "",
    "🔁 *Transfer*",
    "• tf 50000 cash seabank",
    "",
    "🎯 *Budget*",
    "• budget jajan",
    "",
    "🧾 *Lainnya*",
    "• kategori",
    "• akun",
    "• hapus",
    "• ping",
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
    } else if (normalized === "ping") {
      reply = "🏓 pong";
    } else if (normalized === "saldo") {
      const b = await getBalanceSummary(userId);
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
      const arg = normalized.replace(/^riwayat\s*/, "").trim();
      let query = supabase
        .from("transactions")
        .select("id,title,amount,type,date,category_id,account_id,to_account_id")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("inserted_at", { ascending: false })
        .limit(5);

      if (arg === "hari ini") {
        query = query.eq("date", getTodayJakarta());
      } else if (arg) {
        const cat = await findCategory(userId, arg);
        if (!cat) {
          reply = `❌ Kategori *${arg}* tidak ditemukan.`;
        } else {
          query = query.eq("category_id", cat.id);
        }
      }

      if (!reply) {
        const { data: txRows, error: txErr } = await query;
        if (txErr) throw txErr;

        const transactions = (txRows ?? []) as Array<Record<string, JsonValue>>;
        if (transactions.length === 0) {
          reply = "📚 Belum ada riwayat transaksi.";
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

          const lines = transactions.map((tx, i) => {
            const type = String(tx.type ?? "expense");
            const amount = Number(tx.amount ?? 0);
            if (type === "transfer") {
              const fromName = accountMap.get(String(tx.account_id ?? "")) ?? "-";
              const toName = accountMap.get(String(tx.to_account_id ?? "")) ?? "-";
              return `${i + 1}. ${String(tx.date)}\n   Transfer ${fromName} → ${toName}\n   ↔ ${formatIDR(amount)}`;
            }
            const sign = type === "income" ? "+" : "-";
            const categoryName = categoryMap.get(String(tx.category_id ?? "")) ?? "-";
            const title = String(tx.title ?? "-");
            const accountName = accountMap.get(String(tx.account_id ?? "")) ?? "-";
            return `${i + 1}. ${String(tx.date)}\n   ${categoryName} - ${title}\n   ${sign} ${formatIDR(amount)} via ${accountName}`;
          });

          reply = `📚 *Riwayat Transaksi*\n\n${lines.join("\n\n")}`;
        }
      }
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
        if (!tx) {
          reply = "❌ Format tidak dikenali. Ketik menu untuk bantuan.";
        } else {
          parsedLog = { command: "transaction", category: tx.categoryName, account: tx.accountName, amount: tx.amount, title: tx.title };
          const category = await findCategory(userId, tx.categoryName);
          const account = await findAccount(userId, tx.accountName);

          if (!category) {
            reply = `❌ Kategori *${tx.categoryName}* tidak ditemukan.`;
          } else if (!account) {
            reply = `❌ Akun *${tx.accountName}* tidak ditemukan.`;
          } else {
            const today = getTodayJakarta();
            const type = category.type === "income" ? "income" : "expense";

            const { error } = await supabase.from("transactions").insert({
              user_id: userId,
              date: today,
              type,
              category_id: category.id,
              account_id: account.id,
              amount: tx.amount,
              title: tx.title,
              notes: `WhatsApp: ${message}`,
            });
            if (error) throw error;

            const b = await getBalanceSummary(userId);
            const baseLines = [
              type === "income" ? "✅ Pemasukan tercatat" : "✅ Pengeluaran tercatat",
              "",
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
                getMonthlyBudgetInfo(userId, category.name),
                getWeeklyBudgetInfo(userId, category.name),
              ]);

              const budgetLines = buildCombinedBudgetLines(monthlyBudget, weeklyBudget);

              if (budgetLines.length > 0) {
                baseLines.push("", ...budgetLines);
              }
            }

            reply = baseLines.join("\n");
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
        await replyWhatsApp(sender, "❌ Terjadi error pada sistem. Coba lagi beberapa saat.");
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
