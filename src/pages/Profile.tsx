import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthIdentity, User } from '@supabase/supabase-js';
import { useOutletContext } from 'react-router-dom';
import AccountCard from '../components/profile/AccountCard';
import SecurityCard from '../components/profile/SecurityCard';
import PreferencesCard from '../components/profile/PreferencesCard';
import NotificationsCard from '../components/profile/NotificationsCard';
import PrivacyDataCard from '../components/profile/PrivacyDataCard';
import IntegrationsCard from '../components/profile/IntegrationsCard';
import { useToast } from '../context/ToastContext.jsx';
import useNetworkStatus from '../hooks/useNetworkStatus.js';
import {
  checkUsernameAvailability,
  changePassword,
  exportUserData,
  getLinkedProviders,
  getProfile,
  listSessions,
  requestAccountDeletion,
  signOutSession,
  unlinkProvider,
  updateAccount,
  updateNotifications,
  updatePreferences,
  uploadAvatar,
  refreshAvatarUrl,
  type NotificationSettings,
  type SessionSummary,
  type ThemePreference,
  type UserProfileRecord,
} from '../lib/api-profile';

const tabs = [
  { id: 'account', label: 'Akun' },
  { id: 'security', label: 'Keamanan' },
  { id: 'preferences', label: 'Preferensi' },
  { id: 'notifications', label: 'Notifikasi' },
  { id: 'privacy', label: 'Privasi & Data' },
  { id: 'integrations', label: 'Integrasi' },
];

type OutletContextValue = {
  theme?: ThemePreference;
  setTheme?: (theme: ThemePreference) => void;
};

type ProviderState = {
  id: 'google' | 'github';
  connected: boolean;
  email?: string | null;
};

function formatError(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}

function providerEmail(user: User | null, provider: 'google' | 'github'): string | null {
  if (!user?.identities) return null;
  const identity = (user.identities as AuthIdentity[]).find((item) => item.provider === provider);
  if (!identity) return null;
  const data = identity.identity_data as Record<string, unknown> | null | undefined;
  const email = typeof data?.email === 'string' ? data.email : null;
  return email ?? user.email ?? null;
}

