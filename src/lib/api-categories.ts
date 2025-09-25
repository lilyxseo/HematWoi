import { supabase } from "./supabase";

export type CategoryType = "income" | "expense";

export interface CategoryRecord {
  id: string;
  user_id: string;
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

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error && error.message) {
    const wrapped = new Error(error.message);
    (wrapped as { cause?: unknown }).cause = error.cause ?? error;
    return wrapped;
  }
  if (error && typeof error === "object") {
    const message =
      typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : undefined;
    const details =
      typeof (error as { details?: unknown }).details === "string"
        ? (error as { details: string }).details
        : undefined;
    const hint =
      typeof (error as { hint?: unknown }).hint === "string"
        ? (error as { hint: string }).hint
        : undefined;
    if (message || details || hint) {
      return new Error(message ?? details ?? hint ?? fallback);
    }
  }
  if (typeof error === "string" && error) {
    return new Error(error);
  }
  return new Error(fallback);
}

function normalizeType(type: unknown): CategoryType {
  return type === "income" ? "income" : "expense";
}

function mapCategoryRow(row: Record<string, unknown>): CategoryRecord {
  return {
    id: String(row.id ?? ""),
    user_id: typeof row.user_id === "string" ? row.user_id : "",
    name: typeof row.name === "string" ? row.name : "",
    type: normalizeType(row.type),
    order_index:
      typeof row.order_index === "number" && Number.isFinite(row.order_index)
        ? row.order_index
        : null,
    inserted_at:
      typeof row.inserted_at === "string" ? row.inserted_at : null,
    group_name:
      typeof row.group_name === "string" && row.group_name.trim() !== ""
        ? row.group_name
        : null,
  };
}

function assertValidType(type: string): asserts type is CategoryType {
  if (type !== "income" && type !== "expense") {
    throw new Error("Tipe kategori tidak valid.");
  }
}

export async function listCategories(
  signal?: AbortSignal,
  options: { type?: CategoryType } = {}
): Promise<CategoryRecord[]> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    throw new Error("Harus login.");
  }

  let query = supabase
    .from("categories")
    .select(BASE_SELECT)
    .eq("user_id", user.id)
    .order("type", { ascending: true })
    .order("order_index", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true });

  if (options.type) {
    query = query.eq("type", options.type);
  }

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;
  if (error) {
    throw toError(error, "Gagal memuat kategori.");
  }
  return (data ?? []).map((row) =>
    mapCategoryRow(row as Record<string, unknown>)
  );
}

interface CategoryPayload {
  name: string;
  type: CategoryType;
  group_name?: string | null;
  order_index?: number | null;
}

function prepareGroup(groupName: string | null | undefined): string | null {
  if (groupName == null) return null;
  const trimmed = groupName.trim();
  return trimmed ? trimmed : null;
}

function prepareOrder(value: number | null | undefined): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

export async function createCategory(payload: CategoryPayload): Promise<CategoryRecord> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    throw new Error("Harus login.");
  }

  const name = (payload.name ?? "").trim();
  if (!name) {
    throw new Error("Nama kategori wajib.");
  }

  assertValidType(payload.type);

  const body: Record<string, unknown> = {
    user_id: user.id,
    name,
    type: payload.type,
  };

  const preparedOrder = prepareOrder(payload.order_index ?? null);
  if (preparedOrder !== undefined) {
    body.order_index = preparedOrder;
  }

  const preparedGroup = prepareGroup(payload.group_name ?? null);
  if (preparedGroup !== undefined) {
    body["group"] = preparedGroup;
  }

  const { data, error } = await supabase
    .from("categories")
    .insert([body])
    .select(BASE_SELECT)
    .single();

  if (error) {
    throw toError(error, "Gagal menambah kategori.");
  }

  return mapCategoryRow((data ?? {}) as Record<string, unknown>);
}

interface UpdateCategoryPayload {
  name?: string;
  type?: CategoryType;
  group_name?: string | null;
  order_index?: number | null;
}

export async function updateCategory(
  id: string,
  patch: UpdateCategoryPayload
): Promise<CategoryRecord> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    throw new Error("Harus login.");
  }

  const updates: Record<string, unknown> = {};

  if (typeof patch.name === "string") {
    const trimmed = patch.name.trim();
    if (!trimmed) {
      throw new Error("Nama kategori wajib.");
    }
    updates.name = trimmed;
  }

  if (patch.type !== undefined) {
    assertValidType(patch.type);
    updates.type = patch.type;
  }

  if (patch.group_name !== undefined) {
    updates["group"] = prepareGroup(patch.group_name);
  }

  if (patch.order_index !== undefined) {
    updates.order_index = prepareOrder(patch.order_index);
  }

  if (!Object.keys(updates).length) {
    const { data, error } = await supabase
      .from("categories")
      .select(BASE_SELECT)
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (error) {
      throw toError(error, "Gagal memuat kategori.");
    }
    return mapCategoryRow((data ?? {}) as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("categories")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(BASE_SELECT)
    .single();

  if (error) {
    throw toError(error, "Gagal memperbarui kategori.");
  }

  return mapCategoryRow((data ?? {}) as Record<string, unknown>);
}

export async function reorderCategories(
  type: CategoryType,
  orderedIds: string[]
): Promise<void> {
  if (!Array.isArray(orderedIds) || !orderedIds.length) return;

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    throw new Error("Harus login.");
  }

  assertValidType(type);

  const payload = orderedIds.map((id, index) => ({
    id,
    user_id: user.id,
    type,
    order_index: index,
  }));

  const { error } = await supabase
    .from("categories")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    throw toError(error, "Gagal mengurutkan kategori.");
  }
}

export async function deleteCategory(id: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    throw new Error("Harus login.");
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw toError(error, "Gagal menghapus kategori.");
  }
}
