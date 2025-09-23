import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { isBlacklisted, writeLastRoute } from "../lib/lastRoute";

const DEBOUNCE_MS = 150;

export default function useLastRouteTracker(userId) {
  const location = useLocation();
  const timerRef = useRef();

  useEffect(() => {
    const fullPath = `${location.pathname}${location.search}${location.hash}`;

    if (isBlacklisted(fullPath)) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
      return () => {
        window.clearTimeout(timerRef.current);
      };
    }

    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      writeLastRoute(userId, fullPath);
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timerRef.current);
    };
  }, [location.pathname, location.search, location.hash, userId]);
}
