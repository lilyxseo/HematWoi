import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { Loader2, LogIn, WifiOff } from 'lucide-react';
import AccountCard from '../components/profile/AccountCard';
import SecurityCard from '../components/profile/SecurityCard';
import PreferencesCard from '../components/profile/PreferencesCard';
import NotificationsCard from '../components/profile/NotificationsCard';
import PrivacyDataCard from '../components/profile/PrivacyDataCard';
import IntegrationsCard from '../components/profile/IntegrationsCard';
import useNetworkStatus from '../hooks/useNetworkStatus';
import { useToast } from '../context/ToastContext';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import {
  changePassword,
  checkUsernameAvailability,
  exportUserData,
  getProfile,
  getSession,
  listSessions,
  requestAccountDeletion,
  signOutSession,
  unlinkProvider,
  updateAccount,
  updateNotifications,
  updatePreferences,
  uploadAvatar,
  type PasswordChangePayload,
  type ProfileNotifications,
  type SessionInfo,
  type ThemeMode,
  type UserProfile,
} from '../lib/api-profile';

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function toCsvValue(value: unknown): string {
  if (value == null) return '""';
  const raw =
    typeof value === 'string'
      ? value
      : typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : JSON.stringify(value);
  const sanitized = raw.replace(/"/g, '""');
  return `"${sanitized}"`;
}

function recordsToCsv(records: Record<string, unknown[]>): string {
  const lines: string[] = [];
  const entries = Object.entries(records);
  if (entries.length === 0) return '';
  for (const [table, rows] of entries) {
    const list = Array.isArray(rows) ? rows : [];
    const headersSet = new Set<string>();
    list.forEach((row) => {
      if (row && typeof row === 'object') {
        Object.keys(row as Record<string, unknown>).forEach((key) => headersSet.add(key));
      }
    });
    const headers = Array.from(headersSet);
    lines.push(['table', ...headers].join(','));
    if (list.length === 0) {
      const emptyRow = [toCsvValue(table), ...headers.map(() => '""')].join(',');
      lines.push(emptyRow);
      lines.push('');
      continue;
    }
    list.forEach((row) => {
      const record = row as Record<string, unknown>;
      const values = headers.map((key) => toCsvValue(record?.[key]));
      lines.push([toCsvValue(table), ...values].join(','));
    });
    lines.push('');
  }
  return lines.join('\n');
}

function applyThemeInstant(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const systemDark =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const resolved = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
  root.setAttribute('data-theme', resolved);
  try {
    const stored = JSON.parse(localStorage.getItem('hwTheme') || '{}');
    localStorage.setItem('hwTheme', JSON.stringify({ ...stored, mode }));
  } catch {
    // ignore storage error
  }
  try {
    window.dispatchEvent(new CustomEvent('hematwoi:theme-mode-updated', { detail: mode }));
  } catch {
    // ignore event error
  }
}

type TabKey =
  | 'account'
  | 'security'
  | 'preferences'
  | 'notifications'
  | 'privacy'
  | 'integrations';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'account', label: 'Akun' },
  { key: 'security', label: 'Keamanan' },
  { key: 'preferences', label: 'Preferensi' },
  { key: 'notifications', label: 'Notifikasi' },
  { key: 'privacy', label: 'Privasi & Data' },
  { key: 'integrations', label: 'Integrasi' },
];

interface ProviderShape {
  id: string | null;
  provider: 'google' | 'github';
  email?: string | null;
  last_sign_in_at?: string | null;
}

