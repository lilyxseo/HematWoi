import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ALLOWED_USER_ID = Deno.env.get("HEMATWOI_CHATGPT_USER_ID") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function validMonth(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2100;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  if (!URL || !ANON_KEY || !ALLOWED_USER_ID) return json({ error: "Server configuration missing" }, 503);

  const token = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Authentication required" }, 401);

  const client = createClient(URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await client.auth.getUser(token);
  if (authError || !auth.user || auth.user.id !== ALLOWED_USER_ID) {
    return json({ error: "Forbidden" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid body");
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = body.action;
  const month = body.month;
  if (!["accounts", "transactions", "budgets", "categories"].includes(String(action))) {
    return json({ error: "Unsupported read-only action" }, 400);
  }
  if ((action === "transactions" || action === "budgets") && !validMonth(month)) {
    return json({ error: "month must be YYYY-MM" }, 400);
  }

  try {
    const userId = auth.user.id;
    if (action === "accounts") {
      const { data, error } = await client.from("accounts")
        .select("id,name,type,currency,balance,sort_order").eq("user_id", userId).limit(100);
      if (error) throw error;
      return json({ action, accounts: data });
    }

    if (action === "categories") {
      const { data, error } = await client.from("categories")
        .select("id,name,type,group_name,sort_order").eq("user_id", userId).limit(200);
      if (error) throw error;
      return json({ action, categories: data });
    }

    const start = `${month}-01`;
    const [year, mon] = String(month).split("-").map(Number);
    const end = new Date(Date.UTC(year, mon, 1)).toISOString().slice(0, 10);

    if (action === "transactions") {
      const requested = Number(body.limit ?? 50);
      if (!Number.isInteger(requested) || requested < 1 || requested > 100) {
        return json({ error: "limit must be between 1 and 100" }, 400);
      }
      const { data, error } = await client.from("transactions")
        .select("id,date,title,type,amount,category_id,account_id,deleted_at")
        .eq("user_id", userId).gte("date", start).lt("date", end)
        .is("deleted_at", null).order("date", { ascending: false }).limit(requested);
      if (error) throw error;
      return json({ action, month, transactions: data, limit: requested });
    }

    const { data, error } = await client.from("budgets")
      .select("id,name,label,category_id,month,period_month,planned,amount_planned,current_spent,rollover_in,carryover_enabled,budget_type")
      .eq("user_id", userId).or(`period_month.eq.${start},and(period_month.is.null,month.eq.${start})`).limit(100);
    if (error) throw error;
    return json({ action, month, budgets: data });
  } catch (error) {
    console.error("HematWoi read API error", error instanceof Error ? error.message : "unknown");
    return json({ error: "Query failed; verify schema and RLS" }, 500);
  }
});
