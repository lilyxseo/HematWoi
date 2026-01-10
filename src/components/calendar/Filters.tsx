import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { Check, ChevronDown, ArrowDownRight, RotateCcw, ArrowLeftRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
}

const typeOptions: {
  value: CalendarFilters['type'];
  label: string;
  icon: LucideIcon;
}[] = [
  { value: 'expense', label: 'pengeluaran', icon: ArrowDownRight },
  { value: 'debt', label: 'hutang', icon: ArrowLeftRight },
];

export default function Filters({
  value,
  onChange,
  onReset,
  categories,
  accounts,
  loadingCategories = false,
  loadingAccounts = false,
}: FiltersProps) {
  const segmentedRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<CalendarFilters['type'], HTMLButtonElement | null>>({
    expense: null,
    debt: null,
  });
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties>(() => ({
    opacity: 0,
    transform: 'translateX(0px)',
    width: '0px',
  }));

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [categories]);

  const updateIndicator = useCallback(() => {
    const container = segmentedRef.current;
    const activeButton = buttonRefs.current[value.type];
    if (!container || !activeButton) {
      setIndicatorStyle({ opacity: 0, transform: 'translateX(0px)', width: '0px' });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();

    setIndicatorStyle({
      opacity: 1,
      transform: `translateX(${buttonRect.left - containerRect.left}px)`,
      width: `${buttonRect.width}px`,
    });
  }, [value.type]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    window.addEventListener('resize', updateIndicator);
    return () => {
      window.removeEventListener('resize', updateIndicator);
    };
  }, [updateIndicator]);

  const handleTypeChange = (type: CalendarFilters['type']) => {
    if (type === value.type) return;
    if (type === 'debt') {
      onChange({
        ...value,
        type,
        categoryIds: [],
        accountId: null,
        minAmount: null,
        maxAmount: null,
        search: '',
      });
      return;
    }
    onChange({ ...value, type });
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

  const isDebtFilter = value.type === 'debt';

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
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tipe kalender</span>
            <div className="relative">
              <div
                ref={segmentedRef}
                className="relative flex w-full justify-between gap-1 rounded-full bg-slate-800/60 px-2 py-1 ring-1 ring-slate-700/70 backdrop-blur-sm sm:px-1 sm:py-1"
              >
                <span
                  className="pointer-events-none absolute inset-y-1 left-0 z-0 rounded-full bg-[var(--accent)] shadow-md transition-[transform,width,opacity] duration-300 ease-in-out"
                  style={indicatorStyle}
                  aria-hidden="true"
                />
                {typeOptions.map((option) => {
                  const isActive = value.type === option.value;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      ref={(node) => {
                        buttonRefs.current[option.value] = node;
                      }}
                      type="button"
                      onClick={() => handleTypeChange(option.value)}
                      className={
                        'relative z-10 flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:flex-none'
                        + (isActive
                          ? ' text-white drop-shadow-sm'
                          : ' text-slate-300 hover:text-slate-100')
                      }
                      aria-pressed={isActive}
                    >
                      <Icon className="h-4 w-4 opacity-70" aria-hidden="true" />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Kategori</span>
            <Listbox
              value={value.categoryIds}
              onChange={handleCategoriesChange}
              multiple
              disabled={isDebtFilter}
            >
              <div className="relative">
                <Listbox.Button
                  className={
                    'flex h-11 w-full items-center justify-between rounded-2xl border border-slate-700 bg-slate-900 px-3 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
                    + (isDebtFilter ? ' cursor-not-allowed text-slate-500 opacity-60' : ' text-slate-200')
                  }
                  aria-disabled={isDebtFilter}
                >
                  <span className="truncate">
                    {isDebtFilter
                      ? 'Tidak tersedia untuk hutang'
                      : loadingCategories
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
            <Listbox value={value.accountId} onChange={handleAccountChange} disabled={isDebtFilter}>
              <div className="relative">
                <Listbox.Button
                  className={
                    'flex h-11 w-full items-center justify-between rounded-2xl border border-slate-700 bg-slate-900 px-3 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
                    + (isDebtFilter ? ' cursor-not-allowed text-slate-500 opacity-60' : ' text-slate-200')
                  }
                  aria-disabled={isDebtFilter}
                >
                  <span className="truncate">
                    {isDebtFilter
                      ? 'Tidak tersedia untuk hutang'
                      : loadingAccounts
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
                  disabled={isDebtFilter}
                  className={`mt-1 h-11 rounded-2xl border border-slate-700 bg-slate-900 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    isDebtFilter ? 'cursor-not-allowed text-slate-500 opacity-60' : 'text-slate-200'
                  }`}
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
                  disabled={isDebtFilter}
                  className={`mt-1 h-11 rounded-2xl border border-slate-700 bg-slate-900 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    isDebtFilter ? 'cursor-not-allowed text-slate-500 opacity-60' : 'text-slate-200'
                  }`}
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
              disabled={isDebtFilter}
              className={`h-11 rounded-2xl border border-slate-700 bg-slate-900 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                isDebtFilter ? 'cursor-not-allowed text-slate-500 opacity-60' : 'text-slate-200'
              }`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
