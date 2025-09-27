/**
 * Inline SVG icon set used across the wishlist experience. Each component renders
 * a 24x24 outline icon that inherits the current text color, enabling consistent
 * styling with Tailwind utility classes.
 */
export function IconPlus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconEdit({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487a2.226 2.226 0 1 1 3.148 3.148L8.91 18.734 5 19.5l.766-3.91 11.096-11.103Z"
      />
    </svg>
  );
}

export function IconTrash({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path strokeLinecap="round" d="M5 7h14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6M9 7V5h6v2M6 7l1 12h10l1-12" />
    </svg>
  );
}

export function IconCheckCircle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-10 0 2.2 2.2L16 10"
      />
    </svg>
  );
}

export function IconGoalFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 20V4.5a1.5 1.5 0 0 1 2.3-1.25l1.4.93a2 2 0 0 0 2.18.02l1.64-1.06A1.5 1.5 0 0 1 16.8 4.5V14" />
      <path strokeLinecap="round" d="M6 20h3" />
    </svg>
  );
}

export function IconCopy({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V5.6A1.6 1.6 0 0 1 10.6 4h8.8A1.6 1.6 0 0 1 21 5.6v8.8A1.6 1.6 0 0 1 19.4 16H16" />
      <rect x="3" y="8" width="13" height="13" rx="1.6" ry="1.6" />
    </svg>
  );
}

export function IconFunnel({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16l-6.5 8v6l-3 2v-8L4 5Z" />
    </svg>
  );
}

export function IconSort({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m8 5 4-4 4 4M12 1v18M16 19l-4 4-4-4" />
    </svg>
  );
}

export function IconX({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function IconSearch({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <circle cx="11" cy="11" r="6" />
      <path strokeLinecap="round" d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function IconDownload({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" />
    </svg>
  );
}

export function IconUpload({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21V9m0 0 4 4m-4-4-4 4M5 5h14" />
    </svg>
  );
}
