import {
  buildMenuMessage,
  createAdminClient,
  extractMessageText,
  findAccount,
  findCategory,
  formatCurrency,
  formatDateOnly,
  isBotMessage,
  logMessage,
  monthRange,
  normalizePhone,
  parseTransactionMessage,
  parseTransferMessage,
  replyWhatsApp,
} from "./utils.ts";

const COMMAND_ALIASES = new Set(["menu", "help", "bantuan"]);

async function getBalanceSummary(supabase: ReturnType<typeof createAdminClient>, userId: string): Promise<string> {
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

async function getMonthlyBudgetInfo(supabase: ReturnType<typeof createAdminClient>, userId: string, categoryName: string) {
  const category = await findCategory(supabase, userId, categoryName);
  if (!category) return null;

  const { start, end } = monthRange();

  const { data: budgets, error: budgetErr } = await supabase
    .from("budgets")
    .select("id,name,amount")
    .eq("user_id", userId)
    .eq("deleted_at", null);
  if (budgetErr) throw budgetErr;

  const budgetRows = budgets ?? [];
  let targetBudget: { id: string; name: string; amount: number } | null = null;

  for (const b of budgetRows as Array<{ id: string; name: string; amount: number }>) {
    if (b.name?.toLowerCase() === category.name.toLowerCase()) {
      targetBudget = b;
      break;
    }
  }

  if (!targetBudget) {
    const { data: links, error: linkErr } = await supabase
      .from("budget_categories")
      .select("budget_id,category_id")
      .eq("category_id", category.id);
    if (linkErr) throw linkErr;

    const budgetIds = (links ?? []).map((v: { budget_id: string }) => v.budget_id);
    targetBudget = (budgetRows as Array<{ id: string; name: string; amount: number }>).find((b) => budgetIds.includes(b.id)) ?? null;
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
  const pct = limit > 0 ? (spent / limit) * 100 : 0;

  return {
    categoryName: category.name,
    budgetName: targetBudget.name,
    limit,
    spent,
    remain,
    percentage: pct,
  };
}

function buildBudgetLines(info: NonNullable<Awaited<ReturnType<typeof getMonthlyBudgetInfo>>>): string {
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

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), { status: 405 });
    }

    const body = await req.json();
    const text = extractMessageText(body).trim();
    const sender = normalizePhone(body.sender ?? body.phone ?? body.number);
    const dedupeKey = `${sender}:${(body.id ?? body.message_id ?? text).toString()}`;

    if (!sender) {
      return new Response(JSON.stringify({ success: false, message: "Sender not found" }), { status: 400 });
    }

    if (!text) {
      await logMessage(supabase, {
        sender,
        direction: "incoming",
        message: "",
        status: "failed",
        command: "unknown",
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
      .select("id,phone_number,name")
      .eq("phone_number", sender)
      .maybeSingle();
    if (waUserErr) throw waUserErr;

    if (!waUser) {
      await logMessage(supabase, {
        sender,
        direction: "incoming",
        message: text,
        status: "failed",
        command: "unknown",
        error_message: "Whatsapp user not registered",
        dedupe_key: dedupeKey,
      });
      await replyWhatsApp(sender, "❌ Nomor belum terdaftar di HematWoi.");
      return new Response(JSON.stringify({ success: false, message: "User not found" }), { status: 404 });
    }

    const lower = text.toLowerCase();
    const firstToken = lower.split(/\s+/)[0] ?? "";

    await logMessage(supabase, {
      user_id: waUser.id,
      sender,
      direction: "incoming",
      message: text,
      status: "success",
      command: firstToken,
      dedupe_key: dedupeKey,
    });

    let reply = "";

    if (COMMAND_ALIASES.has(lower)) {
      reply = buildMenuMessage();
    } else if (lower === "ping") {
      reply = "🏓 pong";
    } else if (lower === "saldo") {
      reply = await getBalanceSummary(supabase, waUser.id);
    } else if (lower === "summary") {
      const today = formatDateOnly();
      const base = supabase.from("transactions").select("amount,type,category_id").eq("user_id", waUser.id).eq("deleted_at", null).eq("transaction_date", today);
      const { data: txs, error } = await base;
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
        const [catId] = [...categoryMap.entries()].sort((a, b) => b[1] - a[1])[0];
        const { data: cat } = await supabase.from("categories").select("name").eq("id", catId).maybeSingle();
        largestCategory = cat?.name ?? "-";
      }

      reply = [
        "📊 *Summary Hari Ini*",
        `Pemasukan: ${formatCurrency(income)}`,
        `Pengeluaran: ${formatCurrency(expense)}`,
        `Kategori terbesar: ${largestCategory}`,
      ].join("\n");
    } else if (lower.startsWith("riwayat")) {
      const arg = lower.replace("riwayat", "").trim();
      const q = supabase
        .from("transactions")
        .select("id,title,amount,type,transaction_date,categories(name),accounts(name)")
        .eq("user_id", waUser.id)
        .eq("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);

      let finalQ = q;
      if (arg === "hari ini") {
        finalQ = finalQ.eq("transaction_date", formatDateOnly());
      } else if (arg) {
        const cat = await findCategory(supabase, waUser.id, arg);
        if (!cat) {
          reply = `❌ Kategori *${arg}* tidak ditemukan.`;
        } else {
          finalQ = finalQ.eq("category_id", cat.id);
        }
      }

      if (!reply) {
        const { data: rows, error } = await finalQ;
        if (error) throw error;

        if (!rows || rows.length === 0) {
          reply = "📚 Tidak ada riwayat transaksi.";
        } else {
          const lines = rows.map((r: Record<string, unknown>, i: number) => {
            const sign = r.type === "income" ? "+" : "-";
            const category = (r.categories as { name?: string } | null)?.name ?? "-";
            const account = (r.accounts as { name?: string } | null)?.name ?? "-";
            const title = r.title ? ` (${r.title})` : "";
            return `${i + 1}. ${r.transaction_date} | ${category}${title}\n   ${sign}${formatCurrency(Number(r.amount ?? 0))} via ${account}`;
          });
          reply = `📚 *Riwayat Transaksi*\n${lines.join("\n")}`;
        }
      }
    } else if (lower.startsWith("budget ")) {
      const categoryName = lower.replace("budget", "").trim();
      const budgetInfo = await getMonthlyBudgetInfo(supabase, waUser.id, categoryName);
      reply = budgetInfo ? buildBudgetLines(budgetInfo) : `❌ Budget untuk kategori *${categoryName}* tidak ditemukan.`;
    } else if (["hapus", "undo"].includes(lower)) {
      const { data: lastTx, error } = await supabase
        .from("transactions")
        .select("id,amount")
        .eq("user_id", waUser.id)
        .eq("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      if (!lastTx) {
        reply = "ℹ️ Tidak ada transaksi yang bisa dihapus.";
      } else {
        const { error: delErr } = await supabase.from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", lastTx.id);
        if (delErr) throw delErr;
        reply = `🗑️ Transaksi terakhir berhasil dihapus (soft delete).\nNominal: ${formatCurrency(Number(lastTx.amount ?? 0))}`;
      }
    } else if (lower === "kategori") {
      const { data, error } = await supabase.from("categories").select("name,type").eq("user_id", waUser.id).order("name");
      if (error) throw error;
      const lines = (data ?? []).map((v: { name: string; type: string }, i: number) => `${i + 1}. ${v.name} (${v.type})`);
      reply = `🧾 *Daftar Kategori*\n${lines.length ? lines.join("\n") : "Belum ada kategori."}`;
    } else if (lower === "akun") {
      const { data, error } = await supabase.from("accounts").select("name,type").eq("user_id", waUser.id).order("name");
      if (error) throw error;
      const lines = (data ?? []).map((v: { name: string; type: string }, i: number) => `${i + 1}. ${v.name} (${v.type})`);
      reply = `🏦 *Daftar Akun*\n${lines.length ? lines.join("\n") : "Belum ada akun."}`;
    } else if (lower === "info") {
      const today = formatDateOnly();
      const [{ count: accountCount }, { count: categoryCount }, { count: txCount }] = await Promise.all([
        supabase.from("accounts").select("id", { count: "exact", head: true }).eq("user_id", waUser.id),
        supabase.from("categories").select("id", { count: "exact", head: true }).eq("user_id", waUser.id),
        supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", waUser.id).eq("deleted_at", null).eq("transaction_date", today),
      ]);
      reply = [
        "ℹ️ *Info Akun HematWoi*",
        `Jumlah akun: ${accountCount ?? 0}`,
        `Jumlah kategori: ${categoryCount ?? 0}`,
        `Total transaksi hari ini: ${txCount ?? 0}`,
      ].join("\n");
    } else if (parseTransferMessage(lower)) {
      const parsed = parseTransferMessage(lower)!;
      const fromAcc = await findAccount(supabase, waUser.id, parsed.fromAccountName);
      const toAcc = await findAccount(supabase, waUser.id, parsed.toAccountName);

      if (!fromAcc || !toAcc) {
        reply = "❌ Akun transfer tidak ditemukan.";
      } else {
        const { error } = await supabase.from("transactions").insert({
          user_id: waUser.id,
          type: "transfer",
          amount: parsed.amount,
          account_id: fromAcc.id,
          to_account_id: toAcc.id,
          title: `Transfer ${fromAcc.name} ke ${toAcc.name}`,
          transaction_date: formatDateOnly(),
        });
        if (error) throw error;

        reply = [
          "✅ Transfer tercatat",
          `Nominal: ${formatCurrency(parsed.amount)}`,
          `Dari: ${fromAcc.name}`,
          `Ke: ${toAcc.name}`,
        ].join("\n");
      }
    } else {
      const parsedTx = parseTransactionMessage(lower);
      if (!parsedTx) {
        reply = "❌ Format tidak dikenali. Ketik *menu* untuk bantuan.";
      } else {
        const category = await findCategory(supabase, waUser.id, parsedTx.categoryName);
        const account = await findAccount(supabase, waUser.id, parsedTx.accountName);

        if (!category) {
          reply = `❌ Kategori *${parsedTx.categoryName}* tidak ditemukan.`;
        } else if (!account) {
          reply = `❌ Akun *${parsedTx.accountName}* tidak ditemukan.`;
        } else {
          const { error } = await supabase.from("transactions").insert({
            user_id: waUser.id,
            type: category.type,
            category_id: category.id,
            account_id: account.id,
            title: parsedTx.title,
            amount: parsedTx.amount,
            transaction_date: formatDateOnly(),
          });
          if (error) throw error;

          const txTypeLabel = category.type === "income" ? "Pemasukan" : "Pengeluaran";
          reply = [
            `✅ ${txTypeLabel} tercatat`,
            `Kategori: ${category.name}`,
            `Judul: ${parsedTx.title ?? "-"}`,
            `Nominal: ${formatCurrency(parsedTx.amount)}`,
            `Akun: ${account.name}`,
          ].join("\n");
        }
      }
    }

    await replyWhatsApp(sender, reply);
    await logMessage(supabase, {
      user_id: waUser.id,
      sender,
      direction: "outgoing",
      message: reply,
      status: "success",
      command: firstToken,
      dedupe_key: dedupeKey,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Webhook error", error);

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
