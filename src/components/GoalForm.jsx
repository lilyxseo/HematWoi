import { useState } from "react";

export default function GoalForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial.name || "",
    target: initial.target || 0,
    targetDate: initial.targetDate || "",
  });

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...initial, ...form });
      }}
    >
      <input
        className="w-full p-2 border rounded"
        placeholder="Nama tujuan"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />
      <input
        type="number"
        className="w-full p-2 border rounded"
        placeholder="Target"
        value={form.target}
        onChange={(e) => setForm({ ...form, target: Number(e.target.value) })}
        required
      />
      <input
        type="date"
        className="w-full p-2 border rounded"
        value={form.targetDate}
        onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
      />
      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          className="px-3 py-1 rounded bg-slate-200 dark:bg-slate-700"
          onClick={onCancel}
        >
          Batal
        </button>
        <button
          type="submit"
          className="px-3 py-1 rounded bg-brand text-white"
        >
          Simpan
        </button>
      </div>
    </form>
  );
}
