// src/lib/api.js
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase";
import { dbCache } from "./sync/localdb";
import { upsert } from "./sync/SyncEngine";
import { getCurrentUserId } from "./session";

function ensureRestEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase REST config missing");
  }
}

function buildRestHeaders(asJson = false) {
  ensureRestEnv();
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  if (asJson) headers["Content-Type"] = "application/json";
  return headers;
}

function createRestUrl(path, params) {
  ensureRestEnv();
  const base = SUPABASE_URL.replace(/\/$/, "");
  if (!params) {
    return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  }
  const search = params.toString();
  return search
    ? `${base}${path.startsWith("/") ? "" : "/"}${path}?${search}`
    : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function readPostgrestError(response, fallbackMessage) {
  let message = fallbackMessage;
  try {
    const body = await response.json();
    if (body?.message) message = body.message;
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn("[HW] Failed parsing PostgREST error", error);
    }
  }
  const err = new Error(message);
  err.status = response.status;
  return err;
}

function parseOrderIndex(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function sanitizeIlike(value = "") {
  return String(value).replace(/[%_,()]/g, (m) => `\\${m}`);
}

function arrayify(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function startOfWeek(date = new Date()) {
  const clone = new Date(date);
  const day = clone.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  clone.setDate(clone.getDate() + diff);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

function formatDateInput(date) {
  if (!(date instanceof Date)) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextMonthStart(year, month) {
  const next = new Date(Date.UTC(year, month, 1));
  return formatDateInput(next);
}

function normalizeTransactionFilters(options = {}) {
  const search = options.search ?? options.q ?? "";
  const sort = options.sort ?? "date-desc";
  const page = Number.parseInt(options.page ?? 1, 10) || 1;
  const pageSize = Number.parseInt(options.pageSize ?? options.limit ?? 50, 10) || 50;

  let preset = options.period?.preset ?? options.range ?? null;
  let monthValue = options.period?.month ?? options.monthValue ?? null;
  let startDate = options.period?.start ?? options.startDate ?? options.date_from ?? null;
  let endDate = options.period?.end ?? options.endDate ?? options.date_to ?? null;

  if (!preset && options.month && options.month !== "all") {
    preset = "month";
    monthValue = options.month;
  }

  if (!preset && (startDate || endDate)) {
    preset = "custom";
  }

  if (!preset) preset = "all";

  if (preset === "month" && !monthValue) {
    const now = new Date();
    monthValue = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  const categoryInput = options.categories ?? options.category ?? [];
  let categories = [];
  if (Array.isArray(categoryInput)) {
    categories = categoryInput.filter(Boolean);
  } else if (typeof categoryInput === "string") {
    if (categoryInput !== "all" && categoryInput.trim() !== "") {
      categories = categoryInput
        .split(/[,\s]+/)
        .map((v) => v.trim())
        .filter(Boolean);
    }
  } else if (categoryInput != null) {
    categories = [categoryInput];
  }

  const type = options.type ?? "all";

  return {
    preset,
    month: monthValue,
    startDate: startDate || null,
    endDate: endDate || null,
    categories,
    type,
    sort,
    search,
    page,
    pageSize,
  };
}

function resolveDateRange(filters) {
  const { preset, month, startDate, endDate } = filters;
  if (preset === "month" && month) {
    const [yStr, mStr] = String(month).split("-");
    const y = Number.parseInt(yStr, 10);
    const m = Number.parseInt(mStr, 10);
    if (!Number.isNaN(y) && !Number.isNaN(m)) {
      const start = new Date(Date.UTC(y, m - 1, 1));
      const nextStart = new Date(Date.UTC(y, m, 1));
      return {
        from: formatDateInput(start),
        to: formatDateInput(new Date(nextStart.getTime() - 86400000)),
        toExclusive: nextMonthStart(y, m),
      };
    }
  }
  if (preset === "week") {
    const now = new Date();
    const start = startOfWeek(now);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      from: formatDateInput(start),
      to: formatDateInput(end),
      toExclusive: formatDateInput(new Date(end.getTime() + 86400000)),
    };
  }
  if (preset === "custom") {
    const from = startDate ? String(startDate).slice(0, 10) : null;
    const to = endDate ? String(endDate).slice(0, 10) : null;
    if (from && to) {
      const toDate = new Date(`${to}T00:00:00Z`);
      return {
        from,
        to,
        toExclusive: formatDateInput(new Date(toDate.getTime() + 86400000)),
      };
    }
    if (from) {
      return { from, to: null, toExclusive: null };
    }
    if (to) {
      return { from: null, to, toExclusive: formatDateInput(new Date(new Date(`${to}T00:00:00Z`).getTime() + 86400000)) };
    }
  }
  return { from: null, to: null, toExclusive: null };
}

function matchesDateRange(dateValue, range) {
  if (!range) return true;
  const { from, to, toExclusive } = range;
  if (!from && !to && !toExclusive) return true;
  if (!dateValue) return false;
  const dateStr = String(dateValue).slice(0, 10);
  if (from && dateStr < from) return false;
  if (toExclusive) {
    if (dateStr >= toExclusive) return false;
    return true;
  }
  if (to && dateStr > to) return false;
  return true;
}

export function mapTransactionRow(tx = {}) {
  if (!tx) return tx;
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
  const categoryColor =
    tx.category?.color ??
    tx.categories?.color ??
    tx.category_color ??
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

  const insertedAt =
    tx.inserted_at ??
    tx.insertedAt ??
    tx.created_at ??
    tx.createdAt ??
    tx.created ??
    tx.updated_at ??
    null;

  const note =
    tx.note ??
    tx.notes ??
    tx.title ??
    "";

  const tagsValue =
    tx.tags ??
    tx.tag_list ??
    tx.labels ??
    tx.label ??
    null;

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
    category_color: categoryColor,
    merchant: merchantName,
    merchant_id: merchantId,
    receipts,
    receipt_url: tx.receipt_url ?? null,
    parent_id: tx.parent_id ?? null,
    transfer_group_id: tx.transfer_group_id ?? null,
    deleted_at: tx.deleted_at ?? null,
    rev: tx.rev ?? null,
    updated_at: tx.updated_at ?? null,
    inserted_at: insertedAt,
    tags: typeof tagsValue === 'string' ? tagsValue : Array.isArray(tagsValue) ? tagsValue.filter(Boolean).join(',') : null,
  };
}

function filterTransactionsOffline(rows = [], filters = {}, userId) {
  const normalized = normalizeTransactionFilters(filters);
  const range = resolveDateRange(normalized);
  let list = rows
    .map(mapTransactionRow)
    .filter((row) => !row.deleted_at);

  if (userId) {
    list = list.filter((row) => !row.user_id || row.user_id === userId);
  }

  if (normalized.type && normalized.type !== "all") {
    list = list.filter((row) => row.type === normalized.type);
  }

  if (normalized.categories.length) {
    const set = new Set(normalized.categories);
    list = list.filter((row) => row.category_id && set.has(row.category_id));
  }

  if (range.from || range.to || range.toExclusive) {
    list = list.filter((row) => matchesDateRange(row.date, range));
  }

  if (normalized.search && normalized.search.trim()) {
    const needle = normalized.search.trim().toLowerCase();
    list = list.filter((row) => {
      const fields = [
        row.notes,
        row.note,
        row.title,
        row.merchant,
        row.account,
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());
      const amountMatch = String(row.amount ?? "")
        .toLowerCase()
        .includes(needle);
      return amountMatch || fields.some((field) => field.includes(needle));
    });
  }

  return list;
}

function sortTransactions(rows = [], sort = "date-desc") {
  const [field, direction] = sort.split("-");
  const asc = direction === "asc";
  const compareByDate = (a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    if (dateA === dateB) {
      const updatedA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const updatedB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      if (updatedA !== updatedB) {
        return asc ? updatedA - updatedB : updatedB - updatedA;
      }
      const insertedA = a.inserted_at ? new Date(a.inserted_at).getTime() : 0;
      const insertedB = b.inserted_at ? new Date(b.inserted_at).getTime() : 0;
      if (insertedA !== insertedB) {
        return asc ? insertedA - insertedB : insertedB - insertedA;
      }
    }
    return asc ? dateA - dateB : dateB - dateA;
  };
  const compare = (a, b) => {
    if (field === "amount") {
      if (a.amount === b.amount) {
        return compareByDate(a, b);
      }
      return asc ? a.amount - b.amount : b.amount - a.amount;
    }
    return compareByDate(a, b);
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
export async function listTransactions(options = {}) {
  const normalized = normalizeTransactionFilters(options);
  const { sort, page, pageSize } = normalized;
  const userId = await getCurrentUserId();
  if (!userId) {
    return { rows: [], total: 0, page, pageSize };
  }

  if (!navigator.onLine || window.__sync?.fakeOffline) {
    const cached = await dbCache.list("transactions");
    const filtered = filterTransactionsOffline(cached, normalized, userId);
    const sorted = sortTransactions(filtered, sort);
    const paged = paginate(sorted, page, pageSize);
    return { rows: paged, total: sorted.length, page, pageSize };
  }

  const range = resolveDateRange(normalized);

  const columns = `
    id,
    user_id,
    date,
    type,
    amount,
    title,
    notes,
    tags,
    account_id,
    to_account_id,
    category_id,
    merchant_id,
    parent_id,
    transfer_group_id,
    receipt_url,
    rev,
    inserted_at,
    updated_at,
    deleted_at,
    account:account_id (id, name, type),
    to_account:to_account_id (id, name, type),
    category:category_id (id, name, color),
    merchant:merchant_id (id, name),
    receipts:receipts (id, url, content_type, size, uploaded_at)
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
  if (orderField === "date") {
    query = query
      .order("updated_at", { ascending, nullsLast: !ascending })
      .order("inserted_at", { ascending, nullsLast: !ascending });
  }

  if (normalized.type && normalized.type !== "all") {
    query = query.eq("type", normalized.type);
  }
  if (normalized.categories.length) {
    query = query.in("category_id", normalized.categories);
  }
  if (range.from) {
    query = query.gte("date", range.from);
  }
  if (range.toExclusive) {
    query = query.lt("date", range.toExclusive);
  } else if (range.to) {
    query = query.lte("date", range.to);
  }
  if (normalized.search && normalized.search.trim()) {
    const like = `%${sanitizeIlike(normalized.search.trim())}%`;
    const numberCandidate = Number.parseFloat(normalized.search.replace(/[^0-9.-]/g, ""));
    if (!Number.isNaN(numberCandidate) && normalized.search.trim().match(/\d/)) {
      query = query.or(`title.ilike.${like},notes.ilike.${like},amount.eq.${numberCandidate}`);
    } else {
      query = query.or(`title.ilike.${like},notes.ilike.${like}`);
    }
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
    const filtered = filterTransactionsOffline(cached, normalized, userId);
    const sorted = sortTransactions(filtered, sort);
    const paged = paginate(sorted, page, pageSize);
    return { rows: paged, total: sorted.length, page, pageSize };
  }
}

export async function getTransactionsSummary(options = {}) {
  const normalized = normalizeTransactionFilters(options);
  const userId = await getCurrentUserId();
  if (!userId) {
    return { income: 0, expense: 0, net: 0 };
  }

  const accumulate = (rows = []) => {
    return rows.reduce(
      (acc, row) => {
        const amount = Number(row.amount ?? 0);
        if (row.type === "income") {
          acc.income += amount;
        } else if (row.type === "expense") {
          acc.expense += amount;
        }
        acc.net = acc.income - acc.expense;
        return acc;
      },
      { income: 0, expense: 0, net: 0 },
    );
  };

  if (!navigator.onLine || window.__sync?.fakeOffline) {
    const cached = await dbCache.list("transactions");
    const filtered = filterTransactionsOffline(cached, normalized, userId);
    return accumulate(filtered);
  }

  try {
    const range = resolveDateRange(normalized);
    let query = supabase
      .from("transactions")
      .select("type, amount")
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (normalized.type && normalized.type !== "all") {
      query = query.eq("type", normalized.type);
    }
    if (normalized.categories.length) {
      query = query.in("category_id", normalized.categories);
    }
    if (range.from) {
      query = query.gte("date", range.from);
    }
    if (range.toExclusive) {
      query = query.lt("date", range.toExclusive);
    } else if (range.to) {
      query = query.lte("date", range.to);
    }
    if (normalized.search && normalized.search.trim()) {
      const like = `%${sanitizeIlike(normalized.search.trim())}%`;
      const numberCandidate = Number.parseFloat(normalized.search.replace(/[^0-9.-]/g, ""));
      if (!Number.isNaN(numberCandidate) && normalized.search.trim().match(/\d/)) {
        query = query.or(`title.ilike.${like},notes.ilike.${like},amount.eq.${numberCandidate}`);
      } else {
        query = query.or(`title.ilike.${like},notes.ilike.${like}`);
      }
    }

    const { data, error } = await query.limit(5000);
    if (error) throw error;
    return accumulate(data || []);
  } catch (err) {
    console.error("getTransactionsSummary failed, falling back to cache", err);
    const cached = await dbCache.list("transactions");
    const filtered = filterTransactionsOffline(cached, normalized, userId);
    return accumulate(filtered);
  }
}

function normalizeTransactionInput(input = {}) {
  const noteValue = input.notes ?? input.note ?? null;
  const toNullable = (value) => {
    if (value == null) return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }
    return value;
  };
  return {
    id: input.id || crypto.randomUUID(),
    date: input.date ?? new Date().toISOString(),
    type: input.type ?? "expense",
    amount: Number(input.amount ?? 0),
    title: toNullable(input.title),
    notes: toNullable(noteValue),
    account_id: toNullable(input.account_id),
    to_account_id: toNullable(input.to_account_id),
    category_id: toNullable(input.category_id),
    merchant_id: toNullable(input.merchant_id),
    parent_id: toNullable(input.parent_id),
    transfer_group_id: toNullable(input.transfer_group_id),
    receipt_url: toNullable(input.receipt_url),
    rev: input.rev ?? null,
  };
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

const CATEGORY_REST_SELECT = "id,user_id,type,name,color,inserted_at,group_name,order_index";
const CATEGORY_REST_ORDER_PARAMS = [
  "order_index.asc.nullsfirst",
  "name.asc"
];

const CATEGORY_DEFAULT_COLOR = "#64748B";

function normalizeCategoryColor(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    const hex = trimmed
      .slice(1)
      .split("")
      .map((char) => char + char)
      .join("");
    return `#${hex.toUpperCase()}`;
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return trimmed;
}

let categoryViewUnavailable = false;
let categoryFallbackWarned = false;

function mapCategoryRow(row = {}, userId) {
  const groupValue =
    typeof row.group_name === "string"
      ? row.group_name
      : typeof row.group === "string"
      ? row.group
      : null;
  const typeFromGroup = typeof groupValue === "string" ? groupValue.toLowerCase() : "";
  const rawType = row.type ?? row.category_type;
  const inferredType = rawType
    ? rawType
    : typeFromGroup.includes("income")
    ? "income"
    : typeFromGroup.includes("expense")
    ? "expense"
    : undefined;
  let normalizedType = typeof inferredType === "string" ? inferredType.toLowerCase() : "";
  if (!normalizedType || !["income", "expense"].includes(normalizedType)) {
    normalizedType = "expense";
  }
  const rawOrder = row.order_index ?? row.sort_order;
  const orderIndex = parseOrderIndex(rawOrder);
  const colorValue = row.color ?? row.category_color ?? null;
  return {
    id: row.id,
    user_id: row.user_id ?? userId ?? null,
    name: row.name ?? row.title ?? row.label ?? "",
    type: normalizedType,
    group: groupValue ?? null,
    order_index: orderIndex,
    inserted_at: row.inserted_at ?? row.created_at ?? null,
    color: normalizeCategoryColor(colorValue) ?? CATEGORY_DEFAULT_COLOR,
  };
}

async function fetchCategoriesFromRest(userId, type) {
  const params = new URLSearchParams({
    select: CATEGORY_REST_SELECT,
    user_id: `eq.${userId}`,
  });
  CATEGORY_REST_ORDER_PARAMS.forEach((order) => {
    params.append("order", order);
  });
  if (type === "income" || type === "expense") {
    params.set("type", `eq.${type}`);
  }
  const headers = buildRestHeaders();

  if (!categoryViewUnavailable) {
    const viewUrl = createRestUrl("/rest/v1/v_categories_budget", params);
    const response = await fetch(viewUrl, { headers });
    if (response.status === 404) {
      categoryViewUnavailable = true;
      if (!categoryFallbackWarned) {
        console.warn("v_categories_budget missing — using fallback /categories");
        categoryFallbackWarned = true;
      }
    } else if (response.status === 400) {
      const bodyText = await response.clone().text();
      const missingColumn =
        /column/iu.test(bodyText) && /does not exist/iu.test(bodyText);
      if (missingColumn) {
        categoryViewUnavailable = true;
        if (!categoryFallbackWarned) {
          console.warn(
            "v_categories_budget missing expected columns — using fallback /categories"
          );
          categoryFallbackWarned = true;
        }
      } else {
        throw await readPostgrestError(response, "Gagal memuat kategori");
      }
    } else if (!response.ok) {
      throw await readPostgrestError(response, "Gagal memuat kategori");
    } else {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    }
  }

  const fallbackUrl = createRestUrl("/rest/v1/categories", params);
  const fallbackResponse = await fetch(fallbackUrl, { headers });
  if (fallbackResponse.status === 404) {
    throw new Error("Endpoint kategori belum tersedia");
  }
  if (!fallbackResponse.ok) {
    throw await readPostgrestError(fallbackResponse, "Gagal memuat kategori");
  }
  const fallbackData = await fallbackResponse.json();
  return Array.isArray(fallbackData) ? fallbackData : [];
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
    const remoteRows = await fetchCategoriesFromRest(userId, type);
    const rows = remoteRows.map((row) => mapCategoryRow(row, userId));
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
export async function addCategory({ type, name, group = null, order_index = null }) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Pengguna belum masuk");
  const normalizedType = typeof type === "string" ? type.toLowerCase() : "";
  const finalType = normalizedType === "income" ? "income" : "expense";
  let orderIndex = null;
  if (typeof order_index === "number" && Number.isFinite(order_index)) {
    orderIndex = order_index;
  } else if (typeof order_index === "string") {
    const parsed = Number.parseInt(order_index.trim(), 10);
    if (Number.isFinite(parsed)) orderIndex = parsed;
  }
  const record = {
    id: crypto.randomUUID(),
    user_id: userId,
    type: finalType,
    name,
    group,
    order_index: orderIndex,
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
      group: prev?.group ?? null,
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
      group: prev?.group ?? null,
    });
  });
  for (const row of rows) {
    await upsert("categories", row);
  }
  return listCategories();
}

// -- ACCOUNTS ------------------------------------------

function parseSortOrder(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function sortAccountRows(list = []) {
  const getOrderValue = (value) => {
    const parsed = parseSortOrder(value);
    return typeof parsed === "number" ? parsed : Number.POSITIVE_INFINITY;
  };
  const getCreatedValue = (value) => {
    if (!value) return Number.POSITIVE_INFINITY;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
  };

  return [...list].sort((a, b) => {
    const orderA = getOrderValue(a?.sort_order);
    const orderB = getOrderValue(b?.sort_order);
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    const createdA = getCreatedValue(a?.created_at);
    const createdB = getCreatedValue(b?.created_at);
    if (createdA !== createdB) {
      return createdA - createdB;
    }
    return (a?.name ?? "").localeCompare(b?.name ?? "", "id", { sensitivity: "base" });
  });
}

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
    sort_order: parseSortOrder(row.sort_order ?? row.order_index ?? row.order),
  };
}

export async function listAccounts() {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  if (!navigator.onLine || window.__sync?.fakeOffline) {
    const cached = await dbCache.list("accounts");
    return sortAccountRows(cached.map((row) => mapAccountRow(row, userId)));
  }

  try {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    const rows = (data || []).map((row) => mapAccountRow(row, userId));
    const sorted = sortAccountRows(rows);
    await dbCache.bulkSet("accounts", sorted);
    return sorted;
  } catch (err) {
    console.error("listAccounts failed, falling back to cache", err);
    const cached = await dbCache.list("accounts");
    return sortAccountRows(cached.map((row) => mapAccountRow(row, userId)));
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
