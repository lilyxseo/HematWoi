import { supabase } from './supabase';

export interface MonthPeriodRange {
  periodMonth: string;
  startDate: string;
  endDate: string;
}

export interface TopSpendingCategory {
  categoryId: string | null;
  categoryName: string;
  categoryColor?: string | null;
  total: number;
  share: number;
}

export interface TopMerchantSummary {
  merchantId: string | null;
  merchantName: string;
  amount: number;
  categoryId: string | null;
}

export interface TopSpendingMTDResult {
  categories: TopSpendingCategory[];
  topMerchant?: TopMerchantSummary;
  totalExpense: number;
}

export interface BudgetProgressItem {
  id: string;
  categoryId: string | null;
  name: string;
  planned: number;
  actual: number;
  progress: number;
  categoryType: 'income' | 'expense' | null;
}

export interface BudgetProgressMTDResult {
  nearLimit: BudgetProgressItem[];
  overLimit: BudgetProgressItem[];
}

export interface DueDebtItem {
  id: string;
  type: 'debt' | 'subscription';
  title: string;
  amount: number;
  dueDate: string;
  daysLeft: number;
  subtitle?: string;
}

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  return new Error(fallback);
}

function parseNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getTopSpendingMTD(range: MonthPeriodRange): Promise<TopSpendingMTDResult> {
  const { startDate, endDate } = range;

  const [categoryResponse, merchantResponse] = await Promise.all([
    supabase
      .from('transactions')
      .select(
        `category_id, total:amount.sum(), categories!left(id, name, color)`
      )
      .eq('type', 'expense')
      .gte('date', startDate)
      .lte('date', endDate)
      .group('category_id, categories.id, categories.name, categories.color')
      .order('total', { ascending: false })
      .limit(3),
    supabase
      .from('transactions')
      .select(
        `merchant_id, merchants!left(id, name), category_id, total:amount.sum()`
      )
      .eq('type', 'expense')
      .gte('date', startDate)
      .lte('date', endDate)
      .not('merchant_id', 'is', null)
      .group('merchant_id, merchants.id, merchants.name, category_id')
      .order('total', { ascending: false })
      .limit(1),
  ]);

  if (categoryResponse.error) {
    throw toError(categoryResponse.error, 'Gagal memuat data pengeluaran');
  }
  if (merchantResponse.error) {
    throw toError(merchantResponse.error, 'Gagal memuat data merchant');
  }

  const totalExpense = (categoryResponse.data ?? []).reduce(
    (sum, row) => sum + parseNumber((row as { total?: unknown }).total),
    0
  );

  const categories: TopSpendingCategory[] = (categoryResponse.data ?? []).map(
    (row) => {
      const typed = row as unknown as {
        category_id: string | null;
        total: unknown;
        categories?: { id?: string; name?: string; color?: string } | null;
      };
      const amount = parseNumber(typed.total);
      const share = totalExpense > 0 ? Math.round((amount / totalExpense) * 1000) / 10 : 0;
      return {
        categoryId: typed.category_id ?? null,
        categoryName: typed.categories?.name ?? 'Tanpa kategori',
        categoryColor: typed.categories?.color ?? null,
        total: amount,
        share,
      } satisfies TopSpendingCategory;
    }
  );

  const merchantRow = merchantResponse.data?.[0] as
    | {
        merchant_id: string | null;
        merchants?: { id?: string; name?: string | null } | null;
        category_id: string | null;
        total: unknown;
      }
    | undefined;

  const topMerchant: TopMerchantSummary | undefined = merchantRow
    ? {
        merchantId: merchantRow.merchant_id ?? merchantRow.merchants?.id ?? null,
        merchantName: merchantRow.merchants?.name ?? 'Merchant tanpa nama',
        amount: parseNumber(merchantRow.total),
        categoryId: merchantRow.category_id ?? null,
      }
    : undefined;

  return {
    categories,
    topMerchant,
    totalExpense,
  };
}

