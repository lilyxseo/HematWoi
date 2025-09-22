// @ts-nocheck
import { useState } from 'react';
import { EyeOff, SlidersHorizontal } from 'lucide-react';

export default function ColumnVisibility({ columns, hidden, onChange }) {
  const [open, setOpen] = useState(false);
  const hiddenSet = hidden || new Set();

  const toggleColumn = (id: string) => {
    const next = new Set(hiddenSet);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange?.(next);
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex h-[40px] items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm shadow-sm"
        onClick={() => setOpen((prev) => !prev)}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Kolom
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-border bg-background p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
            Kolom
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                onClick={() => onChange?.(new Set())}
              >
                Semua on
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                onClick={() => onChange?.(new Set(columns.map((c) => c.id)))}
              >
                <EyeOff className="h-3 w-3" />
                Semua off
              </button>
            </div>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1 text-sm">
            {columns.map((column) => (
              <label key={column.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-muted/60">
                <span className="truncate text-sm">{column.label}</span>
                <input
                  type="checkbox"
                  checked={!hiddenSet.has(column.id)}
                  onChange={() => toggleColumn(column.id)}
                  className="h-4 w-4 rounded border-muted"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
