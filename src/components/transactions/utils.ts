import { formatCurrency } from "../../lib/format";

const TRANSACTION_DATE_FORMATTER =
  typeof Intl !== "undefined"
    ? new Intl.DateTimeFormat("id-ID", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

export function formatTransactionDate(value?: string | number | Date | null) {
  if (!value) return "";
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return String(value);
    return TRANSACTION_DATE_FORMATTER ? TRANSACTION_DATE_FORMATTER.format(date) : String(value);
  } catch (error) {
    return String(value);
  }
}

export function parseTags(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((tag) => String(tag).trim())
      .filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function formatAmount(value: unknown, currency: string | undefined, locale = "IDR") {
  const amountNumber = Number(value ?? 0);
  const currencyCode = currency || locale;
  return formatCurrency(amountNumber, currencyCode);
}

export function getAmountTone(type?: string) {
  if (type === "income") return "text-emerald-400";
  if (type === "expense") return "text-rose-400";
  if (type === "transfer") return "text-slate-300";
  return "text-slate-200";
}

export function getTypeLabel(type?: string) {
  if (type === "income") return "Pemasukan";
  if (type === "expense") return "Pengeluaran";
  if (type === "transfer") return "Transfer";
  return type || "Transaksi";
}
