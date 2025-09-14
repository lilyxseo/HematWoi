// src/lib/api.js
import { supabase } from "./supabase";

/**
 * List transaksi dari Supabase dengan filter & pagination.
 * @param {Object} opts
 * @param {"income"|"expense"|"all"|undefined} opts.type
 * @param {string|undefined} opts.month - "YYYY-MM" atau "all"
 * @param {string|undefined} opts.q - query pencarian
 * @param {number} opts.page - mulai 1
 * @param {number} opts.pageSize - default 20
 * @returns {{rows: Array, total: number, page: number, pageSize: number}}
 */
export async function listTransactions(
  { type, month, q, page = 1, pageSize = 20 } = {}
) {
  let query = supabase
    .from("transactions")
    .select(
      // ambil kategori via FK alias `categories`
      "id,date,type,amount,note,category_id,categories:category_id (name)",
      { count: "exact" }
    )
    .order("date", { ascending: false });

  if (type && type !== "all") {
    query = query.eq("type", type);
  }
  if (month && month !== "all") {
    const start = `${month}-01`;
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    query = query.gte("date", start).lt("date", end.toISOString().slice(0, 10));
  }
  if (q && q.trim()) {
    const like = `%${q}%`;
    // cari di note atau nama kategori
    query = query.or(`note.ilike.${like},categories.name.ilike.${like}`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  const rows = (data || []).map((t) => ({
    ...t,
    category: t.categories?.name || null,
  }));
  return { rows, total: count || 0, page, pageSize };
}

/**
 * Insert transaksi baru
 * @returns {Promise<Object>}
 */
export async function addTransaction({ date, type, amount, note, category_id }) {
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      date,
      type,
      amount,
      note: note || null,
      category_id: category_id || null,
    })
    .select("id,date,type,amount,note,category_id,categories:category_id (name)")
    .single();
  if (error) throw error;
  return { ...data, category: data.categories?.name || null };
}

/**
 * Update transaksi by id
 * @returns {Promise<Object>}
 */
export async function updateTransaction(id, patch) {
  const { data, error } = await supabase
    .from("transactions")
    .update(patch)
    .eq("id", id)
    .select("id,date,type,amount,note,category_id,categories:category_id (name)")
    .single();
  if (error) throw error;
  return { ...data, category: data.categories?.name || null };
}

/**
 * Hapus transaksi by id
 */
export async function deleteTransaction(id) {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}

// ==== CATEGORIES ======================================

/**
 * List kategori (opsional filter type)
 * @param {"income"|"expense"|undefined} type
 */
export async function listCategories(type) {
  let query = supabase
    .from("categories")
    .select("id,type,name")
    .order("name", { ascending: true });
  if (type) query = query.eq("type", type);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Tambah satu kategori
 */
export async function addCategory({ type, name }) {
  const { data, error } = await supabase
    .from("categories")
    .insert({ type, name })
    .select("id,type,name")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Upsert daftar kategori income/expense (idempotent)
 * @param {{income?: string[], expense?: string[]}} payload
 * @returns {Promise<Array<{id:string,type:string,name:string}>>}
 */
export async function upsertCategories({ income = [], expense = [] }) {
  const { data: existing, error } = await supabase
    .from("categories")
    .select("id,type,name");
  if (error) throw error;

  const have = new Set((existing || []).map((c) => `${c.type}:${c.name}`));
  const inserts = [];
  income.forEach((name) => {
    if (!have.has(`income:${name}`)) inserts.push({ type: "income", name });
  });
  expense.forEach((name) => {
    if (!have.has(`expense:${name}`)) inserts.push({ type: "expense", name });
  });

  if (inserts.length) {
    const { error: errIns } = await supabase.from("categories").insert(inserts);
    if (errIns) throw errIns;
  }

  const { data: final, error: errFinal } = await supabase
    .from("categories")
    .select("id,type,name")
    .order("name", { ascending: true });
  if (errFinal) throw errFinal;

  return final || [];
}
