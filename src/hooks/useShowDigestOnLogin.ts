import { useEffect } from "react";
import useDailyDigest, {
  type UseDailyDigestOptions,
} from "./useDailyDigest";

export const DIGEST_PENDING_KEY = "hw:digest:pending";

export default function useShowDigestOnLogin(options: UseDailyDigestOptions) {
  const digest = useDailyDigest(options);

  useEffect(() => {
    if (!digest.userId) return;
    if (typeof window === "undefined") return;
    try {
      const pending = window.sessionStorage.getItem(DIGEST_PENDING_KEY);
      if (pending === "1") {
        window.sessionStorage.removeItem(DIGEST_PENDING_KEY);
        digest.reopen();
      }
    } catch {
      /* ignore */
    }
  }, [digest.reopen, digest.userId]);

  return digest;
}
