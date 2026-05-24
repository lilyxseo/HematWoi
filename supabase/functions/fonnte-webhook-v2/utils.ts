import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type IncomingPayload = {
  sender?: string;
  phone?: string;
  number?: string;
  device?: string;
  text?: string;
  message?: string;
  msg?: string;
  from_me?: boolean;
  fromMe?: boolean;
  isMe?: boolean;
  data?: Record<string, Json>;
};

export type WhatsappUser = {
  id: string;
  phone_number: string;
  name: string | null;
};

export type Category = {
  id: string;
  user_id: string;
  name: string;
  type: "income" | "expense";
};

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: "cash" | "non_cash";
};

export type ParsedTransaction = {
  categoryName: string;
  title: string | null;
  amount: number;
  accountName: string;
};

export type ParsedTransfer = {
  amount: number;
  fromAccountName: string;
  toAccountName: string;
};

export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function normalizePhone(raw?: string): string {
  if (!raw) return "";
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

export function extractMessageText(payload: IncomingPayload): string {
  const base = payload.text ?? payload.message ?? payload.msg ?? "";
  return String(base).trim();
}

export function isBotMessage(payload: IncomingPayload, text: string): boolean {
  const sender = normalizePhone(payload.sender ?? payload.phone ?? payload.number);
  const device = normalizePhone(payload.device);
  const prefixes = ["🤖", "✅", "💰", "ℹ️", "📊", "📚", "🏦", "📌", "🗑️"];
  const hasBotPrefix = prefixes.some((p) => text.startsWith(p));

  return Boolean(
    payload.from_me === true ||
      payload.fromMe === true ||
      payload.isMe === true ||
      (sender && device && sender === device) ||
      hasBotPrefix,
  );
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateOnly(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function monthRange(date = new Date()): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: formatDateOnly(start), end: formatDateOnly(end) };
}

export function parseNominal(raw: string): number {
  const clean = raw.replace(/[^0-9]/g, "");
  const value = Number(clean);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

export function parseTransactionMessage(text: string): ParsedTransaction | null {
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

  return {
    categoryName,
    title,
    amount,
    accountName,
  };
}

export function parseTransferMessage(text: string): ParsedTransfer | null {
  const parts = text.trim().split(/\s+/);
  if (parts.length !== 4) return null;
  const [cmd, nominal, fromAcc, toAcc] = parts;
  if (!["tf", "transfer"].includes(cmd.toLowerCase())) return null;

  const amount = parseNominal(nominal);
  if (amount <= 0) return null;

  return {
    amount,
    fromAccountName: fromAcc.toLowerCase(),
    toAccountName: toAcc.toLowerCase(),
  };
}

export function buildMenuMessage(): string {
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

export async function findCategory(supabase: SupabaseClient, userId: string, name: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("id,user_id,name,type")
    .eq("user_id", userId)
    .ilike("name", name)
    .maybeSingle();
  if (error) throw error;
  return (data as Category | null) ?? null;
}

export async function findAccount(supabase: SupabaseClient, userId: string, name: string): Promise<Account | null> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id,user_id,name,type")
    .eq("user_id", userId)
    .ilike("name", name)
    .maybeSingle();
  if (error) throw error;
  return (data as Account | null) ?? null;
}

export async function replyWhatsApp(target: string, message: string): Promise<void> {
  const token = Deno.env.get("FONNTE_TOKEN") ?? "";
  if (!token) throw new Error("FONNTE_TOKEN is not configured");

  const response = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target,
      message,
      delay: "2",
      countryCode: "62",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed send WA: ${response.status} ${body}`);
  }
}

export async function logMessage(
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
