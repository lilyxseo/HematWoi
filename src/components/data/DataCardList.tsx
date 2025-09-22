// @ts-nocheck
import { useState } from 'react';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import clsx from 'clsx';

export default function DataCardList({
  rows,
  columns,
  hiddenColumns,
  selectedIds,
  onToggleSelect,
  onAction,
  loading,
}) {
  const hidden = hiddenColumns || new Set();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="rounded-2xl border bg-card/80 shadow-sm p-4 space-y-2 animate-pulse">
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-3 rounded bg-muted/80" />
              <div className="h-3 rounded bg-muted/80" />
            </div>
            <div className="flex justify-end">
              <div className="h-8 w-20 rounded bg-muted/80" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return <p className="text-center text-sm text-muted-foreground">Tidak ada data.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const rowKey = row.id || `row-${index}`;
        return (
          <div key={rowKey} className="rounded-2xl border bg-card/80 shadow-sm p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-muted"
                    checked={selectedIds?.has(row.id)}
                    onChange={() => onToggleSelect?.(row)}
                  />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate">{row.title || row.name || row.id}</h3>
                    {row.subtitle && <p className="text-xs text-muted-foreground truncate">{row.subtitle}</p>}
                  </div>
                </div>
              </div>
              <div className="relative flex items-center gap-1">
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-muted-foreground"
                  onClick={() => setOpenMenu(openMenu === rowKey ? null : rowKey)}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {openMenu === rowKey && (
                  <div className="absolute right-0 top-10 z-20 w-40 rounded-lg border bg-background p-2 shadow-lg">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      onClick={() => {
                        setOpenMenu(null);
                        onAction?.('delete', row);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Hapus
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {columns.map((column) => {
                if (hidden.has(column.id)) return null;
                const value = column.render ? column.render(row) : column.accessor ? column.accessor(row) : row[column.id];
                if (value == null || value === '') return null;
                return (
                  <div key={column.id} className="min-w-0">
                    <p className="text-[11px] uppercase text-muted-foreground">{column.label}</p>
                    <p className={clsx('text-sm font-medium text-foreground', column.align === 'right' && 'text-right tabular-nums')}>
                      {value}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
