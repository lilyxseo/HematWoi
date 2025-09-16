// src/lib/api.js
import { supabase } from "./supabase";
import { dbCache } from "./sync/localdb";
import { upsert } from "./sync/SyncEngine";
import { getCurrentUserId } from "./session";

function sanitizeIlike(value = "") {
  return String(value).replace(/[%_]/g, (m) => `\\${m}`);
}

function toMonthRange(month) {
  if (!month) return null;
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return null;
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

function arrayify(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

export function mapTransactionRow(tx = {}) {
  if (!tx) return tx;
  const joinedTags = Array.isArray(tx.transaction_tags)
    ? tx.transaction_tags
        .map((item) => item?.tag || item)
        .filter(Boolean)
    : [];
  const tags = Array.isArray(tx.tags)
    ? tx.tags
    : joinedTags.map((t) => t.name).filter(Boolean);
  const tagIds = Array.isArray(tx.tag_ids)
    ? tx.tag_ids
    : joinedTags.map((t) => t.id).filter(Boolean);
  const receipts = Array.isArray(tx.receipts)
    ? tx.receipts.map((r) => ({
        id: r.id ?? r.receipt_id ?? null,
        url: r.url ?? r.public_url ?? r.path ?? null,
        content_type: r.content_type ?? r.mime_type ?? null,
        size: r.size ?? r.bytes ?? null,
        uploaded_at: r.uploaded_at ?? r.created_at ?? null,
      }))
    : [];
  const categoryName =
    tx.category?.name ??
    tx.categories?.name ??
    tx.category_name ??
    tx.category ??
    null;
  const categoryId =
    tx.category_id ??
    tx.category?.id ??
    tx.categories?.id ??
    null;
  const accountName =
    tx.account?.name ??
    tx.accounts?.name ??
    tx.account_name ??
    tx.account ??
    null;
  const accountId =
    tx.account_id ??
    tx.account?.id ??
    tx.accounts?.id ??
    null;
  const toAccountName =
    tx.to_account?.name ??
    tx.to_accounts?.name ??
    tx.to_account_name ??
    tx.to_account ??
    null;
  const toAccountId =
    tx.to_account_id ??
    tx.to_account?.id ??
    tx.to_accounts?.id ??
    null;
  const merchantName =
    tx.merchant?.name ??
    tx.merchants?.name ??
    tx.merchant_name ??
    tx.merchant ??
    null;
  const merchantId =
    tx.merchant_id ??
    tx.merchant?.id ??
    tx.merchants?.id ??
    null;

  const createdAt =
    tx.created_at ??
    tx.createdAt ??
    tx.inserted_at ??
    tx.insertedAt ??
    tx.created ??
    tx.updated_at ??
    null;

  const note =
    tx.note ??
    tx.notes ??
    tx.title ??
    "";

  return {
    id: tx.id,
    user_id: tx.user_id ?? null,
    date: tx.date ?? null,
    type: tx.type ?? null,
    amount: Number(tx.amount ?? 0),
    note,
    title: tx.title ?? null,
    notes: tx.notes ?? null,
    account: accountName,
    account_id: accountId,
    to_account: toAccountName,
    to_account_id: toAccountId,
    category: categoryName,
    category_id: categoryId,
    merchant: merchantName,
    merchant_id: merchantId,
    tags,
    tag_ids: tagIds,
    receipts,
    receipt_url: tx.receipt_url ?? null,
    parent_id: tx.parent_id ?? null,
    transfer_group_id: tx.transfer_group_id ?? null,
    deleted_at: tx.deleted_at ?? null,
    rev: tx.rev ?? null,
    updated_at: tx.updated_at ?? null,
    created_at: createdAt,
  };
}

function filterTransactionsOffline(rows = [], filters = {}, userId) {
  const { type = "all", month = "all", category = "all", q } = filters;
  let list = rows
    .map(mapTransactionRow)
    .filter((row) => !row.deleted_at);
  if (userId) {
    list = list.filter((row) => !row.user_id || row.user_id === userId);
  }
  if (type && type !== "all") {
    list = list.filter((row) => row.type === type);
  }
  if (month && month !== "all") {
    list = list.filter((row) =>
      row.date ? String(row.date).slice(0, 7) === month : false
    );
  }
  if (category && category !== "all") {
    list = list.filter(
      (row) => row.category_id === category || row.category === category
    );
  }
  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    list = list.filter((row) => {
      const fields = [
        row.note,
        row.title,
        row.merchant,
        row.account,
        ...(Array.isArray(row.tags) ? row.tags : []),
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());
      return fields.some((field) => field.includes(needle));
    });
  }
  return list;
}

function sortTransactions(rows = [], sort = "date-desc") {
  const [field, direction] = sort.split("-");
  const asc = direction === "asc";
  const compare = (a, b) => {
    if (field === "amount") {
      return asc ? a.amount - b.amount : b.amount - a.amount;
    }
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return asc ? dateA - dateB : dateB - dateA;
  };
  return [...rows].sort(compare);
}

function paginate(rows = [], page = 1, pageSize = 20) {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return rows.slice(start, end);
}

/**
 * List transaksi dari Supabase dengan filter & pagination.
 * Fallback ke cache jika offline.
 */
export async function listTransactions(
  { type, month, category, sort = "date-desc", q, page = 1, pageSize = 20 } = {},
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { rows: [], total: 0, page: 1, pageSize };
  }

  if (!navigator.onLine || window.__sync?.fakeOffline) {
    const cached = await dbCache.list("transactions");
    const filtered = filterTransactionsOffline(cached, { type, month, category, q }, userId);
    const sorted = sortTransactions(filtered, sort);
    const paged = paginate(sorted, page, pageSize);
    return { rows: paged, total: sorted.length, page, pageSize };
  }

  const columns = `
    id,
    user_id,
    date,
    type,
    amount,
    title,
    notes,
    account_id,
    to_account_id,
    category_id,
    merchant_id,
    parent_id,
    transfer_group_id,
    receipt_url,
    rev,
    updated_at,
    deleted_at,
    account:account_id (*),
    to_account:to_account_id (*),
    category:category_id (*),
    merchant:merchant_id (*),
    transaction_tags:transaction_tags ( tag:tag_id (*) ),
    receipts:receipts (*)
  `;

  let query = supabase
    .from("transactions")
    .select(columns, { count: "exact" })
    .eq("user_id", userId)
    .is("deleted_at", null);

  const [sortField, sortDir] = sort.split("-");
  const ascending = sortDir === "asc";
  const orderField = sortField === "amount" ? "amount" : "date";
  query = query.order(orderField, { ascending });

  if (type && type !== "all") {
    query = query.eq("type", type);
  }
  if (month && month !== "all") {
    const range = toMonthRange(month);
    if (range) {
      query = query.gte("date", range.start).lt("date", range.end);
    }
  }
  if (category && category !== "all") {
    query = query.eq("category_id", category);
  }
  if (q && q.trim()) {
    const like = `%${sanitizeIlike(q.trim())}%`;
    query = query.or(`title.ilike.${like},notes.ilike.${like}`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    const rows = (data || []).map(mapTransactionRow);
    await dbCache.bulkSet("transactions", rows);
    return { rows, total: count || 0, page, pageSize };
  } catch (err) {
    console.error("listTransactions failed, falling back to cache", err);
    const cached = await dbCache.list("transactions");
    const filtered = filterTransactionsOffline(cached, { type, month, category, q }, userId);
    const sorted = sortTransactions(filtered, sort);
    const paged = paginate(sorted, page, pageSize);
    return { rows: paged, total: sorted.length, page, pageSize };
  }
}

function normalizeTransactionInput(input = {}) {
  const noteValue = input.notes ?? input.note ?? null;
  return {
    id: input.id || crypto.randomUUID(),
    date: input.date ?? new Date().toISOString(),
    type: input.type ?? "expense",
    amount: Number(input.amount ?? 0),
    title: input.title ?? null,
    notes: noteValue,
    account_id: input.account_id ?? null,
    to_account_id: input.to_account_id ?? null,
    category_id: input.category_id ?? null,
    merchant_id: input.merchant_id ?? null,
    parent_id: input.parent_id ?? null,
    transfer_group_id: input.transfer_group_id ?? null,
    receipt_url: input.receipt_url ?? null,
    rev: input.rev ?? null,
    created_at: input.created_at ?? new Date().toISOString(),
  };
}

async function syncTransactionTags(transactionId, tagIds = [], userId) {
  if (!transactionId) return;
  const tags = arrayify(tagIds).filter(Boolean);
  if (!tags.length) {
    return;
  }
  if (typeof navigator !== "undefined" && (!navigator.onLine || window.__sync?.fakeOffline)) {
    return;
  }
  const rows = tags.map((tagId) => ({
    transaction_id: transactionId,
    tag_id: tagId,
    user_id: userId,
  }));
  const { error } = await supabase
    .from("transaction_tags")
    .upsert(rows, { onConflict: "transaction_id,tag_id" });
  if (error) throw error;
}

async function syncTransactionReceipts(transactionId, receipts = [], userId) {
  const rows = arrayify(receipts)
    .map((r) => ({
      id: r.id || crypto.randomUUID(),
      transaction_id: transactionId,
      user_id: userId,
      url: r.url ?? null,
      content_type: r.content_type ?? r.contentType ?? null,
      size: r.size ?? null,
      uploaded_at: r.uploaded_at ?? r.uploadedAt ?? new Date().toISOString(),
    }))
    .filter((row) => row.url);
  if (!rows.length) return;
  if (typeof navigator !== "undefined" && (!navigator.onLine || window.__sync?.fakeOffline)) {
    return;
  }
  const { error } = await supabase.from("receipts").upsert(rows);
  if (error) throw error;
}

/** Insert transaksi baru */
export async function addTransaction(input = {}) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Pengguna belum masuk");
  const base = normalizeTransactionInput(input);
  if (base.type !== "transfer") {
    base.to_account_id = null;
  }
  base.user_id = userId;
  base.updated_at = new Date().toISOString();
  const saved = await upsert("transactions", base);
  try {
    await syncTransactionTags(saved.id, input.tags ?? input.tag_ids, userId);
    await syncTransactionReceipts(saved.id, input.receipts, userId);
  } catch (err) {
    console.error("Failed to sync related data for transaction", err);
  }
  return mapTransactionRow(saved);
}

