import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useMode } from '../hooks/useMode';
import { supabase } from '../lib/supabase';
import { isBlacklisted, isPrivateRoute, readLastRoute } from '../lib/lastRoute';

interface BootGateProps {
  ready: boolean;
  children: ReactNode;
}

function getBasePath(path: string): string {
  if (!path) return '/';
  const hashIndex = path.indexOf('#');
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const queryIndex = withoutHash.indexOf('?');
  const base = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  return base || '/';
}

export default function BootGate({ ready, children }: BootGateProps) {
  const { mode } = useMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [sessionReady, setSessionReady] = useState(false);
  const initialPathRef = useRef('');

  if (!initialPathRef.current) {
    initialPathRef.current = `${location.pathname}${location.search}${location.hash}`;
  }

  const initialPath = initialPathRef.current || '/';
  const initialBasePath = getBasePath(initialPath);

  useEffect(() => {
    let cancelled = false;

    async function restoreLastRoute() {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        const uid = data.session?.user?.id ?? null;

        if (uid) {
          const target = readLastRoute(uid);
          if (target && initialPath !== target) {
            if (initialBasePath === '/' || initialBasePath === '/auth') {
              navigate(target, { replace: true });
            }
          } else if (!target && initialBasePath === '/auth') {
            navigate('/', { replace: true });
          }
        } else {
          const globalTarget = readLastRoute(null);
          if (
            globalTarget &&
            !isPrivateRoute(globalTarget) &&
            initialPath !== globalTarget &&
            !isBlacklisted(globalTarget)
          ) {
            navigate(globalTarget, { replace: true });
          }
        }
      } catch {
        // keep console clean
      } finally {
        if (!cancelled) {
          setSessionReady(true);
        }
      }
    }

    restoreLastRoute();

    return () => {
      cancelled = true;
    };
  }, [initialBasePath, initialPath, navigate]);

  if (!ready || !sessionReady || !mode) {
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
