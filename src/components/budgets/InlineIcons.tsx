import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function createIcon(path: JSX.Element) {
  return function Icon(props: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {path}
      </svg>
    );
  };
}

export const CalendarIcon = createIcon(
  <>
    <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
    <path d="M8 2.5v4" />
    <path d="M16 2.5v4" />
    <path d="M3.5 9.5h17" />
  </>
);

export const SearchIcon = createIcon(
  <>
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-3.5-3.5" />
  </>
);

export const EyeIcon = createIcon(
  <>
    <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.5" />
  </>
);

export const PencilIcon = createIcon(
  <>
    <path d="m4 20 2.2-6.6 9.4-9.4a1.5 1.5 0 0 1 2.12 0l2.28 2.28a1.5 1.5 0 0 1 0 2.12l-9.4 9.4z" />
    <path d="M13 5.5 18.5 11" />
  </>
);

export const RefreshIcon = createIcon(
  <>
    <path d="M20 11a8 8 0 0 0-14.9-3" />
    <path d="M4 5v3.5h3.5" />
    <path d="M4 13a8 8 0 0 0 14.9 3" />
    <path d="M20 19v-3.5h-3.5" />
  </>
);

export const ToggleIcon = createIcon(
  <>
    <rect x="3" y="8" width="18" height="8" rx="4" />
    <circle cx="9" cy="12" r="2.5" />
  </>
);

export const PlusIcon = createIcon(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>
);

export const InfoIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8.5h.01" />
    <path d="M11 11.5h1v5" />
  </>
);

export const ArrowRightIcon = createIcon(
  <>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </>
);
