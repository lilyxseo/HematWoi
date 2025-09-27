/**
 * WishlistIcons menyediakan ikon SVG inline untuk aksi utama wishlist agar konsisten dan tanpa ketergantungan eksternal.
 */
import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  className?: string;
}

export function IconPlus(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconEdit(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 20h4.586a1 1 0 0 0 .707-.293l9.707-9.707a1 1 0 0 0 0-1.414L15.414 5.293a1 1 0 0 0-1.414 0L4.293 15a1 1 0 0 0-.293.707V20Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m13.5 6.5 4 4" />
    </svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" d="M5 7h14" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7h10Z"
      />
      <path strokeLinecap="round" d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function IconCheckCircle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 12a8 8 0 1 1-8-8 8 8 0 0 1 8 8Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9.5 12.5 2 2 4-4" />
    </svg>
  );
}

export function IconGoalFlag(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 20V4h8l-1 2 5 1v9l-5-1-1 2H6Z" />
      <path strokeLinecap="round" d="M6 20h3" />
    </svg>
  );
}

export function IconCopy(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 9V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4"
      />
      <rect x="3" y="7" width="12" height="14" rx="2" ry="2" />
    </svg>
  );
}

export function IconFunnel(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16l-6 7v5l-4 2v-7L4 5Z" />
    </svg>
  );
}

export function IconSort(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m7 17 3 3 3-3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20V4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m17 7-3-3-3 3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 4v16" />
    </svg>
  );
}

export function IconX(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function IconImage(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 11 3 3 2-2 4 4" />
      <circle cx="9" cy="9" r="1.5" />
    </svg>
  );
}
