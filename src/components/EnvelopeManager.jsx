import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#a4de6c", "#d0ed57"];

export default function EnvelopeManager({ envelopes = [], onSave }) {
  const [name, setName] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <input
          className="flex-1 p-2 border rounded"
          placeholder="Kategori"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="px-3 py-1 rounded bg-brand text-white"
          onClick={() => {
            if (!name) return;
            onSave({ category: name, balance: 0 });
            setName("");
          }}
        >
          Tambah
        </button>
      </div>
      <div className="w-full h-48">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={envelopes}
              dataKey="balance"
              nameKey="category"
              innerRadius={30}
              outerRadius={50}
              paddingAngle={2}
            >
              {envelopes.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {envelopes.map((e) => (
          <div
            key={e.category}
            className="p-4 border rounded shadow-sm bg-white dark:bg-slate-800"
          >
            <div className="font-medium">{e.category}</div>
            <div className="text-sm text-slate-500">Rp {e.balance?.toFixed(0)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
