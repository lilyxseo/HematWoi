import { useState, useEffect } from "react";

export default function AutoAllocationRules({ goals = [], envelopes = [], rules, onSave }) {
  const [local, setLocal] = useState(rules || { goals: {}, envelopes: {} });

  useEffect(() => setLocal(rules || { goals: {}, envelopes: {} }), [rules]);

  const handleGoal = (id, field, value) => {
    setLocal((prev) => ({
      ...prev,
      goals: { ...prev.goals, [id]: { ...prev.goals[id], [field]: value } },
    }));
  };
  const handleEnv = (cat, field, value) => {
    setLocal((prev) => ({
      ...prev,
      envelopes: {
        ...prev.envelopes,
        [cat]: { ...prev.envelopes[cat], [field]: value },
      },
    }));
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Aturan Alokasi Otomatis</h2>
      <div className="space-y-2">
        {goals.map((g) => (
          <div key={g.id} className="flex gap-2 items-center">
            <span className="flex-1">{g.name}</span>
            <input
              type="number"
              className="w-24 p-1 border rounded"
              placeholder="Fix"
              value={local.goals?.[g.id]?.fixed || ""}
              onChange={(e) => handleGoal(g.id, "fixed", Number(e.target.value))}
            />
            <input
              type="number"
              className="w-20 p-1 border rounded"
              placeholder="%"
              value={local.goals?.[g.id]?.percent || ""}
              onChange={(e) => handleGoal(g.id, "percent", Number(e.target.value))}
            />
          </div>
        ))}
      </div>
      <div className="space-y-2 pt-4">
        {envelopes.map((e) => (
          <div key={e.category} className="flex gap-2 items-center">
            <span className="flex-1">{e.category}</span>
            <input
              type="number"
              className="w-24 p-1 border rounded"
              placeholder="Fix"
              value={local.envelopes?.[e.category]?.fixed || ""}
              onChange={(ev) =>
                handleEnv(e.category, "fixed", Number(ev.target.value))
              }
            />
            <input
              type="number"
              className="w-20 p-1 border rounded"
              placeholder="%"
              value={local.envelopes?.[e.category]?.percent || ""}
              onChange={(ev) =>
                handleEnv(e.category, "percent", Number(ev.target.value))
              }
            />
          </div>
        ))}
      </div>
      <button
        className="px-3 py-1 rounded bg-brand text-white"
        onClick={() => onSave(local)}
      >
        Simpan Aturan
      </button>
    </div>
  );
}
