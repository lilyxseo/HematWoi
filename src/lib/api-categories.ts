import { supabase } from "./supabase";
import { dbCache } from "./sync/localdb";
import { getCurrentUserId } from "./session";

type CategoryType = "income" | "expense";
type CategorySortColumn = "sort_order" | "order_index";
type CategoryCreatedColumn = "created_at" | "inserted_at";

export interface CategoryRecord {
  id: string;
  user_id: string | null;
  name: string;
  type: CategoryType;
  color: string;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
}

const DEFAULT_COLOR = "#64748B";
const LOCAL_REPO_KEY = "hw:localRepo";

let categorySortColumn: CategorySortColumn | undefined;
let categoryCreatedColumn: CategoryCreatedColumn | undefined;
let guestRepoMemory: GuestRepoSnapshot | null = null;

interface GuestCategoryRow {
  id: string;
  name: string;
  type: CategoryType;
  color?: string;
  sort_order?: number;
  created_at?: string | null;
  inserted_at?: string | null;
  updated_at?: string | null;
}

type GuestRepoSnapshot = {
  categories?: GuestCategoryRow[];
  [key: string]: unknown;
};

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readGuestRepo(): GuestRepoSnapshot {
  if (guestRepoMemory) {
    return { ...guestRepoMemory, categories: [...(guestRepoMemory.categories ?? [])] };
  }

  if (!hasLocalStorage()) {
    guestRepoMemory = { categories: [] };
    return { categories: [] };
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_REPO_KEY);
    if (!raw) {
      guestRepoMemory = { categories: [] };
      return { categories: [] };
    }
    const parsed = JSON.parse(raw) as GuestRepoSnapshot;
    const categories = Array.isArray(parsed.categories) ? parsed.categories : [];
    guestRepoMemory = { ...parsed, categories };
    return { ...guestRepoMemory, categories: [...categories] };
  } catch (error) {
    console.error("[HW] Failed to read guest repo", error);
    guestRepoMemory = { categories: [] };
    return { categories: [] };
  }
}

function writeGuestRepo(next: GuestRepoSnapshot): void {
  guestRepoMemory = { ...next, categories: [...(next.categories ?? [])] };
  if (!hasLocalStorage()) {
    return;
  }
  try {
    window.localStorage.setItem(LOCAL_REPO_KEY, JSON.stringify(guestRepoMemory));
  } catch (error) {
    console.error("[HW] Failed to persist guest repo", error);
  }
}

function getGuestCategories(): GuestCategoryRow[] {
  const snapshot = readGuestRepo();
  return Array.isArray(snapshot.categories) ? snapshot.categories : [];
}

function setGuestCategories(categories: GuestCategoryRow[]): void {
  const snapshot = readGuestRepo();
  writeGuestRepo({ ...snapshot, categories });
}

function guestNow(): string {
  return new Date().toISOString();
}

function normalizeGuestRow(row: GuestCategoryRow, index: number): CategoryRecord {
  return mapCategoryRow({
    ...row,
    sort_order: row.sort_order ?? index,
    user_id: null,
  } as Partial<CategoryRecord> & Record<string, unknown>);
}

function listGuestCategories(): CategoryRecord[] {
  const rows = getGuestCategories();
  return sortCategories(rows.map((row, index) => normalizeGuestRow(row, index)));
}

function assertGuestUniqueName(
  type: CategoryType,
  name: string,
  excludeId?: string
): void {
  const rows = getGuestCategories();
  const normalized = name.toLowerCase();
  const conflict = rows.find((row) => {
    if (excludeId && row.id === excludeId) return false;
    return (
      normalizeType(row.type) === type &&
      normalizeName(row.name).toLowerCase() === normalized
    );
  });
  if (conflict) {
    throw new Error("Nama kategori sudah digunakan pada tipe ini.");
  }
}

function createGuestCategory(input: {
  name: string;
  type: CategoryType;
  color: string;
}): CategoryRecord {
  const type = normalizeType(input.type);
  const name = normalizeName(input.name);
  assertGuestUniqueName(type, name);
  const color = normalizeColor(input.color);
  const rows = getGuestCategories();
  const nextOrder =
    rows
      .filter((row) => normalizeType(row.type) === type)
      .reduce(
        (max, row) => Math.max(max, normalizeSortOrder(row.sort_order, -1)),
        -1
      ) + 1;
  const now = guestNow();
  const record: GuestCategoryRow = {
    id: globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
    name,
    type,
    color,
    sort_order: nextOrder,
    created_at: now,
    updated_at: now,
  };
  setGuestCategories([...rows, record]);
  return normalizeGuestRow(record, rows.length);
}

