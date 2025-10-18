import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { listRecentMovements } from '../../lib/api';
import type { Movement } from '../../lib/types';
import { formatDateTime } from '../../lib/utils';
import { DataTable } from '../ui/DataTable';
import { Badge } from '../ui/Badge';

const columns: ColumnDef<Movement>[] = [
  {
    header: 'Timestamp',
    accessorKey: 'ts',
    cell: ({ getValue }) => <span className="font-medium">{formatDateTime(getValue<string>())}</span>
  },
  {
    header: 'Type',
    accessorKey: 'type',
    cell: ({ getValue }) => {
      const type = getValue<string>();
      const variant =
        type === 'receive' ? 'success' : type === 'pick' ? 'danger' : type === 'adjust' ? 'warning' : 'default';
      return <Badge variant={variant}>{type}</Badge>;
    }
  },
  {
    header: 'SKU',
    accessorKey: 'sku'
  },
  {
    header: 'Qty',
    accessorKey: 'qty'
  },
  {
    header: 'From',
    accessorKey: 'from_location'
  },
  {
    header: 'To',
    accessorKey: 'to_location'
  },
  {
    header: 'Operator',
    accessorKey: 'operator'
  }
];

export const RecentMovements = () => {
  const { data = [], isLoading } = useQuery({
    queryKey: ['recentMovements'],
    queryFn: () => listRecentMovements(8),
    refetchInterval: 15_000
  });

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">Recent Movements</h3>
          <p className="text-xs text-slate-500">Live feed from the last sync cycle.</p>
        </div>
      </header>
      <DataTable data={isLoading ? [] : data} columns={columns} pageSize={8} emptyState="No recent movements" />
    </div>
  );
};
