import { FormEvent, useEffect, useState } from 'react';
import clsx from 'clsx';
import { useToast } from '../../context/ToastContext.jsx';
import {
  getAppDescription,
  getBranding,
  setAppDescription,
  setBranding,
  type AppDescriptionSetting,
  type BrandingSetting,
} from '../../lib/adminApi';

const TEXTAREA_CLASS =
  'min-h-[140px] w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary';

const INPUT_CLASS =
  'h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary';

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

type BrandingForm = {
  primary: string;
  secondary: string;
};

export default function AdminSettingsTab() {
  const { addToast } = useToast();
  const [description, setDescription] = useState('');
  const [descriptionMeta, setDescriptionMeta] = useState<string | null>(null);
  const [branding, setBrandingState] = useState<BrandingForm>({ primary: '#1e40af', secondary: '#0ea5e9' });
  const [brandingMeta, setBrandingMeta] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDesc, setSavingDesc] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [desc, brand] = await Promise.all([getAppDescription(), getBranding()]);
        if (!mounted) return;
        setDescription(desc.text ?? '');
        setDescriptionMeta(desc.updated_at ?? null);
        setBrandingState({ primary: brand.primary, secondary: brand.secondary });
        setBrandingMeta(brand.updated_at ?? null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal memuat pengaturan';
        if (mounted) {
          addToast(message, 'error');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [addToast]);

  const handleDescriptionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingDesc) return;
    setSavingDesc(true);
    try {
      const result: AppDescriptionSetting = await setAppDescription(description);
      setDescription(result.text);
      setDescriptionMeta(result.updated_at ?? null);
      addToast('Deskripsi aplikasi disimpan', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan deskripsi';
      addToast(message, 'error');
    } finally {
      setSavingDesc(false);
    }
  };

  const handleBrandingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingBrand) return;

    const normalizeHex = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed.startsWith('#')) return `#${trimmed}`;
      return trimmed;
    };

    const payload = {
      primary: normalizeHex(branding.primary),
      secondary: normalizeHex(branding.secondary),
    };

    setSavingBrand(true);
    try {
      const result: BrandingSetting = await setBranding(payload);
      setBrandingState({ primary: result.primary, secondary: result.secondary });
      setBrandingMeta(result.updated_at ?? null);
      addToast('Branding diperbarui', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan branding';
      addToast(message, 'error');
    } finally {
      setSavingBrand(false);
    }
  };

  const renderSkeleton = () => (
    <div className="grid gap-6 lg:grid-cols-2">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-6">
          <div className="h-6 w-32 animate-pulse rounded-full bg-muted/40" />
          <div className="h-5 w-48 animate-pulse rounded-full bg-muted/40" />
          <div className="h-24 w-full animate-pulse rounded-2xl bg-muted/30" />
          <div className="h-11 w-32 animate-pulse rounded-2xl bg-muted/30" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Pengaturan Aplikasi</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola deskripsi aplikasi dan elemen branding agar konsisten dengan identitas produk.
        </p>
      </div>

      {loading ? (
        renderSkeleton()
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleDescriptionSubmit}
            className="space-y-4 rounded-2xl border border-border/60 bg-background p-6 shadow-sm"
          >
            <div>
              <h3 className="text-base font-semibold">Deskripsi Aplikasi</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Teks ini akan tampil sebagai penjelasan singkat aplikasi pada halaman publik atau meta data.
              </p>
            </div>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={TEXTAREA_CLASS}
              placeholder="Tuliskan deskripsi aplikasi di sini"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {descriptionMeta ? `Terakhir diperbarui ${dateFormatter.format(new Date(descriptionMeta))}` : 'Belum pernah disimpan'}
              </span>
              <button
                type="submit"
                className="h-11 rounded-2xl bg-primary px-6 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
                disabled={savingDesc}
              >
                Simpan Deskripsi
              </button>
            </div>
          </form>

          <form
            onSubmit={handleBrandingSubmit}
            className="space-y-4 rounded-2xl border border-border/60 bg-background p-6 shadow-sm"
          >
            <div>
              <h3 className="text-base font-semibold">Branding</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Sesuaikan warna utama dan sekunder untuk tampilan aplikasi. Gunakan format HEX (#RRGGBB).
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-muted-foreground">
                Warna Primer
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={branding.primary}
                    onChange={(event) =>
                      setBrandingState((prev) => ({ ...prev, primary: event.target.value }))
                    }
                    className="h-11 w-12 cursor-pointer rounded-xl border border-border/60 bg-transparent p-1"
                    aria-label="Pilih warna primer"
                  />
                  <input
                    value={branding.primary}
                    onChange={(event) =>
                      setBrandingState((prev) => ({ ...prev, primary: event.target.value }))
                    }
                    className={INPUT_CLASS}
                    placeholder="#1E40AF"
                  />
                </div>
              </label>
              <label className="text-sm font-semibold text-muted-foreground">
                Warna Sekunder
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={branding.secondary}
                    onChange={(event) =>
                      setBrandingState((prev) => ({ ...prev, secondary: event.target.value }))
                    }
                    className="h-11 w-12 cursor-pointer rounded-xl border border-border/60 bg-transparent p-1"
                    aria-label="Pilih warna sekunder"
                  />
                  <input
                    value={branding.secondary}
                    onChange={(event) =>
                      setBrandingState((prev) => ({ ...prev, secondary: event.target.value }))
                    }
                    className={INPUT_CLASS}
                    placeholder="#0EA5E9"
                  />
                </div>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {brandingMeta ? `Terakhir diperbarui ${dateFormatter.format(new Date(brandingMeta))}` : 'Belum pernah disimpan'}
              </span>
              <button
                type="submit"
                className="h-11 rounded-2xl bg-primary px-6 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
                disabled={savingBrand}
              >
                Simpan Branding
              </button>
            </div>
          </form>
        </div>
      )}

      {!loading ? (
        <div className="rounded-2xl border border-border/60 bg-background p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold">Preview Branding</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Lihat gambaran cepat tampilan warna pada elemen utama aplikasi.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="inline-flex h-6 w-10 rounded-full border border-border/60" style={{ backgroundColor: branding.primary }} />
              <span className="inline-flex h-6 w-10 rounded-full border border-border/60" style={{ backgroundColor: branding.secondary }} />
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Header</p>
                  <p className="mt-1 text-sm font-semibold">Admin Preview</p>
                </div>
                <div className="h-8 w-8 rounded-2xl" style={{ backgroundColor: branding.primary }} />
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 w-32 rounded-full bg-muted/40" />
                <div className="h-3 w-40 rounded-full bg-muted/40" />
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
              <p className="text-xs font-semibold text-muted-foreground">Button</p>
              <button
                type="button"
                className="mt-3 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm"
                style={{ background: `linear-gradient(135deg, ${branding.primary}, ${branding.secondary})` }}
              >
                Simpan Perubahan
              </button>
              <div className="mt-4 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: branding.secondary }} />
                <span className="text-xs text-muted-foreground">Highlight sekunder</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
