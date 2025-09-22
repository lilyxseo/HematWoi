// @ts-nocheck
import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';

export default function BulkActionsBar({
  selectedCount,
  categories,
  onDelete,
  onUpdateCategory,
  onClear,
  busy,
}) {
  const [categoryId, setCategoryId] = useState('');

  const handleUpdate = async () => {
    if (!categoryId) return;
    try {
      await onUpdateCategory?.(categoryId);
      setCategoryId('');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[HW][data:bulk-update]', error);
      }
    }
  };

  return (
    <div className="sticky bottom-3 z-30 w-full rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-medium text-foreground">
          {selectedCount} dipilih
          <button type="button" className="ml-3 text-xs text-muted-foreground underline" onClick={onClear}>
            kosongkan
          </button>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <div className="flex items-center gap-2">
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="h-[40px] min-w-[160px] rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="">Ubah kategori...</option>
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="inline-flex h-[40px] items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium shadow-sm"
              onClick={handleUpdate}
              disabled={!categoryId || busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Terapkan'}
            </button>
          </div>
          <button
            type="button"
            className="inline-flex h-[40px] items-center justify-center gap-2 rounded-xl bg-destructive px-4 text-sm font-semibold text-destructive-foreground shadow-sm disabled:opacity-50"
            onClick={onDelete}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}
