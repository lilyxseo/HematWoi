import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type IncomingPayload = {
  sender?: string;
  phone?: string;
  number?: string;
  device?: string;
  text?: string;
  message?: string;
  msg?: string;
  id?: string | number;
  message_id?: string | number;
  from_me?: boolean;
  fromMe?: boolean;
  isMe?: boolean;
  data?: Record<string, Json>;
};

type Category = {
  id: string;
  user_id: string;
  name: string;
  type: "income" | "expense";
};

type Account = {
  id: string;
  user_id: string;
  name: string;
  type: "cash" | "non_cash";
};

type ParsedTransaction = {
  categoryName: string;
  title: string | null;
  amount: number;
  accountName: string;
};

type ParsedTransfer = {
  amount: number;
  fromAccountName: string;
  toAccountName: string;
};

type BudgetInfo = {
  categoryName: string;
  budgetName: string;
  limit: number;
  spent: number;
  remain: number;
  percentage: number;
};

const COMMAND_ALIASES = new Set(["menu", "help", "bantuan"]);

function createAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function normalizePhone(raw?: string): string {
  if (!raw) return "";
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

function extractMessageText(payload: IncomingPayload): string {
  const base = payload.text ?? payload.message ?? payload.msg ?? "";
  return String(base).trim();
}

function isBotMessage(payload: IncomingPayload, text: string): boolean {
  const sender = normalizePhone(payload.sender ?? payload.phone ?? payload.number);
  const device = normalizePhone(payload.device);
  const prefixes = ["🤖", "✅", "💰", "ℹ️", "📊", "📚", "🏦", "📌", "🗑️"];
  const hasBotPrefix = prefixes.some((prefix) => text.startsWith(prefix));

  return Boolean(
    payload.from_me === true ||
      payload.fromMe === true ||
      payload.isMe === true ||
      (sender && device && sender === device) ||
      hasBotPrefix,
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateOnly(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthRange(date = new Date()): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: formatDateOnly(start), end: formatDateOnly(end) };
}

function parseNominal(raw: string): number {
  const clean = raw.replace(/[^0-9]/g, "");
  const value = Number(clean);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function parseTransactionMessage(text: string): ParsedTransaction | null {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 3) return null;

  let amountIndex = -1;
  for (let i = 1; i < parts.length; i++) {
    if (/^[\d.,]+$/.test(parts[i])) {
      amountIndex = i;
      break;
    }
  }
  if (amountIndex < 0 || amountIndex === parts.length - 1) return null;

  const categoryName = parts[0].toLowerCase();
  const amount = parseNominal(parts[amountIndex]);
  const accountName = parts[parts.length - 1].toLowerCase();
  const titleParts = parts.slice(1, amountIndex);
  const title = titleParts.length > 0 ? titleParts.join(" ") : null;

  if (!categoryName || amount <= 0 || !accountName) return null;
  return { categoryName, title, amount, accountName };
}

function parseTransferMessage(text: string): ParsedTransfer | null {
  const parts = text.trim().split(/\s+/);
  if (parts.length !== 4) return null;

  const [command, nominal, fromAccountName, toAccountName] = parts;
  if (!["tf", "transfer"].includes(command.toLowerCase())) return null;

  const amount = parseNominal(nominal);
  if (amount <= 0) return null;

  return { amount, fromAccountName: fromAccountName.toLowerCase(), toAccountName: toAccountName.toLowerCase() };
}

function buildMenuMessage(): string {
  return [
    "📌 *Menu HematWoi*",
    "",
    "1) 💰 *saldo*",
    "2) 📊 *summary*",
    "3) 📚 *riwayat* / *riwayat hari ini* / *riwayat {kategori}*",
    "4) 🎯 *budget {kategori}*",
    "5) 🔁 *tf {nominal} {akun_asal} {akun_tujuan}*",
    "6) ✅ *{kategori} {judul(optional)} {nominal} {akun}*",
    "7) 🗑️ *hapus* / *undo*",
    "8) 🧾 *kategori*",
    "9) 🏦 *akun*",
    "10) ℹ️ *info*",
    "11) 🏓 *ping*",
    "",
    "*Contoh format transaksi:*",
    "- jajan 10000 cash",
    "- jajan beli kopi 10000 cash",
    "- gaji freelance 500000 seabank",
  ].join("\n");
}

async function findCategory(supabase: SupabaseClient, userId: string, name: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("id,user_id,name,type")
    .eq("user_id", userId)
    .ilike("name", name)
    .maybeSingle();
  if (error) throw error;
  return (data as Category | null) ?? null;
}

async function findAccount(supabase: SupabaseClient, userId: string, name: string): Promise<Account | null> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id,user_id,name,type")
    .eq("user_id", userId)
    .ilike("name", name)
    .maybeSingle();
  if (error) throw error;
  return (data as Account | null) ?? null;
}

async function replyWhatsApp(target: string, message: string): Promise<void> {
  const token = Deno.env.get("FONNTE_TOKEN") ?? "";
  if (!token) throw new Error("FONNTE_TOKEN is not configured");

  const response = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ target, message, delay: "2", countryCode: "62" }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed send WA: ${response.status} ${body}`);
  }
}

async function logMessage(
  supabase: SupabaseClient,
  payload: {
    user_id?: string | null;
    sender: string;
    direction: "incoming" | "outgoing";
    message: string;
    status: "success" | "failed";
    command: string;
    error_message?: string | null;
    dedupe_key?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("whatsapp_message_logs").insert({
    user_id: payload.user_id ?? null,
    sender: payload.sender,
    direction: payload.direction,
    message: payload.message,
    status: payload.status,
    command: payload.command,
    error_message: payload.error_message ?? null,
    dedupe_key: payload.dedupe_key ?? null,
  });
  if (error) console.error("Failed log whatsapp_message_logs", error);
}

async function getBalanceSummary(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_account_type_balances", { p_user_id: userId });
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  let cash = 0;
  let nonCash = 0;

  for (const row of rows as Array<Record<string, unknown>>) {
    const label = String(row.account_type ?? row.type ?? "").toLowerCase();
    const amount = Number(row.balance ?? row.total ?? 0);
    if (label.includes("cash") && !label.includes("non")) cash = amount;
    if (label.includes("non")) nonCash = amount;
  }

  return [
    "💰 *Saldo Saat Ini*",
    `Cash: ${formatCurrency(cash)}`,
    `Non Cash: ${formatCurrency(nonCash)}`,
    `Total: ${formatCurrency(cash + nonCash)}`,
  ].join("\n");
}

async function getMonthlyBudgetInfo(supabase: SupabaseClient, userId: string, categoryName: string): Promise<BudgetInfo | null> {
  const category = await findCategory(supabase, userId, categoryName);
  if (!category) return null;

  const { start, end } = monthRange();
  const { data: budgets, error: budgetErr } = await supabase
    .from("budgets")
    .select("id,name,amount")
    .eq("user_id", userId)
    .eq("deleted_at", null);
  if (budgetErr) throw budgetErr;

  const budgetRows = (budgets ?? []) as Array<{ id: string; name: string; amount: number }>;
  let targetBudget: { id: string; name: string; amount: number } | null =
    budgetRows.find((b) => b.name?.toLowerCase() === category.name.toLowerCase()) ?? null;

  if (!targetBudget) {
    const { data: links, error: linkErr } = await supabase
      .from("budget_categories")
      .select("budget_id,category_id")
      .eq("category_id", category.id);
    if (linkErr) throw linkErr;

    const budgetIds = (links ?? []).map((v: { budget_id: string }) => v.budget_id);
    targetBudget = budgetRows.find((b) => budgetIds.includes(b.id)) ?? null;
  }

  if (!targetBudget) return null;

  const { data: txs, error: txErr } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("type", "expense")
    .eq("deleted_at", null)
    .gte("transaction_date", start)
    .lte("transaction_date", end)
    .or(`category_id.eq.${category.id},budget_id.eq.${targetBudget.id}`);
  if (txErr) throw txErr;

  const spent = (txs ?? []).reduce((n: number, t: { amount: number }) => n + Number(t.amount ?? 0), 0);
  const limit = Number(targetBudget.amount ?? 0);
  const remain = Math.max(limit - spent, 0);
  const percentage = limit > 0 ? (spent / limit) * 100 : 0;

  return { categoryName: category.name, budgetName: targetBudget.name, limit, spent, remain, percentage };
}

function buildBudgetLines(info: BudgetInfo): string {
  const warning = info.percentage >= 80 ? "\n⚠️ Budget sudah lebih dari 80%." : "";
  return [
    `🎯 *Budget ${info.categoryName}*`,
    `Limit: ${formatCurrency(info.limit)}`,
    `Terpakai: ${formatCurrency(info.spent)}`,
    `Sisa: ${formatCurrency(info.remain)}`,
    `Progress: ${info.percentage.toFixed(1)}%${warning}`,
  ].join("\n");
}

Deno.serve(async (req) => {
  const supabase = createAdminClient();
  let sender = "";
  let userId: string | null = null;
  let command = "unknown";
  let dedupeKey: string | null = null;

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), { status: 405 });
    }

    const body = (await req.json()) as IncomingPayload;
    const text = extractMessageText(body);
    const lower = text.toLowerCase();

    sender = normalizePhone(body.sender ?? body.phone ?? body.number);
    command = lower.split(/\s+/)[0] ?? "unknown";
    dedupeKey = `${sender}:${String(body.id ?? body.message_id ?? lower)}`;

    if (!sender) return new Response(JSON.stringify({ success: false, message: "Sender not found" }), { status: 400 });

    if (!text) {
      await logMessage(supabase, {
        sender,
        direction: "incoming",
        message: "",
        status: "failed",
        command,
        error_message: "Empty message",
        dedupe_key: dedupeKey,
      });
      return new Response(JSON.stringify({ success: true, ignored: true }), { status: 200 });
    }

    if (isBotMessage(body, text)) {
      return new Response(JSON.stringify({ success: true, ignored: true, reason: "bot-loop" }), { status: 200 });
    }

    const { data: existingLog } = await supabase
      .from("whatsapp_message_logs")
      .select("id")
      .eq("direction", "incoming")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();

    if (existingLog) {
      return new Response(JSON.stringify({ success: true, ignored: true, reason: "duplicate" }), { status: 200 });
    }

    const { data: waUser, error: waUserErr } = await supabase
      .from("whatsapp_users")
      .select("id")
      .eq("phone_number", sender)
      .maybeSingle();
    if (waUserErr) throw waUserErr;

    if (!waUser?.id) {
      await logMessage(supabase, {
        sender,
        direction: "incoming",
        message: text,
        status: "failed",
        command,
        error_message: "Whatsapp user not registered",
        dedupe_key: dedupeKey,
      });
      await replyWhatsApp(sender, "❌ Nomor belum terdaftar di HematWoi.");
      return new Response(JSON.stringify({ success: false, message: "User not found" }), { status: 404 });
    }

    userId = waUser.id;

    await logMessage(supabase, {
      user_id: userId,
      sender,
      direction: "incoming",
      message: text,
      status: "success",
      command,
      dedupe_key: dedupeKey,
    });

    let reply = "";

    if (COMMAND_ALIASES.has(lower)) {
      reply = buildMenuMessage();
    } else if (lower === "ping") {
      reply = "🏓 pong";
    } else if (lower === "saldo") {
      reply = await getBalanceSummary(supabase, userId);
    } else if (lower === "summary") {
      const today = formatDateOnly();
      const { data: txs, error } = await supabase
        .from("transactions")
        .select("amount,type,category_id")
        .eq("user_id", userId)
        .eq("deleted_at", null)
        .eq("transaction_date", today);
      if (error) throw error;

      const income = (txs ?? []).filter((t: { type: string }) => t.type === "income").reduce((n: number, t: { amount: number }) => n + Number(t.amount ?? 0), 0);
      const expenseRows = (txs ?? []).filter((t: { type: string }) => t.type === "expense");
      const expense = expenseRows.reduce((n: number, t: { amount: number }) => n + Number(t.amount ?? 0), 0);

      const categoryMap = new Map<string, number>();
      for (const row of expenseRows as Array<{ category_id: string; amount: number }>) {
        categoryMap.set(row.category_id, (categoryMap.get(row.category_id) ?? 0) + Number(row.amount ?? 0));
      }

      let largestCategory = "-";
      if (categoryMap.size > 0) {
        const [largestCategoryId] = [...categoryMap.entries()].sort((a, b) => b[1] - a[1])[0];
        const { data: category } = await supabase.from("categories").select("name").eq("id", largestCategoryId).maybeSingle();
        largestCategory = category?.name ?? "-";
      }

      reply = [
        "📊 *Summary Hari Ini*",
        `Pemasukan: ${formatCurrency(income)}`,
        `Pengeluaran: ${formatCurrency(expense)}`,
        `Kategori terbesar: ${largestCategory}`,
      ].join("\n");
    } else if (lower.startsWith("riwayat")) {
      const arg = lower.replace("riwayat", "").trim();
      let query = supabase
        .from("transactions")
        .select("id,title,amount,type,transaction_date,categories(name),accounts(name),category_id")
        .eq("user_id", userId)
        .eq("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);

      if (arg === "hari ini") {
        query = query.eq("transaction_date", formatDateOnly());
      } else if (arg) {
        const category = await findCategory(supabase, userId, arg);
        if (!category) {
          reply = `❌ Kategori *${arg}* tidak ditemukan.`;
        } else {
          query = query.eq("category_id", category.id);
        }
      }

      if (!reply) {
        const { data: rows, error } = await query;
        if (error) throw error;

        if (!rows || rows.length === 0) {
          reply = "📚 Tidak ada riwayat transaksi.";
        } else {
          const lines = rows.map((row: Record<string, unknown>, idx: number) => {
            const sign = row.type === "income" ? "+" : "-";
            const category = (row.categories as { name?: string } | null)?.name ?? "-";
            const account = (row.accounts as { name?: string } | null)?.name ?? "-";
            const title = row.title ? ` (${String(row.title)})` : "";
            return `${idx + 1}. ${String(row.transaction_date)} | ${category}${title}\n   ${sign}${formatCurrency(Number(row.amount ?? 0))} via ${account}`;
          });
          reply = `📚 *Riwayat Transaksi*\n${lines.join("\n")}`;
        }
      }
    } else if (lower.startsWith("budget ")) {
      const categoryName = lower.replace("budget", "").trim();
      const budgetInfo = await getMonthlyBudgetInfo(supabase, userId, categoryName);
      reply = budgetInfo ? buildBudgetLines(budgetInfo) : `❌ Budget untuk kategori *${categoryName}* tidak ditemukan.`;
    } else if (["hapus", "undo"].includes(lower)) {
      const { data: lastTx, error } = await supabase
        .from("transactions")
        .select("id,amount")
        .eq("user_id", userId)
        .eq("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      if (!lastTx) {
        reply = "ℹ️ Tidak ada transaksi yang bisa dihapus.";
      } else {
        const { error: deleteError } = await supabase
          .from("transactions")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", lastTx.id);
        if (deleteError) throw deleteError;
        reply = `🗑️ Transaksi terakhir berhasil dihapus (soft delete).\nNominal: ${formatCurrency(Number(lastTx.amount ?? 0))}`;
      }
    } else if (lower === "kategori") {
      const { data, error } = await supabase.from("categories").select("name,type").eq("user_id", userId).order("name");
      if (error) throw error;
      const lines = (data ?? []).map((row: { name: string; type: string }, idx: number) => `${idx + 1}. ${row.name} (${row.type})`);
      reply = `🧾 *Daftar Kategori*\n${lines.length > 0 ? lines.join("\n") : "Belum ada kategori."}`;
    } else if (lower === "akun") {
      const { data, error } = await supabase.from("accounts").select("name,type").eq("user_id", userId).order("name");
      if (error) throw error;
      const lines = (data ?? []).map((row: { name: string; type: string }, idx: number) => `${idx + 1}. ${row.name} (${row.type})`);
      reply = `🏦 *Daftar Akun*\n${lines.length > 0 ? lines.join("\n") : "Belum ada akun."}`;
    } else if (lower === "info") {
      const today = formatDateOnly();
      const [{ count: accountCount }, { count: categoryCount }, { count: transactionCount }] = await Promise.all([
        supabase.from("accounts").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("categories").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("deleted_at", null)
          .eq("transaction_date", today),
      ]);

      reply = [
        "ℹ️ *Info Akun HematWoi*",
        `Jumlah akun: ${accountCount ?? 0}`,
        `Jumlah kategori: ${categoryCount ?? 0}`,
        `Total transaksi hari ini: ${transactionCount ?? 0}`,
      ].join("\n");
    } else {
      const parsedTransfer = parseTransferMessage(lower);
      if (parsedTransfer) {
        const fromAccount = await findAccount(supabase, userId, parsedTransfer.fromAccountName);
        const toAccount = await findAccount(supabase, userId, parsedTransfer.toAccountName);

        if (!fromAccount || !toAccount) {
          reply = "❌ Akun transfer tidak ditemukan.";
        } else {
          const { error } = await supabase.from("transactions").insert({
            user_id: userId,
            type: "transfer",
            amount: parsedTransfer.amount,
            account_id: fromAccount.id,
            to_account_id: toAccount.id,
            title: `Transfer ${fromAccount.name} ke ${toAccount.name}`,
            transaction_date: formatDateOnly(),
          });
          if (error) throw error;

          reply = [
            "✅ Transfer tercatat",
            `Nominal: ${formatCurrency(parsedTransfer.amount)}`,
            `Dari: ${fromAccount.name}`,
            `Ke: ${toAccount.name}`,
          ].join("\n");
        }
      } else {
        const parsedTransaction = parseTransactionMessage(lower);
        if (!parsedTransaction) {
          reply = "❌ Format tidak dikenali. Ketik *menu* untuk bantuan.";
        } else {
          const category = await findCategory(supabase, userId, parsedTransaction.categoryName);
          const account = await findAccount(supabase, userId, parsedTransaction.accountName);

          if (!category) {
            reply = `❌ Kategori *${parsedTransaction.categoryName}* tidak ditemukan.`;
          } else if (!account) {
            reply = `❌ Akun *${parsedTransaction.accountName}* tidak ditemukan.`;
          } else {
            const { error } = await supabase.from("transactions").insert({
              user_id: userId,
              type: category.type,
              category_id: category.id,
              account_id: account.id,
              title: parsedTransaction.title,
              amount: parsedTransaction.amount,
              transaction_date: formatDateOnly(),
            });
            if (error) throw error;

            const txTypeLabel = category.type === "income" ? "Pemasukan" : "Pengeluaran";
            reply = [
              `✅ ${txTypeLabel} tercatat`,
              `Kategori: ${category.name}`,
              `Judul: ${parsedTransaction.title ?? "-"}`,
              `Nominal: ${formatCurrency(parsedTransaction.amount)}`,
              `Akun: ${account.name}`,
            ].join("\n");
          }
        }
      }
    }

    await replyWhatsApp(sender, reply);
    await logMessage(supabase, {
      user_id: userId,
      sender,
      direction: "outgoing",
      message: reply,
      status: "success",
      command,
      dedupe_key: dedupeKey,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Webhook error", error);

    if (sender) {
      const message = "❌ Terjadi error pada sistem. Coba lagi beberapa saat.";
      try {
        await replyWhatsApp(sender, message);
      } catch (replyError) {
        console.error("Failed to send error reply", replyError);
      }
      try {
        await logMessage(createAdminClient(), {
          user_id: userId,
          sender,
          direction: "outgoing",
          message,
          status: "failed",
          command,
          error_message: error instanceof Error ? error.message : String(error),
          dedupe_key: dedupeKey,
        });
      } catch (logError) {
        console.error("Failed to log error", logError);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500 },
    );
  }
});
