import { useEffect, useState } from "react";
import { flushQueue, onStatusChange, pending, SyncStatus } from "../lib/sync/SyncEngine";

export default function SyncBanner() {
  const [status, setStatus] = useState(SyncStatus.IDLE);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const unsub = onStatusChange(async (s) => {
      setStatus(s);
      setCount(await pending());
    });
    (async () => setCount(await pending()))();
    return unsub;
  }, []);

  let text = "";
  if (status === SyncStatus.OFFLINE) text = "Offline";
  else if (status === SyncStatus.SYNCING) text = `Syncing ${count} ops`;
  else if (count > 0) text = `Pending ${count} ops`;
  else text = "All synced";

  return (
    <div className="bg-slate-100 dark:bg-slate-800 text-center text-sm py-1">
      <span>{text}</span>
      {count > 0 && (
        <button
          className="ml-2 underline"
          onClick={() => flushQueue()}
        >
          Sync Now
        </button>
      )}
    </div>
  );
}
