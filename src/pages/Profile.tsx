import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw, WifiOff } from 'lucide-react';
import AccountCard from '../components/profile/AccountCard';
import SecurityCard from '../components/profile/SecurityCard';
import PreferencesCard from '../components/profile/PreferencesCard';
import NotificationsCard from '../components/profile/NotificationsCard';
import PrivacyDataCard from '../components/profile/PrivacyDataCard';
import IntegrationsCard from '../components/profile/IntegrationsCard';
import { useToast } from '../context/ToastContext';
import useNetworkStatus from '../hooks/useNetworkStatus';
import { supabase } from '../lib/supabase';
import {
  changePassword,
  checkUsernameAvailability,
  getProfile,
  getSession,
  listSessions,
  signOutSession,
  unlinkProvider,
  updateAccount,
  updateNotifications,
  updatePreferences,
  uploadAvatar,
} from '../lib/api-profile';
import type {
  NotificationSettings,
  SessionInfo,
  ThemePreference,
  LinkedProvider,
  UserProfile,
} from '../lib/api-profile';

const tabs = [
  { id: 'account', label: 'Akun' },
  { id: 'security', label: 'Keamanan' },
  { id: 'preferences', label: 'Preferensi' },
  { id: 'notifications', label: 'Notifikasi' },
  { id: 'privacy', label: 'Privasi & Data' },
  { id: 'integrations', label: 'Integrasi' },
] as const;

type TabId = (typeof tabs)[number]['id'];

type ExportFormat = 'json' | 'csv';

type TableName = 'transactions' | 'categories' | 'goals' | 'debts' | 'subscriptions';

const EXPORT_TABLES: TableName[] = ['transactions', 'categories', 'goals', 'debts', 'subscriptions'];

function applyThemePreference(preference: ThemePreference) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
  root.setAttribute('data-theme', resolved);
}