/** Update transaksi by id */
export async function updateTransaction(id, patch = {}) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Pengguna belum masuk");
  const base = normalizeTransactionInput({ ...patch, id });
  base.user_id = userId;
  base.updated_at = new Date().toISOString();
  const saved = await upsert("transactions", base);
  if (patch.tags) {
    try {
      await syncTransactionTags(id, patch.tags, userId);
    } catch (err) {
      console.error("Failed to update transaction tags", err);
    }
  }
  if (patch.receipts) {
    try {
      await syncTransactionReceipts(id, patch.receipts, userId);
    } catch (err) {
      console.error("Failed to update receipts", err);
    }
  }
  return mapTransactionRow(saved);
}

/** Soft delete transaksi by id */
export async function deleteTransaction(id) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Pengguna belum masuk");
  const now = new Date().toISOString();
  await upsert("transactions", {
    id,
    user_id: userId,
    deleted_at: now,
    updated_at: now,
  });
}

// -- CATEGORIES ----------------------------------------

function mapCategoryRow(row = {}, userId) {
  const typeFromGroup = typeof row.group === "string" ? row.group.toLowerCase() : "";
  const inferredType = row.type
    ? row.type
    : typeFromGroup.includes("income")
    ? "income"
    : typeFromGroup.includes("expense")
    ? "expense"
    : undefined;
  return {
    id: row.id,
    user_id: row.user_id ?? userId ?? null,
    name: row.name ?? row.title ?? row.label ?? "",
    type: inferredType ?? row.category_type ?? "expense",
    group: row.group ?? null,
    order_index: row.order_index ?? row.sort_order ?? null,
    color: row.color ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

/** List kategori */
export async function listCategories(type) {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  if (!navigator.onLine || window.__sync?.fakeOffline) {
    const cached = await dbCache.list("categories");
    const mapped = cached.map((row) => mapCategoryRow(row, userId));
    return type ? mapped.filter((r) => r.type === type) : mapped;
  }

  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", userId);
    if (error) throw error;
    const rows = (data || []).map((row) => mapCategoryRow(row, userId));
    rows.sort((a, b) => {
      const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
    await dbCache.bulkSet("categories", rows);
    return type ? rows.filter((r) => r.type === type) : rows;
  } catch (err) {
    console.error("listCategories failed, falling back to cache", err);
    const cached = await dbCache.list("categories");
    const mapped = cached.map((row) => mapCategoryRow(row, userId));
    return type ? mapped.filter((r) => r.type === type) : mapped;
  }
}

/** Tambah satu kategori */
export async function addCategory({ type, name, group = null, order_index = null, color = null }) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Pengguna belum masuk");
  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    user_id: userId,
    type,
    name,
    group,
    order_index,
    color,
    updated_at: now,
    created_at: now,
  };
  const saved = await upsert("categories", record);
  return mapCategoryRow(saved, userId);
}

/** Upsert daftar kategori income/expense */
export async function upsertCategories({ income = [], expense = [] }) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Pengguna belum masuk");
  const existing = await dbCache.list("categories");
  const index = new Map(
    existing
      .filter((row) => row.user_id === userId)
      .map((row) => [`${(row.type || "").toLowerCase()}:${(row.name || "").toLowerCase()}`, row]),
  );
  const now = new Date().toISOString();
  const rows = [];
  income.forEach((name, order) => {
    const key = `income:${String(name).toLowerCase()}`;
    const prev = index.get(key);
    rows.push({
      id: prev?.id || crypto.randomUUID(),
      user_id: userId,
      type: "income",
      name,
      order_index: order,
      updated_at: now,
      created_at: prev?.created_at ?? now,
    });
  });
  expense.forEach((name, order) => {
    const key = `expense:${String(name).toLowerCase()}`;
    const prev = index.get(key);
    rows.push({
      id: prev?.id || crypto.randomUUID(),
      user_id: userId,
      type: "expense",
      name,
      order_index: order,
      updated_at: now,
      created_at: prev?.created_at ?? now,
    });
  });
  for (const row of rows) {
    await upsert("categories", row);
  }
  return listCategories();
}

