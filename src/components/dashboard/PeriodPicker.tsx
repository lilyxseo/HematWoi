import { useMemo } from "react"
import type { ChangeEvent } from "react"

export type PeriodPreset = "today" | "week" | "month" | "custom"

export type PeriodRange = {
  start: string
  end: string
}

const SEGMENTS: { label: string; value: PeriodPreset }[] = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "Custom", value: "custom" },
]

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

function toDateParts(value: string) {
  if (!value) return null
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10))
  if ([year, month, day].some((part) => Number.isNaN(part))) return null
  return { year, month, day }
}

function clampRange(range: PeriodRange): PeriodRange {
  const { start, end } = range
  if (start && end && start > end) {
    return { start: end, end: start }
  }
  return range
}

const jakartaFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" })

function toJakartaDate(date = new Date()) {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000
  return new Date(utc + 7 * 60 * 60000)
}

function startOfJakartaDay(date: Date) {
  const clone = new Date(date)
  clone.setUTCHours(0, 0, 0, 0)
  return clone
}

function getWeekStart(date: Date) {
  const start = startOfJakartaDay(date)
  const day = start.getUTCDay() === 0 ? 7 : start.getUTCDay()
  start.setUTCDate(start.getUTCDate() - (day - 1))
  return start
}

function getMonthStart(date: Date) {
  const start = startOfJakartaDay(date)
  start.setUTCDate(1)
  return start
}

function formatJakartaDate(date: Date) {
  return jakartaFormatter.format(date)
}

export function getPresetRange(preset: PeriodPreset, baseDate = new Date()): PeriodRange {
  const nowJakarta = toJakartaDate(baseDate)
  const end = formatJakartaDate(nowJakarta)

  if (preset === "today") {
    return { start: end, end }
  }

  if (preset === "week") {
    const weekStart = getWeekStart(nowJakarta)
    return { start: formatJakartaDate(weekStart), end }
  }

  if (preset === "month") {
    const monthStart = getMonthStart(nowJakarta)
    return { start: formatJakartaDate(monthStart), end }
  }

  return clampRange({ start: end, end })
}

export function formatPeriodLabel(range: PeriodRange): string {
  const startParts = toDateParts(range.start)
  const endParts = toDateParts(range.end)
  if (!startParts || !endParts) return ""

  const sameDay = range.start === range.end
  const sameMonth = sameDay || (startParts.year === endParts.year && startParts.month === endParts.month)
  const sameYear = startParts.year === endParts.year

  const startMonth = MONTH_NAMES[startParts.month - 1] ?? ""
  const endMonth = MONTH_NAMES[endParts.month - 1] ?? ""

  if (sameDay) {
    return `${startParts.day} ${startMonth} ${startParts.year}`
  }

  if (sameMonth) {
    return `${startParts.day}–${endParts.day} ${endMonth} ${endParts.year}`
  }

  if (sameYear) {
    return `${startParts.day} ${startMonth} – ${endParts.day} ${endMonth} ${endParts.year}`
  }

  return `${startParts.day} ${startMonth} ${startParts.year} – ${endParts.day} ${endMonth} ${endParts.year}`
}

interface PeriodPickerProps {
  value: PeriodRange
  preset: PeriodPreset
  onChange: (range: PeriodRange, preset: PeriodPreset) => void
  className?: string
}

function PeriodPicker({ value, preset, onChange, className }: PeriodPickerProps) {
  const normalized = useMemo(() => clampRange(value), [value])

  const rootClassName = [
    "space-y-3 md:space-y-4 max-[400px]:space-y-2",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  const handlePresetClick = (nextPreset: PeriodPreset) => {
    if (nextPreset === "custom") {
      onChange(normalized, "custom")
      return
    }
    onChange(getPresetRange(nextPreset), nextPreset)
  }

  const handleDateChange = (key: "start" | "end") => (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = clampRange({ ...normalized, [key]: event.target.value })
    onChange(nextValue, "custom")
  }

  return (
    <div className={rootClassName}>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-card/60 p-1.5 text-xs shadow-sm backdrop-blur max-[400px]:gap-1.5 max-[400px]:p-1 sm:text-sm">
        {SEGMENTS.map((segment) => {
          const isActive = preset === segment.value
          return (
            <button
              key={segment.value}
              type="button"
              onClick={() => handlePresetClick(segment.value)}
              aria-label={segment.label}
              aria-pressed={isActive}
              className={`inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0 max-[400px]:basis-full sm:flex-none sm:text-sm ${
                isActive
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:bg-primary/5"
              }`}
            >
              {segment.label}
            </button>
          )
        })}
      </div>

      {preset === "custom" ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm sm:text-base max-[400px]:gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1 max-[400px]:basis-full">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">Start</span>
            <input
              type="date"
              value={normalized.start}
              onChange={handleDateChange("start")}
              className="h-11 min-w-[180px] rounded-xl border border-transparent bg-muted/40 px-3 text-sm shadow-inner ring-2 ring-transparent transition focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-primary/20 sm:px-4 sm:text-base max-[400px]:min-w-0"
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 max-[400px]:basis-full">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">End</span>
            <input
              type="date"
              value={normalized.end}
              onChange={handleDateChange("end")}
              className="h-11 min-w-[180px] rounded-xl border border-transparent bg-muted/40 px-3 text-sm shadow-inner ring-2 ring-transparent transition focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-primary/20 sm:px-4 sm:text-base max-[400px]:min-w-0"
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}

export default PeriodPicker
