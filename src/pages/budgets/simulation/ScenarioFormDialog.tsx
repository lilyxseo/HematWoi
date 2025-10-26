import { FormEvent, useEffect, useState } from 'react';
import Modal from '../../../components/Modal';

export type ScenarioFormMode = 'create' | 'rename';

interface ScenarioFormDialogProps {
  open: boolean;
  mode: ScenarioFormMode;
  initialName?: string;
  initialNotes?: string | null;
  onClose: () => void;
  onSubmit: (payload: { name: string; notes: string }) => void;
  submitting?: boolean;
}

const LABEL_BY_MODE: Record<ScenarioFormMode, string> = {
  create: 'Buat Skenario Baru',
  rename: 'Ubah Nama Skenario',
};

export default function ScenarioFormDialog({
  open,
  mode,
  initialName = '',
  initialNotes = '',
  onClose,
  onSubmit,
  submitting = false,
}: ScenarioFormDialogProps) {
  const [name, setName] = useState(initialName);
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName ?? '');
      setNotes(initialNotes ?? '');
      setTouched(false);
    }
  }, [open, initialName, initialNotes]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!name.trim()) {
      return;
    }
    onSubmit({ name: name.trim(), notes: notes.trim() });
  }

  const hasError = touched && !name.trim();

  return (
    <Modal open={open} title={LABEL_BY_MODE[mode]} onClose={onClose}>
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="scenario-name" className="text-sm font-medium text-text-subtle">
            Nama Skenario
          </label>
          <input
            id="scenario-name"
            className="input input-bordered w-full"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Contoh: Optimis Q1"
            autoFocus
          />
          {hasError ? (
            <p className="text-sm text-rose-500">Nama wajib diisi.</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <label htmlFor="scenario-notes" className="text-sm font-medium text-text-subtle">
            Catatan (opsional)
          </label>
          <textarea
            id="scenario-notes"
            className="textarea textarea-bordered w-full"
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Catat asumsi simulasi..."
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {mode === 'create' ? 'Buat' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
