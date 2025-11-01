import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PaymentDrawer from './PaymentDrawer';

const sampleDebt = {
  id: 'debt-1',
  user_id: 'user-1',
  type: 'receivable' as const,
  party_name: 'John Doe',
  title: 'Pinjam A',
  date: new Date('2024-05-01T00:00:00Z').toISOString(),
  due_date: new Date('2024-06-01T00:00:00Z').toISOString(),
  amount: 1000000,
  rate_percent: null,
  paid_total: 0,
  remaining: 1000000,
  status: 'ongoing' as const,
  notes: null,
  tenor_months: 1,
  tenor_sequence: 1,
  created_at: new Date('2024-05-01T00:00:00Z').toISOString(),
  updated_at: new Date('2024-05-01T00:00:00Z').toISOString(),
};

const accounts = [
  {
    id: 'acc-1',
    name: 'Cash',
    type: 'cash' as const,
    currency: 'IDR',
    created_at: new Date('2024-01-01T00:00:00Z').toISOString(),
    sort_order: null,
  },
];

const categories = [
  {
    id: 'cat-1',
    user_id: 'user-1',
    name: 'Piutang',
    type: 'income' as const,
    icon: null,
    sort_order: null,
    created_at: new Date('2024-01-01T00:00:00Z').toISOString(),
  },
];

describe('PaymentDrawer', () => {
  it('submits without linked transaction when toggle is disabled', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <PaymentDrawer
        open
        debt={sampleDebt}
        payments={[]}
        accounts={accounts}
        categories={categories}
        loading={false}
        submitting={false}
        deletingId={null}
        accountsLoading={false}
        categoriesLoading={false}
        onClose={() => {}}
        onSubmit={handleSubmit}
        onDeletePayment={() => {}}
      />,
    );

    const amountInput = screen.getByLabelText(/Nominal pembayaran/i);
    fireEvent.change(amountInput, { target: { value: '1000000' } });

    const toggle = screen.getByLabelText(/Catat juga transaksi/i);
    fireEvent.click(toggle);

    const submitButton = screen.getByRole('button', { name: /Catat Pembayaran/i });
    fireEvent.click(submitButton);

    await waitFor(() => expect(handleSubmit).toHaveBeenCalled());

    const payload = handleSubmit.mock.calls[0][0];
    expect(payload.includeTransaction).toBe(false);
    expect(payload.accountId).toBeNull();
  });
});
