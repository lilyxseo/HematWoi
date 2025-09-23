import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, FormEvent } from 'react';
import { Camera, ImageUp, Loader2 } from 'lucide-react';
import type { ProfileRecord } from '../../lib/api-profile';

const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp';
const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

interface AccountCardProps {
  profile: ProfileRecord | null;
  email: string;
  offline?: boolean;
  saving?: boolean;
  avatarUploading?: boolean;
  onSubmit: (payload: { full_name: string; username: string }) => Promise<void>;
  onAvatarUpload: (file: File) => Promise<void>;
  onCheckUsername: (username: string) => Promise<boolean>;
}

type UsernameState = 'idle' | 'checking' | 'available' | 'unavailable';

export default function AccountCard({
  profile,
  email,
  offline = false,
  saving = false,
  avatarUploading = false,
  onSubmit,
  onAvatarUpload,
  onCheckUsername,
}: AccountCardProps) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [usernameMessage, setUsernameMessage] = useState('');
  const [usernameState, setUsernameState] = useState<UsernameState>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const dropRef = useRef<HTMLLabelElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  const normalizedUsername = useMemo(() => username.trim().toLowerCase(), [username]);
  const initialUsername = useMemo(() => (profile?.username ?? '').trim().toLowerCase(), [profile?.username]);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setUsername(profile?.username ?? '');
    if (profile?.avatar_url) {
      setPreviewUrl(profile.avatar_url);
    }
  }, [profile?.avatar_url, profile?.full_name, profile?.username]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!normalizedUsername) {
      setUsernameState('idle');
      setUsernameMessage('');
      return;
    }
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setUsernameState('unavailable');
      setUsernameMessage('Gunakan 3-30 karakter: huruf kecil, angka, atau underscore.');
      return;
    }
    if (normalizedUsername === initialUsername) {
      setUsernameState('idle');
      setUsernameMessage('');
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setUsernameState('checking');
      try {
        const available = await onCheckUsername(normalizedUsername);
        if (cancelled) return;
        setUsernameState(available ? 'available' : 'unavailable');
        setUsernameMessage(
          available ? 'Username tersedia.' : 'Username sudah dipakai. Pilih nama lain.'
        );
      } catch (error) {
        if (cancelled) return;
        setUsernameState('idle');
        const message = error instanceof Error ? error.message : 'Tidak bisa memeriksa username.';
        setUsernameMessage(message);
      }
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [initialUsername, normalizedUsername, onCheckUsername]);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setFormError(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    const localUrl = URL.createObjectURL(file);
    objectUrlRef.current = localUrl;
    setPreviewUrl(localUrl);
    try {
      await onAvatarUpload(file);
    } catch (error) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setPreviewUrl(profile?.avatar_url ?? null);
      const message = error instanceof Error ? error.message : 'Gagal mengunggah avatar.';
      setFormError(message);
    }
  };

  const onDrop = (event: ReactDragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    const file = event.dataTransfer?.files?.[0];
    void handleFile(file ?? null);
  };

  const onDragEnter = (event: ReactDragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(true);
  };

  const onDragLeave = (event: ReactDragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (offline) return;
    setFormError(null);
    try {
      await onSubmit({
        full_name: fullName.trim(),
        username: normalizedUsername,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Tidak bisa menyimpan profil. Coba lagi.';
      setFormError(message);
    }
  };

  const usernameHelpId = 'account-username-help';
  const errorId = 'account-form-error';

  return (
    <section
      aria-labelledby="account-section-title"
      className="rounded-3xl border border-border-subtle bg-surface shadow-sm"
    >
      <form className="grid gap-6 p-4 md:p-6" onSubmit={handleSubmit} noValidate>
        <header className="space-y-1">
          <h2 id="account-section-title" className="text-lg font-semibold text-text">
            Akun
          </h2>
          <p className="text-sm text-muted">Perbarui profil publik dan identitas akun kamu.</p>
        </header>

        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div
                className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-border-subtle bg-surface-alt shadow-sm transition-colors ${
                  dragOver ? 'ring-2 ring-primary/60' : ''
                }`}
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Avatar pengguna"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Camera aria-hidden="true" className="h-8 w-8 text-muted" />
                )}
              </div>
              <label
                ref={dropRef}
                htmlFor="account-avatar"
                onDragEnter={onDragEnter}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border-subtle bg-surface-alt px-3 py-1 text-xs font-medium text-text shadow-sm transition hover:bg-surface-alt/80 focus-within:ring-2 focus-within:ring-primary"
              >
                <ImageUp aria-hidden="true" className="h-3.5 w-3.5" />
                Ganti
                <input
                  id="account-avatar"
                  name="avatar"
                  type="file"
                  accept={ACCEPTED_TYPES}
                  disabled={offline || avatarUploading}
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    void handleFile(file);
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
            <p className="text-center text-xs text-muted">
              PNG/JPG/WEBP · Maks 2MB · Ideal 512px
            </p>
            {avatarUploading ? (
              <div className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Mengunggah avatar...
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="grid gap-1">
              <label htmlFor="account-full-name" className="text-sm font-medium text-text">
                Nama lengkap
              </label>
              <input
                id="account-full-name"
                name="full_name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={saving}
              />
              <p className="text-xs text-muted" id="account-full-name-hint">
                Tampilkan nama ini di area profil dan leaderboard.
              </p>
            </div>

            <div className="grid gap-1">
              <label htmlFor="account-username" className="text-sm font-medium text-text">
                Username
              </label>
              <div className="relative">
                <input
                  id="account-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value.replace(/\s+/g, ''))}
                  disabled={saving}
                  aria-describedby={`${usernameHelpId}${usernameMessage ? ` ${usernameHelpId}-status` : ''}`}
                  aria-invalid={usernameState === 'unavailable'}
                />
                {usernameState === 'checking' ? (
                  <Loader2
                    className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              <p className="text-xs text-muted" id={usernameHelpId}>
                Gunakan huruf kecil, angka, atau underscore. Minimal 3 karakter.
              </p>
              <p
                id={`${usernameHelpId}-status`}
                className={`text-xs ${
                  usernameState === 'available'
                    ? 'text-success'
                    : usernameState === 'unavailable'
                      ? 'text-danger'
                      : 'text-muted'
                }`}
                aria-live="polite"
              >
                {usernameMessage}
              </p>
            </div>

            <div className="grid gap-1">
              <label htmlFor="account-email" className="text-sm font-medium text-text">
                Email
              </label>
              <input id="account-email" type="email" value={email} readOnly aria-readonly="true" />
              <p className="text-xs text-muted">Email ini digunakan untuk login dan pemulihan akun.</p>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end">
          <div className="flex flex-col items-end gap-2">
            {formError ? (
              <p id={errorId} className="text-sm text-danger" aria-live="assertive">
                {formError}
              </p>
            ) : null}
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={offline || saving || usernameState === 'checking' || usernameState === 'unavailable'}
              aria-describedby={formError ? errorId : undefined}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Simpan perubahan
            </button>
            {offline ? (
              <p className="text-xs text-muted" aria-live="polite">
                Mode lokal aktif — hubungkan internet untuk menyimpan.
              </p>
            ) : null}
          </div>
        </footer>
      </form>
    </section>
  );
}
