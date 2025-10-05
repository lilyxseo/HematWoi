import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function findHashTarget(hash) {
  if (!hash) return null;

  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!fragment) return null;

  const direct = document.getElementById(fragment);
  if (direct) return direct;

  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return document.querySelector(`[name="${CSS.escape(fragment)}"]`);
  }

  return null;
}

export default function SmoothScrollRestoration() {
  const location = useLocation();

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = findHashTarget(location.hash);

      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    });

    return () => cancelAnimationFrame(frame);
  }, [location.hash, location.pathname, location.search]);

  return null;
}
