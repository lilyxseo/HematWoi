export interface FormatShortCurrencyOptions {
  signDisplay?: 'auto' | 'always' | 'never';
}

function formatScaled(value: number, suffix: string): string {
  const decimals = value >= 100 ? 0 : value >= 10 ? 0 : 1;
  const formatted = value.toFixed(decimals);
  return `${formatted.replace(/\.0$/, '')}${suffix}`;
}

export function formatShortCurrency(
  amount: number,
  options: FormatShortCurrencyOptions = {},
): string {
  const { signDisplay = 'auto' } = options;
  const isNegative = amount < 0;
  const isPositive = amount > 0;

  const absValue = Math.abs(amount);

  let suffix = '';
  let scaledValue = absValue;

  if (absValue >= 1_000_000_000_000) {
    suffix = 'T';
    scaledValue = absValue / 1_000_000_000_000;
  } else if (absValue >= 1_000_000_000) {
    suffix = 'M';
    scaledValue = absValue / 1_000_000_000;
  } else if (absValue >= 1_000_000) {
    suffix = 'jt';
    scaledValue = absValue / 1_000_000;
  } else if (absValue >= 1_000) {
    suffix = 'k';
    scaledValue = absValue / 1_000;
  }

  const numberPart =
    suffix === ''
      ? absValue.toLocaleString('id-ID')
      : formatScaled(scaledValue, suffix);

  let sign = '';
  if (isNegative) {
    sign = '-';
  } else if (isPositive && signDisplay === 'always') {
    sign = '+';
  } else if (signDisplay === 'never') {
    sign = '';
  }

  return `${sign}Rp ${numberPart}`.trim();
}
