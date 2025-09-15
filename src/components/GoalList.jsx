import { useState } from "react";
import GoalForm from "./GoalForm";
import { goalProgress } from "../lib/goals";

export default function GoalList({ goals = [], onSave }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Goals</h2>
        <button
          className="px-3 py-1 rounded bg-brand text-white"
          onClick={() => setAdding(true)}
        >
          Tambah
        </button>
      </div>
      {adding && (
        <GoalForm
          onSave={(g) => {
            onSave({ ...g, id: crypto.randomUUID(), allocated: 0 });
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {goals.map((g) => (
          <div
            key={g.id}
            className="p-4 border rounded shadow-sm bg-white dark:bg-slate-800"
          >
            <div className="font-medium mb-1">{g.name}</div>
            <div className="text-sm text-slate-500 mb-2">
              Rp {g.allocated?.toFixed(0)} / Rp {g.target.toFixed(0)}
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded">
              <div
                className="h-2 bg-brand rounded"
                style={{ width: `${goalProgress(g) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
