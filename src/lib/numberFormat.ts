const UNITS = [
  { value: 1_000_000_000_000, suffix: 'T' },
  { value: 1_000_000_000, suffix: 'M' },
  { value: 1_000_000, suffix: 'jt' },
  { value: 1_000, suffix: 'k' },
];

function formatScaled(value: number): string {
  if (value >= 100) {
    return Math.round(value).toString();
  }
  if (value >= 10) {
    return value.toFixed(0);
  }
  return value.toFixed(1).replace(/\.0$/, '');
}

export function formatShortCurrency(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) {
    return 'Rp 0';
  }

  const abs = Math.abs(amount);
  const unit = UNITS.find((candidate) => abs >= candidate.value) ?? {
    value: 1,
    suffix: '',
  };

  if (unit.value === 1) {
    return `Rp ${Math.round(abs).toLocaleString('id-ID')}`;
  }

  const scaled = abs / unit.value;
  return `Rp ${formatScaled(scaled)}${unit.suffix}`;
}
