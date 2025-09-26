import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import CategoryForm from "../components/categories/CategoryForm";
import CategoryList from "../components/categories/CategoryList";
import { useToast } from "../context/ToastContext";
import PageHeader from "../layout/PageHeader";
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
  const headingId = useMemo(() => `confirm-title-${Math.random().toString(36).slice(2)}`, []);
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

function sortByOrder(list: CategoryRecord[]): CategoryRecord[] {
  return [...list].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

function resequenceType(records: CategoryRecord[], type: CategoryType): CategoryRecord[] {
  const orderedIds = records
    .filter((cat) => cat.type === type)
    .sort((a, b) => {
      const diff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    })
    .map((cat) => cat.id);
  const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
  return records.map((cat) =>
    cat.type === type && orderMap.has(cat.id)
      ? { ...cat, sort_order: orderMap.get(cat.id)! }
      : cat
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
        setCategories(rows);
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

  const grouped = useMemo(() => {
    const income = sortByOrder(categories.filter((cat) => cat.type === "income"));
    const expense = sortByOrder(categories.filter((cat) => cat.type === "expense"));
    return { income, expense };
  }, [categories]);

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
    async (values: { name: string; color: string; type: CategoryType }) => {
      const trimmed = values.name.trim();
      const color = values.color.toUpperCase();
      const type = values.type;
      if (!trimmed || trimmed.length > 60) {
        addToast("Nama kategori harus 1-60 karakter.", "error");
        return;
      }
      if (!/^#[0-9A-F]{6}$/i.test(color)) {
        addToast("Gunakan warna dengan format #RRGGBB.", "error");
        return;
      }
      if (isDuplicateName(type, trimmed)) {
        addToast("Nama kategori sudah digunakan pada tipe ini.", "error");
        return;
      }

      const optimisticId =
        globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
      const optimistic: CategoryRecord = {
        id: optimisticId,
        user_id: null,
        name: trimmed,
        color,
        type,
        sort_order: grouped[type].length,
        created_at: null,
        updated_at: null,
      };
      setCategories((prev) => [...prev, optimistic]);
      setCreating(true);
      try {
        const created = await createCategory({ name: trimmed, type, color });
        setCategories((prev) =>
          prev.map((cat) => (cat.id === optimisticId ? created : cat))
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
    [addToast, grouped, isDuplicateName]
  );

  const handleSubmitEdit = useCallback(
    async (category: CategoryRecord, values: { name: string; color: string; type: CategoryType }) => {
      const trimmed = values.name.trim();
      const color = values.color.toUpperCase();
      if (!trimmed || trimmed.length > 60) {
        addToast("Nama kategori harus 1-60 karakter.", "error");
        return;
      }
      if (!/^#[0-9A-F]{6}$/i.test(color)) {
        addToast("Gunakan warna dengan format #RRGGBB.", "error");
        return;
      }
      if (isDuplicateName(category.type, trimmed, category.id)) {
        addToast("Nama kategori sudah digunakan pada tipe ini.", "error");
        return;
      }

      const snapshot = categories;
      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === category.id ? { ...cat, name: trimmed, color } : cat
        )
      );
      addPending([category.id]);
      try {
        const updated = await updateCategory(category.id, { name: trimmed, color });
        setCategories((prev) =>
          prev.map((cat) => (cat.id === updated.id ? { ...cat, ...updated } : cat))
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
    async (type: CategoryType, id: string, direction: "up" | "down") => {
      const ordered = type === "income" ? grouped.income : grouped.expense;
      const index = ordered.findIndex((item) => item.id === id);
      if (index < 0) return;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= ordered.length) return;

      const snapshot = categories;
      const reordered = [...ordered];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, moved);
      const orderedIds = reordered.map((item) => item.id);
      const orderMap = new Map(orderedIds.map((catId, sortIndex) => [catId, sortIndex]));

      setCategories((prev) =>
        prev.map((cat) =>
          cat.type === type && orderMap.has(cat.id)
            ? { ...cat, sort_order: orderMap.get(cat.id)! }
            : cat
        )
      );
      addPending(orderedIds);

      try {
        await reorderCategories(type, orderedIds);
      } catch (err) {
        setCategories(snapshot);
        logDevError("reorderCategories", err);
        addToast(toMessage(err, "Gagal mengurutkan kategori."), "error");
      } finally {
        removePending(orderedIds);
      }
    },
    [addPending, addToast, categories, grouped, removePending]
  );

  const handleDeleteCategory = useCallback(
    async (category: CategoryRecord) => {
      const snapshot = categories;
      const remaining = snapshot.filter((cat) => cat.id !== category.id);
      const resequenced = resequenceType(remaining, category.type);
      setCategories(resequenced);
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
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="space-y-6">
        <PageHeader
          title="Manajemen Kategori"
          description="Buat, ubah, hapus, dan atur urutan kategori pemasukan dan pengeluaran."
        />
        <section className="rounded-2xl border border-border/60 bg-surface-1/70 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text">Tambah kategori baru</h2>
          <p className="mt-1 text-sm text-muted">
            Pilih tipe kategori, beri nama, dan sesuaikan warnanya.
          </p>
          <div className="mt-4">
            <CategoryForm
              key={createFormKey}
              mode="create"
              initialValues={{ name: "", color: "#0EA5E9", type: "expense" }}
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
        <div className="grid gap-4 md:grid-cols-2">
          <CategoryList
            type="income"
            title="Pemasukan"
            items={grouped.income}
            editingId={editingId}
            pendingIds={pendingIds}
            loading={loading}
            onStartEdit={setEditingId}
            onCancelEdit={() => setEditingId(null)}
            onSubmitEdit={handleSubmitEdit}
            onDelete={(category) => setConfirming(category)}
            onMoveUp={(id) => handleMove("income", id, "up")}
            onMoveDown={(id) => handleMove("income", id, "down")}
          />
          <CategoryList
            type="expense"
            title="Pengeluaran"
            items={grouped.expense}
            editingId={editingId}
            pendingIds={pendingIds}
            loading={loading}
            onStartEdit={setEditingId}
            onCancelEdit={() => setEditingId(null)}
            onSubmitEdit={handleSubmitEdit}
            onDelete={(category) => setConfirming(category)}
            onMoveUp={(id) => handleMove("expense", id, "up")}
            onMoveDown={(id) => handleMove("expense", id, "down")}
          />
        </div>
      </div>
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
