import { useState, useEffect } from 'react';
import PageHeader from '../layout/PageHeader';
import SettingsGroup from '../components/settings/SettingsGroup';
import Toggle from '../components/settings/Toggle';
import Select from '../components/settings/Select';
import NumberField from '../components/settings/NumberField';
import DangerZone from '../components/settings/DangerZone';
import { getPrefs, setPrefs, resetPrefs } from '../lib/preferences';
import { useDataMode, useRepo } from '../context/DataContext';
import { supabase } from '../lib/supabase';

export default function SettingsPage() {
  const { mode, setMode } = useDataMode();
  const repo = useRepo();
  const [prefs, setLocalPrefs] = useState(getPrefs());
  const [chatgptTesting, setChatgptTesting] = useState(false);
  const [chatgptResult, setChatgptResult] = useState<{ ok: boolean; message: string } | null>(null);

  const testChatgptConnection = async () => {
    setChatgptTesting(true);
    setChatgptResult(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        setChatgptResult({ ok: false, message: 'Sesi login tidak ditemukan. Silakan login ulang.' });
        return;
      }
      const { data, error } = await supabase.functions.invoke('chatgpt-read', {
        body: { action: 'accounts' },
      });
      if (error) {
        const response = 'context' in error ? (error as { context?: Response }).context : undefined;
        let detail = '';
        if (response && typeof response.json === 'function') {
          try {
            const payload = await response.json();
            if (typeof payload?.error === 'string') detail = payload.error;
          } catch { /* No readable response body */ }
        }
        const status = response?.status ? `HTTP ${response.status}: ` : '';
        throw new Error(`${status}${detail || error.message || 'Permintaan gagal'}`);
      }
      if (!data || !Array.isArray(data.accounts)) throw new Error('Format respons tidak sesuai');
      setChatgptResult({ ok: true, message: `Koneksi berhasil. ${data.accounts.length} akun terbaca.` });
    } catch (error) {
      setChatgptResult({ ok: false, message: error instanceof Error ? error.message : 'Koneksi gagal' });
    } finally {
      setChatgptTesting(false);
    }
  };

  useEffect(() => {
    setPrefs(prefs);
  }, [prefs]);

  const handleReset = () => {
    const p = resetPrefs();
    setLocalPrefs(p);
  };

  const seed = () => repo.seedDummy && repo.seedDummy();

  const handleExport = () => {
    const data = localStorage.getItem('hw:localRepo') || '{}';
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hematwoi-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        localStorage.setItem('hw:localRepo', text);
      } catch {
        // ignore
      }
    });
  };

  return (
    <div className="p-4 space-y-6">
      <PageHeader title="Settings" />
      <SettingsGroup title="General UI">
        <Toggle
          label="Dark mode"
          checked={prefs.darkMode}
          onChange={(v) => setLocalPrefs({ ...prefs, darkMode: v })}
        />
        <Select
          label="Density"
          value={prefs.density}
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'comfortable', label: 'Comfortable' },
          ]}
          onChange={(v) => setLocalPrefs({ ...prefs, density: v })}
        />
        <Select
          label="Language"
          value={prefs.language}
          options={[
            { value: 'id', label: 'Indonesia' },
            { value: 'en', label: 'English' },
          ]}
          onChange={(v) => setLocalPrefs({ ...prefs, language: v })}
        />
      </SettingsGroup>
      <SettingsGroup title="Gamification">
        <Toggle
          label="Avatar Leveling"
          checked={prefs.avatarLeveling}
          onChange={(v) => setLocalPrefs({ ...prefs, avatarLeveling: v })}
        />
        <Toggle
          label="Sound FX"
          checked={prefs.soundFx}
          onChange={(v) => setLocalPrefs({ ...prefs, soundFx: v })}
        />
      </SettingsGroup>
      <SettingsGroup title="Finance">
        <Select
          label="Currency"
          value={prefs.currency}
          options={[
            { value: 'IDR', label: 'IDR' },
            { value: 'USD', label: 'USD' },
          ]}
          onChange={(v) => setLocalPrefs({ ...prefs, currency: v })}
        />
        <Select
          label="Digit format"
          value={prefs.digitFormat}
          options={[
            { value: 'comma', label: '1,000' },
            { value: 'dot', label: '1.000' },
          ]}
          onChange={(v) => setLocalPrefs({ ...prefs, digitFormat: v })}
        />
        <NumberField
          label="First day of week"
          value={prefs.firstDay}
          min={0}
          max={6}
          onChange={(v) => setLocalPrefs({ ...prefs, firstDay: v })}
        />
      </SettingsGroup>
      <SettingsGroup title="Productivity">
        <div className="space-y-1">
          <Toggle
            label="Tetap di halaman tambah setelah simpan transaksi"
            checked={prefs.stayOnAddAfterSave}
            onChange={(v) => setLocalPrefs({ ...prefs, stayOnAddAfterSave: v })}
          />
          <p className="text-xs text-muted">Memudahkan input banyak transaksi sekaligus</p>
        </div>
      </SettingsGroup>
      <SettingsGroup title="Privacy">
        <Toggle
          label="PIN lock"
          checked={prefs.pinLock}
          onChange={(v) => setLocalPrefs({ ...prefs, pinLock: v })}
        />
        <Toggle
          label="Incognito (hide amounts)"
          checked={prefs.incognito}
          onChange={(v) => setLocalPrefs({ ...prefs, incognito: v })}
        />
      </SettingsGroup>
      <SettingsGroup title="Data Mode">
        <Select
          label="Mode"
          value={mode}
          options={[
            { value: 'online', label: 'Online' },
            { value: 'local', label: 'Local' },
          ]}
          onChange={(v) => setMode(v as 'online' | 'local')}
        />
        {mode === 'local' && (
          <DangerZone>
            <button className="btn" onClick={seed} aria-label="Seed Dummy Data">
              Seed Dummy Data
            </button>
          </DangerZone>
        )}
      </SettingsGroup>
      <SettingsGroup title="Integrasi ChatGPT">
        <div className="space-y-2">
          <p className="text-sm text-muted">Uji akses baca akun melalui Edge Function tanpa menyalin token login.</p>
          <button type="button" className="btn" onClick={testChatgptConnection} disabled={chatgptTesting}>
            {chatgptTesting ? "Menguji koneksi..." : "Test Koneksi ChatGPT"}
          </button>
          {chatgptResult && (
            <p role="status" className={`text-sm ${chatgptResult.ok ? "text-green-600" : "text-red-600"}`}>
              {chatgptResult.message}
            </p>
          )}
        </div>
      </SettingsGroup>
      <SettingsGroup title="Backup">
        <div className="flex flex-col sm:flex-row gap-2">
          <button className="btn" onClick={handleExport} aria-label="Export JSON">
            Export JSON
          </button>
          <label className="btn">
            <span>Import JSON</span>
            <input
              type="file"
              accept="application/json"
              onChange={handleImport}
              className="sr-only"
            />
          </label>
        </div>
      </SettingsGroup>
      <button className="btn" onClick={handleReset} aria-label="Reset preferences">
        Reset to default
      </button>
    </div>
  );
}
