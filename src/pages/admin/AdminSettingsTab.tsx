import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import {
  getAppDescription,
  getBranding,
  setAppDescription,
  setBranding,
  type AppDescriptionSetting,
  type BrandingSetting,
} from '../../lib/adminApi';
import {
  cardClass,
  inputClass,
  primaryButton,
  subtleButton,
  textAreaClass,
} from './adminShared';

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch (error) {
    console.error(error);
    return value;
  }
}

export default function AdminSettingsTab() {
  const { addToast } = useToast();
  const [description, setDescription] = useState('');
  const [descriptionMeta, setDescriptionMeta] = useState<AppDescriptionSetting | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [descriptionLoading, setDescriptionLoading] = useState(true);
  const [savingDescription, setSavingDescription] = useState(false);

  const [branding, setBrandingValue] = useState<BrandingSetting | null>(null);
  const [brandingDraft, setBrandingDraft] = useState({ primary: '', secondary: '' });
  const [brandingLoading, setBrandingLoading] = useState(true);
  const [savingBranding, setSavingBranding] = useState(false);

  const loadDescription = useCallback(async () => {
    setDescriptionLoading(true);
    try {
      const data = await getAppDescription();
      setDescription(data.text ?? '');
      setDescriptionDraft(data.text ?? '');
      setDescriptionMeta(data);
    } catch (err) {
      console.error(err);
      addToast(err instanceof Error ? err.message : 'Gagal memuat deskripsi aplikasi', 'error');
    } finally {
      setDescriptionLoading(false);
    }
  }, [addToast]);

  const loadBranding = useCallback(async () => {
    setBrandingLoading(true);
    try {
      const data = await getBranding();
      setBrandingValue(data);
      setBrandingDraft({
        primary: data.primary ?? '',
        secondary: data.secondary ?? '',
      });
    } catch (err) {
      console.error(err);
      addToast(err instanceof Error ? err.message : 'Gagal memuat branding', 'error');
    } finally {
      setBrandingLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadDescription();
    void loadBranding();
  }, [loadDescription, loadBranding]);

  const descriptionChanged = useMemo(
    () => descriptionDraft.trim() !== (description ?? '').trim(),
    [descriptionDraft, description]
  );

  const brandingChanged = useMemo(() => {
    if (!branding) {
      return brandingDraft.primary.trim() !== '' || brandingDraft.secondary.trim() !== '';
    }
    return (
      (brandingDraft.primary || '').trim() !== (branding.primary || '').trim() ||
      (brandingDraft.secondary || '').trim() !== (branding.secondary || '').trim()
    );
  }, [branding, brandingDraft]);

  const handleSaveDescription = async () => {
    setSavingDescription(true);
    try {
      const updated = await setAppDescription(descriptionDraft.trim());
      setDescription(updated.text);
      setDescriptionDraft(updated.text);
      setDescriptionMeta(updated);
      addToast('Deskripsi aplikasi diperbarui', 'success');
    } catch (err) {
      console.error(err);
      addToast(err instanceof Error ? err.message : 'Gagal menyimpan deskripsi', 'error');
    } finally {
      setSavingDescription(false);
    }
  };

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    try {
      const updated = await setBranding({
        primary: brandingDraft.primary,
        secondary: brandingDraft.secondary,
      });
      setBrandingValue(updated);
      setBrandingDraft({ primary: updated.primary, secondary: updated.secondary });
      addToast('Branding berhasil diperbarui', 'success');
    } catch (err) {
      console.error(err);
      addToast(err instanceof Error ? err.message : 'Gagal menyimpan branding', 'error');
    } finally {
      setSavingBranding(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <div className="mb-4 flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Deskripsi Aplikasi</h2>
          <p className="text-sm text-muted-foreground">
            Perbarui deskripsi singkat aplikasi yang tampil di halaman publik atau meta informasi.
          </p>
        </div>
        {descriptionLoading ? (
          <div className="space-y-3">
            <div className="h-11 w-40 animate-pulse rounded-2xl bg-border/60" />
            <div className="h-24 animate-pulse rounded-2xl bg-border/40" />
          </div>
        ) : (
          <>
            <textarea
              className={textAreaClass}
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
              placeholder="Tuliskan deskripsi singkat aplikasi..."
            />
            <div className="mt-4 flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
              <div>
                <span className="font-semibold">Terakhir diperbarui:</span>{' '}
                {formatDate(descriptionMeta?.updatedAt ?? null)}
              </div>
              {descriptionMeta?.updatedBy && (
                <div>
                  <span className="font-semibold">Oleh:</span> {descriptionMeta.updatedBy}
                </div>
              )}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" className={subtleButton} onClick={() => setDescriptionDraft(description)}>
                Reset
              </button>
              <button
                type="button"
                className={primaryButton}
                onClick={() => void handleSaveDescription()}
                disabled={!descriptionChanged || savingDescription}
              >
                Simpan Deskripsi
              </button>
            </div>
          </>
        )}
      </section>

      <section className={cardClass}>
        <div className="mb-4 flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Branding Aplikasi</h2>
          <p className="text-sm text-muted-foreground">
            Atur warna utama dan sekunder untuk konsistensi identitas merek.
          </p>
        </div>
        {brandingLoading ? (
          <div className="space-y-3">
            <div className="h-11 w-32 animate-pulse rounded-2xl bg-border/60" />
            <div className="h-11 w-32 animate-pulse rounded-2xl bg-border/60" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
                Warna Primer
                <div className="flex items-center gap-3">
                  <input
                    className={inputClass}
                    value={brandingDraft.primary}
                    onChange={(event) =>
                      setBrandingDraft((prev) => ({ ...prev, primary: event.target.value }))
                    }
                    placeholder="#2DD4BF"
                  />
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/50"
                    style={{ backgroundColor: brandingDraft.primary || '#ffffff' }}
                    aria-hidden
                  />
                </div>
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
                Warna Sekunder
                <div className="flex items-center gap-3">
                  <input
                    className={inputClass}
                    value={brandingDraft.secondary}
                    onChange={(event) =>
                      setBrandingDraft((prev) => ({ ...prev, secondary: event.target.value }))
                    }
                    placeholder="#6366F1"
                  />
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/50"
                    style={{ backgroundColor: brandingDraft.secondary || '#ffffff' }}
                    aria-hidden
                  />
                </div>
              </label>
            </div>
            <div className="mt-4 flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
              <div>
                <span className="font-semibold">Terakhir diperbarui:</span>{' '}
                {formatDate(branding?.updatedAt ?? null)}
              </div>
              {branding?.updatedBy && (
                <div>
                  <span className="font-semibold">Oleh:</span> {branding.updatedBy}
                </div>
              )}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className={subtleButton}
                onClick={() =>
                  setBrandingDraft({ primary: branding?.primary ?? '', secondary: branding?.secondary ?? '' })
                }
              >
                Reset
              </button>
              <button
                type="button"
                className={primaryButton}
                onClick={() => void handleSaveBranding()}
                disabled={!brandingChanged || savingBranding}
              >
                Simpan Branding
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