export async function getBudgetProgressMTD(range: MonthPeriodRange): Promise<BudgetProgressMTDResult> {
  const { periodMonth, startDate, endDate } = range;
  const [budgetResponse, spendingResponse] = await Promise.all([
    supabase
      .from('budgets')
      .select(
        `id, planned, name, category_id, categories!left(id, name, type)`
      )
      .eq('period_month', `${periodMonth}-01`)
      .order('planned', { ascending: false }),
    supabase
      .from('transactions')
      .select('category_id, total:amount.sum()')
      .eq('type', 'expense')
      .gte('date', startDate)
      .lte('date', endDate)
      .group('category_id'),
  ]);

  if (budgetResponse.error) {
    throw toError(budgetResponse.error, 'Gagal memuat data anggaran');
  }
  if (spendingResponse.error) {
    throw toError(spendingResponse.error, 'Gagal menghitung realisasi anggaran');
  }

  const spendingMap = new Map<string | null, number>();
  for (const row of spendingResponse.data ?? []) {
    const typed = row as { category_id: string | null; total?: unknown };
    spendingMap.set(typed.category_id ?? null, parseNumber(typed.total));
  }

  const items: BudgetProgressItem[] = (budgetResponse.data ?? [])
    .map((row) => {
      const typed = row as {
        id: string;
        planned: unknown;
        name?: string | null;
        category_id: string | null;
        categories?: { id?: string; name?: string | null; type?: 'income' | 'expense' | null } | null;
      };
      const planned = parseNumber(typed.planned);
      const actual = spendingMap.get(typed.category_id ?? null) ?? 0;
      const progressRaw = planned > 0 ? actual / planned : actual > 0 ? 2 : 0;
      return {
        id: typed.id,
        categoryId: typed.category_id ?? null,
        name: typed.categories?.name ?? typed.name ?? 'Tanpa kategori',
        planned,
        actual,
        progress: progressRaw,
        categoryType: typed.categories?.type ?? null,
      } satisfies BudgetProgressItem;
    })
    .filter((item) => item.categoryType !== 'income');

  const nearLimit = items
    .filter((item) => item.progress >= 0.8 && item.progress < 1)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3);

  const overLimit = items
    .filter((item) => item.progress >= 1)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3);

  return { nearLimit, overLimit };
}

export async function getDueDebtsIn7Days(): Promise<DueDebtItem[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + 7);

  const toDateString = (value: Date) => value.toISOString().slice(0, 10);

  const [debtsResponse, subscriptionsResponse] = await Promise.all([
    supabase
      .from('debts')
      .select('id, title, due_date, amount, paid_total, party_name, status')
      .not('status', 'eq', 'paid')
      .not('due_date', 'is', null)
      .gte('due_date', toDateString(today))
      .lte('due_date', toDateString(end))
      .order('due_date', { ascending: true }),
    supabase
      .from('subscription_charges')
      .select('id, due_date, amount, status, subscription:subscriptions(name, vendor)')
      .in('status', ['due', 'overdue'])
      .gte('due_date', toDateString(today))
      .lte('due_date', toDateString(end))
      .order('due_date', { ascending: true })
      .limit(5),
  ]);

  if (debtsResponse.error) {
    throw toError(debtsResponse.error, 'Gagal memuat pengingat hutang');
  }
  if (subscriptionsResponse.error) {
    throw toError(subscriptionsResponse.error, 'Gagal memuat pengingat langganan');
  }

  const items: DueDebtItem[] = [];

  for (const row of debtsResponse.data ?? []) {
    const typed = row as {
      id: string;
      title: string;
      due_date: string;
      amount: unknown;
      paid_total?: unknown;
      party_name?: string | null;
    };
    const dueDate = new Date(typed.due_date);
    const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
    const remaining = Math.max(parseNumber(typed.amount) - parseNumber(typed.paid_total), 0);
    const subtitleParts: string[] = [];
    if (typed.party_name) subtitleParts.push(typed.party_name);
    items.push({
      id: typed.id,
      type: 'debt',
      title: typed.title,
      amount: remaining || parseNumber(typed.amount),
      dueDate: typed.due_date,
      daysLeft,
      subtitle: subtitleParts.length ? subtitleParts.join(' • ') : undefined,
    });
  }

  for (const row of subscriptionsResponse.data ?? []) {
    const typed = row as {
      id: string;
      due_date: string;
      amount: unknown;
      subscription?: { name?: string | null; vendor?: string | null } | null;
    };
    const dueDate = new Date(typed.due_date);
    const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
    const subtitleParts: string[] = [];
    if (typed.subscription?.vendor) subtitleParts.push(typed.subscription.vendor);
    items.push({
      id: typed.id,
      type: 'subscription',
      title: typed.subscription?.name ?? 'Langganan jatuh tempo',
      amount: parseNumber(typed.amount),
      dueDate: typed.due_date,
      daysLeft,
      subtitle: subtitleParts.length ? subtitleParts.join(' • ') : undefined,
    });
  }

  items.sort((a, b) => {
    const diff = a.daysLeft - b.daysLeft;
    if (diff !== 0) return diff;
    return a.title.localeCompare(b.title);
  });

  return items.slice(0, 5);
}

export async function getUncategorizedCount(range: MonthPeriodRange): Promise<number> {
  const { startDate, endDate } = range;
  const response = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .is('category_id', null)
    .gte('date', startDate)
    .lte('date', endDate);

  if (response.error) {
    throw toError(response.error, 'Gagal memuat transaksi belum dikategorikan');
  }

  return response.count ?? 0;
}
