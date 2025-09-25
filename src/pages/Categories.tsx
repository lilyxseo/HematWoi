import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import CategoryForm, { CategoryFormValues } from "../components/categories/CategoryForm";
import CategoryList from "../components/categories/CategoryList";
import { useToast } from "../context/ToastContext";
import {
  CategoryRecord,
  CategoryType,
  createCategory,
  deleteCategory,
  listCategories,
  reorderCategories,
  updateCategory,
} from "../lib/api-categories";
import { useLockBodyScroll } from "../hooks/useLockBodyScroll";

function toMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

function logDevError(scope: string, error: unknown) {
  if (import.meta.env?.DEV || process.env?.NODE_ENV === "development") {
    console.error(`[HW] ${scope}`, error);
  }
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Hapus",
  cancelLabel = "Batal",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useLockBodyScroll(open);
  const headingId = useMemo(
    () => `confirm-title-${Math.random().toString(36).slice(2)}`,
    []
  );
  const descriptionId = useMemo(
    () => `confirm-description-${Math.random().toString(36).slice(2)}`,
    []
  );

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        className="w-full max-w-sm rounded-2xl border border-border/70 bg-surface-1/95 p-5 shadow-xl"
      >
        <h2 id={headingId} className="text-sm font-semibold text-text">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm text-muted">
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-10 rounded-xl border border-border/70 bg-transparent px-4 text-sm font-medium text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-danger px-4 text-sm font-semibold text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function sortCategories(list: CategoryRecord[]): CategoryRecord[] {
  return [...list].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    const orderDiff = (a.order_index ?? Number.MAX_SAFE_INTEGER) - (b.order_index ?? Number.MAX_SAFE_INTEGER);
    if (orderDiff !== 0) {
      return orderDiff;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

function resequenceType(records: CategoryRecord[], type: CategoryType): CategoryRecord[] {
  const sameType = sortCategories(records.filter((cat) => cat.type === type));
  const orderMap = new Map(sameType.map((cat, index) => [cat.id, index]));
  return records.map((cat) =>
    cat.type === type && orderMap.has(cat.id)
      ? { ...cat, order_index: orderMap.get(cat.id)! }
      : cat
  );
}

function nextOrderIndex(records: CategoryRecord[], type: CategoryType): number {
  const sameType = records.filter((cat) => cat.type === type);
  if (!sameType.length) return 0;
  return (
    sameType.reduce(
      (max, cat) => (cat.order_index != null && cat.order_index > max ? cat.order_index : max),
      -1
    ) + 1
  );
}

export default function Categories() {
  const { addToast } = useToast();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createFormKey, setCreateFormKey] = useState(0);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<CategoryRecord | null>(null);

  const addPending = useCallback((ids: string[]) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const removePending = useCallback((ids: string[]) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const rows = await listCategories(signal);
        if (signal?.aborted) return;
        setCategories(sortCategories(rows));
      } catch (err) {
        if (signal?.aborted) return;
        logDevError("listCategories", err);
        const message = toMessage(err, "Gagal memuat kategori.");
        setError(message);
        addToast(message, "error");
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [addToast]
  );

  useEffect(() => {
    const controller = new AbortController();
    reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  const isDuplicateName = useCallback(
    (type: CategoryType, name: string, excludeId?: string) => {
      const normalized = name.trim().toLowerCase();
      if (!normalized) return false;
      return categories.some(
        (cat) =>
          cat.type === type &&
          cat.id !== excludeId &&
          cat.name.trim().toLowerCase() === normalized
      );
    },
    [categories]
  );

  const handleCreate = useCallback(
    async (values: CategoryFormValues) => {
      const trimmed = values.name.trim();
      const type = values.type;
      const groupName = values.group_name?.trim() || null;
      const requestedOrder =
        typeof values.order_index === "number" && Number.isFinite(values.order_index)
          ? Math.trunc(values.order_index)
          : null;

      if (!trimmed || trimmed.length > 60) {
        addToast("Nama kategori harus 1-60 karakter.", "error");
        return;
      }
      if (type !== "income" && type !== "expense") {
        addToast("Tipe kategori tidak valid.", "error");
        return;
      }
      if (isDuplicateName(type, trimmed)) {
        addToast("Nama kategori sudah digunakan pada tipe ini.", "error");
        return;
      }

      const resolvedOrder = requestedOrder ?? nextOrderIndex(categories, type);
      const optimisticId =
        globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
      const optimistic: CategoryRecord = {
        id: optimisticId,
        user_id: "",
        name: trimmed,
        type,
        group_name: groupName,
        order_index: resolvedOrder,
        inserted_at: new Date().toISOString(),
      };
      setCategories((prev) => sortCategories([...prev, optimistic]));
      setCreating(true);
      try {
        const created = await createCategory({
          name: trimmed,
          type,
          group_name: groupName,
          order_index: resolvedOrder,
        });
        setCategories((prev) =>
          sortCategories(prev.map((cat) => (cat.id === optimisticId ? created : cat)))
        );
        setCreateFormKey((prev) => prev + 1);
        addToast("Kategori berhasil ditambahkan.", "success");
      } catch (err) {
        setCategories((prev) => prev.filter((cat) => cat.id !== optimisticId));
        logDevError("createCategory", err);
        addToast(toMessage(err, "Gagal menambah kategori."), "error");
      } finally {
        setCreating(false);
      }
    },
    [addToast, categories, isDuplicateName]
  );

  const handleSubmitEdit = useCallback(
    async (category: CategoryRecord, values: CategoryFormValues) => {
      const trimmed = values.name.trim();
      const type = values.type;
      const groupName = values.group_name?.trim() || null;
      const requestedOrder =
        typeof values.order_index === "number" && Number.isFinite(values.order_index)
          ? Math.trunc(values.order_index)
          : null;

      if (!trimmed || trimmed.length > 60) {
        addToast("Nama kategori harus 1-60 karakter.", "error");
        return;
      }
      if (type !== "income" && type !== "expense") {
        addToast("Tipe kategori tidak valid.", "error");
        return;
      }
      if (isDuplicateName(type, trimmed, category.id)) {
        addToast("Nama kategori sudah digunakan pada tipe ini.", "error");
        return;
      }

      const snapshot = categories;
      const patchOrder = requestedOrder ?? null;
      const optimistic: CategoryRecord = {
        ...category,
        name: trimmed,
        type,
        group_name: groupName,
        order_index: patchOrder ?? category.order_index,
      };

      setCategories((prev) => sortCategories(prev.map((cat) => (cat.id === category.id ? optimistic : cat))));
      addPending([category.id]);
      try {
        const payload: {
          name?: string;
          type?: CategoryType;
          group_name?: string | null;
          order_index?: number | null;
        } = {};
        if (trimmed !== category.name) payload.name = trimmed;
        if (type !== category.type) payload.type = type;
        if ((groupName ?? null) !== (category.group_name ?? null)) {
          payload.group_name = groupName;
        }
        if (
          (patchOrder ?? null) !==
          (category.order_index != null ? category.order_index : null)
        ) {
          payload.order_index = patchOrder;
        }
        const updated = await updateCategory(category.id, payload);
        setCategories((prev) =>
          sortCategories(prev.map((cat) => (cat.id === updated.id ? updated : cat)))
        );
        setEditingId(null);
        addToast("Perubahan kategori disimpan.", "success");
      } catch (err) {
        setCategories(snapshot);
        logDevError("updateCategory", err);
        addToast(toMessage(err, "Gagal memperbarui kategori."), "error");
      } finally {
        removePending([category.id]);
      }
    },
    [addToast, addPending, categories, isDuplicateName, removePending]
  );

  const handleMove = useCallback(
    async (category: CategoryRecord, direction: "up" | "down") => {
      const sameType = sortCategories(
        categories.filter((item) => item.type === category.type)
      );
      const index = sameType.findIndex((item) => item.id === category.id);
      if (index < 0) return;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= sameType.length) return;

      const ordered = [...sameType];
      const [moved] = ordered.splice(index, 1);
      ordered.splice(targetIndex, 0, moved);
      const orderedIds = ordered.map((item) => item.id);
      const orderMap = new Map(orderedIds.map((id, sortIndex) => [id, sortIndex]));

      const snapshot = categories;
      setCategories((prev) =>
        sortCategories(
          prev.map((item) =>
            item.type === category.type && orderMap.has(item.id)
              ? { ...item, order_index: orderMap.get(item.id)! }
              : item
          )
        )
      );
      addPending(orderedIds);
      try {
        await reorderCategories(category.type, orderedIds);
      } catch (err) {
        setCategories(snapshot);
        logDevError("reorderCategories", err);
        addToast(toMessage(err, "Gagal mengurutkan kategori."), "error");
      } finally {
        removePending(orderedIds);
      }
    },
    [addPending, addToast, categories, removePending]
  );

  const handleDeleteCategory = useCallback(
    async (category: CategoryRecord) => {
      const snapshot = categories;
      const remaining = snapshot.filter((cat) => cat.id !== category.id);
      const resequenced = resequenceType(remaining, category.type);
      setCategories(sortCategories(resequenced));
      addPending([category.id]);
      try {
        await deleteCategory(category.id);
        addToast("Kategori dihapus.", "success");
      } catch (err) {
        setCategories(snapshot);
        logDevError("deleteCategory", err);
        addToast(toMessage(err, "Gagal menghapus kategori."), "error");
      } finally {
        removePending([category.id]);
      }
    },
    [addPending, addToast, categories, removePending]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!confirming) return;
    const target = confirming;
    await handleDeleteCategory(target);
    setConfirming(null);
  }, [confirming, handleDeleteCategory]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
      <div className="rounded-2xl border border-border/60 bg-surface-1/70 p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-text">Manajemen Kategori</h1>
        <p className="mt-2 text-sm text-muted">
          Buat, ubah, hapus, dan atur urutan kategori pemasukan dan pengeluaran.
        </p>
      </div>
      <section className="rounded-2xl border border-border/60 bg-surface-1/70 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-text">Tambah kategori baru</h2>
        <p className="mt-1 text-sm text-muted">
          Tentukan tipe kategori, beri nama, dan atur group serta urutan jika diperlukan.
        </p>
        <div className="mt-4">
          <CategoryForm
            key={createFormKey}
            mode="create"
            initialValues={{ name: "", type: "expense", group_name: null, order_index: null }}
            onSubmit={handleCreate}
            isSubmitting={creating}
          />
        </div>
      </section>
      {error ? (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          <div className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => reload()}
              className="inline-flex items-center gap-2 rounded-full border border-danger/40 px-3 py-1 text-xs font-semibold text-danger transition-colors hover:bg-danger/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60"
            >
              Coba lagi
            </button>
          </div>
        </div>
      ) : null}
      <CategoryList
        items={categories}
        editingId={editingId}
        pendingIds={pendingIds}
        loading={loading}
        onStartEdit={setEditingId}
        onCancelEdit={() => setEditingId(null)}
        onSubmitEdit={handleSubmitEdit}
        onDelete={(category) => setConfirming(category)}
        onMove={handleMove}
      />
      <ConfirmDialog
        open={Boolean(confirming)}
        title="Hapus kategori?"
        description="Kategori yang dihapus tidak dapat dikembalikan dan akan dilepas dari transaksi terkait."
        busy={confirming ? pendingIds.has(confirming.id) : false}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirming(null)}
      />
    </main>
  );
}
