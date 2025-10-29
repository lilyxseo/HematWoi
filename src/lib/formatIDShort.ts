const UNITS = [
  { value: 1_000_000_000_000, suffix: 'T' },
  { value: 1_000_000_000, suffix: 'M' },
  { value: 1_000_000, suffix: 'jt' },
  { value: 1_000, suffix: 'rb' },
] as const;

function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;

  const [integerPart, decimalPart] = rounded.toString().split('.');
  if (!decimalPart) {
    return integerPart;
  }

  const trimmedDecimals = decimalPart.replace(/0+$/, '');
  if (trimmedDecimals.length === 0) {
    return integerPart;
  }

  return `${integerPart},${trimmedDecimals}`;
}

export function formatIDShort(amount: number): string {
  if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
    return '—';
  }

  if (amount === 0) {
    return '0';
  }

  const sign = amount < 0 ? '-' : '';
  const absoluteValue = Math.abs(amount);

  for (let index = 0; index < UNITS.length; index += 1) {
    const unit = UNITS[index];
    if (absoluteValue >= unit.value) {
      let currentIndex = index;
      let raw = absoluteValue / unit.value;
      let rounded = Math.round(raw * 100) / 100;

      while (rounded >= 1000 && currentIndex > 0) {
        currentIndex -= 1;
        raw = absoluteValue / UNITS[currentIndex].value;
        rounded = Math.round(raw * 100) / 100;
      }

      return `${sign}${formatNumber(rounded)}${UNITS[currentIndex].suffix}`;
    }
  }

  return `${sign}${formatNumber(absoluteValue)}`;
}

