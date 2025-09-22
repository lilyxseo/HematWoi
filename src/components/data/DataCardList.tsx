// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { MoreHorizontal, Trash2, X as CloseIcon } from 'lucide-react';
import clsx from 'clsx';
import {
  TransactionAccountEditor,
  TransactionAmountEditor,
  TransactionCategoryEditor,
  TransactionDateEditor,
  TransactionTagsEditor,
  TransactionTitleEditor,
  TransactionTypeEditor,
} from './TransactionFieldEditors';

const INTERACTIVE_FIELDS = new Set(['date', 'title', 'type', 'category', 'account', 'amount', 'tags']);

const SHEET_COMPONENTS = {
  date: TransactionDateEditor,
  title: TransactionTitleEditor,
  type: TransactionTypeEditor,
  category: TransactionCategoryEditor,
  account: TransactionAccountEditor,
  amount: TransactionAmountEditor,
  tags: TransactionTagsEditor,
};

export default function DataCardList({
  rows,
  columns,
  hiddenColumns,
  selectedIds,
  onToggleSelect,
  onAction,
  loading,
  editing,
}) {
  if (!Array.isArray(rows)) return null;

  const hidden = hiddenColumns || new Set();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ rowId: string; field: string } | null>(null);

  const interactiveColumns = useMemo(() => {
    if (!editing) return new Set();
    return new Set(
      columns.filter((column) => INTERACTIVE_FIELDS.has(column.id) && !hidden.has(column.id)).map((column) => column.id),
    );
  }, [columns, editing, hidden]);

  const handleOpenSheet = (row, column) => {
    if (!editing) return;
    if (!INTERACTIVE_FIELDS.has(column.id)) return;
    setSheet({ rowId: row.id, field: column.id });
  };

  const handleCloseSheet = () => {
    setSheet(null);
  };

  useEffect(() => {
    if (!sheet) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseSheet();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sheet]);

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

  const activeRow = sheet ? rows.find((row) => row.id === sheet.rowId) : null;
  const SheetComponent = sheet ? SHEET_COMPONENTS[sheet.field] : null;
  const sheetColumn = sheet ? columns.find((column) => column.id === sheet.field) : null;

  return (
    <>
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
                      <h3 className="font-semibold text-sm truncate">
                        {row.title || row.name || row.id}
                      </h3>
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
                  if (column.id === '__actions') return null;
                  const displayValue = column.display
                    ? column.display(row)
                    : column.accessor
                    ? column.accessor(row)
                    : row[column.id];
                  if (displayValue == null || displayValue === '') return null;
                  const interactive = interactiveColumns.has(column.id);
                  const status = interactive && editing ? editing.getStatus(row.id, column.id) : null;

                  if (interactive && editing) {
                    return (
                      <button
                        key={column.id}
                        type="button"
                        onClick={() => handleOpenSheet(row, column)}
                        className="flex min-w-0 flex-col rounded-xl border border-transparent bg-muted/40 px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="text-[11px] uppercase text-muted-foreground">{column.label}</span>
                        <span className={clsx('mt-1 flex items-center gap-2 text-sm font-medium text-foreground')}>
                          <span className="truncate">{displayValue}</span>
                          {status?.state === 'saving' ? (
                            <span className="text-xs text-muted-foreground">⋯</span>
                          ) : status?.state === 'error' ? (
                            <span className="text-xs text-red-500">!</span>
                          ) : null}
                        </span>
                      </button>
                    );
                  }

                  return (
                    <div key={column.id} className="min-w-0">
                      <p className="text-[11px] uppercase text-muted-foreground">{column.label}</p>
                      <p className={clsx('text-sm font-medium text-foreground', column.align === 'right' && 'text-right tabular-nums')}>
                        {displayValue}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {sheet && SheetComponent && activeRow && (
        <div
          className="fixed inset-0 z-40 flex flex-col justify-end bg-black/50"
          onClick={handleCloseSheet}
          role="presentation"
        >
          <div
            className="min-h-0 overflow-y-auto rounded-t-3xl bg-background p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Edit</p>
                <h3 className="text-base font-semibold text-foreground">{sheetColumn?.label || 'Field'}</h3>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border"
                onClick={handleCloseSheet}
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <SheetComponent row={activeRow} editing={editing} variant="sheet" autoFocus />
          </div>
        </div>
      )}
    </>
  );
}
