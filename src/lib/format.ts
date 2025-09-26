const IDR_FORMATTER = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatIDR(value: number): string {
  if (!Number.isFinite(value)) {
    return IDR_FORMATTER.format(0)
  }

  return IDR_FORMATTER.format(value)
}