export default function ProfilePage() {
  const online = useNetworkStatus();
  const offline = !online;
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('account');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [notificationSaving, setNotificationSaving] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const data = await listSessions();
      setSessions(data);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setPageError('');
    (async () => {
      try {
        const session = await getSession();
        if (!mounted) return;
        const user = (session.user as User | null) ?? null;
        setSessionUser(user);
        if (!user) {
          setProfile(null);
          setSessions([]);
          return;
        }
        const profileData = await getProfile();
        if (!mounted) return;
        setProfile(profileData);
        applyThemeInstant(profileData.theme);
        try {
          await loadSessions();
        } catch {
          // ignore session load error on init
        }
      } catch (error) {
        if (!mounted) return;
        setPageError(
          error instanceof Error ? error.message : 'Tidak bisa memuat profil saat ini.',
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loadSessions]);

  useEffect(() => {
    if (!profile) return;
    try {
      const current = typeof window !== 'undefined' ? (window as any).__hw_prefs || {} : {};
      const next = {
        ...current,
        currency: profile.currency,
        locale: profile.locale,
        date_format: profile.date_format,
        timezone: profile.timezone,
        theme: profile.theme,
      };
      if (typeof window !== 'undefined') {
        (window as any).__hw_prefs = next;
      }
    } catch {
      // ignore
    }
  }, [profile]);

  const providerInfos = useMemo<ProviderShape[]>(() => {
    const base: ProviderShape[] = [
      { provider: 'google', id: null, email: null, last_sign_in_at: null },
      { provider: 'github', id: null, email: null, last_sign_in_at: null },
    ];
    if (!sessionUser) return base;
    return base.map((item) => {
      const identity = sessionUser.identities?.find((entry) => entry.provider === item.provider);
      if (!identity) return item;
      return {
        provider: item.provider,
        id: identity.identity_id ?? null,
        email:
          (identity.identity_data as Record<string, unknown> | undefined)?.email?.toString?.() ??
          sessionUser.email ??
          null,
        last_sign_in_at: identity.last_sign_in_at ?? sessionUser.last_sign_in_at ?? null,
      };
    });
  }, [sessionUser]);

  const handleAccountSave = useCallback(
    async (payload: { full_name?: string; username?: string | null }) => {
      const next = await updateAccount(payload);
      setProfile(next);
      addToast('Profil berhasil diperbarui.', 'success');
    },
    [addToast],
  );

  const handleAvatarUpload = useCallback(
    async (file: File) => {
      const next = await uploadAvatar(file);
      setProfile(next);
      addToast('Avatar berhasil diperbarui.', 'success');
    },
    [addToast],
  );

  const handlePreferencesSave = useCallback(
    async (payload: {
      theme?: ThemeMode;
      currency?: string;
      locale?: string;
      date_format?: string;
      timezone?: string;
    }) => {
      setPreferencesSaving(true);
      try {
        const next = await updatePreferences(payload);
        setProfile(next);
        if (payload.theme) {
          applyThemeInstant(payload.theme);
        }
        try {
          const current = typeof window !== 'undefined' ? (window as any).__hw_prefs || {} : {};
          const update = {
            ...current,
            currency: next.currency,
            locale: next.locale,
            date_format: next.date_format,
            timezone: next.timezone,
            theme: next.theme,
          };
          if (typeof window !== 'undefined') {
            (window as any).__hw_prefs = update;
          }
        } catch {
          // ignore storage sync
        }
        addToast('Preferensi berhasil disimpan.', 'success');
      } finally {
        setPreferencesSaving(false);
      }
    },
    [addToast],
  );

  const handleNotificationsSave = useCallback(
    async (payload: Partial<ProfileNotifications>) => {
      setNotificationSaving(true);
      try {
        const next = await updateNotifications(payload);
        setProfile(next);
        addToast('Pengaturan notifikasi diperbarui.', 'success');
      } finally {
        setNotificationSaving(false);
      }
    },
    [addToast],
  );

  const handleChangePassword = useCallback(
    async (payload: PasswordChangePayload) => {
      const result = await changePassword(payload);
      addToast('Password berhasil diperbarui.', 'success');
      if (payload.sign_out_other && result.signed_out_other) {
        addToast('Sesi lain telah keluar.', 'info');
      }
    },
    [addToast],
  );

  const handleSignOutTarget = useCallback(
    async (sessionId?: string) => {
      await signOutSession(sessionId);
      try {
        await loadSessions();
      } catch {
        // ignore refresh error
      }
      addToast('Sesi berhasil ditutup.', 'success');
    },
    [addToast, loadSessions],
  );

  const handleDisconnectProvider = useCallback(
    async (provider: 'google' | 'github') => {
      await unlinkProvider(provider);
      setSessionUser((prev) => {
        if (!prev) return prev;
        const identities = prev.identities?.filter((item) => item.provider !== provider) ?? [];
        return { ...prev, identities };
      });
      addToast(`Sambungan ${provider === 'google' ? 'Google' : 'GitHub'} diputus.`, 'success');
    },
    [addToast],
  );

  const handleExport = useCallback(
    async (format: 'json' | 'csv') => {
      setExporting(true);
      try {
        const data = await exportUserData();
        if (format === 'json') {
          const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json;charset=utf-8;',
          });
          downloadBlob('hematwoi-export.json', blob);
        } else {
          const csv = recordsToCsv(data);
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          downloadBlob('hematwoi-export.csv', blob);
        }
        addToast('Ekspor data siap diunduh.', 'success');
      } finally {
        setExporting(false);
      }
    },
    [addToast],
  );

  const handleDeleteAccount = useCallback(async () => {
    const result = await requestAccountDeletion();
    addToast(result.message, result.status === 'success' ? 'success' : 'info');
    return result;
  }, [addToast]);

  const onCheckUsername = useCallback(async (username: string) => {
    const available = await checkUsernameAvailability(username);
    return available;
  }, []);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted" aria-label="Memuat profil" />
        </div>
      );
    }
    if (pageError) {
      return (
        <div className="rounded-3xl border border-danger/40 bg-danger/10 p-6 text-center text-sm text-danger">
          {pageError}
        </div>
      );
    }
    if (!sessionUser) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-border bg-surface-1 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted/40 text-muted">
            <LogIn className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <p className="text-base font-semibold text-foreground">Profil tamu aktif</p>
            <p className="max-w-md text-sm text-muted">
              Kamu bisa menjelajahi seluruh fitur HematWoi sebagai tamu. Masuk untuk menyinkronkan data
              ke cloud dan mengatur preferensi akun pribadi kamu.
            </p>
          </div>
          <Link
            to="/auth"
            className="inline-flex items-center justify-center rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand/90"
          >
            Masuk ke akun
          </Link>
        </div>
      );
    }
    if (!profile) return null;
    return (
      <>
        <div className="sticky top-0 z-[5] -mx-4 mb-6 bg-surface/80 px-4 py-2 backdrop-blur md:-mx-6 md:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`profile-tab-${tab.key}`}
                aria-selected={activeTab === tab.key}
                aria-controls={`profile-panel-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setActiveTab(tab.key);
                  }
                }}
                className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary ${
                  activeTab === tab.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-surface-alt/70 text-muted hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {offline ? (
          <div className="mb-6 flex items-center gap-2 rounded-3xl border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-warning">
            <WifiOff className="h-4 w-4" aria-hidden="true" /> Mode lokal — perubahan tidak dapat disimpan.
          </div>
        ) : null}
        <div className="space-y-8">
          <div
            role="tabpanel"
            id="profile-panel-account"
            aria-labelledby="profile-tab-account"
            hidden={activeTab !== 'account'}
          >
            <AccountCard
              profile={profile}
              email={sessionUser?.email ?? null}
              offline={offline}
              onSave={handleAccountSave}
              onUploadAvatar={handleAvatarUpload}
              onCheckUsername={onCheckUsername}
            />
          </div>
          <div
            role="tabpanel"
            id="profile-panel-security"
            aria-labelledby="profile-tab-security"
            hidden={activeTab !== 'security'}
          >
            <SecurityCard
              offline={offline}
              sessions={sessions}
              loadingSessions={loadingSessions}
              onRefreshSessions={loadSessions}
              onSignOutSession={handleSignOutTarget}
              onChangePassword={handleChangePassword}
            />
          </div>
          <div
            role="tabpanel"
            id="profile-panel-preferences"
            aria-labelledby="profile-tab-preferences"
            hidden={activeTab !== 'preferences'}
          >
            <PreferencesCard
              profile={profile}
              offline={offline}
              saving={preferencesSaving}
              onSave={handlePreferencesSave}
              onPreviewTheme={applyThemeInstant}
            />
          </div>
          <div
            role="tabpanel"
            id="profile-panel-notifications"
            aria-labelledby="profile-tab-notifications"
            hidden={activeTab !== 'notifications'}
          >
            <NotificationsCard
              notifications={profile.notifications}
              offline={offline}
              saving={notificationSaving}
              onSave={handleNotificationsSave}
            />
          </div>
          <div
            role="tabpanel"
            id="profile-panel-privacy"
            aria-labelledby="profile-tab-privacy"
            hidden={activeTab !== 'privacy'}
          >
            <PrivacyDataCard
              offline={offline}
              exporting={exporting}
              onExport={handleExport}
              onDeleteAccount={handleDeleteAccount}
            />
          </div>
          <div
            role="tabpanel"
            id="profile-panel-integrations"
            aria-labelledby="profile-tab-integrations"
            hidden={activeTab !== 'integrations'}
          >
            <IntegrationsCard
              providers={providerInfos}
              offline={offline}
              onDisconnect={handleDisconnectProvider}
            />
          </div>
        </div>
      </>
    );
  };

  return (
    <Page>
      <div className="space-y-[var(--section-y)]">
        <PageHeader
          title="Profil"
          description="Kelola akun &amp; preferensi kamu dalam satu tempat."
        />
        {renderContent()}
      </div>
    </Page>
  );
}
