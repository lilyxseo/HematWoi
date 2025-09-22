// @ts-nocheck
import clsx from 'clsx';
import { Fragment } from 'react';

function HeaderCell({ column, hidden, onSortChange, sort }) {
  if (hidden) return null;
  const [sortField, sortDir] = sort?.split('-') ?? [];
  const active = sortField === column.id;
  const nextDir = active && sortDir === 'asc' ? 'desc' : 'asc';
  const handleSort = () => {
    if (!onSortChange) return;
    const field = column.sortField ?? column.id;
    if (!field) return;
    const prefix = column.sortField ? column.sortField : column.id;
    onSortChange(`${prefix}-${nextDir}`);
  };
  return (
    <th
      key={column.id}
      scope="col"
      className={clsx(
        'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground',
        column.align === 'right' && 'text-right',
        column.align === 'center' && 'text-center',
        column.headerClassName,
        'whitespace-nowrap'
      )}
    >
      <button
        type="button"
        onClick={column.sortable ? handleSort : undefined}
        className={clsx('flex items-center gap-1', column.align === 'right' && 'justify-end', column.align === 'center' && 'justify-center', !column.sortable && 'cursor-default')}
        disabled={!column.sortable}
      >
        <span className="truncate">{column.label}</span>
        {column.sortable && active && (
          <span className="text-xs font-normal text-muted-foreground">{sortDir === 'asc' ? '▲' : '▼'}</span>
        )}
      </button>
    </th>
  );
}

export default function DataTable({
  columns,
  rows,
  hiddenColumns,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  sort,
  onSortChange,
  loading,
}) {
  const hidden = hiddenColumns || new Set();
  const isAllSelected = rows.length > 0 && rows.every((row) => selectedIds?.has(row.id));
  const isIndeterminate = rows.some((row) => selectedIds?.has(row.id)) && !isAllSelected;

  return (
    <div className="-mx-3 md:mx-0 px-3 md:px-0 overflow-x-auto">
      <table className="table-auto md:table-fixed w-full text-sm">
        <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur">
          <tr className="text-left">
            <th scope="col" className="w-12 px-3 py-2">
              <label className="flex h-4 items-center justify-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isIndeterminate;
                  }}
                  onChange={() => onToggleAll?.()}
                  className="h-4 w-4 rounded border-muted"
                />
              </label>
            </th>
            {columns.map((column) => (
              <HeaderCell
                key={column.id}
                column={column}
                hidden={hidden.has(column.id)}
                onSortChange={onSortChange}
                sort={sort}
              />
            ))}
            <th className="w-12 px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {loading ? (
            <tr>
              <td colSpan={columns.length + 2} className="px-3 py-10 text-center text-muted-foreground">
                Memuat data...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 2} className="px-3 py-10 text-center text-muted-foreground">
                Tidak ada data
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.id || index} className="odd:bg-muted/30 hover:bg-muted/50">
                <td className="w-12 px-3 py-2 align-middle">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-muted"
                    checked={selectedIds?.has(row.id)}
                    onChange={() => onToggleSelect?.(row)}
                  />
                </td>
                {columns.map((column) => {
                  if (hidden.has(column.id)) return <Fragment key={column.id} />;
                  const value = column.render ? column.render(row) : column.accessor ? column.accessor(row) : row[column.id];
                  const cellClass = clsx(
                    'px-3 py-2 align-middle text-sm text-foreground',
                    column.align === 'right' && 'text-right tabular-nums',
                    column.align === 'center' && 'text-center',
                    column.className,
                    !column.render && 'max-w-[220px] truncate',
                  );
                  return (
                    <td key={column.id} className={cellClass} title={!column.render && typeof value === 'string' ? value : undefined}>
                      {value ?? (column.render ? null : '-')}
                    </td>
                  );
                })}
                <td className="w-12 px-3 py-2 text-right">
                  {row.__actions || null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
