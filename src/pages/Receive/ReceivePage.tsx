import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { listItems, createMovement } from '../../lib/api';
import type { MovementInput } from '../../lib/types';
import { BarcodeInput } from '../../components/forms/BarcodeInput';
import { QuantityPad } from '../../components/forms/QuantityPad';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { RecentMovements } from '../../components/widgets/RecentMovements';
import { useOnlineStatus } from '../../app/providers';
import { enqueueMovement } from '../../lib/offlineQueue';
import { useToast } from '../../components/ui/Toast';
import { useAuthStore } from '../../lib/utils';

const ReceiveSchema = z.object({
  ref: z.string().min(1, 'Reference required'),
  barcode: z.string().min(1, 'Scan a barcode'),
  sku: z.string().min(1, 'SKU required'),
  qty: z.coerce.number().min(1, 'Quantity must be positive'),
  notes: z.string().optional()
});

type ReceiveForm = z.infer<typeof ReceiveSchema>;

const ReceivePage = () => {
  const { data: items = [] } = useQuery({ queryKey: ['items'], queryFn: listItems });
  const { online } = useOnlineStatus();
  const { pushToast } = useToast();
  const role = useAuthStore((state) => state.role);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<ReceiveForm>({
    resolver: zodResolver(ReceiveSchema),
    defaultValues: {
      ref: '',
      barcode: '',
      sku: '',
      qty: 1,
      notes: ''
    }
  });

  const qty = watch('qty');
  const barcodeValue = watch('barcode');

  useEffect(() => {
    if (!barcodeValue) return;
    const matched = items.find((item) => item.barcode === barcodeValue || item.sku === barcodeValue);
    if (matched) {
      setValue('sku', matched.sku, { shouldValidate: true });
    }
  }, [barcodeValue, items, setValue]);

  const mutation = useMutation({
    mutationFn: (payload: MovementInput) => createMovement(payload),
    onSuccess: () => {
      pushToast({ title: 'Movement recorded', description: 'Receive logged successfully', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['recentMovements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      reset({ ref: '', barcode: '', sku: '', qty: 1, notes: '' });
    },
    onError: async (error, variables) => {
      pushToast({ title: 'Failed to submit', description: 'Queued for retry when online', variant: 'warning' });
      await enqueueMovement(variables);
    }
  });

  const onSubmit = async (values: ReceiveForm) => {
    const payload: MovementInput = {
      type: 'receive',
      sku: values.sku,
      qty: values.qty,
      operator: role,
      ref: values.ref,
      notes: values.notes,
      to_location: null
    };

    if (!online) {
      await enqueueMovement(payload);
      pushToast({ title: 'Queued offline', description: 'Receive saved to offline queue', variant: 'warning' });
      reset({ ref: '', barcode: '', sku: '', qty: 1, notes: '' });
      return;
    }

    mutation.mutate(payload);
  };

  const adjustQuantity = (increment: number) => {
    setValue('qty', Math.max(1, Number(qty) + increment));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="lg:col-span-5">
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4">
            <div className="space-y-2 text-sm">
              <label className="font-medium text-slate-600" htmlFor="receive-ref">
                Reference / PO
              </label>
              <Input id="receive-ref" placeholder="PO-12345" {...register('ref')} />
              {errors.ref && <p className="text-xs text-rose-500">{errors.ref.message}</p>}
            </div>
            <div className="space-y-2 text-sm">
              <label className="font-medium text-slate-600" htmlFor="receive-barcode">
                Scan / Barcode
              </label>
              <BarcodeInput
                id="receive-barcode"
                placeholder="Scan barcode"
                {...register('barcode')}
                onEnter={handleSubmit(onSubmit)}
              />
              {errors.barcode && <p className="text-xs text-rose-500">{errors.barcode.message}</p>}
            </div>
            <div className="space-y-2 text-sm">
              <label className="font-medium text-slate-600" htmlFor="receive-sku-input">
                SKU
              </label>
              <Input id="receive-sku-input" list="receive-sku" placeholder="SKU" {...register('sku')} />
              <datalist id="receive-sku">
                {items.map((item) => (
                  <option key={item.id} value={item.sku}>
                    {item.name}
                  </option>
                ))}
              </datalist>
              {errors.sku && <p className="text-xs text-rose-500">{errors.sku.message}</p>}
            </div>
            <div className="space-y-2 text-sm">
              <label className="font-medium text-slate-600" htmlFor="receive-qty">
                Quantity
              </label>
              <Input id="receive-qty" type="number" min={1} {...register('qty', { valueAsNumber: true })} />
              {errors.qty && <p className="text-xs text-rose-500">{errors.qty.message}</p>}
            </div>
            <div className="space-y-2 text-sm">
              <label className="font-medium text-slate-600" htmlFor="receive-notes">
                Notes
              </label>
              <Input id="receive-notes" placeholder="Optional notes" {...register('notes')} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Submit Receive'}
          </Button>
        </form>
      </Card>
      <div className="space-y-6 lg:col-span-7">
        <Card>
          <h3 className="text-sm font-semibold text-slate-600">Quick quantity</h3>
          <p className="text-xs text-slate-500">Tap to add to the current quantity ({qty}).</p>
          <div className="mt-4">
            <QuantityPad onAdd={adjustQuantity} />
          </div>
        </Card>
        <RecentMovements />
      </div>
    </div>
  );
};

export default ReceivePage;
