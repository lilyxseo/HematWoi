import { isPrivacyModeEnabled } from './privacy-mode';

export function formatCurrency(n = 0, currency = 'IDR') {
  if (isPrivacyModeEnabled()) {
    return '••••••';
  }
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'id-ID', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n ?? 0);
}

export function formatMoney(n = 0, currency = 'IDR') {
  return formatCurrency(n, currency);
}

export function humanDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('id-ID');
}
