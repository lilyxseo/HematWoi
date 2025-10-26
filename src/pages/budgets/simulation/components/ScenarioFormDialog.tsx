import { useEffect, useState } from 'react';
import type { BudgetSimScenario } from '../../../../lib/simScenarioApi';

interface ScenarioFormDialogProps {
  open: boolean;
  loading?: boolean;
  mode: 'create' | 'rename';
  scenario: BudgetSimScenario | null;
  onSubmit: (name: string) => void | Promise<void>;
  onClose: () => void;
}

export default function ScenarioFormDialog({
  open,
  loading = false,
  mode,
  scenario,
  onSubmit,
  onClose,
}: ScenarioFormDialogProps): JSX.Element | null {
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) {
      setName(scenario?.name ?? '');
    }
  }, [open, scenario?.name]);

  if (!open) return null;

  const title = mode === 'create' ? 'Buat skenario baru' : 'Ganti nama skenario';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 id="scenario-dialog-title" className="text-lg font-semibold text-text">
            {title}
          </h2>
          <button
            type="button"
            className="h-10 w-10 rounded-full text-xl text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
            aria-label="Tutup"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <form
          className="mt-6 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim() || loading) return;
            onSubmit(name.trim());
          }}
        >
          <label className="block text-sm font-medium text-muted">
            Nama skenario
            <input
              type="text"
              className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Contoh: Trim biaya makan"
              minLength={3}
              required
              aria-describedby="scenario-dialog-title"
              autoFocus
            />
          </label>
          <div className="flex justify-end gap-3 text-sm font-semibold">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center rounded-2xl border border-border px-5 text-muted transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="inline-flex h-11 items-center rounded-2xl bg-[color:var(--accent)] px-6 text-sm font-semibold text-white shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Menyimpan…' : mode === 'create' ? 'Buat' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