// -- ACCOUNTS ------------------------------------------

function mapAccountRow(row = {}, userId) {
  return {
    id: row.id,
    user_id: row.user_id ?? userId ?? null,
    name: row.name ?? row.title ?? row.label ?? "",
    type: row.type ?? row.account_type ?? null,
    currency: row.currency ?? row.account_currency ?? row.currency_code ?? "IDR",
    balance: Number(row.balance ?? row.current_balance ?? row.initial_balance ?? 0),
    is_archived: row.is_archived ?? row.archived ?? false,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export async function listAccounts() {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  if (!navigator.onLine || window.__sync?.fakeOffline) {
    const cached = await dbCache.list("accounts");
    return cached.map((row) => mapAccountRow(row, userId));
  }

  try {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true });
    if (error) throw error;
    const rows = (data || []).map((row) => mapAccountRow(row, userId));
    await dbCache.bulkSet("accounts", rows);
    return rows;
  } catch (err) {
    console.error("listAccounts failed, falling back to cache", err);
    const cached = await dbCache.list("accounts");
    return cached.map((row) => mapAccountRow(row, userId));
  }
}

// -- MERCHANTS -----------------------------------------

function mapMerchantRow(row = {}, userId) {
  return {
    id: row.id,
    user_id: row.user_id ?? userId ?? null,
    name: row.name ?? row.title ?? "",
    category_id: row.category_id ?? null,
    notes: row.notes ?? row.note ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export async function listMerchants() {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  if (!navigator.onLine || window.__sync?.fakeOffline) {
    const cached = await dbCache.list("merchants");
    return cached.map((row) => mapMerchantRow(row, userId));
  }

  try {
    const { data, error } = await supabase
      .from("merchants")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true });
    if (error) throw error;
    const rows = (data || []).map((row) => mapMerchantRow(row, userId));
    await dbCache.bulkSet("merchants", rows);
    return rows;
  } catch (err) {
    console.error("listMerchants failed, falling back to cache", err);
    const cached = await dbCache.list("merchants");
    return cached.map((row) => mapMerchantRow(row, userId));
  }
}

