import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getInventory, listLocations, createMovement } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { useOnlineStatus } from '../../app/providers';
import { enqueueMovement } from '../../lib/offlineQueue';
import { useAuthStore } from '../../lib/utils';
import type { MovementInput } from '../../lib/types';

const CycleSchema = z.object({
  zone: z.string().min(1, 'Select zone'),
  location: z.string().min(1, 'Select location'),
  sku: z.string().min(1, 'SKU required'),
  counted_qty: z.coerce.number().min(0, 'Count must be positive')
});

type CycleForm = z.infer<typeof CycleSchema>;

const CycleCountPage = () => {
  const { data: inventory = [] } = useQuery({ queryKey: ['inventory'], queryFn: () => getInventory() });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: listLocations });
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
  } = useForm<CycleForm>({
    resolver: zodResolver(CycleSchema),
    defaultValues: {
      zone: '',
      location: '',
      sku: '',
      counted_qty: 0
    }
  });

  const zone = watch('zone');
  const location = watch('location');
  const sku = watch('sku');
  const countedQty = watch('counted_qty');

  const zoneLocations = useMemo(
    () => locations.filter((loc) => (zone ? loc.zone === zone : true)),
    [locations, zone]
  );

  const expectedQty = useMemo(() => {
    const row = inventory.find((entry) => entry.location === location && entry.sku === sku);
    return row?.qty_on_hand ?? 0;
  }, [inventory, location, sku]);

  const difference = useMemo(() => Number(countedQty || 0) - expectedQty, [countedQty, expectedQty]);

  const mutation = useMutation({
    mutationFn: (payload: MovementInput) => createMovement(payload),
    onSuccess: () => {
      pushToast({ title: 'Adjustment sent', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['recentMovements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      reset({ zone, location: '', sku: '', counted_qty: 0 });
    },
    onError: async (_error, variables) => {
      await enqueueMovement(variables);
      pushToast({ title: 'Saved offline', description: 'Adjustment queued', variant: 'warning' });
    }
  });

  const onSubmit = (values: CycleForm) => {
    const payload: MovementInput = {
      type: 'adjust',
      sku: values.sku,
      qty: Math.abs(difference),
      operator: role,
      from_location: difference < 0 ? values.location : undefined,
      to_location: difference > 0 ? values.location : undefined,
      notes: `Cycle count variance from ${expectedQty} to ${values.counted_qty}`
    };

    if (!difference) {
      pushToast({ title: 'No variance', description: 'Counts match system', variant: 'success' });
      return;
    }

    if (!online) {
      enqueueMovement(payload).then(() =>
        pushToast({ title: 'Queued offline', description: 'Adjustment stored locally', variant: 'warning' })
      );
      reset({ zone: values.zone, location: '', sku: '', counted_qty: 0 });
      return;
    }

    mutation.mutate(payload);
  };

  return (
    <Card className="max-w-4xl">
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 text-sm">
            <label className="font-medium text-slate-600" htmlFor="cycle-zone">
              Zone
            </label>
            <Select id="cycle-zone" {...register('zone')}>
              <option value="">Select zone</option>
              {[...new Set(locations.map((loc) => loc.zone))].map((zValue) => (
                <option key={zValue} value={zValue}>
                  {zValue}
                </option>
              ))}
            </Select>
            {errors.zone && <p className="text-xs text-rose-500">{errors.zone.message}</p>}
          </div>
          <div className="space-y-2 text-sm">
            <label className="font-medium text-slate-600" htmlFor="cycle-location">
              Location
            </label>
            <Select id="cycle-location" {...register('location')}>
              <option value="">Select location</option>
              {zoneLocations.map((loc) => (
                <option key={loc.id} value={loc.code}>
                  {loc.code}
                </option>
              ))}
            </Select>
            {errors.location && <p className="text-xs text-rose-500">{errors.location.message}</p>}
          </div>
          <div className="space-y-2 text-sm lg:col-span-2">
            <label className="font-medium text-slate-600" htmlFor="cycle-sku">
              Scan SKU
            </label>
            <Input id="cycle-sku" placeholder="SKU" {...register('sku')} />
            {errors.sku && <p className="text-xs text-rose-500">{errors.sku.message}</p>}
          </div>
          <div className="space-y-2 text-sm">
            <label className="font-medium text-slate-600" htmlFor="cycle-count">
              Counted quantity
            </label>
            <Input id="cycle-count" type="number" min={0} {...register('counted_qty', { valueAsNumber: true })} />
            {errors.counted_qty && <p className="text-xs text-rose-500">{errors.counted_qty.message}</p>}
          </div>
          <div className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600">
            <p>Expected: {expectedQty}</p>
            <p>Variance: {difference > 0 ? `+${difference}` : difference}</p>
            <p>Status: {difference === 0 ? 'Balanced' : difference > 0 ? 'Over' : 'Short'}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button type="submit">Send Adjustment</Button>
        </div>
      </form>
    </Card>
  );
};

export default CycleCountPage;