function buildFilename(base: string, ext: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${base}-${timestamp}.${ext}`;
}

function convertRowsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows || rows.length === 0) return '';
  const headers = Array.from(rows.reduce((acc, row) => {
    Object.keys(row || {}).forEach((key) => acc.add(key));
    return acc;
  }, new Set<string>()));
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    const values = headers.map((header) => {
      const value = (row as Record<string, unknown>)[header];
      if (value == null) return '';
      if (typeof value === 'object') {
        return JSON.stringify(value).replace(/"/g, '""');
      }
      const text = String(value);
      if (text.includes(',') || text.includes('\n') || text.includes('"')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    });
    lines.push(values.join(','));
  });
  return lines.join('\n');
}

async function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<TabId>('account');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [linkedProviders, setLinkedProviders] = useState<LinkedProvider[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const { addToast } = useToast() ?? { addToast: () => {} };
  const online = useNetworkStatus();
  const isOffline = !online;

  const refreshSessions = useCallback(async () => {
    try {
      const data = await listSessions();
      setSessions(data);
    } catch (error) {
      if (import.meta.env?.DEV) {
        // eslint-disable-next-line no-console
        console.error('[HW][profile] gagal memuat sesi', error);
      }
    }
  }, []);

  const fetchProfileData = useCallback(async () => {
    const { user, profile: profileRow, avatarSignedUrl, linkedProviders: providers } = await getProfile();
    setProfile(profileRow);
    setAvatarUrl(avatarSignedUrl);
    setLinkedProviders(providers);
    setEmail(user.email ?? '');
    applyThemePreference(profileRow.theme);
    await refreshSessions();
  }, [refreshSessions]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setGlobalError(null);
    try {
      await fetchProfileData();
    } catch (error) {
      setGlobalError((error as Error).message ?? 'Tidak dapat memuat profil.');
    } finally {
      setLoading(false);
    }
  }, [fetchProfileData]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleAccountSave = useCallback(
    async (payload: { full_name: string | null; username: string | null }) => {
      setSavingAccount(true);
      try {
        const updated = await updateAccount(payload);
        setProfile(updated);
        addToast?.('Profil berhasil diperbarui.', 'success');
      } catch (error) {
        addToast?.((error as Error).message ?? 'Tidak bisa menyimpan profil.', 'error');
        throw error;
      } finally {
        setSavingAccount(false);
      }
    },
    [addToast]
  );

  const handleAvatarUpload = useCallback(
    async (file: File) => {
      try {
        const result = await uploadAvatar(file);
        setAvatarUrl(result.signedUrl);
        addToast?.('Avatar berhasil diperbarui.', 'success');
        await fetchProfileData();
      } catch (error) {
        addToast?.((error as Error).message ?? 'Gagal mengunggah avatar.', 'error');
        throw error;
      }
    },
    [addToast, fetchProfileData]
  );

  const handlePreferencesSave = useCallback(
    async (payload: { theme: ThemePreference; locale: string; currency: string; date_format: string; timezone: string }) => {
      setSavingPreferences(true);
      try {
        const updated = await updatePreferences(payload);
        setProfile(updated);
        applyThemePreference(updated.theme);
        addToast?.('Preferensi disimpan.', 'success');
      } catch (error) {
        addToast?.((error as Error).message ?? 'Tidak dapat menyimpan preferensi.', 'error');
        throw error;
      } finally {
        setSavingPreferences(false);
      }
    },
    [addToast]
  );

  const handleNotificationsSave = useCallback(
    async (settings: NotificationSettings) => {
      setSavingNotifications(true);
      try {
        const updated = await updateNotifications(settings);
        setProfile((prev) => (prev ? { ...prev, notifications: updated } : prev));
        addToast?.('Pengaturan notifikasi disimpan.', 'success');
      } catch (error) {
        addToast?.((error as Error).message ?? 'Tidak bisa menyimpan notifikasi.', 'error');
        throw error;
      } finally {
        setSavingNotifications(false);
      }
    },
    [addToast]
  );

  const handleChangePassword = useCallback(
    async (payload: { current_password: string; new_password: string; confirm_password: string; signOutOthers: boolean }) => {
      if (payload.new_password !== payload.confirm_password) {
        throw new Error('Konfirmasi kata sandi tidak cocok.');
      }
      setChangingPassword(true);
      try {
        await changePassword({
          current_password: payload.current_password,
          new_password: payload.new_password,
          sign_out_others: payload.signOutOthers,
        });
        addToast?.('Kata sandi berhasil diperbarui.', 'success');
        await refreshSessions();
      } catch (error) {
        addToast?.((error as Error).message ?? 'Tidak dapat mengubah kata sandi.', 'error');
        throw error;
      } finally {
        setChangingPassword(false);
      }
    },
    [addToast, refreshSessions]
  );

  const handleExportData = useCallback(
    async (format: ExportFormat) => {
      setExportingFormat(format);
      try {
        const session = await getSession();
        const userId = session?.user?.id;
        if (!userId) {
          throw new Error('Kamu perlu masuk untuk mengekspor data.');
        }
        const tables: Record<TableName, Record<string, unknown>[]> = {
          transactions: [],
          categories: [],
          goals: [],
          debts: [],
          subscriptions: [],
        };
        for (const table of EXPORT_TABLES) {
          const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
          if (error) throw error;
          tables[table] = data ?? [];
        }
        if (format === 'json') {
          const bundle = {
            exported_at: new Date().toISOString(),
            user: { id: userId, email },
            profile,
            data: tables,
          };
          const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
          await triggerDownload(blob, buildFilename('hematwoi-data', 'json'));
        } else {
          const parts: string[] = [];
          for (const table of EXPORT_TABLES) {
            const csv = convertRowsToCsv(tables[table]);
            parts.push(`# ${table}`);
            parts.push(csv || '');
            parts.push('');
          }
          const blob = new Blob([parts.join('\n')], { type: 'text/csv' });
          await triggerDownload(blob, buildFilename('hematwoi-data', 'csv'));
        }
        addToast?.('Data berhasil diekspor.', 'success');
      } catch (error) {
        addToast?.((error as Error).message ?? 'Gagal mengekspor data.', 'error');
        setExportingFormat(null);
        throw error;
      }
      setExportingFormat(null);
    },
    [addToast, email, profile]
  );

  const handleDeleteAccount = useCallback(async () => {
    setDeletingAccount(true);
    try {
      throw new Error('Penghapusan akun otomatis belum tersedia. Hubungi support@hematwoi.app untuk proses manual.');
    } finally {
      setDeletingAccount(false);
    }
  }, []);

  const handleSignOutCurrent = useCallback(async () => {
    try {
      await signOutSession();
      addToast?.('Sesi saat ini telah berakhir.', 'success');
    } catch (error) {
      addToast?.((error as Error).message ?? 'Gagal mengakhiri sesi.', 'error');
    }
  }, [addToast]);

  const handleSignOutOthers = useCallback(async () => {
    try {
      await signOutSession('others');
      await refreshSessions();
      addToast?.('Sesi lain telah keluar.', 'success');
    } catch (error) {
      addToast?.((error as Error).message ?? 'Tidak bisa keluar dari sesi lain.', 'error');
    }
  }, [addToast, refreshSessions]);

  const handleDisconnectProvider = useCallback(
    async (identityId: string) => {
      try {
        await unlinkProvider(identityId);
        await fetchProfileData();
        addToast?.('Integrasi berhasil diputus.', 'success');
      } catch (error) {
        addToast?.((error as Error).message ?? 'Tidak dapat memutuskan integrasi.', 'error');
        throw error;
      }
    },
    [addToast, fetchProfileData]
  );

  const tabPanels = useMemo(() => {
    if (!profile) return null;
    return {
      account: (
        <AccountCard
          fullName={profile.full_name}
          username={profile.username}
          email={email}
          avatarUrl={avatarUrl}
          pending={savingAccount}
          disabled={isOffline}
          onSave={handleAccountSave}
          onUploadAvatar={handleAvatarUpload}
          onValidateUsername={checkUsernameAvailability}
        />
      ),
      security: (
        <SecurityCard
          email={email}
          sessions={sessions}
          pending={changingPassword}
          disabled={isOffline}
          onChangePassword={handleChangePassword}
          onSignOutCurrent={handleSignOutCurrent}
          onSignOutOthers={handleSignOutOthers}
        />
      ),
      preferences: (
        <PreferencesCard
          theme={profile.theme}
          locale={profile.locale}
          currency={profile.currency}
          dateFormat={profile.date_format}
          timezone={profile.timezone}
          pending={savingPreferences}
          disabled={isOffline}
          onPreviewTheme={applyThemePreference}
          onSave={handlePreferencesSave}
        />
      ),
      notifications: (
        <NotificationsCard
          settings={profile.notifications}
          pending={savingNotifications}
          disabled={isOffline}
          onSave={handleNotificationsSave}
        />
      ),
      privacy: (
        <PrivacyDataCard
          pendingExport={exportingFormat !== null}
          pendingDelete={deletingAccount}
          disabled={isOffline}
          onExport={handleExportData}
          onDeleteAccount={handleDeleteAccount}
        />
      ),
      integrations: (
        <IntegrationsCard
          providers={linkedProviders}
          pending={false}
          disabled={isOffline}
          onDisconnect={handleDisconnectProvider}
        />
      ),
    } satisfies Record<TabId, JSX.Element>;
  }, [
    profile,
    email,
    avatarUrl,
    savingAccount,
    isOffline,
    sessions,
    changingPassword,
    savingPreferences,
    savingNotifications,
    exportingFormat,
    deletingAccount,
    linkedProviders,
    handleAccountSave,
    handleAvatarUpload,
    handleChangePassword,
    handlePreferencesSave,
    handleNotificationsSave,
    handleExportData,
    handleDeleteAccount,
    handleDisconnectProvider,
    handleSignOutCurrent,
    handleSignOutOthers,
  ]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Memuat profil…</span>
      </div>
    );
  }

  if (globalError) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-3xl border border-border-subtle bg-surface p-8 text-center shadow-sm">
        <p className="text-base font-semibold text-text-primary">Profil tidak dapat dimuat</p>
        <p className="text-sm text-text-muted">{globalError}</p>
        <button
          type="button"
          onClick={() => void loadProfile()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring-primary"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          Coba Lagi
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-border-subtle bg-surface p-6 text-center shadow-sm">
        <p className="text-base font-semibold text-text-primary">Kamu belum masuk.</p>
        <p className="text-sm text-text-muted">Masuk untuk mengelola profil dan preferensi kamu.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-text-primary">Profil</h1>
        <p className="text-sm text-text-muted">Kelola akun &amp; preferensi kamu di satu tempat.</p>
      </header>

      <div className="sticky top-0 z-20 -mx-4 border-b border-border-subtle/60 bg-surface/95 px-4 py-3 backdrop-blur md:static md:m-0 md:rounded-3xl md:border md:p-3">
        <nav className="flex flex-wrap gap-2" role="tablist" aria-label="Navigasi pengaturan profil">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setActiveTab(tab.id);
                }
              }}
              className={`inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-ring-primary ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-surface-alt text-text-primary hover:bg-surface-alt/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {isOffline && (
        <div className="flex items-start gap-3 rounded-3xl border border-warning/40 bg-warning/10 p-4 text-sm text-text-primary">
          <WifiOff className="mt-0.5 h-5 w-5 text-warning" aria-hidden="true" />
          <div>
            <p className="font-semibold">Mode lokal — perubahan tidak dapat disimpan.</p>
            <p className="text-xs text-text-muted">Aktifkan kembali koneksi internet untuk menyimpan perubahan ke server.</p>
          </div>
        </div>
      )}

      <div role="tabpanel" className="space-y-6" aria-live="polite">
        {tabPanels ? tabPanels[activeTab] : null}
      </div>
    </div>
  );
}
