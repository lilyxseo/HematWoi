import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getInventory, createMovement } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useOnlineStatus } from '../../app/providers';
import { enqueueMovement } from '../../lib/offlineQueue';
import { useToast } from '../../components/ui/Toast';
import { useAuthStore } from '../../lib/utils';
import type { MovementInput } from '../../lib/types';

const PickSchema = z.object({
  task_id: z.string().optional(),
  sku: z.string().min(1, 'SKU required'),
  location: z.string().min(1, 'Location required'),
  qty: z.coerce.number().min(1, 'Quantity must be positive')
});

type PickForm = z.infer<typeof PickSchema>;

const PickPage = () => {
  const { data: inventory = [] } = useQuery({ queryKey: ['inventory'], queryFn: () => getInventory() });
  const { online } = useOnlineStatus();
  const { pushToast } = useToast();
  const role = useAuthStore((state) => state.role);
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors }
  } = useForm<PickForm>({
    resolver: zodResolver(PickSchema),
    defaultValues: {
      task_id: '',
      sku: '',
      location: '',
      qty: 1
    }
  });

  const sku = watch('sku');

  const guidedRoute = useMemo(() => {
    if (!sku) return [];
    return inventory
      .filter((row) => row.sku === sku)
      .sort((a, b) => a.location.localeCompare(b.location))
      .map((row) => `${row.location} • ${row.qty_on_hand} on hand`);
  }, [inventory, sku]);

  const mutation = useMutation({
    mutationFn: (payload: MovementInput) => createMovement(payload),
    onSuccess: (_, variables) => {
      pushToast({ title: 'Pick confirmed', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['recentMovements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      if (variables.from_location) {
        setProgress((current) => [...current, variables.from_location!]);
      }
      reset({ task_id: variables.ref ?? '', sku: '', location: '', qty: 1 });
    },
    onError: async (_error, variables) => {
      await enqueueMovement(variables);
      pushToast({ title: 'Saved offline', description: 'Pick queued for sync', variant: 'warning' });
    }
  });

  const onSubmit = (values: PickForm) => {
    const payload: MovementInput = {
      type: 'pick',
      sku: values.sku,
      qty: values.qty,
      operator: role,
      from_location: values.location,
      ref: values.task_id
    };

    if (!online) {
      enqueueMovement(payload).then(() =>
        pushToast({ title: 'Queued offline', description: 'Pick stored locally', variant: 'warning' })
      );
      setProgress((current) => [...current, values.location]);
      reset({ task_id: values.task_id, sku: '', location: '', qty: 1 });
      return;
    }

    mutation.mutate(payload);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2 text-sm">
            <label className="font-medium text-slate-600" htmlFor="pick-task">
              Task / DO ID
            </label>
            <Input id="pick-task" placeholder="Task-001" {...register('task_id')} />
          </div>
          <div className="space-y-2 text-sm">
            <label className="font-medium text-slate-600" htmlFor="pick-sku">
              Scan SKU
            </label>
            <Input id="pick-sku" placeholder="SKU" {...register('sku')} />
            {errors.sku && <p className="text-xs text-rose-500">{errors.sku.message}</p>}
          </div>
          <div className="space-y-2 text-sm">
            <label className="font-medium text-slate-600" htmlFor="pick-location">
              Location
            </label>
            <Input id="pick-location" placeholder="A01-01" {...register('location')} />
            {errors.location && <p className="text-xs text-rose-500">{errors.location.message}</p>}
          </div>
          <div className="space-y-2 text-sm">
            <label className="font-medium text-slate-600" htmlFor="pick-qty">
              Quantity
            </label>
            <Input id="pick-qty" type="number" min={1} {...register('qty', { valueAsNumber: true })} />
            {errors.qty && <p className="text-xs text-rose-500">{errors.qty.message}</p>}
          </div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Processing...' : 'Confirm Pick'}
          </Button>
        </form>
      </Card>
      <Card className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-600">Guided route</h3>
          <p className="text-xs text-slate-500">Locations sorted alphanumerically to minimize walking.</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {guidedRoute.length === 0 && <li>No route calculated. Scan SKU to load locations.</li>}
            {guidedRoute.map((step) => (
              <li key={step} className="rounded-lg bg-slate-100 px-3 py-2">
                {step}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-600">Progress</h3>
          <p className="text-xs text-slate-500">Completed stops this session.</p>
          <ul className="mt-3 space-y-2 text-sm text-emerald-600">
            {progress.length === 0 && <li>Waiting for first pick.</li>}
            {progress.map((loc, idx) => (
              <li key={`${loc}-${idx}`}>✓ {loc}</li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default PickPage;
