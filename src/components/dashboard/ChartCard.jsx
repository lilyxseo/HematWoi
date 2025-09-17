import { useEffect, useRef, useState } from "react";
import { LineChart as LineChartIcon } from "lucide-react";
import clsx from "clsx";
import Card, { CardHeader } from "../Card";

function ChartSkeleton({ height }) {
  return (
    <div
      className="flex h-full flex-col justify-center gap-4 rounded-xl bg-white/5 p-6 dark:bg-white/5"
      style={{ minHeight: height }}
    >
      <div className="h-3 w-1/3 rounded-full bg-white/20" />
      <div className="space-y-2">
        <div className="h-32 rounded-xl bg-white/10" />
        <div className="h-4 w-3/4 rounded-full bg-white/10" />
      </div>
    </div>
  );
}

function EmptyChartState({ message }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted/90">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-brand">
        <LineChartIcon className="h-5 w-5" />
      </div>
      <p className="font-medium text-text/80 dark:text-slate-100/80">{message}</p>
    </div>
  );
}

export default function ChartCard({
  title,
  subtext,
  actions,
  children,
  footer,
  height = 320,
  isEmpty = false,
  emptyMessage = "Belum ada data bulan ini.",
  className = "",
}) {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    let debounceId;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        setReady(entry?.contentRect?.width > 0);
      }, 160);
    });

    observer.observe(node);
    setReady(node.getBoundingClientRect().width > 0);

    return () => {
      observer.disconnect();
      clearTimeout(debounceId);
    };
  }, []);

  return (
    <Card className={clsx("flex min-h-[360px] flex-col", className)}>
      {(title || subtext || actions) && (
        <CardHeader title={title} subtext={subtext} actions={actions} />
      )}
      <div
        ref={containerRef}
        className="relative mt-2 flex-1 rounded-2xl bg-gradient-to-br from-white/4 via-transparent to-white/0 p-2"
        style={{ minHeight: height }}
      >
        {isEmpty ? (
          <EmptyChartState message={emptyMessage} />
        ) : ready && typeof children === "function" ? (
          children({ height })
        ) : (
          <ChartSkeleton height={height} />
        )}
      </div>
      {footer && <div className="mt-6">{footer}</div>}
    </Card>
  );
}
