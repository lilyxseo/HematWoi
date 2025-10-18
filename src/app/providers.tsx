import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ToastProvider, ToastViewport, useToast } from '../components/ui/Toast';
import { flushQueue, useOfflineQueueStore } from '../lib/offlineQueue';

type OnlineStatusContextValue = {
  online: boolean;
  queueSize: number;
};

const OnlineStatusContext = createContext<OnlineStatusContextValue>({
  online: true,
  queueSize: 0
});

export const useOnlineStatus = () => useContext(OnlineStatusContext);

const OnlineStatusProvider = ({ children }: { children: ReactNode }) => {
  const [online, setOnline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const queueSize = useOfflineQueueStore((state) => state.queue.length);
  const { pushToast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = async () => {
      setOnline(true);
      if (queueSize > 0) {
        const result = await flushQueue();
        if (result.total > 0) {
          pushToast({
            title: 'Offline queue synced',
            description: `${result.success} movements synced${
              result.failure ? `, ${result.failure} failed` : ''
            }`,
            variant: result.failure ? 'warning' : 'success'
          });
        }
      } else {
        pushToast({ title: 'Back online', description: 'Connections restored', variant: 'success' });
      }
    };

    const handleOffline = () => {
      setOnline(false);
      pushToast({ title: 'You are offline', description: 'Actions will be queued', variant: 'warning' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pushToast, queueSize]);

  const value = useMemo(
    () => ({
      online,
      queueSize
    }),
    [online, queueSize]
  );

  return (
    <OnlineStatusContext.Provider value={value}>
      {children}
      <ToastViewport />
    </OnlineStatusContext.Provider>
  );
};

export const AppProviders = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(() =>
    new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
          staleTime: 60_000
        }
      }
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <OnlineStatusProvider>{children}</OnlineStatusProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
};
