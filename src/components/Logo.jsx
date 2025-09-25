import clsx from "clsx";
import { useId } from "react";

const DEFAULT_TITLE = "HematWoi";

export default function Logo({ className, title = DEFAULT_TITLE, ...props }) {
  const rawId = useId().replace(/:/g, "");
  const gradientId = `${rawId}-gradient`;
  const titleId = `${rawId}-title`;
  const labelled = typeof title === "string" && title.length > 0;

  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      className={clsx("h-10 w-10", className)}
      aria-labelledby={labelled ? titleId : undefined}
      aria-hidden={labelled ? undefined : true}
      {...props}
    >
      {labelled ? <title id={titleId}>{title}</title> : null}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--brand, #3f63f3)" />
          <stop offset="100%" stopColor="var(--brand-ring, #1d3fc5)" />
        </linearGradient>
      </defs>

      <rect
        width="64"
        height="64"
        rx="18"
        fill="var(--brand-soft, #e6ecff)"
      />
      <rect
        x="6"
        y="6"
        width="52"
        height="52"
        rx="14"
        fill="none"
        stroke="var(--brand, #3f63f3)"
        strokeOpacity="0.35"
        strokeWidth="2.5"
      />

      <g fill={`url(#${gradientId})`}>
        <rect x="18" y="30" width="8" height="18" rx="4" />
        <rect x="28" y="24" width="8" height="24" rx="4" />
        <rect x="38" y="18" width="8" height="30" rx="4" />
      </g>

      <circle
        cx="46"
        cy="22"
        r="6"
        fill="var(--brand, #3f63f3)"
        fillOpacity="0.14"
      />
      <circle cx="46" cy="22" r="3.5" fill={`url(#${gradientId})`} />

      <path
        d="M16 42l6-8 7 5 8-14 11 9"
        fill="none"
        stroke="var(--brand-foreground, #ffffff)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}
