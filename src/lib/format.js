export function formatCurrency(n = 0, currency = 'IDR') {
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'id-ID', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n ?? 0);
}

function trimTrailingZeros(value) {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value
    .toFixed(1)
    .replace(/\.0$/, '')
    .replace(',', '.');
}

export function formatCurrencyShort(value = 0, { withSymbol = true } = {}) {
  const abs = Math.abs(value ?? 0);

  if (!Number.isFinite(abs) || abs === 0) {
    return withSymbol ? 'Rp 0' : '0';
  }

  let suffix = '';
  let divisor = 1;

  if (abs >= 1_000_000_000) {
    suffix = 'm';
    divisor = 1_000_000_000;
  } else if (abs >= 1_000_000) {
    suffix = 'jt';
    divisor = 1_000_000;
  } else if (abs >= 1_000) {
    suffix = 'k';
    divisor = 1_000;
  }

  let formattedNumber;
  if (divisor === 1) {
    formattedNumber = abs.toLocaleString('id-ID');
  } else {
    const base = abs / divisor;
    formattedNumber = trimTrailingZeros(base);
  }

  const result = `${formattedNumber}${suffix}`;
  return withSymbol ? `Rp ${result}` : result;
}

export function humanDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('id-ID');
}
