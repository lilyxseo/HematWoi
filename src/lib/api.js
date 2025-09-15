// src/lib/api.js
import { supabase } from "./supabase";
import syncEngine, { normalize } from "./sync/SyncEngine.js";
import * as localdb from "./sync/localdb.js";

/**
 * List transaksi dengan filter & pagination.
 */
export async function listTransactions(
  { type, month, q, page = 1, pageSize = 20 } = {},
) {
  if (!navigator.onLine) {
    let rows = await localdb.getCache("transactions");
    rows = rows.map((t) => ({ ...t }));
    if (type && type !== "all") rows = rows.filter((r) => r.type === type);
    if (month && month !== "all") rows = rows.filter((r) => r.date.startsWith(month));
    if (q && q.trim()) {
      const like = q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.note?.toLowerCase().includes(like) ||
          r.category?.toLowerCase().includes(like),
      );
    }
    const total = rows.length;
    const from = (page - 1) * pageSize;
    const paged = rows.slice(from, from + pageSize);
    return { rows: paged, total, page, pageSize };
  }

  let query = supabase
    .from("transactions")
    .select(
      "id,date,type,amount,note,category_id,categories:category_id (name)",
      { count: "exact" },
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
  await localdb.setCache("transactions", rows);
  return { rows, total: count || 0, page, pageSize };
}

/**
 * Insert transaksi baru
 */
export async function addTransaction({ date, type, amount, note, category_id }) {
  const record = normalize("transactions", {
    date,
    type,
    amount,
    note: note || null,
    category_id: category_id || null,
  });
  await syncEngine.enqueueOrRun("transactions", "UPSERT", record);
  const cats = await localdb.getCache("categories");
  const category = cats.find((c) => c.id === record.category_id)?.name || null;
  return { ...record, category };
}

/**
 * Update transaksi by id
 */
export async function updateTransaction(id, patch) {
  const record = normalize("transactions", { id, ...patch });
  await syncEngine.enqueueOrRun("transactions", "UPSERT", record);
  const cats = await localdb.getCache("categories");
  const category = cats.find((c) => c.id === record.category_id)?.name || null;
  return { ...record, category };
}

/**
 * Hapus transaksi by id
 */
export async function deleteTransaction(id) {
  await syncEngine.enqueueOrRun("transactions", "DELETE", { id });
}

// -- CATEGORIES ----------------------------------------

/**
 * List kategori (opsional filter type)
 */
export async function listCategories(type) {
  if (!navigator.onLine) {
    let rows = await localdb.getCache("categories");
    if (type) rows = rows.filter((c) => c.type === type);
    return rows;
  }
  let query = supabase
    .from("categories")
    .select("id,type,name")
    .order("name", { ascending: true });
  if (type) query = query.eq("type", type);
  const { data, error } = await query;
  if (error) throw error;
  await localdb.setCache("categories", data || []);
  return data || [];
}

/**
 * Tambah satu kategori
 */
export async function addCategory({ type, name }) {
  const record = normalize("categories", { type, name });
  await syncEngine.enqueueOrRun("categories", "UPSERT", record);
  return record;
}

/**
 * Upsert daftar kategori income/expense (idempotent)
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
  await localdb.setCache("categories", final || []);
  return final || [];
}
