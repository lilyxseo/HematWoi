import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { getInventory, listLocations } from '../../lib/api';
import type { InventoryRow } from '../../lib/types';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { formatDateTime } from '../../lib/utils';

const columns: ColumnDef<InventoryRow>[] = [
  { header: 'SKU', accessorKey: 'sku' },
  {
    header: 'Name',
    accessorKey: 'item_name',
    cell: ({ getValue }) => getValue<string>() || '-'
  },
  { header: 'Location', accessorKey: 'location' },
  { header: 'Qty on hand', accessorKey: 'qty_on_hand' },
  {
    header: 'Updated',
    accessorKey: 'updated_at',
    cell: ({ getValue }) => formatDateTime(getValue<string>())
  }
];

const InventoryPage = () => {
  const [filters, setFilters] = useState({ sku: '', location: '', zone: '' });
  const { data: inventory = [], isFetching } = useQuery({
    queryKey: ['inventory', filters],
    queryFn: () => getInventory({
      sku: filters.sku || undefined,
      location: filters.location || undefined,
      zone: filters.zone || undefined
    })
  });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: listLocations });

  const zones = useMemo(() => Array.from(new Set(locations.map((loc) => loc.zone))), [locations]);

  const exportCSV = () => {
    if (typeof document === 'undefined') return;
    const header = ['SKU', 'Item Name', 'Location', 'Qty', 'Updated'];
    const rows = inventory.map((row) => [
      row.sku,
      row.item_name ?? '',
      row.location,
      String(row.qty_on_hand),
      formatDateTime(row.updated_at)
    ]);
    const csv = [header, ...rows].map((line) => line.map((value) => `"${value}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'inventory.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card className="grid gap-4 lg:grid-cols-4">
        <div>
          <p className="text-xs font-medium text-slate-500">SKU</p>
          <Input
            value={filters.sku}
            onChange={(event) => setFilters((prev) => ({ ...prev, sku: event.target.value }))}
            placeholder="Search SKU"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Location</p>
          <Input
            value={filters.location}
            onChange={(event) => setFilters((prev) => ({ ...prev, location: event.target.value }))}
            placeholder="A01-1"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Zone</p>
          <Select
            value={filters.zone}
            onChange={(event) => setFilters((prev) => ({ ...prev, zone: event.target.value }))}
          >
            <option value="">All zones</option>
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end justify-end">
          <Button type="button" variant="secondary" onClick={exportCSV}>
            Export CSV
          </Button>
        </div>
      </Card>
      <DataTable
        data={isFetching ? [] : inventory}
        columns={columns}
        pageSize={12}
        emptyState={isFetching ? 'Loading inventory...' : 'No inventory rows'}
      />
    </div>
  );
};

export default InventoryPage;
