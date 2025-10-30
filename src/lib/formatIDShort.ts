const numberFormatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  useGrouping: false,
});

export function formatIDShort(amount: number): string {
  const absValue = Math.abs(amount);

  const thresholds = [
    { value: 1_000_000_000_000, suffix: 'T' },
    { value: 1_000_000_000, suffix: 'M' },
    { value: 1_000_000, suffix: 'jt' },
    { value: 1_000, suffix: 'rb' },
  ] as const;

  if (absValue === 0) {
    return '0';
  }

  for (const threshold of thresholds) {
    if (absValue >= threshold.value) {
      const scaled = Math.floor((absValue / threshold.value) * 100) / 100;
      return `${formatWithComma(scaled)}${threshold.suffix}`;
    }
  }

  return formatWithComma(Math.floor(absValue * 100) / 100);
}

function formatWithComma(value: number): string {
  return numberFormatter.format(value);
}
