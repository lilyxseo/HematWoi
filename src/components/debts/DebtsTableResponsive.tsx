import { ChevronLeft, ChevronRight, Loader2, Pencil, Trash2, Wallet } from 'lucide-react';
import type { DebtRecord } from '../../lib/api-debts';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
});

const TYPE_LABEL: Record<DebtRecord['type'], string> = {
  debt: 'H',
  receivable: 'P',
};

const TYPE_TITLE: Record<DebtRecord['type'], string> = {
  debt: 'Hutang',
  receivable: 'Piutang',
};

const TYPE_NAME: Record<DebtRecord['type'], string> = {
  debt: 'Hutang',
  receivable: 'Piutang',
};

const STATUS_LABEL: Record<DebtRecord['status'], string> = {
  ongoing: 'Berjalan',
  paid: 'Lunas',
  overdue: 'Jatuh Tempo',
};

const STATUS_STYLE: Record<DebtRecord['status'], string> = {
  ongoing: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
  paid: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
  overdue: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30',
};

interface DebtsTableResponsiveProps {
  debts: DebtRecord[];
  loading?: boolean;
  onEdit: (debt: DebtRecord) => void;
  onDelete: (debt: DebtRecord) => void;
  onAddPayment: (debt: DebtRecord) => void;
  tenorNavigation?: Record<
    string,
    { key: string; hasPrev: boolean; hasNext: boolean; currentIndex: number; total: number }
  >;
  onNavigateTenor?: (seriesKey: string, direction: 1 | -1) => void;
}

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `${percentFormatter.format(value)}%`;
}

function formatDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return dateFormatter.format(date);
}

