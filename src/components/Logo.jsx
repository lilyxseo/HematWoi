import clsx from "clsx";

export default function Logo({ className, ...props }) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="HematWoi"
      focusable="false"
      className={clsx("h-10 w-10", className)}
      {...props}
    >
      <rect width="64" height="64" rx="18" fill="var(--brand-soft)" />
      <path
        d="M16 24c0-5.523 4.477-10 10-10h22c5.523 0 10 4.477 10 10v16c0 5.523-4.477 10-10 10H26c-5.523 0-10-4.477-10-10V24Z"
        fill="var(--brand)"
      />
      <path
        d="M20 28c0-2.761 2.239-5 5-5h23a5 5 0 0 1 5 5v3H20z"
        fill="var(--brand-foreground)"
        fillOpacity="0.1"
      />
      <path
        d="M20 36c0-3.314 2.686-6 6-6h12a6 6 0 0 1 6 6v4a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6z"
        fill="var(--brand-foreground)"
        fillOpacity="0.16"
      />
      <path
        d="M24 38a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v8h-8zM32 34a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v12h-8z"
        fill="var(--brand-foreground)"
      />
      <path
        d="M44 30a6 6 0 0 0 0 12h4a4 4 0 1 0 0-8h-4Z"
        fill="var(--brand-foreground)"
      />
      <path
        d="M18 46h28c0 5.523-4.477 10-10 10H28c-5.523 0-10-4.477-10-10Z"
        fill="var(--brand-foreground)"
        fillOpacity="0.08"
      />
    </svg>
  );
}
