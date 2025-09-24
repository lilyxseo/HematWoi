import { supabase } from "./supabase";
import { getCurrentUserId } from "./session";

export * from "./api.js";

export type AccountType = "cash" | "bank" | "ewallet" | "other";

export interface AccountRecord {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  balance: number;
  is_archived: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface AccountPayload {
  name: string;
  type: AccountType;
  currency?: string;
}

export type AccountPatch = Partial<{
  name: string;
  type: AccountType;
  currency: string;
}>;

const ACCOUNT_COLUMNS = "id, user_id, name, type, currency, created_at, updated_at";

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error && error.message) {
    return error;
  }
  if (typeof error === "string" && error.trim()) {
    return new Error(error.trim());
  }
  return new Error(fallback);
}

function normalizeCurrency(value: unknown): string {
  if (typeof value !== "string") return "IDR";
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return "IDR";
  if (/^[A-Z]{3}$/.test(trimmed)) return trimmed;
  return "IDR";
}

function normalizeName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeType(value: unknown): AccountType {
  if (value === "cash" || value === "bank" || value === "ewallet" || value === "other") {
    return value;
  }
  return "cash";
}

function normalizeBalance(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    return trimmed === "true" || trimmed === "1";
  }
  return false;
}

function mapAccountRow(row: Record<string, unknown>, fallbackUserId: string): AccountRecord {
  const rawCreated = row.created_at;
  const rawUpdated = row.updated_at;
  return {
    id: String(row.id ?? ""),
    user_id: typeof row.user_id === "string" ? row.user_id : fallbackUserId,
    name: typeof row.name === "string" ? row.name : "",
    type: normalizeType(row.type),
    currency: typeof row.currency === "string" ? row.currency : "IDR",
    balance: normalizeBalance(
      (row.balance ?? row.current_balance ?? row.initial_balance ?? 0) as unknown,
    ),
    is_archived: normalizeBoolean(row.is_archived ?? row.archived ?? false),
    created_at: typeof rawCreated === "string" ? rawCreated : null,
    updated_at: typeof rawUpdated === "string" ? rawUpdated : null,
  };
}

async function resolveUserId(userId?: string): Promise<string> {
  if (userId) return userId;
  const uid = await getCurrentUserId();
  if (!uid) {
    throw new Error("User belum masuk. Silakan masuk terlebih dahulu.");
  }
  return uid;
}

export async function listAccounts(userId?: string): Promise<AccountRecord[]> {
  const uid = await resolveUserId(userId);
  const { data, error } = await supabase
    .from("accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("user_id", uid)
    .order("name", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw toError(error, "Gagal memuat daftar akun. Coba lagi.");
  }

  return (data ?? []).map((row) => mapAccountRow(row, uid));
}

export async function createAccount(
  payload: AccountPayload,
  userId?: string
): Promise<AccountRecord> {
  const uid = await resolveUserId(userId);
  const name = normalizeName(payload.name);
  if (!name) {
    throw new Error("Nama akun wajib diisi.");
  }

  const type = normalizeType(payload.type);
  const currency = normalizeCurrency(payload.currency ?? "IDR");

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      name,
      type,
      currency,
      user_id: uid,
    })
    .select(ACCOUNT_COLUMNS)
    .single();

  if (error) {
    throw toError(error, "Gagal menambahkan akun. Coba lagi.");
  }

  if (!data) {
    throw new Error("Server tidak mengembalikan data akun.");
  }

  return mapAccountRow(data, uid);
}

export async function updateAccount(
  id: string,
  patch: AccountPatch,
  userId?: string
): Promise<AccountRecord> {
  const uid = await resolveUserId(userId);
  if (!id) {
    throw new Error("ID akun tidak valid.");
  }

  const updates: Record<string, unknown> = {};
  if (patch.name != null) {
    const name = normalizeName(patch.name);
    if (!name) {
      throw new Error("Nama akun wajib diisi.");
    }
    updates.name = name;
  }
  if (patch.type != null) {
    updates.type = normalizeType(patch.type);
  }
  if (patch.currency != null) {
    updates.currency = normalizeCurrency(patch.currency);
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("Tidak ada perubahan yang disimpan.");
  }

  const { data, error } = await supabase
    .from("accounts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", uid)
    .select(ACCOUNT_COLUMNS)
    .single();

  if (error) {
    throw toError(error, "Gagal memperbarui akun. Coba lagi.");
  }

  if (!data) {
    throw new Error("Akun tidak ditemukan atau sudah dihapus.");
  }

  return mapAccountRow(data, uid);
}

export async function deleteAccount(id: string, userId?: string): Promise<void> {
  const uid = await resolveUserId(userId);
  if (!id) {
    throw new Error("ID akun tidak valid.");
  }

  const { error } = await supabase.from("accounts").delete().eq("id", id).eq("user_id", uid);
  if (error) {
    throw toError(error, "Gagal menghapus akun. Coba lagi.");
  }
}
