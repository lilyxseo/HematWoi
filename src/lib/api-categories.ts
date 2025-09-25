import type { User } from "@supabase/supabase-js";
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

export interface CategoryCreatePayload {
  name: string;
  type: CategoryType;
  group_name?: string | null;
  order_index?: number | null;
}

export interface CategoryUpdatePayload {
  name?: string;
  type?: CategoryType;
  group_name?: string | null;
  order_index?: number | null;
}

export interface CategoryListOptions {
  type?: CategoryType;
  signal?: AbortSignal;
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

function isCategoryType(value: unknown): value is CategoryType {
  return value === "income" || value === "expense";
}

function mapRow(row: Record<string, unknown>): CategoryRecord {
  const id = typeof row.id === "string" ? row.id : String(row.id ?? "");
  const userId = typeof row.user_id === "string" ? row.user_id : String(row.user_id ?? "");
  const name = typeof row.name === "string" ? row.name : "";
  const type: CategoryType = row.type === "income" ? "income" : "expense";
  const orderIndex =
    typeof row.order_index === "number" && Number.isFinite(row.order_index)
      ? row.order_index
      : null;
  const insertedAt = typeof row.inserted_at === "string" ? row.inserted_at : null;
  const groupName =
    typeof row.group_name === "string" && row.group_name.trim().length
      ? row.group_name
      : null;

  return {
    id,
    user_id: userId,
    name,
    type,
    order_index: orderIndex,
    inserted_at: insertedAt,
    group_name: groupName,
  };
}

async function requireUser(): Promise<User> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const user = data?.user;
  if (!user) {
    throw new Error("Harus login.");
  }
  return user;
}

function normalizeName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeGroup(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeOrderIndex(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

async function computeNextOrderIndex(
  userId: string,
  type: CategoryType
): Promise<number> {
  const { data, error } = await supabase
    .from("categories")
    .select("order_index")
    .eq("user_id", userId)
    .eq("type", type)
    .order("order_index", { ascending: false, nullsLast: true })
    .limit(1);
  if (error) throw error;
  const current = data?.[0]?.order_index;
  const base = typeof current === "number" && Number.isFinite(current) ? current : -1;
  return base + 1;
}

function sortCategories(rows: CategoryRecord[]): CategoryRecord[] {
  return [...rows].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    const orderA =
      typeof a.order_index === "number" && Number.isFinite(a.order_index)
        ? a.order_index
        : Number.MIN_SAFE_INTEGER;
    const orderB =
      typeof b.order_index === "number" && Number.isFinite(b.order_index)
        ? b.order_index
        : Number.MIN_SAFE_INTEGER;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export async function listCategories(
  options: CategoryListOptions = {}
): Promise<CategoryRecord[]> {
  const user = await requireUser();
  let query = supabase
    .from("categories")
    .select(BASE_SELECT)
    .eq("user_id", user.id)
    .order("type", { ascending: true })
    .order("order_index", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true });

  if (options.type) {
    if (!isCategoryType(options.type)) {
      throw new Error("Tipe kategori tidak valid.");
    }
    query = query.eq("type", options.type);
  }

  if (options.signal) {
    query = query.abortSignal(options.signal);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  return sortCategories(rows);
}

export async function createCategory(
  payload: CategoryCreatePayload
): Promise<CategoryRecord> {
  const user = await requireUser();
  const name = normalizeName(payload.name);
  if (!name) {
    throw new Error("Nama kategori wajib.");
  }
  if (!isCategoryType(payload.type)) {
    throw new Error("Tipe kategori tidak valid.");
  }

  const body: Record<string, unknown> = {
    user_id: user.id,
    name,
    type: payload.type,
  };

  if (payload.order_index !== undefined) {
    body.order_index = normalizeOrderIndex(payload.order_index);
  } else {
    body.order_index = await computeNextOrderIndex(user.id, payload.type);
  }

  if (payload.group_name !== undefined) {
    body["group"] = normalizeGroup(payload.group_name);
  }

  const { data, error } = await supabase
    .from("categories")
    .insert([body])
    .select(BASE_SELECT)
    .single();
  if (error) throw error;
  return mapRow((data ?? {}) as Record<string, unknown>);
}

export async function updateCategory(
  id: string,
  patch: CategoryUpdatePayload
): Promise<CategoryRecord> {
  const user = await requireUser();
  const updates: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    const nextName = normalizeName(patch.name);
    if (!nextName) {
      throw new Error("Nama kategori wajib.");
    }
    updates.name = nextName;
  }

  if (patch.type !== undefined) {
    if (!isCategoryType(patch.type)) {
      throw new Error("Tipe kategori tidak valid.");
    }
    updates.type = patch.type;
  }

  if (patch.group_name !== undefined) {
    updates["group"] = normalizeGroup(patch.group_name);
  }

  if (patch.order_index !== undefined) {
    updates.order_index = normalizeOrderIndex(patch.order_index);
  }

  if (!Object.keys(updates).length) {
    const { data, error } = await supabase
      .from("categories")
      .select(BASE_SELECT)
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (error) throw error;
    return mapRow((data ?? {}) as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("categories")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(BASE_SELECT)
    .single();
  if (error) throw error;
  return mapRow((data ?? {}) as Record<string, unknown>);
}

export async function deleteCategory(id: string): Promise<void> {
  const user = await requireUser();
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    throw new Error(error.message || "Gagal menghapus kategori");
  }
}