function updateGuestCategory(
  id: string,
  patch: Partial<Pick<CategoryRecord, "name" | "color" | "sort_order">>
): CategoryRecord {
  const rows = getGuestCategories();
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) {
    throw new Error("Kategori tidak ditemukan.");
  }
  const existing = rows[index];
  const next = { ...existing } as GuestCategoryRow;
  if (typeof patch.name === "string") {
    const normalized = normalizeName(patch.name);
    if (!normalized || normalized.length > 60) {
      throw new Error("Nama kategori harus 1-60 karakter.");
    }
    assertGuestUniqueName(normalizeType(existing.type), normalized, id);
    next.name = normalized;
  }
  if (typeof patch.color === "string") {
    next.color = normalizeColor(patch.color);
  }
  if (typeof patch.sort_order === "number") {
    next.sort_order = normalizeSortOrder(patch.sort_order);
  }
  next.updated_at = guestNow();
  const updatedRows = [...rows];
  updatedRows[index] = next;
  setGuestCategories(updatedRows);
  return normalizeGuestRow(next, index);
}

function reorderGuestCategoriesLocal(
  type: CategoryType,
  orderedIds: string[]
): void {
  if (!orderedIds.length) return;
  const normalizedType = normalizeType(type);
  const map = new Map(orderedIds.map((id, index) => [id, index]));
  const rows = getGuestCategories();
  const now = guestNow();
  let changed = false;
  const nextRows = rows.map((row, index) => {
    if (normalizeType(row.type) !== normalizedType) {
      return row;
    }
    if (!map.has(row.id)) {
      return row;
    }
    const nextOrder = map.get(row.id)!;
    if (normalizeSortOrder(row.sort_order, index) === nextOrder) {
      return row;
    }
    changed = true;
    return {
      ...row,
      sort_order: nextOrder,
      updated_at: now,
    };
  });
  if (changed) {
    setGuestCategories(nextRows);
  }
}

function deleteGuestCategory(id: string): void {
  const rows = getGuestCategories();
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) {
    return;
  }
  const removed = rows[index];
  const remaining = rows.filter((row) => row.id !== id);
  const normalizedType = normalizeType(removed.type);
  const now = guestNow();
  const typed = remaining
    .filter((row) => normalizeType(row.type) === normalizedType)
    .sort(
      (a, b) =>
        normalizeSortOrder(a.sort_order) - normalizeSortOrder(b.sort_order)
    );
  const orderMap = new Map(typed.map((row, order) => [row.id, order]));
  const resequenced = remaining.map((row) => {
    if (normalizeType(row.type) !== normalizedType) {
      return row;
    }
    const nextOrder = orderMap.get(row.id);
    return {
      ...row,
      sort_order: typeof nextOrder === "number" ? nextOrder : 0,
      updated_at: now,
    };
  });
  setGuestCategories(resequenced);
}

function getCategorySortColumn(): CategorySortColumn {
  return categorySortColumn ?? "sort_order";
}

function getCategoryBaseColumns(): string {
  const sortColumn = getCategorySortColumn();
  const createdColumn = getCategoryCreatedColumn();
  return [
    "id",
    "user_id",
    "name",
    "type",
    sortColumn,
    ...(createdColumn === "created_at" ? ["created_at"] : []),
    "updated_at",
    "inserted_at",
  ].join(", ");
}

let categoryColorSupported: boolean | undefined;

function shouldUseCategoryColor(): boolean {
  return categoryColorSupported !== false;
}

function getCategoryCreatedColumn(): CategoryCreatedColumn {
  return categoryCreatedColumn ?? "created_at";
}

function getCategorySelectColumns(): string {
  const baseColumns = getCategoryBaseColumns();
  return shouldUseCategoryColor() ? `${baseColumns}, color` : baseColumns;
}

function isMissingColumnError(error: unknown, column: string): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeCode = (error as { code?: unknown }).code;
  const maybeMessage = (error as { message?: unknown }).message;
  if (typeof maybeMessage === "string") {
    const normalized = maybeMessage.toLowerCase();
    if (
      normalized.includes(column.toLowerCase()) &&
      (normalized.includes("does not exist") || normalized.includes("could not find"))
    ) {
      return true;
    }
  }
  if (maybeCode === "42703" || maybeCode === "PGRST204") {
    if (typeof maybeMessage === "string") {
      return maybeMessage.toLowerCase().includes(column.toLowerCase());
    }
    return true;
  }
  return false;
}

