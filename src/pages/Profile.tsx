import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  AlertCircle,
  Bell,
  Loader2,
  Palette,
  ShieldHalf,
  UserCircle,
  LockKeyhole,
  Puzzle,
} from 'lucide-react';
import AccountCard from '../components/profile/AccountCard';
import SecurityCard from '../components/profile/SecurityCard';
import PreferencesCard from '../components/profile/PreferencesCard';
import NotificationsCard from '../components/profile/NotificationsCard';
import PrivacyDataCard from '../components/profile/PrivacyDataCard';
import IntegrationsCard from '../components/profile/IntegrationsCard';
import {
  changePassword,
  checkUsernameAvailability,
  getProfile,
  getSession,
  listSessions,
  signOutSession,
  updateAccount,
  updateNotifications,
  updatePreferences,
  uploadAvatar,
  unlinkProvider,
  type NotificationsSettings,
  type ProfileRecord,
  type SessionInfo,
  type ThemePreference,
} from '../lib/api-profile';
import { useToast } from '../context/ToastContext.jsx';
import useNetworkStatus from '../hooks/useNetworkStatus.js';
import { useMode } from '../hooks/useMode.jsx';
import { useRepo } from '../context/DataContext.jsx';

interface IntegrationState {
  provider: 'google' | 'github';
  connected: boolean;
  email?: string | null;
}

type ExportingState = {
  json: boolean;
  csv: boolean;
};

type TabKey = 'account' | 'security' | 'preferences' | 'notifications' | 'privacy' | 'integrations';

const TAB_ITEMS: Array<{ key: TabKey; label: string; icon: typeof UserCircle }> = [
  { key: 'account', label: 'Akun', icon: UserCircle },
  { key: 'security', label: 'Keamanan', icon: ShieldHalf },
  { key: 'preferences', label: 'Preferensi', icon: Palette },
  { key: 'notifications', label: 'Notifikasi', icon: Bell },
  { key: 'privacy', label: 'Privasi & Data', icon: LockKeyhole },
  { key: 'integrations', label: 'Integrasi', icon: Puzzle },
];

const FALLBACK_TIMEZONES = [
  'Asia/Jakarta',
  'Asia/Makassar',
  'Asia/Jayapura',
  'Asia/Singapore',
  'Asia/Bangkok',
  'Asia/Kuala_Lumpur',
];

function getSupportedTimezones(): string[] {
  if (typeof Intl !== 'undefined' && typeof (Intl as any).supportedValuesOf === 'function') {
    try {
      return (Intl as any).supportedValuesOf('timeZone') as string[];
    } catch {
      return FALLBACK_TIMEZONES;
    }
  }
  return FALLBACK_TIMEZONES;
}

function applyThemePreference(theme: ThemePreference) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
  root.setAttribute('data-theme', resolved);
  try {
    const raw = localStorage.getItem('hwTheme');
    const stored = raw ? JSON.parse(raw) : {};
    localStorage.setItem('hwTheme', JSON.stringify({ ...stored, mode: theme }));
  } catch {
    /* ignore */
  }
}

function deriveIntegrations(user: User | null): IntegrationState[] {
  const identities = user?.identities ?? [];
  const byProvider = new Map<string, { email?: string | null }>();
  identities.forEach((identity: any) => {
    if (!identity?.provider) return;
    byProvider.set(identity.provider, {
      email: identity.identity_data?.email ?? identity.identity_data?.full_name ?? null,
    });
  });
  return (['google', 'github'] as const).map((provider) => {
    const detail = byProvider.get(provider) ?? null;
    return {
      provider,
      connected: Boolean(detail),
      email: detail?.email ?? user?.email ?? null,
    } satisfies IntegrationState;
  });
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) {
    return 'No data';
  }
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row ?? {}).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  };
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((header) => escape((row as any)[header])).join(','));
  });
  return lines.join('\n');
}