export async function saveMerchant({ id, name, category_id = null, notes = null }) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Pengguna belum masuk");
  if (!name) throw new Error("Nama merchant wajib diisi");
  const now = new Date().toISOString();
  const record = {
    id: id || crypto.randomUUID(),
    user_id: userId,
    name,
    category_id,
    notes,
    updated_at: now,
    created_at: id ? undefined : now,
  };
  const saved = await upsert("merchants", record);
  return mapMerchantRow(saved, userId);
}

// -- TAGS ----------------------------------------------

function mapTagRow(row = {}, userId) {
  return {
    id: row.id,
    user_id: row.user_id ?? userId ?? null,
    name: row.name ?? row.title ?? "",
    color: row.color ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export async function listTags() {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  if (!navigator.onLine || window.__sync?.fakeOffline) {
    const cached = await dbCache.list("tags");
    return cached.map((row) => mapTagRow(row, userId));
  }

  try {
    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true });
    if (error) throw error;
    const rows = (data || []).map((row) => mapTagRow(row, userId));
    await dbCache.bulkSet("tags", rows);
    return rows;
  } catch (err) {
    console.error("listTags failed, falling back to cache", err);
    const cached = await dbCache.list("tags");
    return cached.map((row) => mapTagRow(row, userId));
  }
}

export async function addTag({ name, color = null }) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Pengguna belum masuk");
  if (!name) throw new Error("Nama tag wajib diisi");
  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    user_id: userId,
    name,
    color,
    updated_at: now,
    created_at: now,
  };
  const saved = await upsert("tags", record);
  return mapTagRow(saved, userId);
}
