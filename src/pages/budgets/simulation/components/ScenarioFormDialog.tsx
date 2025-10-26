import { FormEvent, useEffect, useState } from 'react';

export interface ScenarioFormValues {
  name: string;
  notes: string;
}

interface ScenarioFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  defaultValues: ScenarioFormValues;
  onClose: () => void;
  onSubmit: (values: ScenarioFormValues) => Promise<void> | void;
}

const MODAL_CLASS =
  'fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-10 backdrop-blur-sm';

export default function ScenarioFormDialog({
  open,
  mode,
  defaultValues,
  onClose,
  onSubmit,
}: ScenarioFormDialogProps) {
  const [values, setValues] = useState<ScenarioFormValues>(defaultValues);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValues(defaultValues);
      setError(null);
      setSubmitting(false);
    }
  }, [open, defaultValues]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values.name.trim()) {
      setError('Nama wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        name: values.name.trim(),
        notes: values.notes.trim(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan skenario.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={MODAL_CLASS} role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-3xl border border-border-subtle bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-text">
          {mode === 'create' ? 'Buat skenario baru' : 'Ubah nama skenario'}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {mode === 'create'
            ? 'Skenario membantu kamu menyimpan draft penyesuaian anggaran.'
            : 'Sesuaikan detail skenario untuk memudahkan identifikasi.'}
        </p>
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-text">
            Nama skenario
            <input
              type="text"
              value={values.name}
              onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-border/60 bg-surface/80 px-3 py-2 text-sm text-text shadow-inner focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/60"
              placeholder="Mis. Budget Ramadan"
              autoFocus
            />
          </label>
          <label className="block text-sm font-medium text-text">
            Catatan (opsional)
            <textarea
              value={values.notes}
              onChange={(event) => setValues((prev) => ({ ...prev, notes: event.target.value }))}
              className="mt-1 h-24 w-full resize-none rounded-xl border border-border/60 bg-surface/80 px-3 py-2 text-sm text-text shadow-inner focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/60"
              placeholder="Tambahkan konteks atau asumsi."
            />
          </label>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border/60 bg-surface px-4 text-sm font-semibold text-text transition hover:border-border hover:bg-surface/80"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground shadow transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
