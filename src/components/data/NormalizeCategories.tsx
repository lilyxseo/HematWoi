// @ts-nocheck
import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getCurrentUserId } from '../../lib/session';

export default function NormalizeCategories({ categories = [], onComplete }) {
  const [mode, setMode] = useState<'rename' | 'merge'>('rename');
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [newName, setNewName] = useState('');
  const [deleteSource, setDeleteSource] = useState(true);
  const [impact, setImpact] = useState({ total: 0, loading: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sourceId) {
      setImpact({ total: 0, loading: false });
      return;
    }
    let cancelled = false;
    const fetchImpact = async () => {
      setImpact({ total: 0, loading: true });
      try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error('User belum masuk');
        const { count, error: countError } = await supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('category_id', sourceId);
        if (countError) throw countError;
        if (!cancelled) {
          setImpact({ total: count || 0, loading: false });
        }
      } catch (err) {
        if (!cancelled) {
          setImpact({ total: 0, loading: false });
          if (import.meta.env.DEV) {
            console.error('[HW][data:normalize]', err);
          }
        }
      }
    };
    fetchImpact();
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  const handleApply = async () => {
    if (!sourceId) {
      setError('Pilih kategori sumber terlebih dahulu.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('User belum masuk');
      if (mode === 'rename') {
        if (!newName.trim()) {
          throw new Error('Nama baru tidak boleh kosong');
        }
        const { error: renameError } = await supabase
          .from('categories')
          .update({ name: newName.trim() })
          .eq('id', sourceId)
          .eq('user_id', userId);
        if (renameError) throw renameError;
      } else {
        if (!targetId) {
          throw new Error('Pilih kategori target.');
        }
        const { error: updateError } = await supabase
          .from('transactions')
          .update({ category_id: targetId })
          .eq('user_id', userId)
          .eq('category_id', sourceId);
        if (updateError) throw updateError;
        if (deleteSource) {
          await supabase.from('categories').delete().eq('id', sourceId).eq('user_id', userId);
        }
      }
      onComplete?.();
      setSourceId('');
      setTargetId('');
      setNewName('');
    } catch (err) {
      setError(err.message || 'Gagal menyimpan perubahan');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card/70 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Normalisasi Kategori</h3>
          <p className="text-xs text-muted-foreground">Gabungkan atau ubah nama kategori untuk rapihkan data.</p>
        </div>
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Mode</label>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as 'rename' | 'merge')}
            className="h-[40px] w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="rename">Rename</option>
            <option value="merge">Merge</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Kategori sumber</label>
          <select
            value={sourceId}
            onChange={(event) => setSourceId(event.target.value)}
            className="h-[40px] w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="">Pilih kategori</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        {mode === 'merge' ? (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Kategori target</label>
            <select
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              className="h-[40px] w-full rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="">Pilih kategori</option>
              {categories
                .filter((cat) => cat.id !== sourceId)
                .map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
            </select>
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Nama baru</label>
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              className="h-[40px] w-full rounded-xl border border-border bg-background px-3 text-sm"
              placeholder="Nama kategori baru"
            />
          </div>
        )}
      </div>
      {mode === 'merge' && (
        <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-muted"
            checked={deleteSource}
            onChange={(event) => setDeleteSource(event.target.checked)}
          />
          Hapus kategori sumber setelah pemindahan
        </label>
      )}
      <div className="mt-4 rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        {impact.loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Menghitung dampak...
          </div>
        ) : sourceId ? (
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-primary" />
            <span>
              {impact.total} transaksi akan {mode === 'merge' ? 'dipindahkan' : 'diupdate nama kategorinya'}
            </span>
          </div>
        ) : (
          <span>Pilih kategori untuk melihat dampaknya.</span>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={handleApply}
          disabled={busy || !sourceId || (mode === 'merge' && !targetId)}
          className="inline-flex h-[42px] items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Terapkan
        </button>
        {mode === 'merge' && deleteSource && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Trash2 className="h-3 w-3" /> kategori sumber akan dihapus
          </div>
        )}
      </div>
    </div>
  );
}
