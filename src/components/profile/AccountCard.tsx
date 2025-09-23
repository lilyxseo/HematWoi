import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ImageDown, Loader2, UploadCloud } from 'lucide-react';
import type { UserProfile } from '../../lib/api-profile';

interface AccountCardProps {
  profile: UserProfile | null;
  email: string | null;
  offline: boolean;
  onSave: (payload: { full_name?: string; username?: string | null }) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<void>;
  onCheckUsername: (username: string) => Promise<boolean>;
}

type UsernameStatus =
  | 'idle'
  | 'current'
  | 'checking'
  | 'available'
  | 'taken'
  | 'invalid'
  | 'error';

const USERNAME_REGEX = /^[_a-z0-9]{3,30}$/;

function normalizeUsernameInput(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export default function AccountCard({
  profile,
  email,
  offline,
  onSave,
  onUploadAvatar,
  onCheckUsername,
}: AccountCardProps) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropRef = useRef<HTMLLabelElement | null>(null);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setUsername(profile?.username ?? '');
    setStatus('idle');
    setStatusMessage('');
    setFormError('');
    setPreviewUrl(profile?.avatar_signed_url ?? null);
  }, [profile]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!username) {
      setStatus('idle');
      setStatusMessage('Gunakan huruf kecil, angka, atau underscore.');
      return;
    }
    if (profile && username === (profile.username ?? '')) {
      setStatus('current');
      setStatusMessage('Username saat ini.');
      return;
    }
    if (!USERNAME_REGEX.test(username)) {
      if (username.length < 3) {
        setStatus('invalid');
        setStatusMessage('Minimal 3 karakter.');
      } else if (username.length > 30) {
        setStatus('invalid');
        setStatusMessage('Maksimal 30 karakter.');
      } else {
        setStatus('invalid');
        setStatusMessage('Hanya huruf kecil, angka, dan underscore.');
      }
      return;
    }
    let active = true;
    setStatus('checking');
    setStatusMessage('Memeriksa ketersediaan…');
    const handler = window.setTimeout(async () => {
      try {
        const available = await onCheckUsername(username);
        if (!active) return;
        if (available) {
          setStatus('available');
          setStatusMessage('Username tersedia.');
        } else {
          setStatus('taken');
          setStatusMessage('Username sudah dipakai.');
        }
      } catch (error) {
        if (!active) return;
        setStatus('error');
        setStatusMessage(
          error instanceof Error ? error.message : 'Tidak bisa mengecek username saat ini.',
        );
      }
    }, 400);
    return () => {
      active = false;
      window.clearTimeout(handler);
    };
  }, [username, onCheckUsername, profile]);

  const hasChanges = useMemo(() => {
    const trimmedName = fullName.trim();
    const currentName = profile?.full_name ?? '';
    const normalized = trimmedName === currentName.trim();
    const usernameChanged = username !== (profile?.username ?? '');
    return !normalized || usernameChanged;
  }, [fullName, username, profile]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!hasChanges || offline) return;
      setSaving(true);
      setFormError('');
      try {
        await onSave({
          full_name: fullName.trim(),
          username: username ? username : null,
        });
      } catch (error) {
        setFormError(
          error instanceof Error
            ? error.message
            : 'Tidak bisa menyimpan profil. Cek koneksi atau coba lagi.',
        );
        inputRef.current?.focus();
      } finally {
        setSaving(false);
      }
    },
    [hasChanges, offline, onSave, fullName, username],
  );

  const handleFile = useCallback(
    async (file?: File | null) => {
      if (!file || offline) return;
      setUploading(true);
      setFormError('');
      try {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        await onUploadAvatar(file);
      } catch (error) {
        setFormError(
          error instanceof Error ? error.message : 'Tidak bisa mengunggah avatar saat ini.',
        );
        setPreviewUrl(profile?.avatar_signed_url ?? null);
      } finally {
        setUploading(false);
      }
    },
    [offline, onUploadAvatar, profile?.avatar_signed_url],
  );

  const onFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      void handleFile(file ?? null);
      event.target.value = '';
    },
    [handleFile],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      if (offline) return;
      const file = event.dataTransfer.files?.[0];
      void handleFile(file ?? null);
    },
    [handleFile, offline],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    if (offline) return;
    event.preventDefault();
  }, [offline]);

  useEffect(() => {
    const node = dropRef.current;
    if (!node) return;
    const prevent = (event: DragEvent) => {
      if (!node.contains(event.target as Node)) return;
      event.preventDefault();
    };
    node.addEventListener('dragenter', prevent);
    node.addEventListener('dragleave', prevent);
    return () => {
      node.removeEventListener('dragenter', prevent);
      node.removeEventListener('dragleave', prevent);
    };
  }, []);

  return (
    <section
      aria-labelledby="profile-account-heading"
      className="rounded-3xl border border-border-subtle bg-surface p-4 shadow-sm md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="profile-account-heading" className="text-lg font-semibold text-foreground">
          Akun
        </h2>
        <p className="text-sm text-muted">Kelola nama, username, dan avatar kamu.</p>
      </div>
      <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="col-span-1 md:col-span-2">
          <label
            ref={dropRef}
            htmlFor="avatar-upload"
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="group relative flex h-full min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border-subtle bg-surface-alt/60 p-4 text-center transition hover:border-primary/60 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring-primary"
          >
            <input
              id="avatar-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onFileChange}
              disabled={offline || uploading}
              className="sr-only"
            />
            <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-border-subtle bg-surface">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted">
                  <ImageDown className="h-10 w-10" aria-hidden="true" />
                </div>
              )}
              {uploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden="true" />
                </div>
              ) : null}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Perbarui avatar</p>
              <p className="text-xs text-muted">
                Seret & lepas atau klik untuk unggah. PNG/JPG/WEBP, maksimal 2MB.
              </p>
              {offline ? (
                <p className="text-xs text-warning">Mode offline — unggah dinonaktifkan.</p>
              ) : null}
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl bg-surface px-3 py-2 text-xs font-semibold text-primary shadow-sm">
              <UploadCloud className="h-4 w-4" aria-hidden="true" /> Pilih file
            </div>
          </label>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="profile-full-name" className="text-sm font-medium text-foreground">
            Nama lengkap
          </label>
          <input
            ref={inputRef}
            id="profile-full-name"
            name="full_name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            disabled={saving || offline}
            className="h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt/70 px-3 text-sm text-foreground shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="profile-username" className="text-sm font-medium text-foreground">
            Username / Handle
          </label>
          <div className="relative">
            <input
              id="profile-username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(normalizeUsernameInput(event.target.value))}
              disabled={saving || offline}
              aria-describedby="profile-username-status"
              aria-invalid={status === 'invalid' || status === 'taken' || status === 'error'}
              className="h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt/70 px-3 pr-10 text-sm text-foreground shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            />
            {status === 'available' || status === 'current' ? (
              <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-success" aria-hidden="true" />
            ) : null}
            {status === 'taken' || status === 'invalid' || status === 'error' ? (
              <AlertCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-danger" aria-hidden="true" />
            ) : null}
          </div>
          <p
            id="profile-username-status"
            className="flex items-center gap-2 text-xs"
            aria-live="polite"
          >
            {status === 'checking' ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted" aria-hidden="true" />
            ) : null}
            <span
              className={
                status === 'available' || status === 'current'
                  ? 'text-success'
                  : status === 'taken' || status === 'invalid' || status === 'error'
                    ? 'text-danger'
                    : 'text-muted'
              }
            >
              {statusMessage || 'Gunakan huruf kecil, angka, atau underscore.'}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <label htmlFor="profile-email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="profile-email"
            type="email"
            value={email ?? ''}
            readOnly
            className="h-11 w-full cursor-not-allowed rounded-2xl border border-border-subtle bg-surface-alt/60 px-3 text-sm text-muted shadow-inner"
          />
        </div>
        <div className="col-span-1 md:col-span-2 flex flex-col gap-2">
          {formError ? (
            <p className="flex items-center gap-2 text-sm text-danger" aria-live="assertive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              {formError}
            </p>
          ) : null}
          <div className="flex w-full justify-end">
            <button
              type="submit"
              disabled={!hasChanges || saving || offline || status === 'checking' || status === 'invalid' || status === 'taken'}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Simpan perubahan
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
