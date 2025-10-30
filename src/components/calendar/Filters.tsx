import { Fragment, useMemo, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import {
  ArrowDownLeft,
  ArrowsUpDown,
  Check,
  ChevronDown,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import type { CalendarFilters } from '../../lib/calendarApi';
import type { CategoryRecord } from '../../lib/api-categories';
import type { AccountRecord } from '../../lib/api';

interface FiltersProps {
  value: CalendarFilters;
  onChange: (next: CalendarFilters) => void;
  onReset: () => void;
  categories: CategoryRecord[];
  accounts: AccountRecord[];
  loadingCategories?: boolean;
  loadingAccounts?: boolean;
  isBusy?: boolean;
}

const typeOptions: {
  value: CalendarFilters['type'];
  label: string;
  icon: LucideIcon;
}[] = [
  { value: 'expense', label: 'Expense', icon: ArrowDownLeft },
  {
    value: 'expense-income',
    label: 'Exp+Inc',
    icon: ArrowsUpDown,
  },
];

export default function Filters({
  value,
  onChange,
  onReset,
  categories,
  accounts,
  loadingCategories = false,
  loadingAccounts = false,
  isBusy = false,
}: FiltersProps) {
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [categories]);

  const typeRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleTypeChange = (type: CalendarFilters['type']) => {
    onChange({ ...value, type });
  };

  const handleTypeKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (isBusy) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }

    event.preventDefault();

    const delta = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const nextIndex = (index + delta + typeOptions.length) % typeOptions.length;
    const nextOption = typeOptions[nextIndex];
    handleTypeChange(nextOption.value);
    typeRefs.current[nextIndex]?.focus();
  };

  const handleCategoriesChange = (selected: string[]) => {
    onChange({ ...value, categoryIds: selected });
  };

  const handleAccountChange = (accountId: string | null) => {
    onChange({ ...value, accountId });
  };

  const handleMinAmountChange = (raw: string) => {
    const parsed = raw === '' ? null : Number.parseInt(raw, 10);
    onChange({
      ...value,
      minAmount:
        typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null,
    });
  };

  const handleMaxAmountChange = (raw: string) => {
    const parsed = raw === '' ? null : Number.parseInt(raw, 10);
    onChange({
      ...value,
      maxAmount:
        typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null,
    });
  };

  const handleSearchChange = (next: string) => {
    onChange({ ...value, search: next });
  };

  return (
    <section aria-label="Filter kalender" className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-200">Filter</div>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label="Reset filter"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Tipe
            </span>
            <div
              role="radiogroup"
              aria-label="Filter tipe transaksi"
              aria-disabled={isBusy}
              className={`flex flex-wrap justify-center gap-2 rounded-full bg-slate-900/50 p-1 ring-1 ring-slate-700/60 sm:justify-start${
                isBusy ? ' cursor-wait opacity-90' : ''
              }`}
            >
              {typeOptions.map((option, index) => {
                const isActive = value.type === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    ref={(node) => {
                      typeRefs.current[index] = node;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    aria-label={option.label}
                    tabIndex={isActive ? 0 : -1}
                    disabled={isBusy}
                    onKeyDown={(event) => handleTypeKeyDown(event, index)}
                    onClick={() => handleTypeChange(option.value)}
                    className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium transition md:px-4 ${
                      isActive
                        ? 'bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-[var(--accent)]'
                        : 'text-slate-300 ring-1 ring-slate-700/60 hover:bg-slate-800/60'
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-wait`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Kategori</span>
            <Listbox value={value.categoryIds} onChange={handleCategoriesChange} multiple>
              <div className="relative">
                <Listbox.Button className="flex h-11 w-full items-center justify-between rounded-2xl border border-slate-700 bg-slate-900 px-3 text-left text-sm font-medium text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
                  <span className="truncate">
                    {loadingCategories
                      ? 'Memuat kategori...'
                      : value.categoryIds.length === 0
                        ? 'Semua kategori'
                        : `${value.categoryIds.length} kategori`}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 text-slate-400" aria-hidden="true" />
                </Listbox.Button>
                <Transition
                  as={Fragment}
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <Listbox.Options className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-slate-700 bg-slate-900 p-1 text-sm shadow-xl">
                    {loadingCategories ? (
                      <div className="px-3 py-2 text-sm text-slate-400">Memuat...</div>
                    ) : sortedCategories.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-slate-400">Tidak ada kategori</div>
                    ) : (
                      sortedCategories.map((category) => (
                        <Listbox.Option
                          key={category.id}
                          value={category.id}
                          className={({ active }) =>
                            `flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 ${
                              active ? 'bg-slate-800 text-slate-100' : 'text-slate-200'
                            }`
                          }
                        >
                          {({ selected }) => (
                            <>
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate text-sm font-medium">{category.name}</span>
                                <span className="text-xs uppercase tracking-wide text-slate-400">
                                  {category.type === 'income' ? 'Income' : 'Expense'}
                                </span>
                              </div>
                              {selected ? <Check className="h-4 w-4 text-[var(--accent)]" /> : null}
                            </>
                          )}
                        </Listbox.Option>
                      ))
                    )}
                  </Listbox.Options>
                </Transition>
              </div>
            </Listbox>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Akun</span>
            <Listbox value={value.accountId} onChange={handleAccountChange}>
              <div className="relative">
                <Listbox.Button className="flex h-11 w-full items-center justify-between rounded-2xl border border-slate-700 bg-slate-900 px-3 text-left text-sm font-medium text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
                  <span className="truncate">
                    {loadingAccounts
                      ? 'Memuat akun...'
                      : value.accountId
                        ? accounts.find((acc) => acc.id === value.accountId)?.name ?? 'Tidak ditemukan'
                        : 'Semua akun'}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 text-slate-400" aria-hidden="true" />
                </Listbox.Button>
                <Transition
                  as={Fragment}
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <Listbox.Options className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-slate-700 bg-slate-900 p-1 text-sm shadow-xl">
                    <Listbox.Option
                      value={null}
                      className={({ active }) =>
                        `flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 ${
                          active ? 'bg-slate-800 text-slate-100' : 'text-slate-200'
                        }`
                      }
                    >
                      {({ selected }) => (
                        <>
                          <span className="text-sm font-medium">Semua akun</span>
                          {selected ? <Check className="h-4 w-4 text-[var(--accent)]" /> : null}
                        </>
                      )}
                    </Listbox.Option>
                    {loadingAccounts ? (
                      <div className="px-3 py-2 text-sm text-slate-400">Memuat...</div>
                    ) : accounts.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-slate-400">Tidak ada akun</div>
                    ) : (
                      accounts.map((account) => (
                        <Listbox.Option
                          key={account.id}
                          value={account.id}
                          className={({ active }) =>
                            `flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 ${
                              active ? 'bg-slate-800 text-slate-100' : 'text-slate-200'
                            }`
                          }
                        >
                          {({ selected }) => (
                            <>
                              <span className="text-sm font-medium">{account.name}</span>
                              {selected ? <Check className="h-4 w-4 text-[var(--accent)]" /> : null}
                            </>
                          )}
                        </Listbox.Option>
                      ))
                    )}
                  </Listbox.Options>
                </Transition>
              </div>
            </Listbox>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rentang nominal (IDR)</span>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col">
                <span className="text-xs text-slate-400">Min</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={value.minAmount ?? ''}
                  onChange={(event) => handleMinAmountChange(event.target.value)}
                  placeholder="0"
                  className="mt-1 h-11 rounded-2xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
              </label>
              <label className="flex flex-col">
                <span className="text-xs text-slate-400">Max</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={value.maxAmount ?? ''}
                  onChange={(event) => handleMaxAmountChange(event.target.value)}
                  placeholder="0"
                  className="mt-1 h-11 rounded-2xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
              </label>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pencarian</span>
            <input
              type="search"
              value={value.search}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Cari judul, catatan, atau merchant"
              className="h-11 rounded-2xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
