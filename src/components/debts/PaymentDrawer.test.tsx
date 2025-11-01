import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PaymentDrawer from './PaymentDrawer';

describe('PaymentDrawer', () => {
  const baseProps = {
    open: true,
    debt: {
      id: 'd1',
      user_id: 'u1',
      type: 'receivable' as const,
      party_name: 'Andi',
      title: 'Pinjam',
      date: new Date().toISOString(),
      due_date: null,
      amount: 100000,
      rate_percent: null,
      paid_total: 0,
      remaining: 100000,
      status: 'ongoing' as const,
      notes: null,
      tenor_months: 1,
      tenor_sequence: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    payments: [],
    accounts: [],
    categories: [],
    loading: false,
    submitting: false,
    deletingId: null,
    accountsLoading: false,
    categoriesLoading: false,
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onDeletePayment: vi.fn(),
  };

  it('submits payment without transaction when toggle is unchecked', async () => {
    render(<PaymentDrawer {...baseProps} />);

    const amountInput = screen.getByLabelText(/Nominal pembayaran/i);
    fireEvent.change(amountInput, { target: { value: '100000' } });

    const toggle = screen.getByLabelText(/Catat juga transaksi/i);
    fireEvent.click(toggle);

    const submitButton = screen.getByRole('button', { name: /Catat Pembayaran/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(baseProps.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ includeTransaction: false })
      );
    });
  });
});
