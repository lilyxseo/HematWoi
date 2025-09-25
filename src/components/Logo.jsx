import clsx from "clsx";

export default function Logo({ className, ...props }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="HematWoi"
      xmlns="http://www.w3.org/2000/svg"
      className={clsx("h-10 w-10", className)}
      focusable="false"
      {...props}
    >
      <defs>
        <linearGradient
          id="hematwoi-logo-soft"
          x1="16"
          y1="20"
          x2="48"
          y2="52"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="hsl(var(--color-primary-soft))" />
          <stop offset="1" stopColor="hsl(var(--color-primary))" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="hsl(var(--color-primary))" />
      <path
        d="M16.5 38.5c4.2-8.4 10.2-14.7 16.2-18.9 6 4.2 10.8 10.1 13.8 18.9"
        fill="none"
        stroke="url(#hematwoi-logo-soft)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <path
        d="M20 38.5 27.5 31 33 39l8-14 7 10"
        fill="none"
        stroke="hsl(var(--color-primary-foreground))"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="20"
        cy="38.5"
        r="3"
        fill="hsl(var(--color-primary-foreground))"
        opacity="0.9"
      />
    </svg>
  );
}
