import { useLocation } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { useOnlineStatus } from '../app/providers';
import { roleLabels, useAuthStore, useUIStore } from '../lib/utils';
import { useOfflineQueueStore } from '../lib/offlineQueue';
import type { Role } from '../lib/types';

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/receive': 'Receive',
  '/putaway': 'Putaway',
  '/pick': 'Pick',
  '/cycle-count': 'Cycle Count',
  '/inventory': 'Inventory',
  '/masters/items': 'Items Master',
  '/masters/locations': 'Locations Master'
};

const resolveTitle = (pathname: string) => {
  if (titles[pathname]) return titles[pathname];
  const entry = Object.entries(titles).find(([key]) => pathname.startsWith(key));
  return entry ? entry[1] : 'Workspace';
};

const Topbar = () => {
  const location = useLocation();
  const { online, queueSize } = useOnlineStatus();
  const role = useAuthStore((state) => state.role);
  const loginAs = useAuthStore((state) => state.loginAs);
  const openSidebar = useUIStore((state) => state.openSidebar);
  const queue = useOfflineQueueStore((state) => state.queue);

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:px-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={openSidebar}>
          Menu
        </Button>
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">
            {resolveTitle(location.pathname)}
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{online ? 'Online' : 'Offline mode'}</span>
            {!online && <Badge variant="warning">Queue {queueSize}</Badge>}
            {queue.length > 0 && online && <Badge variant="success">Queued {queue.length}</Badge>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs text-slate-500">Role</p>
          <Select
            value={role}
            onChange={(event) => loginAs(event.target.value as Role)}
            className="h-9 w-40 border-slate-200 text-sm"
          >
            {(Object.keys(roleLabels) as Role[]).map((key) => (
              <option key={key} value={key}>
                {roleLabels[key]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)] text-white">
          {role.slice(0, 2).toUpperCase()}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
