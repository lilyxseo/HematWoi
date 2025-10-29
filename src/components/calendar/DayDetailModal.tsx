import { Fragment, useMemo, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import clsx from "clsx";
import {
  CalendarDays,
  Loader2,
  Pencil,
  Receipt,
  Trash2,
  X,
} from "lucide-react";
import { formatCurrency } from "../../lib/format";
import type { CalendarTransaction } from "../../lib/calendarApi";
import type { DayAggregate } from "../../hooks/useMonthAggregates";

const DATE_LABEL =
  typeof Intl !== "undefined"
    ? new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

const TIME_LABEL =
  typeof Intl !== "undefined"
    ? new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

function formatTime(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return TIME_LABEL ? TIME_LABEL.format(date) : date.toLocaleTimeString();
  } catch {
    return null;
  }
}

function resolveCategory(
  categoryId: string | null,
  categoryName: string | null,
  categoryMap: Record<string, string>,
): string {
  if (categoryId && categoryMap[categoryId]) {
    return categoryMap[categoryId];
  }
  if (categoryName) {
    return categoryName;
  }
  return "Tanpa kategori";
}

function resolveAccount(
  accountId: string | null,
  accountMap: Record<string, string>,
): string | null {
  if (!accountId) return null;
  return accountMap[accountId] ?? null;
}

function formatAmount(amount: number, type: string): string {
  const value = Math.abs(Number(amount) || 0);
  const formatted = formatCurrency(value, "IDR");
  if (type === "expense") {
    return `- ${formatted}`;
  }
  if (type === "income") {
    return `+ ${formatted}`;
  }
  return formatted;
}

export interface DayDetailModalProps {
  open: boolean;
  dateKey: string | null;
  summary?: DayAggregate;
  transactions: CalendarTransaction[];
  includeIncome: boolean;
  categoryMap: Record<string, string>;
  accountMap: Record<string, string>;
  isLoading: boolean;
  onClose: () => void;
  onEdit: (transaction: CalendarTransaction) => void;
  onDelete: (transaction: CalendarTransaction) => Promise<void> | void;
}

