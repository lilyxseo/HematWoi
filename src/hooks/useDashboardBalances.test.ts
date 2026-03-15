import { describe, expect, it } from 'vitest'
import { __dashboardBalanceInternals } from './useDashboardBalances'

const { isTransferLike, buildMetrics } = __dashboardBalanceInternals

describe('useDashboardBalances transfer handling', () => {
  it('treats linked transfer rows as transfer-like even when type is not transfer', () => {
    expect(
      isTransferLike({
        id: 'tx-1',
        user_id: 'u1',
        account_id: 'a1',
        to_account_id: null,
        parent_id: 'parent-1',
        transfer_group_id: null,
        type: 'expense',
        amount: 200,
        date: '2025-01-10',
        deleted_at: null,
      }),
    ).toBe(true)

    expect(
      isTransferLike({
        id: 'tx-2',
        user_id: 'u1',
        account_id: 'a1',
        to_account_id: 'a2',
        parent_id: null,
        transfer_group_id: 'group-1',
        type: 'income',
        amount: 200,
        date: '2025-01-10',
        deleted_at: null,
      }),
    ).toBe(true)
  })

  it('excludes transfer-like rows from income/expense while keeping balances correct', () => {
    const metrics = buildMetrics({
      transactions: [
        {
          id: 'income-1',
          user_id: 'u1',
          account_id: 'a1',
          to_account_id: null,
          parent_id: null,
          transfer_group_id: null,
          type: 'income',
          amount: 1000,
          date: '2025-01-02',
          deleted_at: null,
        },
        {
          id: 'expense-1',
          user_id: 'u1',
          account_id: 'a1',
          to_account_id: null,
          parent_id: null,
          transfer_group_id: null,
          type: 'expense',
          amount: 300,
          date: '2025-01-03',
          deleted_at: null,
        },
        {
          id: 'legacy-transfer',
          user_id: 'u1',
          account_id: 'a1',
          to_account_id: 'a2',
          parent_id: 'legacy-parent',
          transfer_group_id: null,
          type: 'expense',
          amount: 200,
          date: '2025-01-04',
          deleted_at: null,
        },
      ],
      accounts: [
        { id: 'a1', type: 'cash' },
        { id: 'a2', type: 'bank' },
      ],
      range: { start: '2025-01-01', end: '2025-01-31' },
    })

    expect(metrics.income).toBe(1000)
    expect(metrics.expense).toBe(300)
    expect(metrics.totalBalance).toBe(700)
  })
})
