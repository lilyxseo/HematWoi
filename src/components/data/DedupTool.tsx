// @ts-nocheck
import { useState } from 'react';
import {
  IconLoader2 as Loader2,
  IconTrash as Trash2
} from '@tabler/icons-react';

export default function DedupTool({ duplicates = [], onDelete, loading, onRefresh }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const hasSelection = selectedIds.size > 0;

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDelete = async () => {
    if (!hasSelection) return;
    setBusy(true);
    try {
      await onDelete?.(Array.from(selectedIds));
      setSelectedIds(new Set());
      onRefresh?.();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[HW][data:dedup]', error);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card/70 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Deteksi Duplikat</h3>
          <p className="text-xs text-muted-foreground">Pilih catatan yang ingin dihapus.</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs text-muted-foreground underline"
        >
          Muat ulang
        </button>
      </div>
      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat kandidat duplikat...
        </div>
      ) : duplicates.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Tidak ditemukan duplikat.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {duplicates.map((group, index) => (
            <div key={index} className="rounded-2xl border border-border bg-background/60 p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">{group.length} entri mirip</p>
              <div className="mt-2 space-y-2">
                {group.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.title || item.notes || 'Tanpa catatan'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.date).toLocaleDateString('id-ID')} • {item.amount?.toLocaleString?.('id-ID')}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-muted"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelection(item.id)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleDelete}
          disabled={!hasSelection || busy}
          className="inline-flex h-[40px] items-center justify-center gap-2 rounded-full bg-destructive px-5 text-sm font-semibold text-destructive-foreground shadow-sm disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Hapus Terpilih
        </button>
      </div>
    </div>
  );
}
