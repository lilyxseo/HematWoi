import { useEffect, useState } from 'react';
import Modal from '../../../components/Modal.jsx';

interface ScenarioFormDialogProps {
  open: boolean;
  title: string;
  description?: string;
  defaultName?: string;
  defaultNotes?: string;
  pending?: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; notes: string }) => void;
}

export default function ScenarioFormDialog({
  open,
  title,
  description,
  defaultName = '',
  defaultNotes = '',
  pending = false,
  onClose,
  onSubmit,
}: ScenarioFormDialogProps) {
  const [name, setName] = useState(defaultName);
  const [notes, setNotes] = useState(defaultNotes);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setNotes(defaultNotes);
    }
  }, [open, defaultName, defaultNotes]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), notes });
  };

  return (
    <Modal open={open} title={title} onClose={pending ? () => {} : onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {description ? <p className="text-sm text-muted">{description}</p> : null}
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Nama skenario</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={3}
            maxLength={120}
            disabled={pending}
            className="h-11 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text shadow-inner transition focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-60"
            placeholder="Contoh: Penghematan akhir bulan"
            aria-label="Nama skenario"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Catatan</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={pending}
            rows={3}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text shadow-inner transition focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-60"
            placeholder="Opsional"
            aria-label="Catatan skenario"
          />
        </label>
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-border px-4 text-sm font-semibold text-muted transition hover:border-brand/40 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-6 text-sm font-semibold text-brand-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

