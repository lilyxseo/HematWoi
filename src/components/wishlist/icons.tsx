/**
 * Wishlist inline icon set used across wishlist UI controls and actions.
 * Each icon is an inline SVG matching the Tailwind text color.
 */
export function IconPlus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconEdit({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16.25V20h3.75L18.81 8.94a1.5 1.5 0 0 0 0-2.12L15.18 3.19a1.5 1.5 0 0 0-2.12 0L4 12.75"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m12.5 5.5 4 4" />
    </svg>
  );
}

export function IconTrash({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path strokeLinecap="round" d="M5 7h14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V4.75A1.75 1.75 0 0 1 10.75 3h2.5A1.75 1.75 0 0 1 15 4.75V7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 11v6M15 11v6" />
      <path strokeLinejoin="round" d="M6.5 7h11l-.73 11.03a2 2 0 0 1-2 1.84h-5.54a2 2 0 0 1-2-1.84L6.5 7Z" />
    </svg>
  );
}

export function IconCheckCircle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function IconGoalFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path strokeLinecap="round" d="M6 21V4.5a1.5 1.5 0 0 1 1.5-1.5H19l-2.5 3 2.5 3H7.5" />
      <path strokeLinecap="round" d="M6 21h3" />
    </svg>
  );
}

export function IconCopy({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path strokeLinejoin="round" d="M9 9.75A1.75 1.75 0 0 1 10.75 8h7.5A1.75 1.75 0 0 1 20 9.75v7.5A1.75 1.75 0 0 1 18.25 19h-7.5A1.75 1.75 0 0 1 9 17.25z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 15H5.75A1.75 1.75 0 0 1 4 13.25v-7.5A1.75 1.75 0 0 1 5.75 4h7.5A1.75 1.75 0 0 1 15 5.75V6" />
    </svg>
  );
}

export function IconFunnel({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16l-6 7v5l-4 2v-7z" />
    </svg>
  );
}

export function IconSort({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 4 3-3 3 3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1v14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m15 20-3 3-3-3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 23V9" />
    </svg>
  );
}

export function IconX({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}
