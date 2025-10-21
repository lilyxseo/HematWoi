import {
  IconArrowDown as ArrowDown,
  IconArrowUp as ArrowUp,
  IconLoader2 as Loader2,
  IconPencil as Pencil,
  IconTrash as Trash2
} from '@tabler/icons-react';
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
    values: { name: string; color: string; type: CategoryType }
  ) => Promise<void> | void;
  onDelete: (category: CategoryRecord) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}

const TYPE_TITLES: Record<CategoryType, string> = {
  income: "Income",
  expense: "Expense",
};

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
        <ul className="flex-1 space-y-3 overflow-y-auto pr-1">
          {items.map((item, index) => {
            const isEditing = editingId === item.id;
            const isFirst = index === 0;
            const isLast = index === items.length - 1;
            const isBusy = pendingIds.has(item.id);
            return (
              <li
                key={item.id}
                className="rounded-xl border border-border/60 bg-surface-1/80 p-3 shadow-sm"
              >
                {isEditing ? (
                  <CategoryForm
                    mode="edit"
                    initialValues={{ name: item.name, color: item.color, type: item.type }}
                    onSubmit={(values) => onSubmitEdit(item, values)}
                    onCancel={onCancelEdit}
                    isSubmitting={isBusy}
                    allowTypeChange={false}
                  />
                ) : (
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-white/20"
                      style={{ backgroundColor: item.color || "#64748B" }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">
                      {item.name || "Tanpa nama"}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
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
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-transparent text-rose-400 transition-colors hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Hapus kategori"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
