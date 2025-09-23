import { ReactNode, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMode } from "../hooks/useMode";
import { supabase } from "../lib/supabase";
import { isPrivateRoute, normalizeRoute, readLastRoute } from "../lib/lastRoute";

interface BootGateProps {
  children: ReactNode;
}

export default function BootGate({ children }: BootGateProps) {
  const { mode } = useMode();
  const navigate = useNavigate();
  const location = useLocation();
  const initialLocationRef = useRef(location);
  const [bootReady, setBootReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function restoreLastRoute() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;

        const session = data.session ?? null;
        if (session?.user) {
          const stored = readLastRoute(session.user.id);
          if (stored) {
            const initialLocation = initialLocationRef.current;
            const initialFull = normalizeRoute(
              `${initialLocation.pathname}${initialLocation.search}${initialLocation.hash}`
            );
            const target = normalizeRoute(stored);
            const isDefaultDestination =
              !initialFull ||
              initialFull === normalizeRoute("/") ||
              initialFull === normalizeRoute("/auth");

            if (target && isDefaultDestination && target !== initialFull) {
              navigate(stored, { replace: true });
            }
          }
        } else {
          const globalLast = readLastRoute();
          if (globalLast && !isPrivateRoute(globalLast)) {
            const initialLocation = initialLocationRef.current;
            const initialFull = normalizeRoute(
              `${initialLocation.pathname}${initialLocation.search}${initialLocation.hash}`
            );
            const target = normalizeRoute(globalLast);
            const isDefaultDestination =
              !initialFull ||
              initialFull === normalizeRoute("/") ||
              initialFull === normalizeRoute("/auth");

            if (target && isDefaultDestination && target !== initialFull) {
              navigate(globalLast, { replace: true });
            }
          }
        }
      } catch {
        // keep splash without logging to console
      } finally {
        if (active) {
          setBootReady(true);
        }
      }
    }

    restoreLastRoute();

    return () => {
      active = false;
    };
  }, [navigate]);

  if (!bootReady || !mode) {
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
