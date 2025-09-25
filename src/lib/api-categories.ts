import { supabase } from "./supabase";
import { dbCache } from "./sync/localdb";
import { getCurrentUserId } from "./session";
import { LocalDriver } from "./data-driver";

type CategoryType = "income" | "expense";

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

function normalizeType(value: unknown): CategoryType {
  return value === "income" ? "income" : "expense";
}

function normalizeName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeOrderIndex(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function normalizeGroupName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function mapCategoryRow(
  row: Partial<CategoryRecord> & Record<string, unknown>
): CategoryRecord {
  return {
    id: String(row.id ?? ""),
    user_id: typeof row.user_id === "string" ? row.user_id : null,
    name: normalizeName(row.name),
    type: normalizeType(row.type),
    order_index: normalizeOrderIndex(row.order_index),
    inserted_at: typeof row.inserted_at === "string" ? row.inserted_at : null,
    group_name: normalizeGroupName(row.group_name ?? row["group"]) ?? null,
  };
}

function sortCategories(rows: CategoryRecord[]): CategoryRecord[] {
  return [...rows].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    const orderA = a.order_index ?? Number.POSITIVE_INFINITY;
    const orderB = b.order_index ?? Number.POSITIVE_INFINITY;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
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
    mapCategoryRow(row as Partial<CategoryRecord> & Record<string, unknown>)
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
  const { name, type, group_name, order_index } = input;
  await ensureGuestUniqueName(type, name);
  const existing = await listGuestCategories();
  const lastOrder = existing
    .filter((row) => row.type === type)
    .reduce((max, row) => Math.max(max, row.order_index ?? -1), -1);
  const nextOrder =
    order_index != null && Number.isFinite(order_index)
      ? order_index
      : lastOrder + 1;
  const payload: Record<string, unknown> = {
    name,
    type,
    order_index: nextOrder,
    group_name: group_name ?? null,
    user_id: null,
    inserted_at: new Date().toISOString(),
  };
  const inserted = await guestDriver.insert("categories", payload);
  const record = mapCategoryRow(
    inserted as Partial<CategoryRecord> & Record<string, unknown>
  );
  await dbCache.set("categories", record);
  return record;
}

async function updateGuestCategory(
  id: string,
  patch: {
    name?: string;
    group_name?: string | null;
    order_index?: number | null;
  }
): Promise<CategoryRecord> {
  const existing = await guestDriver.get("categories", id);
  if (!existing) {
    throw new Error("Kategori tidak ditemukan.");
  }
  const current = mapCategoryRow(
    existing as Partial<CategoryRecord> & Record<string, unknown>
  );
  const updates: Record<string, unknown> = {};

  if (typeof patch.name === "string") {
    const normalized = normalizeName(patch.name);
    if (!normalized || normalized.length > 60) {
      throw new Error("Nama kategori harus 1-60 karakter.");
    }
    await ensureGuestUniqueName(current.type, normalized, current.id);
    updates.name = normalized;
  }

  if (patch.group_name !== undefined) {
    updates.group_name = normalizeGroupName(patch.group_name) ?? null;
  }

  if (patch.order_index !== undefined) {
    updates.order_index = normalizeOrderIndex(patch.order_index) ?? null;
  }

  if (!Object.keys(updates).length) {
    return current;
  }

  const updated = await guestDriver.update("categories", id, updates);
  const record = mapCategoryRow(
    updated as Partial<CategoryRecord> & Record<string, unknown>
  );
  await dbCache.set("categories", record);
  return record;
}

async function reorderGuestCategories(
  type: CategoryType,
  orderedIds: string[]
): Promise<void> {
  if (!Array.isArray(orderedIds) || !orderedIds.length) {
    return;
  }
  const normalizedType = normalizeType(type);
  await Promise.all(
    orderedIds.map((id, index) =>
      guestDriver.update("categories", id, {
        type: normalizedType,
        order_index: index,
      })
    )
  );
  const rows = await listGuestCategories();
  await dbCache.bulkSet("categories", rows);
}

async function deleteGuestCategory(id: string): Promise<void> {
  await guestDriver.softDelete("categories", id);
  await dbCache.remove("categories", id);
}

export async function listCategories(signal?: AbortSignal): Promise<CategoryRecord[]> {
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
    const rows = sortCategories((data ?? []).map(mapCategoryRow));
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

async function assertUniqueName(
  userId: string,
  type: CategoryType,
  name: string,
  excludeId?: string
) {
  const query = supabase
    .from("categories")
    .select("id, name")
    .eq("user_id", userId)
    .eq("type", type)
    .ilike("name", name)
    .limit(5);
  const { data, error } = await query;
  if (error) throw error;
  const conflict = (data ?? []).find((row) => {
    if (excludeId && row.id === excludeId) return false;
    return normalizeName(row.name).toLowerCase() === name.toLowerCase();
  });
  if (conflict) {
    throw new Error("Nama kategori sudah digunakan pada tipe ini.");
  }
}

export async function createCategory(input: {
  name: string;
  type: CategoryType;
  group_name?: string | null;
  order_index?: number | null;
}): Promise<CategoryRecord> {
  const name = normalizeName(input.name);
  if (!name || name.length > 60) {
    throw new Error("Nama kategori harus 1-60 karakter.");
  }
  if (!["income", "expense"].includes(input.type)) {
    throw new Error("Tipe kategori tidak valid.");
  }
  const type = normalizeType(input.type);
  const groupName = normalizeGroupName(input.group_name);
  const providedOrder = normalizeOrderIndex(input.order_index);

  const userId = await resolveUserId();
  if (!userId) {
    return createGuestCategory({
      name,
      type,
      group_name: groupName,
      order_index: providedOrder ?? undefined,
    });
  }

  try {
    await assertUniqueName(userId, type, name);

    let nextOrder: number | null = providedOrder ?? null;
    if (nextOrder == null) {
      const { data: orderRows, error: orderError } = await supabase
        .from("categories")
        .select("order_index")
        .eq("user_id", userId)
        .eq("type", type)
        .order("order_index", { ascending: false, nullsFirst: false })
        .limit(1);
      if (orderError) throw orderError;
      const orderRow = orderRows?.[0];
      if (orderRow && orderRow.order_index != null) {
        const normalized = normalizeOrderIndex(orderRow.order_index);
        nextOrder = normalized != null ? normalized + 1 : null;
      } else {
        nextOrder = 0;
      }
    }

    const body: Record<string, unknown> = {
      user_id: userId,
      name,
      type,
    };

    if (nextOrder != null) {
      body.order_index = nextOrder;
    }

    if (groupName !== null) {
      body["group"] = groupName;
    }

    const { data, error } = await supabase
      .from("categories")
      .insert([body])
      .select(BASE_SELECT)
      .single();
    if (error) throw error;

    const record = mapCategoryRow(data ?? {});
    await dbCache.set("categories", record);
    return record;
  } catch (error) {
    logDevError("createCategory", error);
    throw toError(error, "Gagal menambah kategori.");
  }
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

  const dbPatch: Record<string, unknown> = {};
  if (patch.name != null) {
    const normalized = normalizeName(patch.name);
    if (!normalized || normalized.length > 60) {
      throw new Error("Nama kategori harus 1-60 karakter.");
    }
    dbPatch.name = normalized;
  }

  if (patch.type != null) {
    if (!["income", "expense"].includes(patch.type)) {
      throw new Error("Tipe kategori tidak valid.");
    }
    dbPatch.type = normalizeType(patch.type);
  }

  if (patch.group_name !== undefined) {
    const normalized = normalizeGroupName(patch.group_name);
    dbPatch["group"] = normalized;
  }

  if (patch.order_index !== undefined) {
    dbPatch.order_index = normalizeOrderIndex(patch.order_index);
  }

  if (!Object.keys(dbPatch).length) {
    const cached = await dbCache.get("categories", id);
    if (cached) {
      return mapCategoryRow(cached);
    }
  }

  try {
    if (typeof dbPatch.name === "string") {
      const current = await supabase
        .from("categories")
        .select("type")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      if (current.error) throw current.error;
      const type = normalizeType(dbPatch.type ?? current.data?.type);
      await assertUniqueName(userId, type, dbPatch.name as string, id);
    }

    const { data, error } = await supabase
      .from("categories")
      .update(dbPatch)
      .eq("id", id)
      .eq("user_id", userId)
      .select(BASE_SELECT)
      .single();
    if (error) throw error;

    const record = mapCategoryRow(data ?? {});
    await dbCache.set("categories", record);
    return record;
  } catch (error) {
    logDevError("updateCategory", error);
    throw toError(error, "Gagal memperbarui kategori.");
  }
}

export async function reorderCategories(
  type: CategoryType,
  orderedIds: string[]
): Promise<void> {
  if (!Array.isArray(orderedIds) || !orderedIds.length) return;

  const userId = await resolveUserId();
  if (!userId) {
    await reorderGuestCategories(type, orderedIds);
    return;
  }

  const normalizedType = normalizeType(type);
  const payload = orderedIds.map((id, index) => ({
    id,
    user_id: userId,
    type: normalizedType,
    order_index: index,
  }));

  try {
    const { data, error } = await supabase
      .from("categories")
      .upsert(payload, { onConflict: "id" })
      .select(BASE_SELECT);
    if (error) throw error;
    if (data) {
      await dbCache.bulkSet(
        "categories",
        data.map((row) => mapCategoryRow(row))
      );
    }
  } catch (error) {
    logDevError("reorderCategories", error);
    throw toError(error, "Gagal mengurutkan kategori.");
  }
}

export async function deleteCategory(id: string): Promise<void> {
  const userId = await resolveUserId();
  if (!userId) {
    await deleteGuestCategory(id);
    return;
  }

  try {
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
    await dbCache.remove("categories", id);
  } catch (error) {
    logDevError("deleteCategory", error);
    throw toError(error, "Gagal menghapus kategori.");
  }
}

export type { CategoryType };
