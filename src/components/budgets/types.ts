import type { BudgetActivity, BudgetRecord, CarryRule } from '../../lib/api-budgets';

export type BudgetStatus = 'on-track' | 'overspend' | 'warning';

export interface BudgetViewModel {
  id: string;
  label: string;
  categoryId: string | null;
  period: string;
  planned: number;
  rolloverIn: number;
  rolloverOut: number;
  actual: number;
  inflow: number;
  outflow: number;
  remaining: number;
  carryRule: CarryRule;
  note: string | null;
  activity?: BudgetActivity;
  status: BudgetStatus;
  progress: number;
  coverageDays: number | null;
  raw: BudgetRecord;
}
