export function formatIDR(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(safeValue);
}
