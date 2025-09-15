import { formatCurrency } from "../../lib/format";

export default function BudgetTable({ items, onSelect }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-2">Kategori</th>
            <th className="py-2 text-right">Planned</th>
            <th className="py-2 text-right">Actual</th>
            <th className="py-2 text-right">Remaining</th>
            <th className="py-2 text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-border last:border-b-0 hover:bg-surface-1 cursor-pointer"
              onClick={() => onSelect(item)}
            >
              <td className="py-2">{item.category}</td>
              <td className="py-2 text-right">{formatCurrency(item.amount)}</td>
              <td className="py-2 text-right">{formatCurrency(item.actual)}</td>
              <td className="py-2 text-right">{formatCurrency(item.remaining)}</td>
              <td className="py-2 text-right">{item.pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