function handleMissingCategoryColor(error: unknown): boolean {
  if (shouldUseCategoryColor() && isMissingColumnError(error, "color")) {
    categoryColorSupported = false;
    return true;
  }
  return false;
}

function handleMissingCategorySortColumn(error: unknown): boolean {
  const current = getCategorySortColumn();
  if (current === "sort_order" && isMissingColumnError(error, "sort_order")) {
    categorySortColumn = "order_index";
    return true;
  }
  if (current === "order_index" && isMissingColumnError(error, "order_index")) {
    categorySortColumn = "sort_order";
    return true;
  }
  return false;
}

function handleMissingCategoryCreatedColumn(error: unknown): boolean {
  const current = getCategoryCreatedColumn();
  if (current === "created_at" && isMissingColumnError(error, "created_at")) {
    categoryCreatedColumn = "inserted_at";
    return true;
  }
  return false;
}

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

function normalizeColor(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
      return trimmed.toUpperCase();
    }
  }
  return DEFAULT_COLOR;
}

function normalizeSortOrder(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function mapCategoryRow(row: Partial<CategoryRecord> & Record<string, unknown>): CategoryRecord {
  const sortValue =
    typeof row.sort_order !== "undefined" ? row.sort_order : row.order_index;
  return {
    id: String(row.id ?? ""),
    user_id: (typeof row.user_id === "string" ? row.user_id : null) ?? null,
    name: normalizeName(row.name),
    type: normalizeType(row.type),
    color: normalizeColor(row.color),
    sort_order: normalizeSortOrder(sortValue),
    created_at: (typeof row.created_at === "string" ? row.created_at : row.inserted_at) ?? null,
    updated_at: (typeof row.updated_at === "string" ? row.updated_at : null),
  };
}

function sortCategories(rows: CategoryRecord[]): CategoryRecord[] {
  return [...rows].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export async function listCategories(signal?: AbortSignal): Promise<CategoryRecord[]> {
  let userId: string | null = null;
  try {
    userId = await getCurrentUserId();
  } catch (error) {
    logDevError("getCurrentUserId", error);
  }

  if (!userId) {
    const rows = listGuestCategories();
    await dbCache.bulkSet("categories", rows);
    return rows;
  }

  try {
    const sortColumn = getCategorySortColumn();
    const createdColumn = getCategoryCreatedColumn();
    let query = supabase
      .from("categories")
      .select(getCategorySelectColumns())
      .eq("user_id", userId)
      .order("type", { ascending: true })
      .order(sortColumn, { ascending: true })
      .order(createdColumn, { ascending: true });

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query;
    if (error) throw error;
    const rows = sortCategories((data ?? []).map(mapCategoryRow));
    await dbCache.bulkSet("categories", rows);
    return rows;
  } catch (error) {
    if (handleMissingCategoryColor(error)) {
      return listCategories(signal);
    }
    if (handleMissingCategorySortColumn(error)) {
      return listCategories(signal);
    }
    if (handleMissingCategoryCreatedColumn(error)) {
      return listCategories(signal);
    }
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
  color: string;
}): Promise<CategoryRecord> {
  const name = normalizeName(input.name);
  if (!name || name.length > 60) {
    throw new Error("Nama kategori harus 1-60 karakter.");
  }
  const type = normalizeType(input.type);
  const color = normalizeColor(input.color);

  let userId: string | null = null;
  try {
    userId = await getCurrentUserId();
  } catch (error) {
    logDevError("getCurrentUserId", error);
  }

  if (!userId) {
    const record = createGuestCategory({ name, type, color });
    await dbCache.set("categories", record);
    return record;
  }

  try {
    await assertUniqueName(userId, type, name);

    const sortColumn = getCategorySortColumn();
    const { data: orderRows, error: orderError } = await supabase
      .from("categories")
      .select(sortColumn)
      .eq("user_id", userId)
      .eq("type", type)
      .order(sortColumn, { ascending: false })
      .limit(1);
    if (orderError) throw orderError;
    const orderRow = (orderRows?.[0] ?? {}) as Partial<
      Record<CategorySortColumn, unknown>
    >;
    const nextOrder = normalizeSortOrder(orderRow[sortColumn], -1) + 1;

    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      name,
      type,
      [sortColumn]: nextOrder,
    };

    if (shouldUseCategoryColor()) {
      insertPayload.color = color;
    }

    const { data, error } = await supabase
      .from("categories")
      .insert(insertPayload)
      .select(getCategorySelectColumns())
      .single();
    if (error) throw error;

    const record = mapCategoryRow(data ?? {});
    await dbCache.set("categories", record);
    return record;
  } catch (error) {
    if (handleMissingCategoryColor(error)) {
      return createCategory(input);
    }
    if (handleMissingCategorySortColumn(error)) {
      return createCategory(input);
    }
    if (handleMissingCategoryCreatedColumn(error)) {
      return createCategory(input);
    }
    logDevError("createCategory", error);
    throw toError(error, "Gagal menambah kategori.");
  }
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<CategoryRecord, "name" | "color" | "sort_order">>
): Promise<CategoryRecord> {
  let userId: string | null = null;
  try {
    userId = await getCurrentUserId();
  } catch (error) {
    logDevError("getCurrentUserId", error);
  }

  if (!userId) {
    const record = updateGuestCategory(id, patch);
    await dbCache.set("categories", record);
    return record;
  }

  const updates: Record<string, unknown> = {};
  const nextName =
    typeof patch.name === "string" ? normalizeName(patch.name) : undefined;
  if (typeof nextName === "string") {
    if (!nextName || nextName.length > 60) {
      throw new Error("Nama kategori harus 1-60 karakter.");
    }
    updates.name = nextName;
  }

  if (shouldUseCategoryColor() && typeof patch.color === "string") {
    updates.color = normalizeColor(patch.color);
  }

  if (patch.sort_order != null) {
    const sortColumn = getCategorySortColumn();
    updates[sortColumn] = normalizeSortOrder(patch.sort_order);
  }

  if (!Object.keys(updates).length) {
    const cached = await dbCache.get("categories", id);
    if (cached) {
      return mapCategoryRow(cached);
    }
  }

  try {
    if (typeof updates.name === "string") {
      const current = await supabase
        .from("categories")
        .select("type")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      if (current.error) throw current.error;
      const type = normalizeType(current.data?.type);
      await assertUniqueName(userId, type, updates.name as string, id);
    }

    const { data, error } = await supabase
      .from("categories")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select(getCategorySelectColumns())
      .single();
    if (error) throw error;

    const record = mapCategoryRow(data ?? {});
    await dbCache.set("categories", record);
    return record;
  } catch (error) {
    if (handleMissingCategoryColor(error)) {
      return updateCategory(id, patch);
    }
    if (handleMissingCategorySortColumn(error)) {
      return updateCategory(id, patch);
    }
    if (handleMissingCategoryCreatedColumn(error)) {
      return updateCategory(id, patch);
    }
    logDevError("updateCategory", error);
    throw toError(error, "Gagal memperbarui kategori.");
  }
}

export async function reorderCategories(
  type: CategoryType,
  orderedIds: string[]
): Promise<void> {
  let userId: string | null = null;
  try {
    userId = await getCurrentUserId();
  } catch (error) {
    logDevError("getCurrentUserId", error);
  }

  if (!userId) {
    reorderGuestCategoriesLocal(type, orderedIds);
    const rows = listGuestCategories();
    await dbCache.bulkSet("categories", rows);
    return;
  }
  if (!Array.isArray(orderedIds) || !orderedIds.length) return;

  const normalizedType = normalizeType(type);
  const sortColumn = getCategorySortColumn();
  const payload = orderedIds.map((id, index) => ({
    id,
    user_id: userId,
    type: normalizedType,
    [sortColumn]: index,
  }));

  try {
    const { data, error } = await supabase
      .from("categories")
      .upsert(payload, { onConflict: "id" })
      .select(getCategorySelectColumns());
    if (error) throw error;
    if (data) {
      await dbCache.bulkSet("categories", data.map((row) => mapCategoryRow(row)));
    }
  } catch (error) {
    if (handleMissingCategoryColor(error)) {
      return reorderCategories(type, orderedIds);
    }
    if (handleMissingCategorySortColumn(error)) {
      return reorderCategories(type, orderedIds);
    }
    if (handleMissingCategoryCreatedColumn(error)) {
      return reorderCategories(type, orderedIds);
    }
    logDevError("reorderCategories", error);
    throw toError(error, "Gagal mengurutkan kategori.");
  }
}

export async function deleteCategory(id: string): Promise<void> {
  let userId: string | null = null;
  try {
    userId = await getCurrentUserId();
  } catch (error) {
    logDevError("getCurrentUserId", error);
  }

  if (!userId) {
    deleteGuestCategory(id);
    const rows = listGuestCategories();
    await dbCache.bulkSet("categories", rows);
    await dbCache.remove("categories", id);
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
