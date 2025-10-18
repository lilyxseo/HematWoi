import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { listLocations } from '../../lib/api';
import type { Location } from '../../lib/types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { DataTable } from '../../components/ui/DataTable';
import { useToast } from '../../components/ui/Toast';
import { ColumnDef } from '@tanstack/react-table';

const LocationSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, 'Code required'),
  zone: z.string().min(1, 'Zone required'),
  capacity: z.coerce.number().min(1, 'Capacity must be positive')
});

type LocationForm = z.infer<typeof LocationSchema>;

const LocationsPage = () => {
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: listLocations });
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<LocationForm>({
    resolver: zodResolver(LocationSchema),
    defaultValues: {
      code: '',
      zone: '',
      capacity: 1
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const openModal = useCallback((location?: Location) => {
    if (location) {
      setEditing(location);
      reset(location);
    } else {
      setEditing(null);
      reset({ code: '', zone: '', capacity: 1 });
    }
    setOpen(true);
  }, [reset]);

  const closeModal = () => setOpen(false);

  const onSubmit = (values: LocationForm) => {
    const id = values.id ?? editing?.id ?? crypto.randomUUID();
    const next: Location = { ...values, id };
    queryClient.setQueryData<Location[]>(['locations'], (current = []) => {
      const idx = current.findIndex((loc) => loc.id === id);
      if (idx >= 0) {
        const nextLocations = [...current];
        nextLocations[idx] = next;
        return nextLocations;
      }
      return [next, ...current];
    });
    pushToast({ title: 'Location saved', variant: 'success' });
    setOpen(false);
  };

  const columns = useMemo<ColumnDef<Location>[]>(
    () => [
      { header: 'Code', accessorKey: 'code' },
      { header: 'Zone', accessorKey: 'zone' },
      { header: 'Capacity', accessorKey: 'capacity' },
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
          Add location
        </Button>
      </div>
      <DataTable data={locations} columns={columns} pageSize={8} emptyState="No locations" />
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--color-text)]">
                {editing ? 'Edit location' : 'Add location'}
              </h3>
              <Button variant="ghost" size="sm" onClick={closeModal}>
                Close
              </Button>
            </div>
            <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-1 text-xs">
                <label className="font-medium text-slate-500" htmlFor="location-code">
                  Code
                </label>
                <Input id="location-code" {...register('code')} />
                {errors.code && <span className="text-xs text-rose-500">{errors.code.message}</span>}
              </div>
              <div className="space-y-1 text-xs">
                <label className="font-medium text-slate-500" htmlFor="location-zone">
                  Zone
                </label>
                <Input id="location-zone" {...register('zone')} />
                {errors.zone && <span className="text-xs text-rose-500">{errors.zone.message}</span>}
              </div>
              <div className="space-y-1 text-xs">
                <label className="font-medium text-slate-500" htmlFor="location-capacity">
                  Capacity
                </label>
                <Input
                  id="location-capacity"
                  type="number"
                  min={1}
                  {...register('capacity', { valueAsNumber: true })}
                />
                {errors.capacity && <span className="text-xs text-rose-500">{errors.capacity.message}</span>}
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

export default LocationsPage;
