import { Calendar } from "lucide-react";

const QUICK_OPTIONS = [
  { label: "Hari ini", offset: 0 },
  { label: "Kemarin", offset: -1 },
];

export default function DateChips({ onSelect, activeDate }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/40 px-3 py-2 text-sm font-medium text-muted-foreground dark:border-white/10">
        <Calendar className="h-4 w-4" />
        Tanggal
      </div>
      {QUICK_OPTIONS.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={() => onSelect(option.offset)}
          className={`h-9 rounded-xl px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            isActive(option.offset, activeDate) ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function isActive(offset, activeDate) {
  if (!activeDate) return false;
  const quickDate = resolveDate(offset);
  return quickDate === activeDate;
}

function resolveDate(offset) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const base = new Date();
  const zoned = new Date(base.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  zoned.setDate(zoned.getDate() + offset);
  return formatter.format(zoned);
}
