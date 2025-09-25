export function formatCurrency(n = 0, currency = 'IDR') {
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'id-ID', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n ?? 0);
}

export const fmtIDR = (n = 0) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n || 0);

export function humanDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('id-ID');
}
