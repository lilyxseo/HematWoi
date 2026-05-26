import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type WhatsappUser = {
  user_id: string;
  phone: string;
  is_active?: boolean;
};

type ExpenseTransaction = {
  id: string;
  user_id: string;
  category_id: string | null;
  amount: number;
  title: string | null;
  date: string;
};

type Category = {
  id: string;
  name: string;
};

type BalanceSummary = {
  cash: number;
  nonCash: number;
  total: number;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FONNTE_TOKEN = Deno.env.get("FONNTE_TOKEN") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function getTodayJakarta(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTanggalIndonesia(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

async function getBalanceSummary(userId: string): Promise<BalanceSummary> {
  const { data, error } = await supabase.rpc("get_account_type_balances", {
    p_user_id: userId,
  });

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  let cash = 0;
  let nonCash = 0;

  for (const row of rows) {
    const accountType = String(row.account_type ?? "").toLowerCase();
    const balance = Number(row.balance ?? 0);
    if (accountType === "cash") {
      cash += balance;
    } else {
      nonCash += balance;
    }
  }

  return {
    cash,
    nonCash,
    total: cash + nonCash,
  };
}

function getLargestCategory(
  transactions: ExpenseTransaction[],
  categoryMap: Map<string, string>,
): { name: string; amount: number; ratio: number } {
  if (transactions.length === 0) {
    return { name: "-", amount: 0, ratio: 0 };
  }

  const totals = new Map<string, number>();
  let totalExpense = 0;

  for (const trx of transactions) {
    totalExpense += Number(trx.amount ?? 0);
    const key = trx.category_id ?? "__uncategorized__";
    const prev = totals.get(key) ?? 0;
    totals.set(key, prev + Number(trx.amount ?? 0));
  }

  let largestCategoryId = "";
  let largestAmount = 0;

  for (const [categoryId, amount] of totals.entries()) {
    if (amount > largestAmount) {
      largestAmount = amount;
      largestCategoryId = categoryId;
    }
  }

  const ratio = totalExpense > 0 ? largestAmount / totalExpense : 0;
  const name = largestCategoryId === "__uncategorized__"
    ? "-"
    : (categoryMap.get(largestCategoryId) ?? "-");

  return {
    name,
    amount: largestAmount,
    ratio,
  };
}

function getLargestTransaction(
  transactions: ExpenseTransaction[],
  categoryMap: Map<string, string>,
): { title: string; amount: number } {
  if (transactions.length === 0) {
    return { title: "-", amount: 0 };
  }

  let largest = transactions[0];
  for (const trx of transactions) {
    if (Number(trx.amount ?? 0) > Number(largest.amount ?? 0)) {
      largest = trx;
    }
  }

  const fallbackCategory = largest.category_id
    ? (categoryMap.get(largest.category_id) ?? "-")
    : "-";
  const title = (largest.title ?? "").trim() || fallbackCategory;

  return {
    title,
    amount: Number(largest.amount ?? 0),
  };
}

function buildInsight(params: {
  totalExpense: number;
  totalTransactions: number;
  largestCategoryName: string;
  largestCategoryRatio: number;
}): string {
  const {
    totalExpense,
    totalTransactions,
    largestCategoryName,
    largestCategoryRatio,
  } = params;

  if (totalTransactions >= 8) {
    return "📌 Aktivitas transaksi cukup tinggi hari ini.";
  }

  if (largestCategoryRatio > 0.5 && largestCategoryName !== "-") {
    return `⚠️ Pengeluaran terbesar ada di kategori ${largestCategoryName}.`;
  }

  if (totalExpense <= 50000) {
    return "✅ Pengeluaran hari ini masih ringan.";
  }

  if (totalExpense > 200000) {
    return "⚠️ Pengeluaran hari ini cukup besar, cek kembali detailnya.";
  }

  return "✅ Pengeluaran hari ini masih terkontrol.";
}

async function sendWhatsAppMessage(phone: string, message: string): Promise<void> {
  const response = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: FONNTE_TOKEN,
    },
    body: JSON.stringify({
      target: phone,
      message,
      countryCode: "62",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fonnte error ${response.status}: ${errorText}`);
  }
}

Deno.serve(async (req: Request) => {
  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("CRON_SECRET");

  if (!expectedSecret || cronSecret !== expectedSecret) {
    return new Response(JSON.stringify({ ok: false, message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FONNTE_TOKEN) {
    return new Response(
      JSON.stringify({ ok: false, message: "Missing required environment variables" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const today = getTodayJakarta();

  const { data: users, error: usersError } = await supabase
    .from("whatsapp_users")
    .select("user_id, phone, is_active")
    .eq("is_active", true);

  if (usersError) {
    return new Response(
      JSON.stringify({ ok: false, message: usersError.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const activeUsers = (users ?? []) as WhatsappUser[];
  let totalSent = 0;

  for (const user of activeUsers) {
    try {
      const userId = user.user_id;
      const phone = user.phone;

      const { data: transactionsData, error: transactionsError } = await supabase
        .from("transactions")
        .select("id, user_id, category_id, amount, title, date")
        .eq("user_id", userId)
        .eq("type", "expense")
        .eq("date", today)
        .is("deleted_at", null);

      if (transactionsError) {
        throw transactionsError;
      }

      const transactions = (transactionsData ?? []) as ExpenseTransaction[];
      if (transactions.length === 0) {
        continue;
      }

      const categoryIds = Array.from(
        new Set(
          transactions
            .map((trx) => trx.category_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      let categoryMap = new Map<string, string>();
      if (categoryIds.length > 0) {
        const { data: categoriesData, error: categoriesError } = await supabase
          .from("categories")
          .select("id, name")
          .in("id", categoryIds);

        if (categoriesError) {
          throw categoriesError;
        }

        categoryMap = new Map(
          ((categoriesData ?? []) as Category[]).map((cat) => [cat.id, cat.name]),
        );
      }

      const totalExpense = transactions.reduce(
        (sum, trx) => sum + Number(trx.amount ?? 0),
        0,
      );
      const totalTransactions = transactions.length;
      const averageTransaction = totalTransactions > 0
        ? totalExpense / totalTransactions
        : 0;

      const largestCategory = getLargestCategory(transactions, categoryMap);
      const largestTransaction = getLargestTransaction(transactions, categoryMap);
      const balanceSummary = await getBalanceSummary(userId);

      const insight = buildInsight({
        totalExpense,
        totalTransactions,
        largestCategoryName: largestCategory.name,
        largestCategoryRatio: largestCategory.ratio,
      });

      const message = [
        "📊 *Summary Pengeluaran Hari Ini*",
        "",
        `📅 ${formatTanggalIndonesia(today)}`,
        "",
        "💸 Total Pengeluaran",
        formatIDR(totalExpense),
        "",
        "🧾 Total Transaksi",
        `${totalTransactions} transaksi`,
        "",
        "🏆 Kategori Terbesar",
        `${largestCategory.name} — ${formatIDR(largestCategory.amount)}`,
        "",
        "🔥 Transaksi Terbesar",
        `${largestTransaction.title} — ${formatIDR(largestTransaction.amount)}`,
        "",
        "📊 Rata-rata Transaksi",
        formatIDR(averageTransaction),
        "",
        "💰 Saldo Saat Ini",
        `Cash: ${formatIDR(balanceSummary.cash)}`,
        `Non Cash: ${formatIDR(balanceSummary.nonCash)}`,
        `Total: ${formatIDR(balanceSummary.total)}`,
        "",
        "💡 Insight",
        insight,
      ].join("\n");

      console.log("[DAILY SUMMARY]", {
        userId,
        phone,
        totalExpense,
        totalTransactions,
      });

      await sendWhatsAppMessage(phone, message);
      totalSent += 1;
    } catch (error) {
      console.error("[DAILY SUMMARY][ERROR]", {
        userId: user.user_id,
        phone: user.phone,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed: activeUsers.length,
      sent: totalSent,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});
