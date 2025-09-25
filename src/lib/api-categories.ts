import { supabase } from "./supabase";
import { dbCache } from "./sync/localdb";
import { getCurrentUserId } from "./session";
import { LocalDriver } from "./data-driver";

export type CategoryType = "income" | "expense";

export interface CategoryRecord {
  id: string;
  user_id: string | null;
  name: string;
  type: CategoryType;
  order_index: number | null;
  inserted_at: string | null;
  group_name: string | null;
}

const BASE_SELECT = `
  id,
  user_id,
  name,
  type,
  order_index,
  inserted_at,
  "group" as group_name
`;

const guestDriver = new LocalDriver();

const isDevelopment = Boolean(
  (typeof import.meta !== "undefined" && import.meta.env?.DEV) ||
    (typeof process !== "undefined" && process.env?.NODE_ENV === "development")
);

function logDevError(scope: string, error: unknown) {
  if (isDevelopment) {
    console.error(`[HW] ${scope}`, error);
  }
}

function toError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    const wrapped = new Error(error.message);
    (wrapped as { cause?: unknown }).cause = error.cause ?? error;
    return wrapped;
  }
  if (typeof error === "string") {
    return new Error(error);
  }
  return new Error(fallback);
}

function normalizeName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeType(value: unknown): CategoryType {
  return value === "income" ? "income" : "expense";
}

