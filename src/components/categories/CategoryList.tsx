import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import type { CategoryRecord, CategoryType } from "../../lib/api-categories";

interface CategoryListProps {
  items: CategoryRecord[];
  loading?: boolean;
  pendingIds: Set<string>;
  editingId: string | null;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (
    id: string,
    values: {
      name: string;
      type: CategoryType;
      group_name: string | null;
      order_index: number | null;
    }
  ) => Promise<void> | void;
  onDelete: (item: CategoryRecord) => void;
}

const TYPE_LABEL: Record<CategoryType, string> = {
  income: "Pemasukan",
  expense: "Pengeluaran",
};

function toNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeType(value: string | CategoryType): CategoryType {
  return value === "income" ? "income" : "expense";
}

interface EditableRowProps {
  item: CategoryRecord;
  onSubmit: (values: {
    name: string;
    type: CategoryType;
    group_name: string | null;
    order_index: number | null;
  }) => Promise<void> | void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function EditableRow({ item, onSubmit, onCancel, isSubmitting }: EditableRowProps) {
  const [name, setName] = useState(item.name);
  const [type, setType] = useState<CategoryType>(item.type);
  const [groupName, setGroupName] = useState(item.group_name ?? "");
  const [orderInput, setOrderInput] = useState(
    item.order_index != null ? String(item.order_index) : ""
  );
  const [error, setError] = useState<string | null>(null);

  const nameId = useId();
  const typeId = useId();
  const groupId = useId();
  const orderId = useId();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 60) {
      setError("Nama harus 1-60 karakter.");
      return;
    }
    const parsedOrder = toNumber(orderInput);
    if (orderInput.trim() && parsedOrder === null) {
      setError("Urutan harus berupa angka.");
      return;
    }
    setError(null);
    await onSubmit({
      name: trimmedName,
      type,
      group_name: groupName.trim() ? groupName.trim() : null,
      order_index: parsedOrder,
    });
  };

  return (
    <tr className="bg-surface-1/80">
      <td colSpan={5} className="p-3">
        <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-5" noValidate>
          <div className="md:col-span-2">
            <label
              htmlFor={nameId}
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
            >
              Nama
            </label>
            <input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
              className="h-10 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label
              htmlFor={typeId}
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
            >
              Tipe
            </label>
            <select
              id={typeId}
              value={type}
              onChange={(event) => setType(normalizeType(event.target.value as CategoryType))}
              disabled={isSubmitting}
              className="h-10 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed"
            >
              <option value="income">Pemasukan</option>
              <option value="expense">Pengeluaran</option>
            </select>
          </div>
          <div>
            <label
              htmlFor={groupId}
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
            >
              Grup
            </label>
            <input
              id={groupId}
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              disabled={isSubmitting}
              className="h-10 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label
              htmlFor={orderId}
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
            >
              Urutan
            </label>
            <input
              id={orderId}
              inputMode="numeric"
              value={orderInput}
              onChange={(event) => setOrderInput(event.target.value.replace(/[^0-9-]/g, ""))}
              disabled={isSubmitting}
              className="h-10 w-full rounded-xl border border-border bg-surface-1 px-3 text-sm text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed"
            />
          </div>
          <div className="flex items-end justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border/60 px-4 text-sm font-medium text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
          {error ? (
            <div className="md:col-span-5">
              <p className="text-xs text-danger">{error}</p>
            </div>
          ) : null}
        </form>
      </td>
    </tr>
  );
}

export default function CategoryList({
  items,
  loading = false,
  pendingIds,
  editingId,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onDelete,
}: CategoryListProps) {
  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-border/60 bg-surface-1/60 p-6 text-muted">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat kategori...
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-border/60 bg-surface-1/60 p-6 text-sm text-muted">
        Belum ada kategori.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-surface-1/60 shadow-sm">
      <table className="min-w-full divide-y divide-border/60 text-sm">
        <thead className="bg-surface-1/70 text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Nama</th>
            <th className="px-4 py-3 text-left font-semibold">Tipe</th>
            <th className="px-4 py-3 text-left font-semibold">Grup</th>
            <th className="px-4 py-3 text-left font-semibold">Urutan</th>
            <th className="px-4 py-3 text-right font-semibold">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {items.map((item) => {
            if (editingId === item.id) {
              return (
                <EditableRow
                  key={item.id}
                  item={item}
                  onSubmit={(values) => onSubmitEdit(item.id, values)}
                  onCancel={onCancelEdit}
                  isSubmitting={pendingIds.has(item.id)}
                />
              );
            }
            const isBusy = pendingIds.has(item.id);
            return (
              <tr key={item.id} className="bg-surface-1/80">
                <td className="px-4 py-3 font-medium text-text">{item.name || "(Tanpa nama)"}</td>
                <td className="px-4 py-3 text-muted">{TYPE_LABEL[item.type]}</td>
                <td className="px-4 py-3 text-muted">{item.group_name || "-"}</td>
                <td className="px-4 py-3 text-muted">{item.order_index ?? "-"}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onStartEdit(item.id)}
                      disabled={isBusy}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed"
                      aria-label="Edit kategori"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      disabled={isBusy}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-danger transition-colors hover:text-danger/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50 disabled:cursor-not-allowed"
                      aria-label="Hapus kategori"
                    >
                      {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