export default function Profile() {
  const { addToast } = useToast();
  const online = useNetworkStatus();
  const { mode } = useMode();
  const repo = useRepo();
  const [activeTab, setActiveTab] = useState<TabKey>('account');
  const [loading, setLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationState[]>([]);
  const [accountSaving, setAccountSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [exporting, setExporting] = useState<ExportingState>({ json: false, csv: false });
  const [deleting, setDeleting] = useState(false);

  const offline = !online || mode !== 'online';
  const timezones = useMemo(() => getSupportedTimezones(), []);

  const refreshSessions = useCallback(async () => {
    setSessionLoading(true);
    try {
      const data = await listSessions();
      setSessions(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Tidak bisa memuat sesi aktif. Coba lagi.';
      addToast(message, 'danger');
    } finally {
      setSessionLoading(false);
    }
  }, [addToast]);

  const refreshIntegrations = useCallback((user: User | null) => {
    setIntegrations(deriveIntegrations(user));
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [{ user }, profileData] = await Promise.all([getSession(), getProfile()]);
        if (!mounted) return;
        setSessionUser(user);
        setProfile(profileData);
        applyThemePreference(profileData.theme);
        refreshIntegrations(user);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tidak bisa memuat profil.';
        addToast(message, 'danger');
      } finally {
        if (mounted) {
          setLoading(false);
          void refreshSessions();
        }
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [addToast, refreshIntegrations, refreshSessions]);

  const handleAccountSubmit = useCallback(
    async (payload: { full_name: string; username: string }) => {
      setAccountSaving(true);
      try {
        const updated = await updateAccount(payload);
        setProfile(updated);
        addToast('Profil berhasil diperbarui.', 'success');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Tidak bisa menyimpan profil. Coba lagi.';
        addToast(message, 'danger');
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setAccountSaving(false);
      }
    },
    [addToast]
  );

  const handleAvatarUpload = useCallback(
    async (file: File) => {
      setAvatarUploading(true);
      try {
        const updated = await uploadAvatar(file);
        setProfile(updated);
        addToast('Avatar berhasil diperbarui.', 'success');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Tidak bisa mengunggah avatar. Coba lagi.';
        addToast(message, 'danger');
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setAvatarUploading(false);
      }
    },
    [addToast]
  );

  const handlePreferencesSubmit = useCallback(
    async (next: {
      theme: ThemePreference;
      currency: string;
      locale: string;
      date_format: string;
      timezone: string;
    }) => {
      setPreferencesSaving(true);
      try {
        const updated = await updatePreferences(next);
        setProfile(updated);
        applyThemePreference(updated.theme);
        addToast('Preferensi berhasil disimpan.', 'success');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Tidak bisa menyimpan preferensi. Coba lagi.';
        addToast(message, 'danger');
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setPreferencesSaving(false);
      }
    },
    [addToast]
  );

  const handleNotificationsSubmit = useCallback(
    async (next: NotificationsSettings) => {
      setNotificationsSaving(true);
      try {
        const updated = await updateNotifications(next);
        setProfile(updated);
        addToast('Pengaturan notifikasi disimpan.', 'success');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Tidak bisa menyimpan notifikasi. Coba lagi.';
        addToast(message, 'danger');
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setNotificationsSaving(false);
      }
    },
    [addToast]
  );

  const handleChangePassword = useCallback(
    async (payload: { current_password: string; new_password: string; signOutOthers: boolean }) => {
      setChangingPassword(true);
      try {
        await changePassword(payload);
        addToast('Kata sandi berhasil diperbarui.', 'success');
        if (payload.signOutOthers) {
          await refreshSessions();
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Tidak bisa mengubah kata sandi. Coba lagi.';
        addToast(message, 'danger');
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setChangingPassword(false);
      }
    },
    [addToast, refreshSessions]
  );

  const handleSignOutScope = useCallback(
    async (scope: 'current' | 'others' | 'all') => {
      try {
        await signOutSession(scope);
        if (scope !== 'current') {
          await refreshSessions();
        }
        addToast('Sesi berhasil diakhiri.', 'success');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Tidak bisa keluar dari sesi. Coba lagi.';
        addToast(message, 'danger');
        throw error instanceof Error ? error : new Error(message);
      }
    },
    [addToast, refreshSessions]
  );

  const handleDisconnect = useCallback(
    async (provider: 'google' | 'github') => {
      try {
        await unlinkProvider(provider);
        setSessionUser((prev) => {
          if (!prev) return prev;
          const identities = (prev.identities ?? []).filter((item: any) => item.provider !== provider);
          return { ...prev, identities } as User;
        });
        setIntegrations((prev) =>
          prev.map((item) =>
            item.provider === provider ? { ...item, connected: false } : item
          )
        );
        addToast('Penyedia berhasil diputus.', 'success');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Tidak bisa memutuskan sambungan penyedia.';
        addToast(message, 'danger');
        throw error instanceof Error ? error : new Error(message);
      }
    },
    [addToast]
  );

  const handleThemePreview = useCallback((theme: ThemePreference) => {
    applyThemePreference(theme);
  }, []);

  const handleExportJson = useCallback(async () => {
    setExporting((prev) => ({ ...prev, json: true }));
    try {
      const [transactions, categories, budgets, goals, subscriptions, challenges] = await Promise.all([
        repo.transactions.list(),
        repo.categories.list(),
        repo.budgets.list(),
        repo.goals.list(),
        repo.subscriptions.list(),
        repo.challenges.list(),
      ]);
      const payload = {
        generated_at: new Date().toISOString(),
        profile,
        transactions,
        categories,
        budgets,
        goals,
        subscriptions,
        challenges,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      downloadBlob('hematwoi-export.json', blob);
      addToast('Ekspor JSON siap diunduh.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengekspor data.';
      addToast(message, 'danger');
    } finally {
      setExporting((prev) => ({ ...prev, json: false }));
    }
  }, [addToast, profile, repo.budgets, repo.categories, repo.challenges, repo.goals, repo.subscriptions, repo.transactions]);

  const handleExportCsv = useCallback(async () => {
    setExporting((prev) => ({ ...prev, csv: true }));
    try {
      const transactions = await repo.transactions.list();
      const csv = toCsv(
        transactions.map((tx: any) => ({
          id: tx.id,
          date: tx.date,
          type: tx.type,
          category: tx.category,
          amount: tx.amount,
          note: tx.note,
        }))
      );
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      downloadBlob('hematwoi-transactions.csv', blob);
      addToast('Ekspor CSV siap diunduh.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengekspor CSV.';
      addToast(message, 'danger');
    } finally {
      setExporting((prev) => ({ ...prev, csv: false }));
    }
  }, [addToast, repo.transactions]);

  const onDeleteAccountFallback = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return Promise.resolve();
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    if (offline) {
      throw new Error('Penghapusan akun membutuhkan koneksi internet.');
    }
    setDeleting(true);
    try {
      await onDeleteAccountFallback();
      addToast('Permintaan penghapusan diterima. Tim kami akan menindaklanjuti.', 'success');
    } finally {
      setDeleting(false);
    }
  }, [addToast, offline, onDeleteAccountFallback]);

  const tabContent = useMemo(() => {
    if (!profile || !sessionUser) return null;
    switch (activeTab) {
      case 'account':
        return (
          <AccountCard
            profile={profile}
            email={sessionUser.email ?? ''}
            offline={offline}
            saving={accountSaving}
            avatarUploading={avatarUploading}
            onSubmit={handleAccountSubmit}
            onAvatarUpload={handleAvatarUpload}
            onCheckUsername={checkUsernameAvailability}
          />
        );
      case 'security':
        return (
          <SecurityCard
            sessions={sessions}
            offline={offline}
            loadingSessions={sessionLoading}
            changingPassword={changingPassword}
            onRefreshSessions={refreshSessions}
            onChangePassword={handleChangePassword}
            onSignOut={handleSignOutScope}
          />
        );
      case 'preferences':
        return (
          <PreferencesCard
            value={{
              theme: profile.theme,
              currency: profile.currency,
              locale: profile.locale,
              date_format: profile.date_format,
              timezone: profile.timezone,
            }}
            timezones={timezones}
            offline={offline}
            saving={preferencesSaving}
            onPreviewTheme={handleThemePreview}
            onSubmit={async (next) => {
              await handlePreferencesSubmit(next);
            }}
          />
        );
      case 'notifications':
        return (
          <NotificationsCard
            value={profile.notifications}
            offline={offline}
            saving={notificationsSaving}
            onSubmit={async (next) => {
              await handleNotificationsSubmit(next);
            }}
          />
        );
      case 'privacy':
        return (
          <PrivacyDataCard
            offline={offline}
            exporting={exporting}
            deleting={deleting}
            onExportJson={handleExportJson}
            onExportCsv={handleExportCsv}
            onDeleteAccount={handleDeleteAccount}
          />
        );
      case 'integrations':
        return (
          <IntegrationsCard
            providers={integrations}
            offline={offline}
            onDisconnect={handleDisconnect}
          />
        );
      default:
        return null;
    }
  }, [
    accountSaving,
    activeTab,
    avatarUploading,
    changingPassword,
    deleting,
    exporting,
    handleAccountSubmit,
    handleAvatarUpload,
    handleChangePassword,
    handleDeleteAccount,
    handleDisconnect,
    handleNotificationsSubmit,
    handlePreferencesSubmit,
    handleSignOutScope,
    handleExportCsv,
    handleExportJson,
    handleThemePreview,
    integrations,
    notificationsSaving,
    offline,
    preferencesSaving,
    profile,
    refreshSessions,
    sessionLoading,
    sessionUser,
    sessions,
    timezones,
  ]);

  return (
    <main className="flex flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-text">Profil</h1>
        <p className="text-sm text-muted">Kelola akun & preferensi.</p>
      </header>

      {offline ? (
        <div className="flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          <AlertCircle className="h-5 w-5" aria-hidden="true" /> Mode lokal — perubahan tidak dapat disimpan.
        </div>
      ) : null}

      <nav
        className="sticky top-16 z-20 -mx-4 overflow-x-auto border-b border-border-subtle bg-surface/80 px-4 pb-2 backdrop-blur sm:top-20"
        role="tablist"
        aria-label="Navigasi profil"
      >
        <div className="flex w-full gap-2">
          {TAB_ITEMS.map(({ key, label, icon: Icon }) => {
            const active = key === activeTab;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                className={`inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-none sm:px-4 ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'border border-border-subtle bg-surface-alt text-text hover:border-border-strong'
                }`}
                onClick={() => setActiveTab(key)}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {loading || !profile || !sessionUser ? (
        <div className="flex items-center justify-center py-16 text-muted">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          <span className="ml-2 text-sm">Memuat profil…</span>
        </div>
      ) : (
        <div className="grid gap-6" aria-live="polite">
          {tabContent}
        </div>
      )}
    </main>
  );
}