function normalizeGroupName(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeOrderIndex(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapCategoryRow(row: Record<string, unknown>): CategoryRecord {
  return {
    id: String(row.id ?? ""),
    user_id: typeof row.user_id === "string" ? row.user_id : null,
    name: normalizeName(row.name),
    type: normalizeType(row.type),
    order_index: normalizeOrderIndex(row.order_index),
    inserted_at: typeof row.inserted_at === "string" ? row.inserted_at : null,
    group_name: normalizeGroupName(row.group_name ?? (row as { group?: unknown }).group),
  };
}

function sortCategories(rows: CategoryRecord[]): CategoryRecord[] {
  return [...rows].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

function nowISO(): string {
  return new Date().toISOString();
}

async function resolveUserId(): Promise<string | null> {
  try {
    return await getCurrentUserId();
  } catch (error) {
    logDevError("resolveUserId", error);
    return null;
  }
}

async function listGuestCategories(): Promise<CategoryRecord[]> {
  const rows = await guestDriver.list("categories");
  const mapped = (rows ?? []).map((row) =>
    mapCategoryRow(row as Record<string, unknown>)
  );
  return sortCategories(mapped);
}

async function ensureGuestUniqueName(
  type: CategoryType,
  name: string,
  excludeId?: string
): Promise<void> {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return;
  const rows = await listGuestCategories();
  const conflict = rows.find(
    (row) =>
      row.type === type &&
      row.id !== excludeId &&
      row.name.trim().toLowerCase() === normalized
  );
  if (conflict) {
    throw new Error("Nama kategori sudah digunakan pada tipe ini.");
  }
}

async function createGuestCategory(input: {
  name: string;
  type: CategoryType;
  group_name?: string | null;
  order_index?: number | null;
}): Promise<CategoryRecord> {
  const rows = await listGuestCategories();
  const nextOrder =
    input.order_index ??
    rows
      .filter((row) => row.type === input.type)
      .reduce((max, row) => Math.max(max, row.order_index ?? -1), -1) + 1;

  await ensureGuestUniqueName(input.type, input.name);

  const payload: Record<string, unknown> = {
    name: input.name,
    type: input.type,
    order_index: nextOrder,
    inserted_at: nowISO(),
    group_name: normalizeGroupName(input.group_name),
    user_id: null,
  };

  const inserted = await guestDriver.insert("categories", payload);
  const record = mapCategoryRow(inserted as Record<string, unknown>);
  await dbCache.set("categories", record);
  return record;
}

async function updateGuestCategory(
  id: string,
  patch: {
    name?: string;
    type?: CategoryType;
    group_name?: string | null;
    order_index?: number | null;
  }
): Promise<CategoryRecord> {
  const existing = await guestDriver.get("categories", id);
  if (!existing) {
    throw new Error("Kategori tidak ditemukan.");
  }
  const current = mapCategoryRow(existing as Record<string, unknown>);

  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const normalized = normalizeName(patch.name);
    if (!normalized) {
      throw new Error("Nama kategori wajib.");
    }
    await ensureGuestUniqueName(current.type, normalized, current.id);
    updates.name = normalized;
  }
  if (patch.type !== undefined) {
    updates.type = normalizeType(patch.type);
  }
  if (patch.group_name !== undefined) {
    updates.group_name = normalizeGroupName(patch.group_name);
  }
  if (patch.order_index !== undefined) {
    updates.order_index = normalizeOrderIndex(patch.order_index);
  }

  if (!Object.keys(updates).length) {
    return current;
  }

  const updated = await guestDriver.update("categories", id, updates);
  const record = mapCategoryRow(updated as Record<string, unknown>);
  await dbCache.set("categories", record);
  return record;
}

async function deleteGuestCategory(id: string): Promise<void> {
  await guestDriver.softDelete("categories", id);
  await dbCache.remove("categories", id);
}

async function reorderGuestCategories(
  type: CategoryType,
  orderedIds: string[]
): Promise<void> {
  if (!orderedIds.length) return;
  const normalizedType = normalizeType(type);
  const updates = orderedIds.map((id, index) => ({
    id,
    type: normalizedType,
    order_index: index,
  }));
  await Promise.all(
    updates.map((item) => guestDriver.update("categories", item.id, item))
  );
  const rows = await listGuestCategories();
  await dbCache.bulkSet("categories", rows);
}

async function assertUniqueName(
  userId: string,
  type: CategoryType,
  name: string,
  excludeId?: string
) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, type")
    .eq("user_id", userId)
    .eq("type", type)
    .ilike("name", name)
    .limit(10);
  if (error) throw error;
  const normalized = name.trim().toLowerCase();
  const conflict = (data ?? []).find((row) => {
    if (excludeId && row.id === excludeId) return false;
    return (row.name ?? "").trim().toLowerCase() === normalized;
  });
  if (conflict) {
    throw new Error("Nama kategori sudah digunakan pada tipe ini.");
  }
}

export async function listCategories(
  signal?: AbortSignal
): Promise<CategoryRecord[]> {
  if (signal?.aborted) {
    return [];
  }

  const userId = await resolveUserId();
  if (!userId) {
    return listGuestCategories();
  }

  try {
    let query = supabase
      .from("categories")
      .select(BASE_SELECT)
      .eq("user_id", userId)
      .order("type", { ascending: true })
      .order("order_index", { ascending: true, nullsFirst: true })
      .order("name", { ascending: true });

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []).map((row) => mapCategoryRow(row as Record<string, unknown>));
    await dbCache.bulkSet("categories", rows);
    return rows;
  } catch (error) {
    if (signal?.aborted) {
      return [];
    }
    logDevError("listCategories", error);
    const cached = await dbCache.list("categories");
    const filtered = cached
      .map((row) => mapCategoryRow(row))
      .filter((row) => row.user_id === userId);
    if (filtered.length) {
      return sortCategories(filtered);
    }
    throw toError(error, "Gagal memuat kategori.");
  }
}