export default function DayDetailModal({
  open,
  dateKey,
  summary,
  transactions,
  includeIncome,
  categoryMap,
  accountMap,
  isLoading,
  onClose,
  onEdit,
  onDelete,
}: DayDetailModalProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  const totals = useMemo(() => {
    const expense = transactions
      .filter((tx) => tx.type === "expense")
      .reduce((total, tx) => total + Math.abs(Number(tx.amount) || 0), 0);
    const income = transactions
      .filter((tx) => tx.type === "income")
      .reduce((total, tx) => total + Math.abs(Number(tx.amount) || 0), 0);
    return { expense, income, net: income - expense };
  }, [transactions]);

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const aTime = new Date(a.transaction_date ?? a.created_at ?? "").getTime();
      const bTime = new Date(b.transaction_date ?? b.created_at ?? "").getTime();
      return bTime - aTime;
    });
  }, [transactions]);

  const dateLabel = useMemo(() => {
    if (!dateKey) return "";
    try {
      const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10));
      const date = new Date(year, (month || 1) - 1, day || 1);
      return DATE_LABEL ? DATE_LABEL.format(date) : date.toDateString();
    } catch {
      return dateKey;
    }
  }, [dateKey]);

  const handleDelete = async (transaction: CalendarTransaction) => {
    if (pendingId || !transaction?.id) return;
    const confirmed = window.confirm("Hapus transaksi ini?");
    if (!confirmed) return;
    try {
      setPendingId(transaction.id);
      await onDelete(transaction);
    } catch {
      /* error ditangani pemanggil */
    } finally {
      setPendingId(null);
    }
  };

  const handleViewReceipt = (url: string | null | undefined) => {
    if (!url) return;
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      /* ignore */
    }
  };

  const expenseDisplay = formatCurrency(summary?.expenseTotal ?? totals.expense, "IDR");
  const incomeDisplay = formatCurrency(summary?.incomeTotal ?? totals.income, "IDR");
  const netDisplay = formatCurrency(totals.net, "IDR");
  const netClass = totals.net >= 0 ? "text-emerald-400" : "text-rose-400";

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[80]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-stretch justify-end">
            <Transition.Child
              as={Fragment}
              enter="transform transition ease-out duration-200"
              enterFrom="translate-x-full"
              enterTo="translate-x-0"
              leave="transform transition ease-in duration-150"
              leaveFrom="translate-x-0"
              leaveTo="translate-x-full"
            >
              <Dialog.Panel className="flex h-full w-full max-w-xl flex-col bg-slate-950 text-slate-100 shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-900/80 p-6">
                  <div>
                    <Dialog.Title className="text-lg font-semibold text-slate-50">
                      {dateLabel || "Detail transaksi"}
                    </Dialog.Title>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-300 sm:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Pengeluaran</p>
                        <p className="font-semibold text-rose-300">{expenseDisplay}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Pemasukan</p>
                        <p className="font-semibold text-emerald-300">{includeIncome ? incomeDisplay : "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Saldo</p>
                        <p className={clsx("font-semibold", netClass)}>{netDisplay}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/70 text-slate-300 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    aria-label="Tutup"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {isLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={`day-detail-skeleton-${index}`}
                          className="rounded-2xl border border-slate-900/70 bg-slate-900/40 p-4"
                        >
                          <div className="h-4 w-24 animate-pulse rounded bg-slate-800/60" />
                          <div className="mt-3 h-3 w-36 animate-pulse rounded bg-slate-800/60" />
                          <div className="mt-4 h-9 w-full animate-pulse rounded-lg bg-slate-800/60" />
                        </div>
                      ))}
                    </div>
                  ) : sortedTransactions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800/80 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
                      Tidak ada transaksi pada tanggal ini.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sortedTransactions.map((transaction) => {
                        const categoryLabel = resolveCategory(
                          transaction.category_id ?? null,
                          transaction.category_name ?? null,
                          categoryMap,
                        );
                        const accountLabel = resolveAccount(
                          transaction.account_id ?? null,
                          accountMap,
                        );
                        const merchantLabel = transaction.merchant_name ?? transaction.merchant_id ?? null;
                        const timeLabel = formatTime(transaction.transaction_date ?? transaction.created_at ?? null);
                        const amountDisplay = formatAmount(transaction.amount, transaction.type);
                        const amountClass =
                          transaction.type === "expense"
                            ? "text-rose-300"
                            : transaction.type === "income"
                              ? "text-emerald-300"
                              : "text-slate-300";

                        return (
                          <div
                            key={transaction.id}
                            className="rounded-2xl border border-slate-900/70 bg-slate-900/60 p-4 shadow-sm"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-100">
                                    {transaction.note?.trim() || "(Tanpa catatan)"}
                                  </span>
                                  <span
                                    className={clsx(
                                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase",
                                      transaction.type === "expense"
                                        ? "bg-rose-500/15 text-rose-200"
                                        : transaction.type === "income"
                                          ? "bg-emerald-500/15 text-emerald-200"
                                          : "bg-slate-500/15 text-slate-200",
                                    )}
                                  >
                                    {transaction.type === "expense"
                                      ? "Expense"
                                      : transaction.type === "income"
                                        ? "Income"
                                        : "Transfer"}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-3 text-[12px] text-slate-400">
                                  {timeLabel ? (
                                    <span className="inline-flex items-center gap-1">
                                      <CalendarDays className="h-3 w-3" />
                                      {timeLabel}
                                    </span>
                                  ) : null}
                                  <span className="inline-flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full bg-slate-500" />
                                    {categoryLabel}
                                  </span>
                                  {merchantLabel ? (
                                    <span className="inline-flex items-center gap-1 text-slate-300">
                                      {merchantLabel}
                                    </span>
                                  ) : null}
                                  {accountLabel ? (
                                    <span className="inline-flex items-center gap-1 text-slate-300">
                                      Akun: {accountLabel}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div className={clsx("text-sm font-semibold", amountClass)}>
                                {amountDisplay}
                              </div>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onEdit(transaction)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </button>
                              {transaction.receipt_url ? (
                                <button
                                  type="button"
                                  onClick={() => handleViewReceipt(transaction.receipt_url)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                                >
                                  <Receipt className="h-4 w-4" />
                                  Nota
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleDelete(transaction)}
                                disabled={pendingId === transaction.id}
                                className={clsx(
                                  "inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 transition",
                                  pendingId === transaction.id
                                    ? "opacity-60"
                                    : "hover:bg-red-500/15",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                                )}
                              >
                                {pendingId === transaction.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                                Hapus
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
