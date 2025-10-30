const integerFormatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: false,
});

const decimalFormatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
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

  for (let index = 0; index < thresholds.length; index += 1) {
    const threshold = thresholds[index];
    if (absValue < threshold.value) {
      continue;
    }

    const scaled = absValue / threshold.value;
    const { display, rounded } = formatScaledNumber(scaled);

    if (rounded >= 1000 && index > 0) {
      // Example: 999.9rb should be shown as 1jt.
      const nextThreshold = thresholds[index - 1];
      const nextScaled = absValue / nextThreshold.value;
      const nextResult = formatScaledNumber(nextScaled);
      return `${nextResult.display}${nextThreshold.suffix}`;
    }

    return `${display}${threshold.suffix}`;
  }

  return formatBaseNumber(absValue);
}

function formatScaledNumber(value: number): { display: string; rounded: number } {
  if (value >= 100) {
    const rounded = Math.round(value);
    return { display: integerFormatter.format(rounded), rounded };
  }

  if (value >= 10) {
    const rounded = Math.round(value);
    return { display: integerFormatter.format(rounded), rounded };
  }

  const rounded = Math.round(value * 10) / 10;
  if (rounded >= 10) {
    const promoted = Math.round(rounded);
    return { display: integerFormatter.format(promoted), rounded: promoted };
  }

  return { display: decimalFormatter.format(rounded), rounded };
}

function formatBaseNumber(value: number): string {
  if (value >= 100) {
    return integerFormatter.format(Math.round(value));
  }

  if (value >= 10) {
    return integerFormatter.format(Math.round(value));
  }

  const rounded = Math.round(value * 10) / 10;
  if (rounded >= 10) {
    return integerFormatter.format(Math.round(rounded));
  }

  return decimalFormatter.format(rounded);
}
