import { ArrowDown, ArrowUp, Loader2, Pencil, Trash2 } from "lucide-react";
import CategoryForm from "./CategoryForm";
import type { CategoryRecord, CategoryType } from "../../lib/api-categories";

interface CategoryListProps {
  type: CategoryType;
  title?: string;
  items: CategoryRecord[];
  editingId: string | null;
  pendingIds: Set<string>;
  loading?: boolean;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (
    category: CategoryRecord,
    values: { name: string; group_name?: string | null; order_index?: number | null; type: CategoryType }
  ) => Promise<void> | void;
  onDelete: (category: CategoryRecord) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}

const TYPE_TITLES: Record<CategoryType, string> = {
  income: "Income",
  expense: "Expense",
};

function formatOrder(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return String(value);
}

export default function CategoryList({
  type,
  title,
  items,
  editingId,
  pendingIds,
  loading = false,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: CategoryListProps) {
  const resolvedTitle = title ?? TYPE_TITLES[type] ?? "Kategori";

  return (
    <section className="flex h-full min-w-0 flex-col rounded-2xl border border-border/60 bg-surface-1/60 p-4 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text">{resolvedTitle}</h2>
          <p className="text-xs text-muted">
            {loading ? "Memuat..." : `${items.length} kategori`}
          </p>
        </div>
      </header>
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-muted">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat daftar...
          </div>
        </div>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Belum ada kategori {type === "income" ? "pemasukan" : "pengeluaran"}.
        </p>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <table className="min-w-full table-fixed border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-3">Nama</th>
                <th className="px-3">Grup</th>
                <th className="px-3 w-20">Urutan</th>
                <th className="px-3 w-32 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const isEditing = editingId === item.id;
                const isFirst = index === 0;
                const isLast = index === items.length - 1;
                const isBusy = pendingIds.has(item.id);
                return (
                  <tr key={item.id} className="rounded-xl border border-border/60 bg-surface-1/80 text-sm shadow-sm">
                    <td className="align-top px-3 py-3">
                      {isEditing ? (
                        <CategoryForm
                          mode="edit"
                          initialValues={{
                            name: item.name,
                            type: item.type,
                            group_name: item.group_name ?? "",
                            order_index: item.order_index ?? undefined,
                          }}
                          onSubmit={(values) => onSubmitEdit(item, values)}
                          onCancel={onCancelEdit}
                          isSubmitting={isBusy}
                          allowTypeChange={false}
                        />
                      ) : (
                        <div className="flex flex-col">
                          <span className="font-medium text-text">{item.name || "Tanpa nama"}</span>
                          <span className="text-xs text-muted">{item.inserted_at ? new Date(item.inserted_at).toLocaleDateString() : ""}</span>
                        </div>
                      )}
                    </td>
                    {!isEditing ? (
                      <td className="align-top px-3 py-3 text-sm text-text">
                        {item.group_name ? item.group_name : <span className="text-muted">-</span>}
                      </td>
                    ) : (
                      <td className="px-3 py-3 align-top" colSpan={2}></td>
                    )}
                    {!isEditing ? (
                      <td className="align-top px-3 py-3 text-sm text-text">{formatOrder(item.order_index)}</td>
                    ) : null}
                    <td className="align-top px-3 py-3 text-right">
                      {isEditing ? null : (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onMoveUp(item.id)}
                            disabled={isFirst || isBusy}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-transparent text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Naikkan urutan"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onMoveDown(item.id)}
                            disabled={isLast || isBusy}
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
                      )}
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
