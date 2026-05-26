import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type WhatsappUser = {
  user_id: string;
  phone: string;
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

async function sendWhatsAppMessage(phone: string, message: string): Promise<Response> {
  return await fetch("https://api.fonnte.com/send", {
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
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  try {
    console.log("[DAILY SUMMARY STEP] start");
    console.log("[DAILY SUMMARY REQUEST]", {
      method: req.method,
      hasCronSecret: Boolean(req.headers.get("x-cron-secret")),
      userAgent: req.headers.get("user-agent"),
    });

    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    const requestSecret = req.headers.get("x-cron-secret") ?? "";

    if (!cronSecret) {
      console.error("[DAILY SUMMARY] CRON_SECRET env is missing");
      return json({
        ok: false,
        error: "CRON_SECRET env is missing",
      }, 500);
    }

    if (requestSecret !== cronSecret) {
      console.error("[DAILY SUMMARY] Invalid cron secret", {
        hasRequestSecret: Boolean(requestSecret),
      });

      return json({
        ok: false,
        error: "Invalid cron secret",
        hint: "Add x-cron-secret header in Supabase Cron job",
      }, 401);
    }

    const missingEnv: string[] = [];
    if (!SUPABASE_URL) missingEnv.push("SUPABASE_URL");
    if (!SUPABASE_SERVICE_ROLE_KEY) missingEnv.push("SUPABASE_SERVICE_ROLE_KEY");
    if (!FONNTE_TOKEN) missingEnv.push("FONNTE_TOKEN");
    if (!cronSecret) missingEnv.push("CRON_SECRET");

    if (missingEnv.length > 0) {
      console.error("[DAILY SUMMARY MISSING ENV]", missingEnv);
      return json({ ok: false, error: "Missing env", missingEnv }, 500);
    }
    console.log("[DAILY SUMMARY STEP] env ok");

    const today = getTodayJakarta();
    console.log("[DAILY SUMMARY STEP] fetch users");
    const { data: users, error: usersError } = await supabase
      .from("whatsapp_users")
      .select("phone,user_id");

    if (usersError) {
      console.error("[DAILY SUMMARY USERS ERROR]", usersError);
      return json({ ok: false, error: usersError.message }, 500);
    }

    const activeUsers = (users ?? []) as WhatsappUser[];
    console.log("[DAILY SUMMARY STEP] users fetched", { count: activeUsers.length });
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of activeUsers) {
      try {
        const userId = user.user_id;
        const phone = user.phone;
        console.log("[DAILY SUMMARY STEP] process user", { userId, phone });

        console.log("[DAILY SUMMARY STEP] fetch transactions");
        const { data: transactionsData, error: transactionsError } = await supabase
          .from("transactions")
          .select("id,title,amount,type,date,category_id,account_id")
          .eq("user_id", userId)
          .eq("type", "expense")
          .eq("date", today)
          .is("deleted_at", null);

        if (transactionsError) {
          failed += 1;
          console.error("[DAILY SUMMARY TRANSACTIONS ERROR]", { userId, phone, error: transactionsError });
          continue;
        }

        const transactions = (transactionsData ?? []) as ExpenseTransaction[];
        if (transactions.length === 0) {
          skipped += 1;
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
            .select("id,name")
            .in("id", categoryIds);

          if (categoriesError) {
            failed += 1;
            console.error("[DAILY SUMMARY CATEGORY ERROR]", { userId, phone, error: categoriesError });
            continue;
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
        console.log("[DAILY SUMMARY STEP] get balance");
        let balanceText = [
          "💰 Saldo Saat Ini",
          "Gagal mengambil saldo.",
        ];
        try {
          const balanceSummary = await getBalanceSummary(userId);
          balanceText = [
            "💰 Saldo Saat Ini",
            `Cash: ${formatIDR(balanceSummary.cash)}`,
            `Non Cash: ${formatIDR(balanceSummary.nonCash)}`,
            `Total: ${formatIDR(balanceSummary.total)}`,
          ];
        } catch (balanceError) {
          console.error("[DAILY SUMMARY BALANCE ERROR]", {
            userId,
            phone,
            error: balanceError instanceof Error ? balanceError.message : String(balanceError),
          });
        }

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
          ...balanceText,
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

        console.log("[DAILY SUMMARY STEP] send whatsapp");
        const response = await sendWhatsAppMessage(phone, message);
        if (!response.ok) {
          failed += 1;
          const responseText = await response.text();
          console.error("[DAILY SUMMARY FONNTE ERROR]", {
            phone,
            status: response.status,
            body: responseText,
          });
          continue;
        }
        sent += 1;
      } catch (userError) {
        failed += 1;
        console.error("[DAILY SUMMARY USER ERROR]", {
          user,
          error: String(userError),
        });
      }
    }

    console.log("[DAILY SUMMARY STEP] done");
    return json({
      ok: true,
      processed: activeUsers.length,
      sent,
      skipped,
      failed,
    });
  } catch (error) {
    console.error("[DAILY SUMMARY FATAL]", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    });
    return json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
