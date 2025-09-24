import { useEffect, useId, useState } from "react";
import type { CategoryType } from "../../lib/api-categories";
import ColorSwatch from "./ColorSwatch";

interface CategoryFormValues {
  name: string;
  color: string;
  type: CategoryType;
}

interface CategoryFormProps {
  mode?: "create" | "edit";
  initialValues?: CategoryFormValues;
  onSubmit: (values: CategoryFormValues) => Promise<void> | void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  allowTypeChange?: boolean;
}

const TYPE_OPTIONS: { value: CategoryType; label: string }[] = [
  { value: "income", label: "Pemasukan" },
  { value: "expense", label: "Pengeluaran" },
];

function normalizeType(value?: CategoryType): CategoryType {
  return value === "income" ? "income" : "expense";
}

export default function CategoryForm({
  mode = "create",
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  allowTypeChange = mode === "create",
}: CategoryFormProps) {
  const defaultName = initialValues?.name ?? "";
  const defaultColor = initialValues?.color ?? "#64748B";
  const defaultType = normalizeType(initialValues?.type);

  const [name, setName] = useState(defaultName);
  const [color, setColor] = useState(defaultColor);
  const [type, setType] = useState<CategoryType>(defaultType);
  const [nameError, setNameError] = useState<string | null>(null);
  const [colorError, setColorError] = useState<string | null>(null);

  const nameId = useId();
  const typeId = useId();

  useEffect(() => {
    setName(defaultName);
    setColor(defaultColor);
    setType(defaultType);
    setNameError(null);
    setColorError(null);
  }, [defaultName, defaultColor, defaultType]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    let hasError = false;

    if (!trimmed || trimmed.length < 1 || trimmed.length > 60) {
      setNameError("Nama harus 1-60 karakter.");
      hasError = true;
    } else {
      setNameError(null);
    }

    if (!/^#[0-9A-F]{6}$/i.test(color)) {
      setColorError("Gunakan format #RRGGBB.");
      hasError = true;
    } else {
      setColorError(null);
    }

    if (hasError) return;

    try {
      await onSubmit({ name: trimmed, color: color.toUpperCase(), type });
    } catch (error) {
      if (import.meta.env?.DEV || process.env?.NODE_ENV === "development") {
        console.error("[HW] category form submit failed", error);
      }
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <label htmlFor={nameId} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Nama kategori
          </label>
          <input
            id={nameId}
            name="category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isSubmitting}
            className="h-10 w-full min-w-0 rounded-xl border border-border bg-surface-1/80 px-3 text-sm text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed"
            placeholder="Contoh: Gaji"
          />
          {nameError ? <p className="mt-1 text-xs text-danger">{nameError}</p> : null}
        </div>
        {allowTypeChange ? (
          <div className="min-w-0">
            <label htmlFor={typeId} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Tipe
            </label>
            <select
              id={typeId}
              value={type}
              onChange={(event) => setType(normalizeType(event.target.value as CategoryType))}
              disabled={isSubmitting}
              className="h-10 w-full min-w-0 rounded-xl border border-border bg-surface-1/80 px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed"
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
      <div className="min-w-0">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Warna</p>
        <ColorSwatch
          value={color}
          onChange={setColor}
          disabled={isSubmitting}
          name="category-color"
        />
        {colorError ? <p className="mt-1 text-xs text-danger">{colorError}</p> : null}
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
          {mode === "edit" ? "Simpan" : "Tambah"}
        </button>
      </div>
    </form>
  );
}
