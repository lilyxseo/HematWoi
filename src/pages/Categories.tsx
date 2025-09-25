import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import CategoryForm from "../components/categories/CategoryForm";
import CategoryList from "../components/categories/CategoryList";
import { useToast } from "../context/ToastContext";
import {
  CategoryRecord,
  CategoryType,
  createCategory,
  deleteCategory,
  listCategories,
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

function sortCategories(list: CategoryRecord[]): CategoryRecord[] {
  return [...list].sort((a, b) => {
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

  const orderedCategories = useMemo(
    () => sortCategories(categories),
    [categories]
  );

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
    async (values: {
      name: string;
      type: CategoryType;
      group_name: string | null;
      order_index: number | null;
    }) => {
      const trimmedName = values.name.trim();
      if (!trimmedName || trimmedName.length > 60) {
        addToast("Nama kategori harus 1-60 karakter.", "error");
        return;
      }
      if (!["income", "expense"].includes(values.type)) {
        addToast("Tipe kategori tidak valid.", "error");
        return;
      }
      if (isDuplicateName(values.type, trimmedName)) {
        addToast("Nama kategori sudah digunakan pada tipe ini.", "error");
        return;
      }

      setCreating(true);
      try {
        const created = await createCategory({
          name: trimmedName,
          type: values.type,
          group_name: values.group_name,
          order_index: values.order_index,
        });
        setCategories((prev) => sortCategories([...prev, created]));
        setCreateFormKey((prev) => prev + 1);
        addToast("Kategori berhasil ditambahkan.", "success");
      } catch (err) {
        logDevError("createCategory", err);
        addToast(toMessage(err, "Gagal menambah kategori."), "error");
      } finally {
        setCreating(false);
      }
    },
    [addToast, isDuplicateName]
  );

  const handleSubmitEdit = useCallback(
    async (
      id: string,
      values: {
        name: string;
        type: CategoryType;
        group_name: string | null;
        order_index: number | null;
      }
    ) => {
      const trimmed = values.name.trim();
      if (!trimmed || trimmed.length > 60) {
        addToast("Nama kategori harus 1-60 karakter.", "error");
        return;
      }
      if (isDuplicateName(values.type, trimmed, id)) {
        addToast("Nama kategori sudah digunakan pada tipe ini.", "error");
        return;
      }

      addPending([id]);
      const snapshot = categories;
      try {
        const updated = await updateCategory(id, {
          name: trimmed,
          type: values.type,
          group_name: values.group_name,
          order_index: values.order_index,
        });
        setCategories((prev) =>
          sortCategories(prev.map((cat) => (cat.id === updated.id ? updated : cat)))
        );
        setEditingId(null);
        addToast("Perubahan kategori disimpan.", "success");
      } catch (err) {
        logDevError("updateCategory", err);
        setCategories(snapshot);
        addToast(toMessage(err, "Gagal memperbarui kategori."), "error");
      } finally {
        removePending([id]);
      }
    },
    [addPending, addToast, categories, isDuplicateName, removePending]
  );

  const handleDeleteCategory = useCallback(
    async (category: CategoryRecord) => {
      const snapshot = categories;
      setCategories((prev) => prev.filter((cat) => cat.id !== category.id));
      addPending([category.id]);
      try {
        await deleteCategory(category.id);
        addToast("Kategori dihapus.", "success");
      } catch (err) {
        logDevError("deleteCategory", err);
        setCategories(snapshot);
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
          Buat, ubah, hapus, dan kelola urutan kategori pemasukan dan pengeluaran.
        </p>
      </div>
      <section className="rounded-2xl border border-border/60 bg-surface-1/70 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-text">Tambah kategori baru</h2>
        <p className="mt-1 text-sm text-muted">
          Nama dan tipe wajib diisi, grup serta urutan bersifat opsional.
        </p>
        <div className="mt-4">
          <CategoryForm
            key={createFormKey}
            mode="create"
            initialValues={{ type: "expense" }}
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
        items={orderedCategories}
        loading={loading}
        pendingIds={pendingIds}
        editingId={editingId}
        onStartEdit={(id) => setEditingId(id)}
        onCancelEdit={() => setEditingId(null)}
        onSubmitEdit={handleSubmitEdit}
        onDelete={(category) => setConfirming(category)}
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