export default function ProfilePage() {
  const { setTheme } = useOutletContext<OutletContextValue>();
  const toast = useToast();
  const addToast = toast?.addToast ?? (() => {});
  const online = useNetworkStatus();
  const [activeTab, setActiveTab] = useState<string>('account');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [providers, setProviders] = useState<ProviderState[]>([]);
  const [accountSaving, setAccountSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [providerLoading, setProviderLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tabRefs = useRef<HTMLButtonElement[]>([]);

  const loadSessions = useCallback(async () => {
    try {
      const data = await listSessions();
      setSessions(data);
    } catch (err) {
      if (import.meta.env?.DEV) {
        console.debug('[HW][profile-ui] gagal memuat sesi', err);
      }
    }
  }, []);

  const loadProviders = useCallback(
    async (nextUser: User | null) => {
      try {
        const linked = await getLinkedProviders();
        const list: ProviderState[] = ['google', 'github'].map((id) => ({
          id,
          connected: linked.includes(id as 'google' | 'github'),
          email: providerEmail(nextUser, id as 'google' | 'github'),
        }));
        setProviders(list);
      } catch (err) {
        if (import.meta.env?.DEV) {
          console.debug('[HW][profile-ui] gagal memuat provider', err);
        }
      }
    },
    [],
  );

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { profile: profileData, user: userData } = await getProfile();
      setProfile(profileData);
      setUser(userData);
      setEmail(userData.email ?? '');
      if (profileData.avatar_url) {
        try {
          const signed = await refreshAvatarUrl(profileData.avatar_url);
          setAvatarUrl(signed);
        } catch (err) {
          if (import.meta.env?.DEV) {
            console.debug('[HW][profile-ui] gagal muat avatar', err);
          }
          setAvatarUrl(null);
        }
      } else {
        setAvatarUrl(null);
      }
      if (setTheme) {
        setTheme(profileData.theme);
      }
      await Promise.all([loadSessions(), loadProviders(userData)]);
    } catch (err) {
      setError(formatError(err, 'Tidak dapat memuat profil. Pastikan koneksi internet tersedia.'));
    } finally {
      setLoading(false);
    }
  }, [loadProviders, loadSessions, setTheme]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = (index + 1) % tabs.length;
      setActiveTab(tabs[nextIndex]?.id ?? tabs[0].id);
      tabRefs.current[nextIndex]?.focus();
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = (index - 1 + tabs.length) % tabs.length;
      setActiveTab(tabs[prevIndex]?.id ?? tabs[0].id);
      tabRefs.current[prevIndex]?.focus();
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setActiveTab(tabs[0].id);
      tabRefs.current[0]?.focus();
    }
    if (event.key === 'End') {
      event.preventDefault();
      const last = tabs.length - 1;
      setActiveTab(tabs[last]?.id ?? tabs[0].id);
      tabRefs.current[last]?.focus();
    }
  };

  const handleAccountSave = async (payload: { full_name: string | null; username: string | null }) => {
    if (!profile) return;
    setAccountSaving(true);
    try {
      const updated = await updateAccount(payload);
      setProfile(updated);
      addToast('Profil berhasil diperbarui.', 'success');
    } catch (err) {
      addToast(formatError(err, 'Tidak bisa menyimpan profil. Coba lagi.'), 'error');
    } finally {
      setAccountSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!online) {
      addToast('Tidak bisa mengunggah avatar saat offline.', 'error');
      return;
    }
    setAvatarUploading(true);
    try {
      const { url, profile: updated } = await uploadAvatar(file);
      setAvatarUrl(url);
      setProfile(updated);
      addToast('Avatar berhasil diperbarui.', 'success');
    } catch (err) {
      addToast(formatError(err, 'Avatar gagal diunggah.'), 'error');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleCheckUsername = async (username: string) => {
    if (!online) {
      return 'Tidak bisa memeriksa saat offline.';
    }
    try {
      const available = await checkUsernameAvailability(username);
      return available ? null : 'Username sudah digunakan.';
    } catch (err) {
      return formatError(err, 'Tidak dapat memeriksa username.');
    }
  };

  const handlePreferencesSave = async (values: {
    theme: ThemePreference;
    locale: string;
    currency: string;
    date_format: string;
    timezone: string;
  }) => {
    if (!profile) return;
    setPreferencesSaving(true);
    try {
      const updated = await updatePreferences(values);
      setProfile(updated);
      if (setTheme) {
        setTheme(updated.theme);
      }
      addToast('Preferensi berhasil disimpan.', 'success');
    } catch (err) {
      addToast(formatError(err, 'Tidak dapat menyimpan preferensi.'), 'error');
    } finally {
      setPreferencesSaving(false);
    }
  };

  const handleNotificationsSave = async (value: NotificationSettings) => {
    setNotificationsSaving(true);
    try {
      const updated = await updateNotifications(value);
      setProfile(updated);
      addToast('Pengaturan notifikasi diperbarui.', 'success');
    } catch (err) {
      addToast(formatError(err, 'Tidak dapat menyimpan notifikasi.'), 'error');
    } finally {
      setNotificationsSaving(false);
    }
  };

  const handlePasswordChange = async (payload: {
    current_password: string;
    new_password: string;
    sign_out_others: boolean;
  }) => {
    setPasswordSaving(true);
    try {
      await changePassword(payload);
      addToast('Kata sandi berhasil diperbarui.', 'success');
      if (payload.sign_out_others) {
        await loadSessions();
      }
    } catch (err) {
      addToast(formatError(err, 'Tidak dapat mengubah kata sandi.'), 'error');
      throw err;
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSignOutCurrent = async () => {
    try {
      await signOutSession('current');
      addToast('Berhasil keluar dari perangkat ini.', 'info');
      window.location.assign('/auth');
    } catch (err) {
      addToast(formatError(err, 'Tidak dapat keluar dari sesi ini.'), 'error');
    }
  };

  const handleSignOutAll = async () => {
    try {
      await signOutSession('all');
      addToast('Semua sesi telah keluar.', 'info');
      window.location.assign('/auth');
    } catch (err) {
      addToast(formatError(err, 'Tidak dapat keluar dari semua sesi.'), 'error');
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    if (!online) {
      throw new Error('Tidak bisa mengekspor saat offline.');
    }
    setExporting(true);
    try {
      const blob = await exportUserData(format);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `hematwoi-data-${timestamp}.${format === 'json' ? 'json' : 'csv'}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addToast(`Ekspor ${format.toUpperCase()} siap diunduh.`, 'success');
      return `Ekspor ${format.toUpperCase()} berhasil. File: ${fileName}`;
    } catch (err) {
      addToast(formatError(err, 'Tidak dapat mengekspor data.'), 'error');
      throw err;
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!online) {
      throw new Error('Tidak bisa mengajukan penghapusan akun saat offline.');
    }
    setDeleting(true);
    try {
      const feedback = await requestAccountDeletion();
      addToast('Permintaan hapus akun dikirim.', 'info');
      return feedback;
    } catch (err) {
      addToast(formatError(err, 'Tidak dapat mengirim permintaan hapus akun.'), 'error');
      throw err;
    } finally {
      setDeleting(false);
    }
  };

  const handleDisconnectProvider = async (provider: 'google' | 'github') => {
    if (!online) {
      addToast('Tidak bisa memutuskan sambungan saat offline.', 'error');
      return;
    }
    setProviderLoading(provider);
    try {
      await unlinkProvider(provider);
      const { profile: refreshedProfile, user: refreshedUser } = await getProfile();
      setProfile(refreshedProfile);
      setUser(refreshedUser);
      setEmail(refreshedUser.email ?? '');
      if (refreshedProfile.avatar_url) {
        try {
          const signed = await refreshAvatarUrl(refreshedProfile.avatar_url);
          setAvatarUrl(signed);
        } catch (err) {
          if (import.meta.env?.DEV) {
            console.debug('[HW][profile-ui] gagal memuat avatar setelah unlink', err);
          }
        }
      } else {
        setAvatarUrl(null);
      }
      addToast('Penyedia berhasil diputus.', 'success');
      await loadProviders(refreshedUser);
    } catch (err) {
      addToast(formatError(err, 'Tidak dapat memutuskan sambungan.'), 'error');
      await loadProviders(user);
    } finally {
      setProviderLoading(null);
    }
  };

  const offlineBanner = !online ? (
    <div
      className="rounded-3xl border border-warning/40 bg-warning/15 px-4 py-3 text-sm text-warning"
      role="status"
    >
      Mode lokal — perubahan tidak dapat disimpan.
    </div>
  ) : null;

  const loadingSkeleton = (
    <div className="space-y-4">
      <div className="h-40 rounded-3xl border border-border-subtle bg-surface-alt/60 animate-pulse" />
      <div className="h-40 rounded-3xl border border-border-subtle bg-surface-alt/60 animate-pulse" />
      <div className="h-40 rounded-3xl border border-border-subtle bg-surface-alt/60 animate-pulse" />
    </div>
  );

  return (
    <main className="flex min-h-full flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-primary">Profil</h1>
        <p className="text-sm text-muted">Kelola akun & preferensi untuk pengalaman HematWoi yang lebih personal.</p>
      </header>
      {offlineBanner}
      <div className="sticky top-[72px] z-20 -mx-4 border-b border-border-subtle/80 bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-0 sm:rounded-3xl sm:border sm:px-6">
        <nav role="tablist" aria-label="Pengaturan profil" className="flex snap-x gap-2 overflow-x-auto">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[index] = element ?? undefined;
              }}
              type="button"
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`profile-tab-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={clsx(
                'min-h-[40px] flex-shrink-0 rounded-2xl px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                activeTab === tab.id
                  ? 'bg-primary text-white shadow'
                  : 'border border-border-subtle bg-surface-alt text-muted hover:text-primary',
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      {error ? (
        <div className="rounded-3xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </div>
      ) : null}
      {loading || !profile ? (
        loadingSkeleton
      ) : (
        <div className="space-y-6">
          <section
            id="profile-tab-account"
            role="tabpanel"
            aria-labelledby="tab-account"
            hidden={activeTab !== 'account'}
          >
            <AccountCard
              profile={profile}
              email={email}
              avatarUrl={avatarUrl}
              saving={accountSaving}
              uploading={avatarUploading}
              disabled={!online}
              onSubmit={handleAccountSave}
              onUploadAvatar={handleAvatarUpload}
              onCheckUsername={handleCheckUsername}
            />
          </section>
          <section
            id="profile-tab-security"
            role="tabpanel"
            aria-labelledby="tab-security"
            hidden={activeTab !== 'security'}
          >
            <SecurityCard
              sessions={sessions}
              loadingPassword={passwordSaving}
              disabled={!online}
              onChangePassword={handlePasswordChange}
              onRefreshSessions={loadSessions}
              onSignOutCurrent={handleSignOutCurrent}
              onSignOutAll={handleSignOutAll}
            />
          </section>
          <section
            id="profile-tab-preferences"
            role="tabpanel"
            aria-labelledby="tab-preferences"
            hidden={activeTab !== 'preferences'}
          >
            <PreferencesCard
              profile={profile}
              saving={preferencesSaving}
              disabled={!online}
              onSave={handlePreferencesSave}
              onPreviewTheme={(value) => {
                if (setTheme) {
                  setTheme(value);
                }
              }}
            />
          </section>
          <section
            id="profile-tab-notifications"
            role="tabpanel"
            aria-labelledby="tab-notifications"
            hidden={activeTab !== 'notifications'}
          >
            <NotificationsCard
              value={profile.notifications}
              saving={notificationsSaving}
              disabled={!online}
              onSave={handleNotificationsSave}
            />
          </section>
          <section
            id="profile-tab-privacy"
            role="tabpanel"
            aria-labelledby="tab-privacy"
            hidden={activeTab !== 'privacy'}
          >
            <PrivacyDataCard
              exporting={exporting}
              deleting={deleting}
              disabled={!online}
              onExport={handleExport}
              onDelete={handleDeleteAccount}
            />
          </section>
          <section
            id="profile-tab-integrations"
            role="tabpanel"
            aria-labelledby="tab-integrations"
            hidden={activeTab !== 'integrations'}
          >
            <IntegrationsCard
              providers={providers}
              disabled={!online}
              loadingProvider={providerLoading}
              onDisconnect={handleDisconnectProvider}
            />
          </section>
        </div>
      )}
    </main>
  );
}
