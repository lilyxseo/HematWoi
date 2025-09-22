import { useState } from "react";

export default function GoalForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial.name || "",
    target: initial.target || 0,
    targetDate: initial.targetDate || "",
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...initial, ...form });
      }}
    >
      <input
        className="input"
        placeholder="Nama tujuan"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />
      <input
        type="number"
        className="input"
        placeholder="Target"
        value={form.target}
        onChange={(e) => setForm({ ...form, target: Number(e.target.value) })}
        required
      />
      <input
        type="date"
        className="input"
        value={form.targetDate}
        onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
      />
      <div className="flex justify-end gap-2 pt-3">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Batal
        </button>
        <button type="submit" className="btn btn-primary">
          Simpan
        </button>
      </div>
    </form>
  );
}
