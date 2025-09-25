import { useEffect, useId, useState } from "react";
import type { CategoryType } from "../../lib/api-categories";

interface CategoryFormValues {
  name: string;
  type: CategoryType;
  group_name: string | null;
  order_index: number | null;
}

interface CategoryFormProps {
  mode?: "create" | "edit";
  initialValues?: Partial<CategoryFormValues>;
  onSubmit: (values: CategoryFormValues) => Promise<void> | void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  allowTypeChange?: boolean;
  submitLabel?: string;
}

const TYPE_OPTIONS: { value: CategoryType; label: string }[] = [
  { value: "income", label: "Pemasukan" },
  { value: "expense", label: "Pengeluaran" },
];

function normalizeType(value?: CategoryType | string | null): CategoryType {
  return value === "income" ? "income" : "expense";
}

function toNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function CategoryForm({
  mode = "create",
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  allowTypeChange = mode === "create",
  submitLabel,
}: CategoryFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [type, setType] = useState<CategoryType>(
    normalizeType(initialValues?.type)
  );
  const [groupName, setGroupName] = useState(initialValues?.group_name ?? "");
  const [orderInput, setOrderInput] = useState(
    initialValues?.order_index != null ? String(initialValues.order_index) : ""
  );

  const [nameError, setNameError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const nameId = useId();
  const typeId = useId();
  const groupId = useId();
  const orderId = useId();

  useEffect(() => {
    setName(initialValues?.name ?? "");
    setType(normalizeType(initialValues?.type));
    setGroupName(initialValues?.group_name ?? "");
    setOrderInput(
      initialValues?.order_index != null ? String(initialValues.order_index) : ""
    );
    setNameError(null);
    setOrderError(null);
  }, [initialValues?.name, initialValues?.type, initialValues?.group_name, initialValues?.order_index]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedGroup = groupName.trim();
    const parsedOrder = toNumber(orderInput);

    let hasError = false;
    if (!trimmedName || trimmedName.length > 60) {
      setNameError("Nama harus 1-60 karakter.");
      hasError = true;
    } else {
      setNameError(null);
    }

    if (orderInput.trim() && parsedOrder === null) {
      setOrderError("Urutan harus berupa angka.");
      hasError = true;
    } else {
      setOrderError(null);
    }

    if (hasError) return;

    try {
      await onSubmit({
        name: trimmedName,
        type,
        group_name: trimmedGroup ? trimmedGroup : null,
        order_index: parsedOrder,
      });
    } catch (error) {
      if (import.meta.env?.DEV || process.env?.NODE_ENV === "development") {
        console.error("[HW] category form submit failed", error);
      }
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <label
            htmlFor={nameId}
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Nama kategori
          </label>
          <input
            id={nameId}
            name="category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isSubmitting}
            className="h-10 w-full rounded-xl border border-border bg-surface-1/80 px-3 text-sm text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed"
            placeholder="Contoh: Gaji"
            autoComplete="off"
          />
          {nameError ? <p className="mt-1 text-xs text-danger">{nameError}</p> : null}
        </div>
        {allowTypeChange ? (
          <div className="min-w-0">
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
              className="h-10 w-full rounded-xl border border-border bg-surface-1/80 px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <label
            htmlFor={groupId}
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Grup (opsional)
          </label>
          <input
            id={groupId}
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            disabled={isSubmitting}
            className="h-10 w-full rounded-xl border border-border bg-surface-1/80 px-3 text-sm text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed"
            placeholder="Contoh: Kebutuhan Pokok"
            autoComplete="off"
          />
        </div>
        <div className="min-w-0">
          <label
            htmlFor={orderId}
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Urutan (opsional)
          </label>
          <input
            id={orderId}
            inputMode="numeric"
            value={orderInput}
            onChange={(event) => setOrderInput(event.target.value.replace(/[^0-9-]/g, ""))}
            disabled={isSubmitting}
            className="h-10 w-full rounded-xl border border-border bg-surface-1/80 px-3 text-sm text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed"
            placeholder="Contoh: 1"
          />
          {orderError ? <p className="mt-1 text-xs text-danger">{orderError}</p> : null}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="h-10 rounded-xl border border-border/70 bg-transparent px-4 text-sm font-medium text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed"
          >
            Batal
          </button>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Menyimpan..." : submitLabel ?? (mode === "edit" ? "Simpan" : "Tambah")}
        </button>
      </div>
    </form>
  );
}
