import { useEffect, useState } from "react";
import { isDuplicate } from "../lib/statement";

export default function ImportPreview({ rows = [], txs = [], categories, rules = {}, onBack, onImport }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const init = rows.map((r) => {
      const type = r.amount >= 0 ? "income" : "expense";
      const amount = Math.abs(Number(r.amount));
      const lcNote = (r.note || "").toLowerCase();
      let category = "";
      for (const [key, cat] of Object.entries(rules)) {
        if (lcNote.includes(key)) {
          category = cat;
          break;
        }
      }
      if (!category) category = categories[type]?.[0] || "";
      return {
        date: r.date,
        note: r.note,
        amount,
        type,
        category,
        duplicate: isDuplicate({ date: r.date, amount, note: r.note }, txs),
        remember: false,
      };
    });
    setItems(init);
  }, [rows, txs, categories, rules]);

  const handleCatChange = (idx, val) => {
    setItems((it) => it.map((r, i) => (i === idx ? { ...r, category: val } : r)));
  };
  const handleRemember = (idx, val) => {
    setItems((it) => it.map((r, i) => (i === idx ? { ...r, remember: val } : r)));
  };

  const handleImport = () => {
    const toImport = items.filter((i) => !i.duplicate);
    const newRules = {};
    items.forEach((i) => {
      if (i.remember && i.note) {
        newRules[i.note.toLowerCase()] = i.category;
      }
    });
    onImport(toImport, newRules);
  };

  const formatter = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

  return (
    <div className="space-y-4">
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="p-2">Tanggal</th>
              <th className="p-2">Catatan</th>
              <th className="p-2 text-right">Jumlah</th>
              <th className="p-2">Kategori</th>
              <th className="p-2">Duplikat</th>
              <th className="p-2">Rule</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r, idx) => (
              <tr key={idx} className="border-t border-slate-200 dark:border-slate-700">
                <td className="p-2 whitespace-nowrap">{r.date}</td>
                <td className="p-2">{r.note}</td>
                <td className="p-2 text-right">{formatter.format(r.amount)}</td>
                <td className="p-2">
                  <select
                    className="input"
                    value={r.category}
                    onChange={(e) => handleCatChange(idx, e.target.value)}
                  >
                    {(categories[r.type] || []).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  {r.duplicate && (
                    <span className="px-2 py-1 text-xs rounded bg-red-200 text-red-700">
                      Duplikat
                    </span>
                  )}
                </td>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={r.remember}
                    onChange={(e) => handleRemember(idx, e.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between">
        <button className="btn" type="button" onClick={onBack}>
          Kembali
        </button>
        <button className="btn btn-primary" type="button" onClick={handleImport}>
          Import
        </button>
      </div>
    </div>
  );
}
