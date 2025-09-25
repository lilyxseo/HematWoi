import { ArrowDown, ArrowUp, Loader2, Pencil, Trash2 } from "lucide-react";
import CategoryForm, { CategoryFormValues } from "./CategoryForm";
import type { CategoryRecord } from "../../lib/api-categories";

interface CategoryListProps {
  items: CategoryRecord[];
  editingId: string | null;
  pendingIds: Set<string>;
  loading?: boolean;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (category: CategoryRecord, values: CategoryFormValues) => Promise<void> | void;
  onDelete: (category: CategoryRecord) => void;
  onMove: (category: CategoryRecord, direction: "up" | "down") => void;
}

function formatTypeLabel(type: string): string {
  return type === "income" ? "Pemasukan" : "Pengeluaran";
}

function sortItems(items: CategoryRecord[]): CategoryRecord[] {
  return [...items].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    const orderDiff = (a.order_index ?? Number.POSITIVE_INFINITY) - (b.order_index ?? Number.POSITIVE_INFINITY);
    if (Number.isFinite(orderDiff) && orderDiff !== 0) {
      return orderDiff;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export default function CategoryList({
  items,
  editingId,
  pendingIds,
  loading = false,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onDelete,
  onMove,
}: CategoryListProps) {
  const sorted = sortItems(items);

  return (
    <section className="flex h-full min-w-0 flex-col rounded-2xl border border-border/60 bg-surface-1/60 p-4 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text">Daftar Kategori</h2>
          <p className="text-xs text-muted">{loading ? "Memuat..." : `${sorted.length} kategori`}</p>
        </div>
      </header>
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-muted">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat daftar...
          </div>
        </div>
      ) : sorted.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Belum ada kategori.</p>
      ) : (
        <div className="-mx-2 flex-1 overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-2 py-2">Nama</th>
                <th className="px-2 py-2">Tipe</th>
                <th className="px-2 py-2">Group</th>
                <th className="px-2 py-2 text-center">Urutan</th>
                <th className="px-2 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {sorted.map((item) => {
                const isEditing = editingId === item.id;
                const isBusy = pendingIds.has(item.id);
                const typeItems = sorted.filter((row) => row.type === item.type);
                const typeIndex = typeItems.findIndex((row) => row.id === item.id);
                const isFirst = typeIndex === 0;
                const isLast = typeIndex === typeItems.length - 1;

                if (isEditing) {
                  return (
                    <tr key={item.id} className="bg-surface-1">
                      <td colSpan={5} className="px-2 py-3">
                        <CategoryForm
                          mode="edit"
                          initialValues={{
                            name: item.name,
                            type: item.type,
                            group_name: item.group_name,
                            order_index: item.order_index ?? undefined,
                          }}
                          onSubmit={(values) => onSubmitEdit(item, values)}
                          onCancel={onCancelEdit}
                          isSubmitting={isBusy}
                          allowTypeChange
                        />
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={item.id} className="text-sm text-text">
                    <td className="px-2 py-2">
                      <div className="flex flex-col">
                        <span className="font-medium">{item.name || "Tanpa nama"}</span>
                        {item.inserted_at ? (
                          <span className="text-xs text-muted">Ditambahkan {new Date(item.inserted_at).toLocaleDateString()}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2 py-2 align-top text-xs font-medium text-muted">
                      {formatTypeLabel(item.type)}
                    </td>
                    <td className="px-2 py-2 align-top text-sm text-text">
                      {item.group_name ?? <span className="text-muted">-</span>}
                    </td>
                    <td className="px-2 py-2 text-center text-sm font-semibold text-text">
                      {Number.isFinite(item.order_index ?? NaN) ? item.order_index : "-"}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onMove(item, "up")}
                          disabled={isFirst || isBusy || typeItems.length <= 1}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-transparent text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Naikkan urutan"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onMove(item, "down")}
                          disabled={isLast || isBusy || typeItems.length <= 1}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-transparent text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Turunkan urutan"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onStartEdit(item.id)}
                          disabled={isBusy}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-transparent text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Edit kategori"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(item)}
                          disabled={isBusy}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-transparent text-danger transition-colors hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Hapus kategori"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
