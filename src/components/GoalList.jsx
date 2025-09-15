import { useState } from 'react';
import GoalCard from './GoalCard';
import GoalFormModal from './GoalFormModal';

export default function GoalList({ goals, onAdd, onUpdate, onDelete, onQuickAdd }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const startAdd = () => {
    setEditing(null);
    setOpen(true);
  };
  const startEdit = (g) => {
    setEditing(g);
    setOpen(true);
  };

  const handleSave = (data) => {
    if (editing) {
      onUpdate(editing.id, data);
    } else {
      onAdd({ ...data, id: crypto.randomUUID(), saved: 0, history: [] });
    }
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Goals</h2>
        <button className="btn btn-primary" onClick={startAdd}>
          Tambah
        </button>
      </div>
      {goals.length === 0 && (
        <div className="text-center text-sm text-slate-500">
          Belum ada goal.{' '}
          <button className="text-brand" onClick={startAdd}>
            Buat Goal Pertama
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((g) => (
          <GoalCard key={g.id} goal={g} onEdit={startEdit} onDelete={onDelete} onQuickAdd={onQuickAdd} />
        ))}
      </div>
      <GoalFormModal
        open={open}
        onClose={() => setOpen(false)}
        onSave={handleSave}
        initial={editing}
      />
    </div>
  );
}