function isOverdue(debt: DebtRecord) {
  if (!debt.due_date) return false;
  if (debt.status === 'paid') return false;
  const due = new Date(debt.due_date);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function formatTenor(debt: DebtRecord) {
  const total = Math.max(1, Math.floor(debt.tenor_months || 1));
  const current = Math.max(1, Math.min(Math.floor(debt.tenor_sequence || 1), total));
  return `${current}/${total}`;
}

export default function DebtsTableResponsive({
  debts,
  loading,
  onEdit,
  onDelete,
  onAddPayment,
  tenorNavigation,
  onNavigateTenor,
}: DebtsTableResponsiveProps) {
  const showSkeleton = Boolean(loading && debts.length === 0);
  const showEmpty = Boolean(!loading && debts.length === 0);

  const renderStatusChip = (status: DebtRecord['status']) => {
    const style = STATUS_STYLE[status] ?? '';
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${style}`}
      >
        {STATUS_LABEL[status] ?? status}
      </span>
    );
  };

  const renderTypeChip = (type: DebtRecord['type']) => (
    <span
      className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-primary-200 ring-1 ring-primary/20"
      title={TYPE_TITLE[type]}
    >
      {TYPE_LABEL[type]}
    </span>
  );

  return (
    <div className="min-w-0 space-y-4">
      <div className="hidden min-w-0 sm:block">
        <div className="min-w-0 rounded-2xl border border-border bg-card/80 shadow-sm">
          <div className="-mx-3 md:mx-0 px-3 md:px-0 overflow-x-auto">
            <table className="table-auto md:table-fixed w-full text-sm">
              <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
                <tr>
                  <th scope="col" className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center w-12">
                    Tipe
                  </th>
                  <th scope="col" className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-left min-w-[160px]">
                    Pihak
                  </th>
                  <th scope="col" className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-left min-w-[200px]">
                    Judul
                  </th>
                  <th scope="col" className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-left min-w-[150px]">
                    Jatuh Tempo
                  </th>
                  <th scope="col" className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center min-w-[110px]">
                    Tenor
                  </th>
                  <th scope="col" className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right min-w-[120px]">
                    Bunga %
                  </th>
                  <th scope="col" className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right min-w-[140px]">
                    Jumlah
                  </th>
                  <th scope="col" className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right min-w-[140px]">
                    Terbayar
                  </th>
                  <th scope="col" className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right min-w-[140px]">
                    Sisa
                  </th>
                  <th scope="col" className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center min-w-[120px]">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center w-[140px]">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {showSkeleton
                  ? Array.from({ length: 6 }).map((_, index) => (
                      <tr
                        key={`debt-skeleton-${index}`}
                        className="odd:bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3 align-middle text-center">
                          <div className="mx-auto h-6 w-6 animate-pulse rounded-full bg-border/50" />
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="h-3.5 w-32 animate-pulse rounded bg-border/40" />
                          <div className="mt-2 h-3 w-24 animate-pulse rounded bg-border/30" />
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="h-3.5 w-48 animate-pulse rounded bg-border/40" />
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="h-3.5 w-36 animate-pulse rounded bg-border/40" />
                        </td>
                        <td className="px-4 py-3 align-middle text-center">
                          <div className="mx-auto h-3.5 w-12 animate-pulse rounded bg-border/40" />
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="ml-auto h-3.5 w-16 animate-pulse rounded bg-border/40" />
                        </td>
                        <td className="px-4 py-3 align-middle text-right">
                          <div className="ml-auto h-3.5 w-24 animate-pulse rounded bg-border/40" />
                        </td>
                        <td className="px-4 py-3 align-middle text-right">
                          <div className="ml-auto h-3.5 w-24 animate-pulse rounded bg-border/40" />
                        </td>
                        <td className="px-4 py-3 align-middle text-right">
                          <div className="ml-auto h-3.5 w-24 animate-pulse rounded bg-border/40" />
                        </td>
                        <td className="px-4 py-3 align-middle text-center">
                          <div className="mx-auto h-6 w-20 animate-pulse rounded-full bg-border/30" />
                        </td>
                        <td className="px-4 py-3 align-middle text-center">
                          <div className="mx-auto flex max-w-[120px] justify-center gap-2">
                            <div className="h-9 w-9 animate-pulse rounded-full bg-border/40" />
                            <div className="h-9 w-9 animate-pulse rounded-full bg-border/40" />
                            <div className="h-9 w-9 animate-pulse rounded-full bg-border/40" />
                          </div>
                        </td>
                      </tr>
                    ))
                  : null}

                {showEmpty ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-sm text-muted-foreground">
                      Tidak ada data hutang sesuai filter.
                    </td>
                  </tr>
                ) : null}

                {!showEmpty &&
                  debts.map((debt) => {
                    const overdue = isOverdue(debt);
                    const navigation = tenorNavigation?.[debt.id];
                    return (
                      <tr
                        key={debt.id}
                        className="odd:bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3 align-middle text-center">
                          {renderTypeChip(debt.type)}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="min-w-0 space-y-1">
                            <p className="truncate font-medium text-foreground" title={debt.party_name}>
                              {debt.party_name}
                            </p>
                            {debt.notes ? (
                              <p className="truncate text-xs text-muted-foreground" title={debt.notes}>
                                {debt.notes}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span className="line-clamp-2 text-sm font-medium text-foreground" title={debt.title}>
                            {debt.title}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle text-sm text-muted-foreground">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={`truncate ${overdue ? 'font-semibold text-rose-300' : ''}`}>
                              {formatDate(debt.due_date)}
                            </span>
                            {overdue ? (
                              <span className="inline-flex items-center rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-500/30">
                                Jatuh tempo
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle text-center text-sm tabular-nums text-muted-foreground">
                          <div className="flex items-center justify-center gap-1">
                            {debt.tenor_months > 1 && navigation ? (
                              <>
                                <button
                                  type="button"
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                                  aria-label="Lihat tenor sebelumnya"
                                  onClick={() => navigation.hasPrev && onNavigateTenor?.(navigation.key, -1)}
                                  disabled={!navigation.hasPrev}
                                >
                                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                                <span className="font-semibold text-foreground">{formatTenor(debt)}</span>
                                <button
                                  type="button"
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                                  aria-label="Lihat tenor selanjutnya"
                                  onClick={() => navigation.hasNext && onNavigateTenor?.(navigation.key, 1)}
                                  disabled={!navigation.hasNext}
                                >
                                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </>
                            ) : (
                              <span className={debt.tenor_months > 1 ? 'font-semibold text-foreground' : ''}>{formatTenor(debt)}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle text-right text-sm tabular-nums text-muted-foreground">
                          {formatPercent(debt.rate_percent)}
                        </td>
                        <td className="px-4 py-3 align-middle text-right font-semibold tabular-nums text-foreground">
                          {formatCurrency(debt.amount)}
                        </td>
                        <td className="px-4 py-3 align-middle text-right tabular-nums text-muted-foreground">
                          {formatCurrency(debt.paid_total)}
                        </td>
                        <td className="px-4 py-3 align-middle text-right font-semibold tabular-nums text-foreground">
                          {formatCurrency(debt.remaining)}
                        </td>
                        <td className="px-4 py-3 align-middle text-center">
                          {renderStatusChip(debt.status)}
                        </td>
                        <td className="px-4 py-3 align-middle text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => onAddPayment(debt)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                              aria-label="Catat pembayaran"
                            >
                              <Wallet className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onEdit(debt)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                              aria-label="Ubah hutang"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(debt)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-danger transition hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                              aria-label="Hapus hutang"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {debts.length > 0 && loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Memuat data hutang…
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-3 sm:hidden">
        {showSkeleton
          ? Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`debt-card-skeleton-${index}`}
                className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-border/40" />
                  <div className="h-5 w-12 animate-pulse rounded-full bg-border/40" />
                </div>
                <div className="mt-3 h-3.5 w-full animate-pulse rounded bg-border/30" />
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-2">
                    <div className="h-3 w-20 animate-pulse rounded bg-border/30" />
                    <div className="h-3 w-24 animate-pulse rounded bg-border/30" />
                    <div className="h-3 w-16 animate-pulse rounded bg-border/30" />
                    <div className="h-3 w-20 animate-pulse rounded bg-border/30" />
                  </div>
                  <div className="space-y-2 text-right">
                    <div className="ml-auto h-3 w-24 animate-pulse rounded bg-border/30" />
                    <div className="ml-auto h-3 w-24 animate-pulse rounded bg-border/30" />
                    <div className="ml-auto h-3 w-24 animate-pulse rounded bg-border/30" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="h-9 flex-1 animate-pulse rounded-xl bg-border/40" />
                  <div className="h-9 flex-1 animate-pulse rounded-xl bg-border/40" />
                  <div className="h-9 w-9 animate-pulse rounded-full bg-border/40" />
                </div>
              </div>
            ))
          : null}

        {showEmpty ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-6 text-center text-sm text-muted-foreground">
            Tidak ada data hutang sesuai filter.
          </div>
        ) : null}

        {!showEmpty &&
          debts.map((debt) => {
            const overdue = isOverdue(debt);
            const navigation = tenorNavigation?.[debt.id];
            const statusStyle = STATUS_STYLE[debt.status] ?? '';
            return (
              <article
                key={debt.id}
                className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm transition-transform hover:translate-y-[1px]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p
                    className="min-w-0 truncate text-base font-semibold text-foreground"
                    role="heading"
                    aria-level={3}
                    title={debt.party_name}
                  >
                    {debt.party_name}
                  </p>
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary-200 ring-1 ring-primary/20">
                    {TYPE_NAME[debt.type]}
                  </span>
                </div>
                <div className="mt-2 flex items-start justify-between gap-3 text-xs text-muted-foreground">
                  <p className="min-w-0 flex-1 text-left text-muted-foreground line-clamp-2" title={debt.title}>
                    {debt.title}
                  </p>
                  <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${statusStyle}`}>
                    {STATUS_LABEL[debt.status] ?? debt.status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Jatuh tempo</p>
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${overdue ? 'text-rose-300' : 'text-foreground'}`}>
                          {formatDate(debt.due_date)}
                        </p>
                        {overdue ? (
                          <span className="inline-flex items-center rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-500/30">
                            Jatuh tempo
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Tenor</p>
                      {debt.tenor_months > 1 && navigation ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Lihat tenor sebelumnya"
                            onClick={() => navigation.hasPrev && onNavigateTenor?.(navigation.key, -1)}
                            disabled={!navigation.hasPrev}
                          >
                            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <p className="text-sm font-semibold text-foreground">{formatTenor(debt)}</p>
                          <button
                            type="button"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Lihat tenor selanjutnya"
                            onClick={() => navigation.hasNext && onNavigateTenor?.(navigation.key, 1)}
                            disabled={!navigation.hasNext}
                          >
                            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <p className={`text-sm font-semibold ${debt.tenor_months > 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {formatTenor(debt)}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Bunga</p>
                      <p className="text-sm font-medium text-foreground tabular-nums">{formatPercent(debt.rate_percent)}</p>
                    </div>
                  </div>
                  <div className="space-y-3 text-right">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Jumlah</p>
                      <p className="text-sm font-semibold text-foreground tabular-nums">
                        {formatCurrency(debt.amount)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Terbayar</p>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        {formatCurrency(debt.paid_total)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Sisa</p>
                      <p className="text-sm font-semibold text-foreground tabular-nums">
                        {formatCurrency(debt.remaining)}
                      </p>
                    </div>
                  </div>
                </div>

                <footer className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAddPayment(debt)}
                    className="inline-flex w-full min-w-[180px] flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                    aria-label="Catat pembayaran"
                  >
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    Catat pembayaran
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(debt)}
                    className="inline-flex w-full min-w-[150px] flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                    aria-label="Ubah hutang"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(debt)}
                    className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card text-danger transition hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                    aria-label="Hapus hutang"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </footer>
              </article>
            );
          })}

        {debts.length > 0 && loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card/70 px-4 py-3 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Memuat data hutang…
          </div>
        ) : null}
      </div>
    </div>
  );
}
