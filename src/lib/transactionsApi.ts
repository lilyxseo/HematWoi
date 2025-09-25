import { supabase } from "./supabase";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_TYPES = new Set(["income", "expense", "transfer"]);

function normalizeTags(tags?: string[] | null): string[] | null {
  if (!Array.isArray(tags)) return null;
  const cleaned = tags
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter(Boolean);
  if (!cleaned.length) {
    return null;
  }
  return Array.from(new Set(cleaned));
}

export type CreateTransactionPayload = {
  date: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  account_id: string;
  to_account_id?: string | null;
  category_id?: string | null;
  merchant_id?: string | null;
  title?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  receipt_url?: string | null;
};

export async function createTransaction(payload: CreateTransactionPayload) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw new Error(userError.message || "Gagal memuat sesi pengguna.");
  }
  const userId = userData?.user?.id;
  if (!userId) {
    throw new Error("Anda harus login untuk menambah transaksi.");
  }

  const type = payload.type;
  if (!ALLOWED_TYPES.has(type)) {
    throw new Error("Tipe transaksi tidak valid.");
  }

  if (!payload.account_id) {
    throw new Error("Akun sumber wajib dipilih.");
  }

  if (!payload.amount || !Number.isFinite(payload.amount) || payload.amount <= 0) {
    throw new Error("Jumlah transaksi tidak valid.");
  }

  if (!DATE_REGEX.test(payload.date)) {
    throw new Error("Tanggal transaksi tidak valid.");
  }

  if (type === "transfer") {
    if (!payload.to_account_id) {
      throw new Error("Akun tujuan wajib untuk transfer.");
    }
    if (payload.to_account_id === payload.account_id) {
      throw new Error("Akun tujuan harus berbeda dengan akun sumber.");
    }
  }

  if (type === "expense" && !payload.category_id) {
    throw new Error("Kategori wajib untuk pengeluaran.");
  }

  const tags = normalizeTags(payload.tags ?? null);

  const record: Record<string, any> = {
    user_id: userId,
    date: payload.date,
    type,
    amount: Math.round(Number(payload.amount)),
    account_id: payload.account_id,
    to_account_id: type === "transfer" ? payload.to_account_id ?? null : null,
    category_id: type === "transfer" ? null : payload.category_id ?? null,
    merchant_id: payload.merchant_id ?? null,
    title: payload.title ?? null,
    notes: payload.notes ?? null,
    tags,
    receipt_url: payload.receipt_url ?? null,
  };

  const { data, error } = await supabase
    .from("transactions")
    .insert([record])
    .select(
      "id,date,type,amount,account_id,to_account_id,category_id,merchant_id,title,notes,tags,receipt_url,created_at,updated_at",
    )
    .single();

  if (error) {
    throw new Error(error.message || "Gagal menyimpan transaksi.");
  }

  if (!data) {
    throw new Error("Transaksi tidak tersimpan. Coba ulangi.");
  }

  return data;
}
