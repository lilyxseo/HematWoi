import { ReactNode, useEffect, useState } from "react";

import { useMode } from "../hooks/useMode";
import { supabase } from "../lib/supabase";

interface BootGateProps {
  children: ReactNode;
}

const LEGACY_GLOBAL_KEY = "hw:lastRoute:global";
const LEGACY_USER_PREFIX = "hw:lastRoute:uid:";

function clearLegacyRouteKeys(): void {
  if (typeof window === "undefined") return;

  const storage = window.localStorage;
  if (!storage) return;

  try {
    storage.removeItem(LEGACY_GLOBAL_KEY);

    const keysToRemove: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith(LEGACY_USER_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      storage.removeItem(key);
    }
  } catch {
    // ignore cleanup failures silently
  }
}

export default function BootGate({ children }: BootGateProps) {
  const { mode } = useMode();
  const [bootReady, setBootReady] = useState(false);

  useEffect(() => {
    clearLegacyRouteKeys();
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .catch(() => null)
      .finally(() => {
        if (active) {
          setBootReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

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
