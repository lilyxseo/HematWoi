// src/lib/api.js
import { supabase } from "./supabase";
import { dbCache } from "./sync/localdb";
import { upsert, remove } from "./sync/SyncEngine";

/**
 * List transaksi dari Supabase dengan filter & pagination.
 * Fallback ke cache jika offline.
 */
export async function listTransactions(
  { type, month, category, sort = "date-desc", q, page = 1, pageSize = 20 } = {},
) {
  if (!navigator.onLine || window.__sync?.fakeOffline) {
    const rows = await dbCache.list("transactions");
    return { rows, total: rows.length, page: 1, pageSize: rows.length };
  }

  let query = supabase
    .from("transactions")
    .select(
      "id,date,type,amount,note,category_id,categories:category_id (name)",
      { count: "exact" }
    );

  const [sortField, sortDir] = sort.split("-");
  const ascending = sortDir === "asc";
  const field = sortField === "amount" ? "amount" : "date";
  query = query.order(field, { ascending });

  if (type && type !== "all") {
    query = query.eq("type", type);
  }
  if (month && month !== "all") {
    const start = `${month}-01`;
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    query = query.gte("date", start).lt("date", end.toISOString().slice(0, 10));
  }
  if (category && category !== "all") {
    query = query.eq("category_id", category);
  }
  if (q && q.trim()) {
    const like = `%${q}%`;
    query = query.or(`note.ilike.${like},categories.name.ilike.${like}`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    const rows = (data || []).map((t) => ({
      ...t,
      category: t.categories?.name || null,
    }));
    await dbCache.bulkSet("transactions", rows);
    return { rows, total: count || 0, page, pageSize };
  } catch {
    const rows = await dbCache.list("transactions");
    return { rows, total: rows.length, page: 1, pageSize: rows.length };
  }
}

/** Insert transaksi baru */
export async function addTransaction({ date, type, amount, note, category_id }) {
  const record = {
    id: crypto.randomUUID(),
    date,
    type,
    amount,
    note: note || null,
    category_id: category_id || null,
    updated_at: new Date().toISOString(),
  };
  await upsert("transactions", record);
  return record;
}

/** Update transaksi by id */
export async function updateTransaction(id, patch) {
  const record = { id, ...patch, updated_at: new Date().toISOString() };
  await upsert("transactions", record);
  return record;
}

/** Hapus transaksi by id */
export async function deleteTransaction(id) {
  await remove("transactions", id);
}

// -- CATEGORIES ----------------------------------------

/** List kategori */
export async function listCategories(type) {
  if (!navigator.onLine || window.__sync?.fakeOffline) {
    const rows = await dbCache.list("categories");
    return type ? rows.filter((r) => r.type === type) : rows;
  }

  let query = supabase
    .from("categories")
    .select("id,type,name")
    .order("name", { ascending: true });
  if (type) query = query.eq("type", type);
  try {
    const { data, error } = await query;
    if (error) throw error;
    await dbCache.bulkSet("categories", data || []);
    return data || [];
  } catch {
    const rows = await dbCache.list("categories");
    return type ? rows.filter((r) => r.type === type) : rows;
  }
}

/** Tambah satu kategori */
export async function addCategory({ type, name }) {
  const record = {
    id: crypto.randomUUID(),
    type,
    name,
    updated_at: new Date().toISOString(),
  };
  await upsert("categories", record);
  return record;
}

/** Upsert daftar kategori income/expense */
export async function upsertCategories({ income = [], expense = [] }) {
  const rows = [];
  income.forEach((name) =>
    rows.push({ id: crypto.randomUUID(), type: "income", name, updated_at: new Date().toISOString() })
  );
  expense.forEach((name) =>
    rows.push({ id: crypto.randomUUID(), type: "expense", name, updated_at: new Date().toISOString() })
  );
  for (const r of rows) await upsert("categories", r);
  const all = await dbCache.list("categories");
  return all;
}
