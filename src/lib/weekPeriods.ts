const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('id-ID', { month: 'long' });

function formatIsoDateUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getFirstWeekStartOfPeriod(period: string): string {
  const [yearStr, monthStr] = period.split('-');
  const year = Number.parseInt(yearStr ?? '', 10);
  const month = Number.parseInt(monthStr ?? '', 10);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    return formatIsoDateUTC(todayUtc);
  }

  const cursor = new Date(Date.UTC(year, month - 1, 1));
  const targetMonth = cursor.getUTCMonth();

  while (cursor.getUTCDay() !== 1) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getUTCMonth() !== targetMonth) {
      break;
    }
  }

  return formatIsoDateUTC(cursor);
}

export function formatWeekSequenceLabel(sequence: number, weekStart: string): string {
  const safeSequence = Number.isFinite(sequence) ? sequence : Number.parseInt(String(sequence ?? ''), 10);
  const displaySequence = Number.isFinite(safeSequence) && safeSequence > 0 ? safeSequence : sequence;

  try {
    const monthLabel = MONTH_LABEL_FORMATTER.format(new Date(`${weekStart}T00:00:00.000Z`));
    if (Number.isFinite(displaySequence)) {
      return `Minggu ke ${displaySequence} bulan ${monthLabel}`;
    }
    return `Minggu bulan ${monthLabel}`;
  } catch (error) {
    if (Number.isFinite(displaySequence)) {
      return `Minggu ke ${displaySequence}`;
    }
    return 'Minggu';
  }
}
