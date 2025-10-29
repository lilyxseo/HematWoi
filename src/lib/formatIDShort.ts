const formatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
  useGrouping: false,
});

const UNITS = [
  { value: 1_000_000_000_000, suffix: 'T' },
  { value: 1_000_000_000, suffix: 'M' },
  { value: 1_000_000, suffix: 'jt' },
  { value: 1_000, suffix: 'rb' },
];

export function formatIDShort(amount: number): string {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return '—';
  }

  if (!Number.isFinite(amount)) {
    return amount > 0 ? '∞' : amount < 0 ? '-∞' : '—';
  }

  if (amount === 0) {
    return '0';
  }

  const sign = amount < 0 ? '-' : '';
  const absolute = Math.abs(amount);

  for (const { value, suffix } of UNITS) {
    if (absolute >= value) {
      const scaled = absolute / value;
      return `${sign}${formatter.format(scaled)}${suffix}`;
    }
  }

  return `${sign}${formatter.format(absolute)}`;
}

export default formatIDShort;
