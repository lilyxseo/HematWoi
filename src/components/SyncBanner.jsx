import { useEffect, useState } from "react";
import useNetworkStatus from "../hooks/useNetworkStatus.js";
import syncEngine from "../lib/sync/SyncEngine.js";

export default function SyncBanner() {
  const online = useNetworkStatus();
  const [status, setStatus] = useState(syncEngine.syncing ? "syncing" : "idle");
  useEffect(() => syncEngine.onStatus(setStatus), []);
  const text = !online
    ? "Offline"
    : status === "syncing"
    ? "Syncing..."
    : "All synced";
  const bg = !online
    ? "bg-red-500"
    : status === "syncing"
    ? "bg-yellow-500"
    : "bg-green-600";
  return (
    <div className={`fixed top-0 inset-x-0 z-50 text-center text-white text-xs py-1 ${bg}`}>
      {text}
    </div>
  );
}
