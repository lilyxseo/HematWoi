export const WISHLIST_PRIORITY_LABELS: Record<number, string> = {
  1: 'Mendesak',
  2: 'Tinggi',
  3: 'Sedang',
  4: 'Rendah',
  5: 'Nice to have',
};

export function getWishlistPriorityLabel(priority?: number | null): string | null {
  if (priority == null) return null;
  const rounded = Math.round(priority);
  if (Number.isNaN(rounded)) return null;
  return WISHLIST_PRIORITY_LABELS[rounded] ?? null;
}
