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

  for (let i = 0; i < thresholds.length; i += 1) {
    const threshold = thresholds[i];
    if (absValue >= threshold.value) {
      const scaled = absValue / threshold.value;
      const rounded = roundToThreeDigits(scaled);

      if (rounded >= 1000 && i > 0) {
        const higherThreshold = thresholds[i - 1];
        const higherScaled = absValue / higherThreshold.value;
        const higherRounded = roundToThreeDigits(higherScaled);
        return `${formatRounded(higherRounded)}${higherThreshold.suffix}`;
      }

      return `${formatRounded(rounded)}${threshold.suffix}`;
    }
  }

  return formatRounded(roundToThreeDigits(absValue));
}

const numberFormatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  useGrouping: false,
});

function roundToThreeDigits(value: number): number {
  if (value === 0) {
    return 0;
  }

  const integerDigits = Math.floor(value).toString().length;

  if (integerDigits >= 3) {
    return Math.round(value);
  }

  const decimalPlaces = integerDigits === 2 ? 1 : 2;
  const factor = 10 ** decimalPlaces;
  const rounded = Math.round(value * factor) / factor;

  if (rounded >= 10 ** integerDigits && integerDigits < 3) {
    return roundToThreeDigits(rounded);
  }

  return rounded;
}

function formatRounded(value: number): string {
  const formatted = numberFormatter.format(value);
  return formatted.replace(/,(?:0|00)$/, '');
}
