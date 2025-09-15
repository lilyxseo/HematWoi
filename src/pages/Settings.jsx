import { useDataMode, useRepo } from '../context/DataContext';

export default function SettingsPage() {
  const { mode, setMode } = useDataMode();
  const repo = useRepo();
  const seed = () => repo.seedDummy && repo.seedDummy();
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <label className="block">
        <span className="mr-2">Data Mode</span>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="border rounded p-1"
        >
          <option value="cloud">Cloud</option>
          <option value="local">Local</option>
        </select>
      </label>
      {mode === 'local' && (
        <button className="btn" onClick={seed}>
          Seed dummy data
        </button>
      )}
    </div>
  );
}
