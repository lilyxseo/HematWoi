import { useEffect } from 'react';

import { scheduleSheetSync } from '@/lib/syncQueue';

let hasBootstrappedSheetSync = false;

export const useSheetSyncBootstrap = (): void => {
  useEffect(() => {
    if (hasBootstrappedSheetSync) return;

    hasBootstrappedSheetSync = true;
    scheduleSheetSync();
  }, []);
};