export async function createCategory(payload: {
  name: string;
  type: CategoryType;
  group_name?: string | null;
  order_index?: number | null;
}): Promise<CategoryRecord> {
  const name = normalizeName(payload.name);
  if (!name) {
    throw new Error("Nama kategori wajib.");
  }
  if (!["income", "expense"].includes(payload.type)) {
    throw new Error("Tipe kategori tidak valid.");
  }

  const userId = await resolveUserId();
  if (!userId) {
    return createGuestCategory({
      name,
      type: normalizeType(payload.type),
      group_name: payload.group_name ?? null,
      order_index: normalizeOrderIndex(payload.order_index),
    });
  }

  await assertUniqueName(userId, payload.type, name);

  const body: Record<string, unknown> = {
    user_id: userId,
    name,
    type: payload.type,
  };

  const orderIndex = normalizeOrderIndex(payload.order_index);
  if (orderIndex !== null) {
    body.order_index = orderIndex;
  } else {
    const { data: lastRows, error: lastError } = await supabase
      .from("categories")
      .select("order_index")
      .eq("user_id", userId)
      .eq("type", payload.type)
      .order("order_index", { ascending: false, nullsFirst: false })
      .limit(1);
    if (lastError) throw lastError;
    const lastValue = normalizeOrderIndex(lastRows?.[0]?.order_index ?? null);
    body.order_index = (lastValue ?? -1) + 1;
  }

  const groupName = normalizeGroupName(payload.group_name);
  if (groupName !== null) {
    body["group"] = groupName;
  }

  const { data, error } = await supabase
    .from("categories")
    .insert([body])
    .select(BASE_SELECT)
    .single();
  if (error) throw error;

  const record = mapCategoryRow((data ?? {}) as Record<string, unknown>);
  await dbCache.set("categories", record);
  return record;
}

export async function updateCategory(
  id: string,
  patch: {
    name?: string;
    type?: CategoryType;
    group_name?: string | null;
    order_index?: number | null;
  }
): Promise<CategoryRecord> {
  const userId = await resolveUserId();
  if (!userId) {
    return updateGuestCategory(id, patch);
  }

  const { data: currentRow, error: currentError } = await supabase
    .from("categories")
    .select("name, type")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!currentRow) {
    throw new Error("Kategori tidak ditemukan.");
  }

  const currentType = normalizeType(currentRow.type);
  const currentName = normalizeName(currentRow.name);
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const normalized = normalizeName(patch.name);
    if (!normalized) {
      throw new Error("Nama kategori wajib.");
    }
    const typeForValidation = patch.type ? normalizeType(patch.type) : currentType;
    await assertUniqueName(userId, typeForValidation, normalized, id);
    dbPatch.name = normalized;
  }
  if (patch.type !== undefined) {
    const normalizedTypeValue = normalizeType(patch.type);
    dbPatch.type = normalizedTypeValue;
    const targetName = (dbPatch.name as string | undefined) ?? currentName;
    await assertUniqueName(userId, normalizedTypeValue, targetName, id);
  }
  if (patch.group_name !== undefined) {
    dbPatch["group"] = normalizeGroupName(patch.group_name);
  }
  if (patch.order_index !== undefined) {
    dbPatch.order_index = normalizeOrderIndex(patch.order_index);
  }

  if (!Object.keys(dbPatch).length) {
    const cached = await dbCache.get("categories", id);
    if (cached) {
      return mapCategoryRow(cached as Record<string, unknown>);
    }
  }

  const { data, error } = await supabase
    .from("categories")
    .update(dbPatch)
    .eq("id", id)
    .eq("user_id", userId)
    .select(BASE_SELECT)
    .single();
  if (error) throw error;

  const record = mapCategoryRow((data ?? {}) as Record<string, unknown>);
  await dbCache.set("categories", record);
  return record;
}

export async function reorderCategories(
  type: CategoryType,
  orderedIds: string[]
): Promise<void> {
  if (!orderedIds.length) return;

  const userId = await resolveUserId();
  if (!userId) {
    await reorderGuestCategories(type, orderedIds);
    return;
  }

  const payload = orderedIds.map((id, index) => ({
    id,
    user_id: userId,
    order_index: index,
  }));

  const { error, data } = await supabase
    .from("categories")
    .upsert(payload, { onConflict: "id" })
    .select(BASE_SELECT);
  if (error) throw error;
  if (data) {
    await dbCache.bulkSet(
      "categories",
      data.map((row) => mapCategoryRow(row as Record<string, unknown>))
    );
  }
}

export async function deleteCategory(id: string): Promise<void> {
  const userId = await resolveUserId();
  if (!userId) {
    await deleteGuestCategory(id);
    return;
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
  await dbCache.remove("categories", id);
}
