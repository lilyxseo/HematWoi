import { Fragment, useMemo } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { Filter, Check, ChevronDown, X, Search } from 'lucide-react';
import clsx from 'clsx';
import { CalendarFilters } from '../../lib/calendarApi';

interface Option {
  id: string;
  name: string;
  meta?: string | null;
}

interface FiltersProps {
  value: CalendarFilters;
  onChange: (value: CalendarFilters) => void;
  categories: Option[];
  accounts: Option[];
  loading?: boolean;
}

function buildOptionLabel(option: Option) {
  if (!option.meta) return option.name;
  return `${option.name} · ${option.meta}`;
}

export default function Filters({
  value,
  onChange,
  categories,
  accounts,
  loading = false,
}: FiltersProps) {
  const selectedCategories = useMemo(() => {
    const map = new Map(categories.map((item) => [item.id, item]));
    return value.categoryIds
      .map((id) => map.get(id))
      .filter((item): item is Option => Boolean(item));
  }, [categories, value.categoryIds]);

  const selectedAccount = useMemo(() => {
    if (!value.accountIds.length) return null;
    const map = new Map(accounts.map((item) => [item.id, item]));
    return map.get(value.accountIds[0]) ?? null;
  }, [accounts, value.accountIds]);

  const applyPatch = (patch: Partial<CalendarFilters>) => {
    onChange({
      includeIncome: value.includeIncome,
      categoryIds: value.categoryIds,
      accountIds: value.accountIds,
      minAmount: value.minAmount ?? undefined,
      maxAmount: value.maxAmount ?? undefined,
      search: value.search ?? '',
      ...patch,
    });
  };

  const handleReset = () => {
    onChange({
      includeIncome: true,
      categoryIds: [],
      accountIds: [],
      minAmount: undefined,
      maxAmount: undefined,
      search: '',
    });
  };

  return (
    <section className="rounded-2xl border border-border/60 bg-surface-2/60 p-4 shadow-sm backdrop-blur-md">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Filter className="h-4 w-4" aria-hidden="true" />
          Filter transaksi
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Reset
        </button>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Tipe transaksi
          </legend>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPatch({ includeIncome: false })}
              className={clsx(
                'inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                value.includeIncome
                  ? 'border-border bg-surface-1 text-slate-300 hover:bg-surface-3'
                  : 'border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--accent)]',
              )}
              aria-pressed={!value.includeIncome}
            >
              Expense saja
            </button>
            <button
              type="button"
              onClick={() => applyPatch({ includeIncome: true })}
              className={clsx(
                'inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                value.includeIncome
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--accent)]'
                  : 'border-border bg-surface-1 text-slate-300 hover:bg-surface-3',
              )}
              aria-pressed={value.includeIncome}
            >
              Expense + Income
            </button>
          </div>
        </fieldset>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Kategori
          </label>
          <Listbox
            value={value.categoryIds}
            onChange={(ids: string[]) => applyPatch({ categoryIds: ids })}
            multiple
          >
            {({ open }) => (
              <div className="relative">
                <Listbox.Button className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm text-slate-200 transition hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                  <span className="flex flex-wrap gap-1">
                    {selectedCategories.length ? (
                      selectedCategories.map((item) => (
                        <span
                          key={item.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--accent)]/10 px-2 py-0.5 text-xs font-medium text-[color:var(--accent)]"
                        >
                          {item.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500">Semua kategori</span>
                    )}
                  </span>
                  <ChevronDown
                    className={clsx(
                      'h-4 w-4 transition-transform',
                      open ? 'rotate-180 text-[color:var(--accent)]' : 'text-slate-400',
                    )}
                  />
                </Listbox.Button>
                <Transition
                  as={Fragment}
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <Listbox.Options className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-border bg-surface-1 p-2 text-sm shadow-lg">
                    {loading ? (
                      <div className="p-3 text-center text-xs text-slate-400">
                        Memuat kategori...
                      </div>
                    ) : categories.length ? (
                      categories.map((option) => (
                        <Listbox.Option
                          key={option.id}
                          value={option.id}
                          className={({ active, selected }) =>
                            clsx(
                              'flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition',
                              active && 'bg-surface-3 text-[color:var(--accent)]',
                              selected && 'bg-[color:var(--accent)]/10 text-[color:var(--accent)]',
                            )
                          }
                        >
                          {({ selected }) => (
                            <>
                              <span>{buildOptionLabel(option)}</span>
                              {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                            </>
                          )}
                        </Listbox.Option>
                      ))
                    ) : (
                      <div className="p-3 text-center text-xs text-slate-400">
                        Tidak ada kategori
                      </div>
                    )}
                  </Listbox.Options>
                </Transition>
              </div>
            )}
          </Listbox>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Akun
          </label>
          <Listbox
            value={selectedAccount?.id ?? ''}
            onChange={(id: string) =>
              applyPatch({ accountIds: id ? [id] : [] })
            }
          >
            {({ open }) => (
              <div className="relative">
                <Listbox.Button className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm text-slate-200 transition hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                  <span>
                    {selectedAccount ? selectedAccount.name : 'Semua akun'}
                  </span>
                  <ChevronDown
                    className={clsx(
                      'h-4 w-4 transition-transform',
                      open ? 'rotate-180 text-[color:var(--accent)]' : 'text-slate-400',
                    )}
                  />
                </Listbox.Button>
                <Transition
                  as={Fragment}
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <Listbox.Options className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-border bg-surface-1 p-2 text-sm shadow-lg">
                    <Listbox.Option
                      value=""
                      className={({ active }) =>
                        clsx(
                          'cursor-pointer rounded-lg px-3 py-2 text-sm transition',
                          active && 'bg-surface-3 text-[color:var(--accent)]',
                        )
                      }
                    >
                      Semua akun
                    </Listbox.Option>
                    {loading ? (
                      <div className="p-3 text-center text-xs text-slate-400">
                        Memuat akun...
                      </div>
                    ) : (
                      accounts.map((option) => (
                        <Listbox.Option
                          key={option.id}
                          value={option.id}
                          className={({ active, selected }) =>
                            clsx(
                              'flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition',
                              active && 'bg-surface-3 text-[color:var(--accent)]',
                              selected && 'bg-[color:var(--accent)]/10 text-[color:var(--accent)]',
                            )
                          }
                        >
                          {({ selected }) => (
                            <>
                              <span>{option.name}</span>
                              {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                            </>
                          )}
                        </Listbox.Option>
                      ))
                    )}
                  </Listbox.Options>
                </Transition>
              </div>
            )}
          </Listbox>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Nominal (IDR)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              className="min-h-[44px] w-full rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm text-slate-200 shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              placeholder="Min"
              value={value.minAmount ?? ''}
              onChange={(event) => {
                const parsed = event.target.value === '' ? undefined : Number(event.target.value);
                applyPatch({ minAmount: Number.isFinite(parsed ?? NaN) ? parsed : undefined });
              }}
            />
            <input
              type="number"
              inputMode="decimal"
              min={0}
              className="min-h-[44px] w-full rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm text-slate-200 shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              placeholder="Max"
              value={value.maxAmount ?? ''}
              onChange={(event) => {
                const parsed = event.target.value === '' ? undefined : Number(event.target.value);
                applyPatch({ maxAmount: Number.isFinite(parsed ?? NaN) ? parsed : undefined });
              }}
            />
          </div>
        </div>
        <div className="md:col-span-2 xl:col-span-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Cari judul, catatan, merchant
          </label>
          <div className="relative mt-2 flex items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-500" aria-hidden="true" />
            <input
              type="search"
              className="min-h-[44px] w-full rounded-xl border border-border bg-surface-1 pl-10 pr-3 text-sm text-slate-200 shadow-inner placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              placeholder="Cari transaksi..."
              value={value.search ?? ''}
              onChange={(event) => applyPatch({ search: event.target.value })}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
