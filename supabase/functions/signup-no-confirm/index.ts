import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase environment variables for signup-no-confirm function");
}

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

function jsonResponse(body: Record<string, unknown>, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...init.headers,
    },
    status: init.status,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  if (!supabaseAdmin) {
    return jsonResponse({ error: "Server configuration error" }, { status: 500 });
  }

  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return jsonResponse({ error: "Payload is required" }, { status: 400 });
  }

  const { email, password, full_name } = payload as {
    email?: unknown;
    password?: unknown;
    full_name?: unknown;
  };

  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const normalizedPassword = typeof password === "string" ? password : "";
  const normalizedFullName = typeof full_name === "string" ? full_name.trim() : undefined;

  if (!normalizedEmail) {
    return jsonResponse({ error: "Email wajib diisi." }, { status: 400 });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(normalizedEmail)) {
    return jsonResponse({ error: "Gunakan format email yang valid." }, { status: 400 });
  }

  if (!normalizedPassword || normalizedPassword.length < 6) {
    return jsonResponse({ error: "Password minimal 6 karakter." }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: normalizedPassword,
      email_confirm: true,
      user_metadata: normalizedFullName ? { full_name: normalizedFullName } : undefined,
    });

    if (error) {
      const normalizedMessage = error.message?.toLowerCase() ?? "";
      const isDuplicateEmail =
        normalizedMessage.includes("already registered") ||
        normalizedMessage.includes("already exists") ||
        normalizedMessage.includes("email already") ||
        normalizedMessage.includes("user already");
      if (error.status === 409 || isDuplicateEmail) {
        return jsonResponse({ error: "Email sudah terdaftar" }, { status: 409 });
      }
      return jsonResponse({ error: error.message ?? "Gagal membuat akun." }, { status: 400 });
    }

    if (!data?.user) {
      return jsonResponse({ error: "Data pengguna tidak ditemukan." }, { status: 400 });
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: data.user.id,
        preferences: {},
      })
      .select("id")
      .maybeSingle();

    if (profileError) {
      console.error("[signup-no-confirm] failed to create profile", profileError);
      return jsonResponse({ error: "Gagal menyiapkan profil pengguna." }, { status: 500 });
    }

    return jsonResponse({ user: data.user }, { status: 200 });
  } catch (error) {
    console.error("[signup-no-confirm] failed", error);
    return jsonResponse({ error: "Terjadi kesalahan. Coba lagi nanti." }, { status: 400 });
  }
});
