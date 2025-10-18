import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listLocations, getInventory, createMovement } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { useOnlineStatus } from '../../app/providers';
import { enqueueMovement } from '../../lib/offlineQueue';
import { useAuthStore } from '../../lib/utils';
import type { MovementInput } from '../../lib/types';

const PutawaySchema = z.object({
  sku: z.string().min(1, 'SKU required'),
  from_location: z.string().optional(),
  to_location: z.string().min(1, 'Select destination'),
  qty: z.coerce.number().min(1, 'Quantity must be positive')
});

type PutawayForm = z.infer<typeof PutawaySchema>;

const PutawayPage = () => {
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: listLocations });
  const { data: inventory = [] } = useQuery({ queryKey: ['inventory'], queryFn: () => getInventory() });
  const { pushToast } = useToast();
  const { online } = useOnlineStatus();
  const role = useAuthStore((state) => state.role);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors }
  } = useForm<PutawayForm>({
    resolver: zodResolver(PutawaySchema),
    defaultValues: {
      sku: '',
      from_location: '',
      to_location: '',
      qty: 1
    }
  });

  const qty = watch('qty');
  const destination = watch('to_location');

  const occupancyByLocation = useMemo(() => {
    return inventory.reduce<Record<string, number>>((acc, row) => {
      acc[row.location] = (acc[row.location] || 0) + row.qty_on_hand;
      return acc;
    }, {});
  }, [inventory]);

  const destinationCapacity = useMemo(() => {
    if (!destination) return null;
    const location = locations.find((loc) => loc.code === destination);
    if (!location) return null;
    const occupancy = occupancyByLocation[destination] || 0;
    return { location, occupancy };
  }, [destination, locations, occupancyByLocation]);

  const mutation = useMutation({
    mutationFn: (payload: MovementInput) => createMovement(payload),
    onSuccess: () => {
      pushToast({ title: 'Putaway created', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['recentMovements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      reset({ sku: '', from_location: '', to_location: '', qty: 1 });
    },
    onError: async (_error, variables) => {
      await enqueueMovement(variables);
      pushToast({ title: 'Saved offline', description: 'Will sync once online', variant: 'warning' });
    }
  });

  const onSubmit = (values: PutawayForm) => {
    const payload: MovementInput = {
      type: 'putaway',
      sku: values.sku,
      qty: values.qty,
      operator: role,
      from_location: values.from_location,
      to_location: values.to_location
    };

    if (!online) {
      enqueueMovement(payload).then(() =>
        pushToast({ title: 'Queued offline', description: 'Putaway stored locally', variant: 'warning' })
      );
      reset({ sku: '', from_location: '', to_location: '', qty: 1 });
      return;
    }

    mutation.mutate(payload);
  };

  const isCapacityExceeded = useMemo(() => {
    if (!destinationCapacity) return false;
    return destinationCapacity.occupancy + Number(qty || 0) > destinationCapacity.location.capacity;
  }, [destinationCapacity, qty]);

  return (
    <Card className="max-w-3xl">
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 text-sm">
            <label className="font-medium text-slate-600" htmlFor="putaway-sku">
              Scan SKU
            </label>
            <Input id="putaway-sku" placeholder="SKU" {...register('sku')} />
            {errors.sku && <p className="text-xs text-rose-500">{errors.sku.message}</p>}
          </div>
          <div className="space-y-2 text-sm">
            <label className="font-medium text-slate-600" htmlFor="putaway-from">
              From location
            </label>
            <Input id="putaway-from" placeholder="Auto detect" {...register('from_location')} />
          </div>
          <div className="space-y-2 text-sm lg:col-span-2">
            <label className="font-medium text-slate-600" htmlFor="putaway-to">
              To location
            </label>
            <Select id="putaway-to" {...register('to_location')}>
              <option value="">Select destination</option>
              {locations.map((location) => (
                <option key={location.id} value={location.code}>
                  {location.code} • Zone {location.zone} • Cap {location.capacity}
                </option>
              ))}
            </Select>
            {errors.to_location && (
              <p className="text-xs text-rose-500">{errors.to_location.message}</p>
            )}
            {destinationCapacity && (
              <p className="text-xs text-slate-500">
                Occupancy {destinationCapacity.occupancy}/{destinationCapacity.location.capacity}
              </p>
            )}
            {isCapacityExceeded && (
              <p className="text-xs font-semibold text-amber-600">
                Warning: capacity exceeded by {destinationCapacity!.occupancy + Number(qty || 0) - destinationCapacity!.location.capacity} units
              </p>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <label className="font-medium text-slate-600" htmlFor="putaway-qty">
              Quantity
            </label>
            <Input id="putaway-qty" type="number" min={1} {...register('qty', { valueAsNumber: true })} />
            {errors.qty && <p className="text-xs text-rose-500">{errors.qty.message}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Processing...' : 'Confirm Putaway'}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default PutawayPage;
