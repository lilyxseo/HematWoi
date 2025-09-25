import { Loader2, Pencil, Trash2 } from "lucide-react";
import type { CategoryRecord } from "../../lib/api-categories";
import CategoryForm, { type CategoryFormValues } from "./CategoryForm";

interface CategoryListProps {
  items: CategoryRecord[];
  loading?: boolean;
  editingId: string | null;
  pendingIds: Set<string>;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (id: string, values: CategoryFormValues) => Promise<void> | void;
  onDelete: (category: CategoryRecord) => void;
}

function formatTypeLabel(type: CategoryRecord["type"]): string {
  return type === "income" ? "Pemasukan" : "Pengeluaran";
}

export default function CategoryList({
  items,
  loading = false,
  editingId,
  pendingIds,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onDelete,
}: CategoryListProps) {
  return (
    <section className="rounded-2xl border border-border/60 bg-surface-1/60 p-4 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text">Daftar Kategori</h2>
          <p className="text-xs text-muted">
            {loading ? "Memuat kategori..." : `${items.length} kategori`}
          </p>
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border/60 text-left text-sm">
          <thead className="bg-surface-1/70 text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-3 py-2">Nama</th>
              <th scope="col" className="px-3 py-2">Tipe</th>
              <th scope="col" className="px-3 py-2">Grup</th>
              <th scope="col" className="px-3 py-2">Urutan</th>
              <th scope="col" className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-sm">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <tr key={`skeleton-${index}`} className="animate-pulse">
                  <td className="px-3 py-3">
                    <div className="h-4 w-32 rounded bg-border/70" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-4 w-20 rounded bg-border/70" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-4 w-24 rounded bg-border/70" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-4 w-12 rounded bg-border/70" />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="ml-auto h-4 w-16 rounded bg-border/70" />
                  </td>
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted">
                  Belum ada kategori yang tersimpan.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isEditing = editingId === item.id;
                const isBusy = pendingIds.has(item.id);
                if (isEditing) {
                  return (
                    <tr key={item.id}>
                      <td colSpan={5} className="px-3 py-3">
                        <CategoryForm
                          mode="edit"
                          initialValues={{
                            name: item.name,
                            type: item.type,
                            group_name: item.group_name ?? null,
                            order_index: item.order_index ?? null,
                          }}
                          onSubmit={(values) => onSubmitEdit(item.id, values)}
                          onCancel={onCancelEdit}
                          isSubmitting={isBusy}
                        />
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={item.id}>
                    <td className="px-3 py-3 text-sm font-medium text-text">{item.name || "Tanpa nama"}</td>
                    <td className="px-3 py-3 text-sm text-muted">{formatTypeLabel(item.type)}</td>
                    <td className="px-3 py-3 text-sm text-muted">
                      {item.group_name ? item.group_name : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-3 py-3 text-sm text-muted">
                      {typeof item.order_index === "number" && Number.isFinite(item.order_index)
                        ? item.order_index
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onStartEdit(item.id)}
                          disabled={isBusy}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-transparent text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Edit kategori"
                        >
                          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(item)}
                          disabled={isBusy}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-transparent text-rose-400 transition-colors hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Hapus kategori"
                        >
                          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
