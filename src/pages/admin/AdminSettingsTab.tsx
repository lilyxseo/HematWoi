import { FormEvent, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useToast } from '../../context/ToastContext.jsx';
import {
  getAppInfo,
  getBranding,
  setAppInfo,
  setBranding,
  type AppInfoSetting,
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

type AppInfoForm = {
  title: string;
  tagline: string;
  description: string;
  logoUrl: string;
  faviconUrl: string;
};

export default function AdminSettingsTab() {
  const { addToast } = useToast();
  const [appInfo, setAppInfoState] = useState<AppInfoForm>({
    title: '',
    tagline: '',
    description: '',
    logoUrl: '',
    faviconUrl: '',
  });
  const [appInfoMeta, setAppInfoMeta] = useState<string | null>(null);
  const [branding, setBrandingState] = useState<BrandingForm>({ primary: '#1e40af', secondary: '#0ea5e9' });
  const [brandingMeta, setBrandingMeta] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [info, brand] = await Promise.all([getAppInfo(), getBranding()]);
        if (!mounted) return;
        setAppInfoState({
          title: info.title ?? '',
          tagline: info.tagline ?? '',
          description: info.description ?? '',
          logoUrl: info.logo_url ?? '',
          faviconUrl: info.favicon_url ?? '',
        });
        setAppInfoMeta(info.updated_at ?? null);
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

  const logoPreviewUrl = useMemo(() => appInfo.logoUrl.trim(), [appInfo.logoUrl]);

  const faviconPreviewUrl = useMemo(() => appInfo.faviconUrl.trim(), [appInfo.faviconUrl]);

  const handleAppInfoSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingInfo) return;
    setSavingInfo(true);
    try {
      const payload = {
        title: appInfo.title,
        tagline: appInfo.tagline,
        description: appInfo.description,
        logo_url: appInfo.logoUrl,
        favicon_url: appInfo.faviconUrl,
      };

      const result: AppInfoSetting = await setAppInfo(payload);
      setAppInfoState({
        title: result.title,
        tagline: result.tagline,
        description: result.description,
        logoUrl: result.logo_url,
        faviconUrl: result.favicon_url,
      });
      setAppInfoMeta(result.updated_at ?? null);
      addToast('Informasi aplikasi disimpan', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan informasi aplikasi';
      addToast(message, 'error');
    } finally {
      setSavingInfo(false);
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
          Kelola informasi utama, deskripsi aplikasi, dan elemen branding agar konsisten dengan identitas produk.
        </p>
      </div>

      {loading ? (
        renderSkeleton()
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleAppInfoSubmit} className="space-y-4 rounded-2xl border border-border/60 bg-background p-6 shadow-sm">
            <div>
              <h3 className="text-base font-semibold">Informasi Aplikasi</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Atur judul, tagline, deskripsi, dan logo aplikasi. Informasi ini akan muncul pada area publik maupun dashboard.
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold text-muted-foreground">
                Judul Aplikasi
                <input
                  value={appInfo.title}
                  onChange={(event) =>
                    setAppInfoState((prev) => ({ ...prev, title: event.target.value }))
                  }
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="HematWoi"
                  required
                />
              </label>

              <label className="block text-sm font-semibold text-muted-foreground">
                Tagline
                <input
                  value={appInfo.tagline}
                  onChange={(event) =>
                    setAppInfoState((prev) => ({ ...prev, tagline: event.target.value }))
                  }
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="Kelola keuangan lebih mudah"
                />
              </label>

              <label className="block text-sm font-semibold text-muted-foreground">
                Logo URL
                <input
                  value={appInfo.logoUrl}
                  onChange={(event) =>
                    setAppInfoState((prev) => ({ ...prev, logoUrl: event.target.value }))
                  }
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="https://example.com/logo.png"
                />
              </label>

              {logoPreviewUrl ? (
                <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border/60 p-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-muted/30">
                    <img
                      src={logoPreviewUrl}
                      alt="Logo preview"
                      className="h-full w-full object-contain"
                      onError={(event) => {
                        (event.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium">Pratinjau Logo</p>
                    <p className="line-clamp-1 break-all">{logoPreviewUrl}</p>
                  </div>
                </div>
              ) : null}

              <label className="block text-sm font-semibold text-muted-foreground">
                Favicon URL
                <input
                  value={appInfo.faviconUrl}
                  onChange={(event) =>
                    setAppInfoState((prev) => ({ ...prev, faviconUrl: event.target.value }))
                  }
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="https://example.com/favicon.ico"
                />
              </label>

              {faviconPreviewUrl ? (
                <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border/60 p-3">
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-border/40 bg-muted/30">
                    <img
                      src={faviconPreviewUrl}
                      alt="Favicon preview"
                      className="h-full w-full object-contain"
                      onError={(event) => {
                        (event.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium">Pratinjau Favicon</p>
                    <p className="line-clamp-1 break-all">{faviconPreviewUrl}</p>
                  </div>
                </div>
              ) : null}

              <label className="block text-sm font-semibold text-muted-foreground">
                Deskripsi
                <textarea
                  value={appInfo.description}
                  onChange={(event) =>
                    setAppInfoState((prev) => ({ ...prev, description: event.target.value }))
                  }
                  className={clsx(TEXTAREA_CLASS, 'mt-1')}
                  placeholder="Tuliskan deskripsi aplikasi di sini"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {appInfoMeta ? `Terakhir diperbarui ${dateFormatter.format(new Date(appInfoMeta))}` : 'Belum pernah disimpan'}
              </span>
              <button
                type="submit"
                className="h-11 rounded-2xl bg-primary px-6 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
                disabled={savingInfo}
              >
                Simpan Informasi
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
                <input
                  value={branding.primary}
                  onChange={(event) =>
                    setBrandingState((prev) => ({ ...prev, primary: event.target.value }))
                  }
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="#1E40AF"
                />
                <span className="mt-2 inline-flex h-6 w-16 rounded-full border border-border/60" style={{ backgroundColor: branding.primary }} />
              </label>
              <label className="text-sm font-semibold text-muted-foreground">
                Warna Sekunder
                <input
                  value={branding.secondary}
                  onChange={(event) =>
                    setBrandingState((prev) => ({ ...prev, secondary: event.target.value }))
                  }
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="#0EA5E9"
                />
                <span className="mt-2 inline-flex h-6 w-16 rounded-full border border-border/60" style={{ backgroundColor: branding.secondary }} />
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
    </div>
  );
}
