import { ArrowDown, ArrowUp, EllipsisVertical, Loader2, Pencil, Trash2 } from "lucide-react";
import { type DragEvent, useCallback, useMemo, useState } from "react";
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
  onReorder: (orderedIds: string[]) => void;
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
  onReorder,
}: CategoryListProps) {
  const resolvedTitle = title ?? TYPE_TITLES[type] ?? "Kategori";
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const orderedIds = useMemo(() => items.map((item) => item.id), [items]);

  const handleDragStart = useCallback(
    (id: string) => (event: DragEvent<HTMLLIElement>) => {
      setDraggingId(id);
      setDragOverId(null);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
    },
    []
  );

  const handleDragOver = useCallback(
    (id: string) => (event: DragEvent<HTMLLIElement>) => {
      if (!draggingId || draggingId === id) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDragOverId(id);
    },
    [draggingId]
  );

  const handleDrop = useCallback(
    (id: string) => (event: DragEvent<HTMLLIElement>) => {
      event.preventDefault();
      const sourceId = event.dataTransfer.getData("text/plain") || draggingId;
      setDraggingId(null);
      setDragOverId(null);
      if (!sourceId || sourceId === id) return;
      const sourceIndex = orderedIds.indexOf(sourceId);
      const targetIndex = orderedIds.indexOf(id);
      if (sourceIndex < 0 || targetIndex < 0) return;
      const next = [...orderedIds];
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, sourceId);
      if (next.join("|") !== orderedIds.join("|")) {
        onReorder(next);
      }
    },
    [draggingId, onReorder, orderedIds]
  );

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverId(null);
  }, []);

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
            const isDragging = draggingId === item.id;
            const isDropTarget = dragOverId === item.id;
            return (
              <li
                key={item.id}
                draggable={!isEditing && !isBusy}
                onDragStart={handleDragStart(item.id)}
                onDragOver={handleDragOver(item.id)}
                onDrop={handleDrop(item.id)}
                onDragEnd={handleDragEnd}
                className={`rounded-xl border border-border/60 bg-surface-1/80 p-3 shadow-sm transition ${
                  isDropTarget ? "border-brand/60 ring-1 ring-brand/40" : ""
                } ${isDragging ? "opacity-60" : ""}`}
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
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-muted"
                      aria-hidden="true"
                    >
                      <EllipsisVertical className="h-4 w-4" />
                    </span>
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
