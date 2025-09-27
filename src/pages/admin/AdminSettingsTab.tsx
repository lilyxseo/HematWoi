import { FormEvent, useEffect, useState } from 'react';
import clsx from 'clsx';
import { useToast } from '../../context/ToastContext.jsx';
import {
  getAppInfo,
  getBranding,
  setAppInfo,
  setBranding,
  type AppInfoSetting,
  type BrandingSetting,
  type UpdateAppInfoInput,
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

type AppInfoForm = UpdateAppInfoInput;

const DEFAULT_APP_INFO: AppInfoForm = {
  title: 'HematWoi',
  tagline: '',
  description: '',
  logo_url: '',
  favicon_url: '',
  support_email: '',
  support_phone: '',
  support_url: '',
};

export default function AdminSettingsTab() {
  const { addToast } = useToast();
  const [appInfo, setAppInfoState] = useState<AppInfoForm>({ ...DEFAULT_APP_INFO });
  const [infoMeta, setInfoMeta] = useState<string | null>(null);
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
        const nextInfo: AppInfoForm = {
          title: info.title,
          tagline: info.tagline,
          description: info.description,
          logo_url: info.logo_url,
          favicon_url: info.favicon_url,
          support_email: info.support_email,
          support_phone: info.support_phone,
          support_url: info.support_url,
        };
        setAppInfoState(nextInfo);
        setInfoMeta(info.updated_at ?? null);
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

  const handleInfoSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingInfo) return;
    setSavingInfo(true);
    try {
      const result: AppInfoSetting = await setAppInfo(appInfo);
      const nextInfo: AppInfoForm = {
        title: result.title,
        tagline: result.tagline,
        description: result.description,
        logo_url: result.logo_url,
        favicon_url: result.favicon_url,
        support_email: result.support_email,
        support_phone: result.support_phone,
        support_url: result.support_url,
      };
      setAppInfoState(nextInfo);
      setInfoMeta(result.updated_at ?? null);
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
          Kelola informasi utama aplikasi beserta elemen branding agar konsisten dengan identitas produk.
        </p>
      </div>

      {loading ? (
        renderSkeleton()
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleInfoSubmit}
            className="space-y-4 rounded-2xl border border-border/60 bg-background p-6 shadow-sm"
          >
            <div>
              <h3 className="text-base font-semibold">Informasi Aplikasi</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Ubah judul, deskripsi, dan detail kontak yang akan tampil di area publik maupun meta data aplikasi.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-muted-foreground">
                Judul Aplikasi
                <input
                  value={appInfo.title}
                  onChange={(event) => setAppInfoState((prev) => ({ ...prev, title: event.target.value }))}
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="HematWoi"
                  disabled={savingInfo}
                />
              </label>
              <label className="text-sm font-semibold text-muted-foreground">
                Tagline
                <input
                  value={appInfo.tagline}
                  onChange={(event) => setAppInfoState((prev) => ({ ...prev, tagline: event.target.value }))}
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="Kelola keuangan dengan mudah"
                  disabled={savingInfo}
                />
              </label>
            </div>
            <label className="text-sm font-semibold text-muted-foreground">
              Deskripsi
              <textarea
                value={appInfo.description}
                onChange={(event) => setAppInfoState((prev) => ({ ...prev, description: event.target.value }))}
                className={clsx(TEXTAREA_CLASS, 'mt-1')}
                placeholder="Tuliskan deskripsi aplikasi di sini"
                disabled={savingInfo}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-muted-foreground">
                URL Logo
                <input
                  value={appInfo.logo_url}
                  onChange={(event) => setAppInfoState((prev) => ({ ...prev, logo_url: event.target.value }))}
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="https://.../logo.png"
                  disabled={savingInfo}
                />
                <p className="mt-2 text-xs text-muted-foreground">Gunakan URL gambar berformat PNG atau SVG.</p>
              </label>
              <label className="text-sm font-semibold text-muted-foreground">
                URL Favicon
                <input
                  value={appInfo.favicon_url}
                  onChange={(event) => setAppInfoState((prev) => ({ ...prev, favicon_url: event.target.value }))}
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="https://.../favicon.ico"
                  disabled={savingInfo}
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-muted-foreground">
                Email Kontak
                <input
                  type="email"
                  value={appInfo.support_email}
                  onChange={(event) => setAppInfoState((prev) => ({ ...prev, support_email: event.target.value }))}
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="support@hematwoi.com"
                  disabled={savingInfo}
                />
              </label>
              <label className="text-sm font-semibold text-muted-foreground">
                Nomor Telepon
                <input
                  type="tel"
                  value={appInfo.support_phone}
                  onChange={(event) => setAppInfoState((prev) => ({ ...prev, support_phone: event.target.value }))}
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="0812-3456-7890"
                  disabled={savingInfo}
                />
              </label>
            </div>
            <label className="text-sm font-semibold text-muted-foreground">
              URL Bantuan / Website
              <input
                type="url"
                value={appInfo.support_url}
                onChange={(event) => setAppInfoState((prev) => ({ ...prev, support_url: event.target.value }))}
                className={clsx(INPUT_CLASS, 'mt-1')}
                placeholder="https://hematwoi.com/bantuan"
                disabled={savingInfo}
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {infoMeta ? `Terakhir diperbarui ${dateFormatter.format(new Date(infoMeta))}` : 'Belum pernah disimpan'}
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
                  disabled={savingBrand}
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
                  disabled={savingBrand}
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
