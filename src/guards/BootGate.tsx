import type { ReactNode } from 'react';
import { useMode } from '../hooks/useMode';

interface BootGateProps {
  ready: boolean;
  children: ReactNode;
}

export default function BootGate({ ready, children }: BootGateProps) {
  const { mode } = useMode();

  if (!ready || !mode) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg text-text">
        <div className="space-y-2 text-center">
          <div className="text-2xl font-semibold">HematWoi</div>
          <p className="text-sm text-muted">Menyiapkan dasbor…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
