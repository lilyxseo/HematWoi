const idFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

export function formatIDR(value: number): string {
  if (!Number.isFinite(value)) {
    return idFormatter.format(0)
  }

  return idFormatter.format(Math.round(value))
}
