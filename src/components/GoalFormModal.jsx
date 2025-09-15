import { useEffect, useState } from 'react';
import Modal from './Modal';

export default function GoalFormModal({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState({ name: '', target: 0, saved: 0 });
  useEffect(() => {
    if (open) {
      setForm({
        name: initial?.name || '',
        target: initial?.target || 0,
        saved: initial?.saved || 0,
      });
    }
  }, [open, initial]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Goal' : 'Tambah Goal'}>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          className="w-full p-2 border rounded"
          placeholder="Nama goal"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          type="number"
          className="w-full p-2 border rounded"
          placeholder="Target"
          value={form.target}
          min={1}
          onChange={(e) => setForm({ ...form, target: Number(e.target.value) })}
          required
        />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary">
            Simpan
          </button>
        </div>
      </form>
    </Modal>
  );
}
