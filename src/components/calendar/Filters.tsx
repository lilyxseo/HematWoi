import { Fragment, useMemo, type ChangeEvent } from 'react';
import { Popover, Transition } from '@headlessui/react';
import clsx from 'clsx';
import type { CalendarFilter } from '../../lib/calendarApi';
import type { Category } from '../../services/categories';
import type { AccountRecord } from '../../lib/api';

export type CalendarFiltersProps = {
  value: CalendarFilter;
  onChange: (next: CalendarFilter) => void;
  onReset: () => void;
  categories: Category[];
  accounts: AccountRecord[];
  loadingCategories?: boolean;
  loadingAccounts?: boolean;
};

function toggleValue(values: string[], candidate: string): string[] {
  if (!candidate) return values;
  if (values.includes(candidate)) {
    return values.filter((item) => item !== candidate);
  }
  return [...values, candidate];
}

export default function Filters({
  value,
  onChange,
  onReset,
  categories,
  accounts,
  loadingCategories = false,
  loadingAccounts = false,
}: CalendarFiltersProps) {
  const selectedCategoryCount = value.categoryIds.length;
  const selectedAccountCount = value.accountIds.length;

  const categoryLabel = useMemo(() => {
    if (loadingCategories) return 'Memuat...';
    if (!selectedCategoryCount) return 'Semua Kategori';
    if (selectedCategoryCount === 1) {
      const match = categories.find((cat) => cat.id === value.categoryIds[0]);
      return match ? match.name : '1 kategori';
    }
    return `${selectedCategoryCount} kategori`;
  }, [categories, loadingCategories, selectedCategoryCount, value.categoryIds]);

  const accountLabel = useMemo(() => {
    if (loadingAccounts) return 'Memuat...';
    if (!selectedAccountCount) return 'Semua Akun';
    if (selectedAccountCount === 1) {
      const match = accounts.find((acc) => acc.id === value.accountIds[0]);
      return match ? match.name : '1 akun';
    }
    return `${selectedAccountCount} akun`;
  }, [accounts, loadingAccounts, selectedAccountCount, value.accountIds]);

  const handleTypeChange = (type: 'expense' | 'all') => {
    if (value.type === type) return;
    onChange({ ...value, type });
  };

  const handleCategoryToggle = (categoryId: string) => {
    onChange({ ...value, categoryIds: toggleValue(value.categoryIds, categoryId) });
  };

  const handleAccountToggle = (accountId: string) => {
    onChange({ ...value, accountIds: toggleValue(value.accountIds, accountId) });
  };

  const handleAmountChange = (field: 'amountMin' | 'amountMax', raw: string) => {
    const parsed = raw === '' ? null : Number.parseInt(raw, 10);
    const nextValue = parsed != null && Number.isFinite(parsed) ? parsed : null;
    onChange({ ...value, [field]: nextValue });
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, search: event.target.value });
  };

  return (
    <section className="rounded-3xl border border-slate-800/70 bg-surface-1/80 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-2xl border border-slate-800/70 bg-slate-900/70 p-1">
          <button
            type="button"
            onClick={() => handleTypeChange('expense')}
            className={clsx(
              'inline-flex items-center rounded-2xl px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              value.type === 'expense'
                ? 'bg-brand/20 text-brand'
                : 'text-muted hover:text-text',
            )}
          >
            Expense Only
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('all')}
            className={clsx(
              'inline-flex items-center rounded-2xl px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              value.type !== 'expense'
                ? 'bg-brand/20 text-brand'
                : 'text-muted hover:text-text',
            )}
          >
            Expense + Income
          </button>
        </div>

        <Popover className="relative">
          {({ open }) => (
            <>
              <Popover.Button
                className={clsx(
                  'inline-flex items-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-900/70 px-3 py-1.5 text-sm font-medium text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                  open && 'text-text',
                )}
              >
                Kategori
                <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-xs font-semibold text-slate-200">
                  {categoryLabel}
                </span>
              </Popover.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-150"
                enterFrom="opacity-0 translate-y-1"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-1"
              >
                <Popover.Panel className="absolute z-20 mt-2 w-72 rounded-2xl border border-slate-800/70 bg-surface-2/95 p-4 shadow-xl">
                  {loadingCategories ? (
                    <p className="text-sm text-muted">Memuat kategori...</p>
                  ) : categories.length === 0 ? (
                    <p className="text-sm text-muted">Tidak ada kategori.</p>
                  ) : (
                    <ul className="flex max-h-60 flex-col gap-2 overflow-y-auto">
                      {categories.map((category) => {
                        const checked = value.categoryIds.includes(category.id);
                        return (
                          <li key={category.id}>
                            <label className="flex items-center gap-2 text-sm text-text">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleCategoryToggle(category.id)}
                                className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-brand focus:ring-brand"
                              />
                              <span>{category.name}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Popover.Panel>
              </Transition>
            </>
          )}
        </Popover>

        <Popover className="relative">
          {({ open }) => (
            <>
              <Popover.Button
                className={clsx(
                  'inline-flex items-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-900/70 px-3 py-1.5 text-sm font-medium text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                  open && 'text-text',
                )}
              >
                Akun
                <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-xs font-semibold text-slate-200">
                  {accountLabel}
                </span>
              </Popover.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-150"
                enterFrom="opacity-0 translate-y-1"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-1"
              >
                <Popover.Panel className="absolute z-20 mt-2 w-72 rounded-2xl border border-slate-800/70 bg-surface-2/95 p-4 shadow-xl">
                  {loadingAccounts ? (
                    <p className="text-sm text-muted">Memuat akun...</p>
                  ) : accounts.length === 0 ? (
                    <p className="text-sm text-muted">Tidak ada akun.</p>
                  ) : (
                    <ul className="flex max-h-60 flex-col gap-2 overflow-y-auto">
                      {accounts.map((account) => {
                        const checked = value.accountIds.includes(account.id);
                        return (
                          <li key={account.id}>
                            <label className="flex items-center gap-2 text-sm text-text">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleAccountToggle(account.id)}
                                className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-brand focus:ring-brand"
                              />
                              <span>{account.name}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Popover.Panel>
              </Transition>
            </>
          )}
        </Popover>

        <div className="flex items-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-900/70 px-3 py-1.5">
          <label className="text-xs uppercase tracking-wide text-muted">Nominal</label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="Min"
            value={value.amountMin ?? ''}
            onChange={(event) => handleAmountChange('amountMin', event.target.value)}
            className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          />
          <span className="text-muted">–</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="Max"
            value={value.amountMax ?? ''}
            onChange={(event) => handleAmountChange('amountMax', event.target.value)}
            className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          />
        </div>

        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-900/70 px-3 py-1.5">
          <input
            type="text"
            value={value.search}
            onChange={handleSearchChange}
            placeholder="Cari catatan / merchant"
            className="flex-1 bg-transparent text-sm text-text placeholder:text-muted focus-visible:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={onReset}
          className="ml-auto inline-flex items-center rounded-2xl border border-slate-800/70 bg-slate-900/70 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          Reset
        </button>
      </div>
    </section>
  );
}
