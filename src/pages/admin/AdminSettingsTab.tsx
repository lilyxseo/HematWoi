import { FormEvent, useEffect, useState } from 'react';
import clsx from 'clsx';
import { useToast } from '../../context/ToastContext.jsx';
import {
  getAppIdentity,
  getAppDescription,
  getBranding,
  setAppIdentity,
  setAppDescription,
  setBranding,
  type AppIdentitySetting,
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

type IdentityForm = {
  title: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
};

export default function AdminSettingsTab() {
  const { addToast } = useToast();
  const [identity, setIdentity] = useState<IdentityForm>({
    title: 'HematWoi',
    tagline: '',
    logoUrl: '',
    faviconUrl: '',
  });
  const [identityMeta, setIdentityMeta] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [descriptionMeta, setDescriptionMeta] = useState<string | null>(null);
  const [branding, setBrandingState] = useState<BrandingForm>({ primary: '#1e40af', secondary: '#0ea5e9' });
  const [brandingMeta, setBrandingMeta] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [identityData, desc, brand] = await Promise.all([
          getAppIdentity(),
          getAppDescription(),
          getBranding(),
        ]);
        if (!mounted) return;
        setIdentity({
          title: identityData.title,
          tagline: identityData.tagline,
          logoUrl: identityData.logo_url,
          faviconUrl: identityData.favicon_url,
        });
        setIdentityMeta(identityData.updated_at ?? null);
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

  const handleIdentitySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingIdentity) return;
    setSavingIdentity(true);
    try {
      const payload = {
        title: identity.title,
        tagline: identity.tagline,
        logo_url: identity.logoUrl,
        favicon_url: identity.faviconUrl,
      };
      const result: AppIdentitySetting = await setAppIdentity(payload);
      setIdentity({
        title: result.title,
        tagline: result.tagline,
        logoUrl: result.logo_url,
        faviconUrl: result.favicon_url,
      });
      setIdentityMeta(result.updated_at ?? null);
      addToast('Identitas aplikasi disimpan', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan identitas aplikasi';
      addToast(message, 'error');
    } finally {
      setSavingIdentity(false);
    }
  };

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
      <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-6 lg:col-span-2">
        <div className="h-6 w-40 animate-pulse rounded-full bg-muted/40" />
        <div className="h-5 w-56 animate-pulse rounded-full bg-muted/40" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="h-4 w-28 animate-pulse rounded-full bg-muted/40" />
              <div className="h-11 w-full animate-pulse rounded-2xl bg-muted/30" />
            </div>
          ))}
        </div>
        <div className="h-11 w-40 animate-pulse rounded-2xl bg-muted/30" />
      </div>
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
            onSubmit={handleIdentitySubmit}
            className="space-y-4 rounded-2xl border border-border/60 bg-background p-6 shadow-sm lg:col-span-2"
          >
            <div>
              <h3 className="text-base font-semibold">Identitas Aplikasi</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Atur judul, slogan, dan logo agar tampilan aplikasi sesuai dengan brand Anda.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-muted-foreground">
                Judul Aplikasi
                <input
                  value={identity.title}
                  onChange={(event) =>
                    setIdentity((prev) => ({ ...prev, title: event.target.value }))
                  }
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="HematWoi"
                />
              </label>
              <label className="text-sm font-semibold text-muted-foreground">
                Slogan / Tagline
                <input
                  value={identity.tagline}
                  onChange={(event) =>
                    setIdentity((prev) => ({ ...prev, tagline: event.target.value }))
                  }
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="Buat laporan finansial lebih mudah"
                />
              </label>
              <label className="text-sm font-semibold text-muted-foreground">
                URL Logo
                <input
                  value={identity.logoUrl}
                  onChange={(event) =>
                    setIdentity((prev) => ({ ...prev, logoUrl: event.target.value }))
                  }
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="https://example.com/logo.png"
                />
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border/60 bg-muted/40">
                    {identity.logoUrl ? (
                      <img
                        src={identity.logoUrl}
                        alt="Pratinjau logo"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <IconPlaceholder />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Gunakan URL gambar transparan (PNG/SVG) untuk hasil terbaik.
                  </p>
                </div>
              </label>
              <label className="text-sm font-semibold text-muted-foreground">
                URL Favicon
                <input
                  value={identity.faviconUrl}
                  onChange={(event) =>
                    setIdentity((prev) => ({ ...prev, faviconUrl: event.target.value }))
                  }
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="https://example.com/favicon.png"
                />
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border/60 bg-muted/40">
                    {identity.faviconUrl ? (
                      <img
                        src={identity.faviconUrl}
                        alt="Pratinjau favicon"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <IconPlaceholder />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Ukuran ideal 64x64 piksel.</p>
                </div>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {identityMeta
                  ? `Terakhir diperbarui ${dateFormatter.format(new Date(identityMeta))}`
                  : 'Belum pernah disimpan'}
              </span>
              <button
                type="submit"
                className="h-11 rounded-2xl bg-primary px-6 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
                disabled={savingIdentity}
              >
                Simpan Identitas
              </button>
            </div>
          </form>
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

function IconPlaceholder() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-6 w-6 text-muted-foreground/60"
    >
      <path
        d="M4.75 5.75a1 1 0 0 1 1-1h12.5a1 1 0 0 1 1 1v12.5a1 1 0 0 1-1 1H5.75a1 1 0 0 1-1-1V5.75Zm4 3.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Zm7 8a3.25 3.25 0 0 0-6.5 0h6.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
