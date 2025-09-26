import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { useAccent } from "../context/AccentContext";
import { useToast } from "../context/ToastContext";
import { normalizeAccentHex } from "../lib/api-user-settings";

const PRESET_COLORS = [
  "#3898f8",
  "#2584e4",
  "#50b6ff",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
] as const;

type AccentResult = { ok: boolean; error?: string };

export default function AccentPicker() {
  const { accent, setAccent, loading, saving, error } = useAccent();
  const toast = useToast();
  const [inputValue, setInputValue] = useState<string>(accent);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setInputValue(accent);
  }, [accent]);

  const normalizedInput = useMemo(() => {
    try {
      return normalizeAccentHex(inputValue);
    } catch {
      return null;
    }
  }, [inputValue]);

  const colorPickerValue = normalizedInput ?? accent;
  const activeAccent = accent.toUpperCase();
  const combinedError = formError ?? error;
  const isBusy = saving || loading;

  const handlePreset = async (hex: string) => {
    if (isBusy) return;
    setFormError(null);
    setInputValue(hex.toUpperCase());
    const result = await persistAccent(hex);
    handleResult(result);
  };

  const persistAccent = async (hex: string): Promise<AccentResult> => {
    setFormError(null);
    const result = await setAccent(hex);
    return result;
  };

  const handleResult = (result: AccentResult, successMessage = "Warna aksen diperbarui") => {
    if (result.ok) {
      toast?.addToast(successMessage, "success");
      setFormError(null);
    } else {
      const message = result.error ?? "Gagal memperbarui warna";
      setFormError(message);
      toast?.addToast("Gagal memperbarui warna aksen", "error");
    }
  };

  const handleColorInput = (event: ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    setInputValue(event.target.value.toUpperCase());
  };

  const handleTextInput = (event: ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    const raw = event.target.value.trim().replace(/\s+/g, "");
    if (!raw) {
      setInputValue("");
      return;
    }
    const prefixed = raw.startsWith("#") ? raw : `#${raw}`;
    setInputValue(prefixed.toUpperCase());
  };

  const handleBlur = () => {
    if (!inputValue) return;
    try {
      setInputValue(normalizeAccentHex(inputValue));
    } catch {
      // keep current invalid value until corrected
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;
    const hex = inputValue || accent;
    const result = await persistAccent(hex);
    handleResult(result, "Warna aksen disimpan");
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-hidden>
        <div className="h-4 w-32 rounded-lg bg-surface-2 animate-pulse" />
        <div className="flex flex-wrap gap-3">
          {PRESET_COLORS.map((color) => (
            <div
              key={color}
              className="h-10 w-10 rounded-full bg-surface-2 animate-pulse"
            />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="h-12 rounded-xl bg-surface-2 animate-pulse" />
          <div className="h-12 rounded-xl bg-surface-2 animate-pulse" />
          <div className="h-12 rounded-xl bg-surface-2 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <p className="text-sm font-medium text-muted">Pilih warna aksen</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {PRESET_COLORS.map((color) => {
            const selected = activeAccent === color.toUpperCase();
            return (
              <button
                key={color}
                type="button"
                className={clsx(
                  "relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition",
                  selected
                    ? "border-[var(--accent,#3898f8)]"
                    : "border-transparent hover:border-[var(--accent-ring,rgba(56,152,248,0.35))]",
                  isBusy && "pointer-events-none opacity-60"
                )}
                style={{ backgroundColor: color }}
                onClick={() => handlePreset(color)}
                aria-label={`Pilih warna aksen ${color}`}
              >
                {selected ? (
                  <Check
                    className="h-5 w-5"
                    style={{ color: "var(--accent-foreground, #ffffff)" }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="flex flex-col gap-2 text-sm font-medium text-muted">
          <span>Pemilih warna</span>
          <input
            type="color"
            value={colorPickerValue}
            onChange={handleColorInput}
            disabled={isBusy}
            className="h-12 w-full cursor-pointer rounded-xl border border-border-subtle bg-surface"
            aria-label="Pilih warna aksen"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-muted">
          <span>Kode hex</span>
          <input
            type="text"
            value={inputValue}
            onChange={handleTextInput}
            onBlur={handleBlur}
            placeholder="#3898F8"
            className="h-12 rounded-xl border border-border-subtle bg-surface px-3 font-mono text-sm uppercase tracking-wide text-text"
            aria-label="Masukkan kode warna hex"
            disabled={isBusy}
          />
        </label>
        <button
          type="submit"
          className="btn btn-primary h-12 px-6"
          disabled={isBusy}
          aria-label="Simpan warna aksen"
        >
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
      {combinedError ? (
        <p className="form-error" role="alert">
          {combinedError}
        </p>
      ) : null}
    </form>
  );
}
