import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { listItems } from '../../lib/api';
import type { Item } from '../../lib/types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { DataTable } from '../../components/ui/DataTable';
import { useToast } from '../../components/ui/Toast';
import { ColumnDef } from '@tanstack/react-table';

const ItemSchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(1, 'SKU required'),
  name: z.string().min(1, 'Name required'),
  uom: z.string().min(1, 'UOM required'),
  barcode: z.string().min(1, 'Barcode required'),
  group: z.string().min(1, 'Group required'),
  status: z.enum(['active', 'inactive'])
});

type ItemForm = z.infer<typeof ItemSchema>;

const ItemsPage = () => {
  const { data: items = [] } = useQuery({ queryKey: ['items'], queryFn: listItems });
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ItemForm>({
    resolver: zodResolver(ItemSchema),
    defaultValues: {
      sku: '',
      name: '',
      uom: '',
      barcode: '',
      group: '',
      status: 'active'
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const openModal = useCallback((item?: Item) => {
    if (item) {
      setEditing(item);
      reset(item);
    } else {
      setEditing(null);
      reset({ sku: '', name: '', uom: '', barcode: '', group: '', status: 'active' });
    }
    setOpen(true);
  }, [reset]);

  const closeModal = () => setOpen(false);

  const onSubmit = (values: ItemForm) => {
    const id = values.id ?? editing?.id ?? crypto.randomUUID();
    const next: Item = { ...values, id };
    queryClient.setQueryData<Item[]>(['items'], (current = []) => {
      const existingIndex = current.findIndex((item) => item.id === id);
      if (existingIndex >= 0) {
        const nextItems = [...current];
        nextItems[existingIndex] = next;
        return nextItems;
      }
      return [next, ...current];
    });
    pushToast({ title: 'Item saved', variant: 'success' });
    setOpen(false);
  };

  const columns = useMemo<ColumnDef<Item>[]>(
    () => [
      { header: 'SKU', accessorKey: 'sku' },
      { header: 'Name', accessorKey: 'name' },
      { header: 'Group', accessorKey: 'group' },
      { header: 'UOM', accessorKey: 'uom' },
      { header: 'Barcode', accessorKey: 'barcode' },
      { header: 'Status', accessorKey: 'status' },
      {
        header: 'Actions',
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" onClick={() => openModal(row.original)}>
            Edit
          </Button>
        )
      }
    ],
    [openModal]
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => openModal()} size="sm">
          Add item
        </Button>
      </div>
      <DataTable data={items} columns={columns} pageSize={8} emptyState="No items" />
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--color-text)]">
                {editing ? 'Edit item' : 'Add item'}
              </h3>
              <Button variant="ghost" size="sm" onClick={closeModal}>
                Close
              </Button>
            </div>
            <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-1 text-xs">
                  <label className="font-medium text-slate-500" htmlFor="item-sku">
                    SKU
                  </label>
                  <Input id="item-sku" {...register('sku')} />
                  {errors.sku && <span className="text-xs text-rose-500">{errors.sku.message}</span>}
                </div>
                <div className="space-y-1 text-xs">
                  <label className="font-medium text-slate-500" htmlFor="item-name">
                    Name
                  </label>
                  <Input id="item-name" {...register('name')} />
                  {errors.name && <span className="text-xs text-rose-500">{errors.name.message}</span>}
                </div>
                <div className="space-y-1 text-xs">
                  <label className="font-medium text-slate-500" htmlFor="item-uom">
                    UOM
                  </label>
                  <Input id="item-uom" {...register('uom')} />
                  {errors.uom && <span className="text-xs text-rose-500">{errors.uom.message}</span>}
                </div>
                <div className="space-y-1 text-xs">
                  <label className="font-medium text-slate-500" htmlFor="item-barcode">
                    Barcode
                  </label>
                  <Input id="item-barcode" {...register('barcode')} />
                  {errors.barcode && <span className="text-xs text-rose-500">{errors.barcode.message}</span>}
                </div>
                <div className="space-y-1 text-xs">
                  <label className="font-medium text-slate-500" htmlFor="item-group">
                    Group
                  </label>
                  <Input id="item-group" {...register('group')} />
                  {errors.group && <span className="text-xs text-rose-500">{errors.group.message}</span>}
                </div>
                <div className="space-y-1 text-xs">
                  <label className="font-medium text-slate-500" htmlFor="item-status">
                    Status
                  </label>
                  <Select id="item-status" {...register('status')}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ItemsPage;
