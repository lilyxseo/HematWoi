import { formatCurrency } from "../../lib/format";
import {
  IconX as X
} from '@tabler/icons-react';

export default function BudgetDetailPanel({ item, onClose }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-20 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-80 max-w-full bg-surface-1 p-4 shadow-lg overflow-y-auto">
        <button
          type="button"
          className="btn mb-4"
          onClick={onClose}
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="mb-2 text-lg font-semibold">{item.category}</h2>
        <div className="space-y-1 text-sm">
          <div>Planned: {formatCurrency(item.amount_planned)}</div>
          <div>Actual: {formatCurrency(item.actual)}</div>
          <div>Remaining: {formatCurrency(item.remaining)}</div>
        </div>
      </div>
    </div>
  );
}
