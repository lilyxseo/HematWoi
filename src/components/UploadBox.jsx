import { useMemo, useRef, useState } from "react";

const formatSize = (size) => {
  if (!size && size !== 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let index = 0;
  let value = size;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[index]}`;
};

export default function UploadBox({
  onUpload,
  uploadState,
  expiresIn,
  onExpiresInChange,
  onReset,
}) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [copied, setCopied] = useState(false);

  const { file, status, progress, link, error } = uploadState;

  const fileSummary = useMemo(() => {
    if (!file) return null;
    return `${file.name} • ${formatSize(file.size)}`;
  }, [file]);

  const handleFiles = (selected) => {
    if (!selected || selected.length === 0) return;
    setCopied(false);
    onUpload(selected[0]);
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section id="upload" className="py-16">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-300">
              Anonymous upload
            </p>
            <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">
              Upload instantly, share in seconds.
            </h2>
            <p className="text-slate-600 dark:text-slate-300">
              Drag & drop any file below. We will keep it safe and ready to share
              before it auto-expires.
            </p>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 text-sm text-slate-600 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/80 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-white">
                Default limits
              </p>
              <ul className="mt-3 space-y-2">
                <li>• Max size 50MB (anonymous)</li>
                <li>• Auto-expire in 7 days</li>
                <li>• Instant share link</li>
              </ul>
            </div>
          </div>
          <div className="space-y-4">
            <div
              className={`rounded-3xl border-2 border-dashed p-6 transition ${
                dragActive
                  ? "border-blue-500 bg-blue-50/80 dark:bg-blue-500/10"
                  : "border-slate-200/70 bg-white/80 dark:border-slate-800/70 dark:bg-slate-900/80"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                handleFiles(event.dataTransfer.files);
              }}
              aria-label="Upload files by dragging and dropping"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-200">
                  ⬆️
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-900 dark:text-white">
                    Drag & drop your file here
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    or select a file from your device
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-500"
                >
                  Choose File
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  aria-label="Choose file"
                  onChange={(event) => handleFiles(event.target.files)}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/80">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  File details
                </p>
                <select
                  value={expiresIn}
                  onChange={(event) => onExpiresInChange(event.target.value)}
                  className="rounded-full border border-slate-200/70 bg-white px-3 py-1 text-xs text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  aria-label="Choose expiration time"
                >
                  <option value="1">Expire in 1 day</option>
                  <option value="3">Expire in 3 days</option>
                  <option value="7">Expire in 7 days</option>
                </select>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <p>{fileSummary || "No file selected"}</p>
                <p>
                  Status:{" "}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {status === "idle" && "Waiting"}
                    {status === "uploading" && "Uploading"}
                    {status === "success" && "Ready"}
                    {status === "error" && "Failed"}
                  </span>
                </p>
              </div>
              <div className="mt-4">
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-2 rounded-full bg-blue-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {progress}% uploaded
                </p>
              </div>
              {error ? (
                <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-200">
                  {error}
                </div>
              ) : null}
            </div>
            {status === "success" && link ? (
              <div className="rounded-2xl border border-blue-200/70 bg-blue-50/70 p-5 text-sm text-slate-700 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-slate-200">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-blue-600 dark:text-blue-200">
                      Share link ready
                    </p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                      {link}
                    </p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Expires in {expiresIn} days
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-blue-600 shadow-sm transition hover:bg-blue-100 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-slate-800"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={onReset}
                      className="rounded-full border border-blue-200 px-4 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/40 dark:text-blue-200 dark:hover:bg-blue-500/10"
                    >
                      Upload another file
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <div className="grid h-20 w-20 grid-cols-6 gap-1 rounded-xl bg-white p-2 dark:bg-slate-900">
                    {Array.from({ length: 36 }).map((_, index) => (
                      <span
                        key={index}
                        className={`block h-2 w-2 rounded-sm ${
                          index % 3 === 0
                            ? "bg-slate-900 dark:bg-white"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      QR code (optional)
                    </p>
                    <p>Scan to open the share link on mobile devices.</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
