import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useOnlineStatus } from '../app/providers';

const AppLayout = () => {
  const { online, queueSize } = useOnlineStatus();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 lg:grid lg:grid-cols-[18rem_1fr]">
      <Sidebar />
      <div className="flex min-h-screen flex-col">
        <Topbar />
        {!online && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 lg:px-8">
            Offline mode • {queueSize} movement(s) queued. Actions will sync once connected.
          </div>
        )}
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
