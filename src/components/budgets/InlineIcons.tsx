import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  title?: string;
}

const baseProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function createIcon(paths: JSX.Element[]): (props: IconProps) => JSX.Element {
  return function Icon({ title, ...props }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" {...baseProps} {...props}>
        {title ? <title>{title}</title> : null}
        {paths}
      </svg>
    );
  };
}

export const CalendarIcon = createIcon([
  <rect key="frame" x={3} y={4} width={18} height={18} rx={2.5} />,
  <path key="header" d="M16 2v4M8 2v4M3 10h18" />,
]);

export const SearchIcon = createIcon([
  <circle key="circle" cx={11} cy={11} r={6} />,
  <line key="line" x1={21} y1={21} x2={16.65} y2={16.65} />,
]);

export const EyeIcon = createIcon([
  <path key="outer" d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />,
  <circle key="iris" cx={12} cy={12} r={2.5} />,
]);

export const PencilIcon = createIcon([
  <path key="tip" d="m4 20 1.76-5.29a2 2 0 0 1 .52-.82L16.5 3.67a2.4 2.4 0 0 1 3.38 0 2.4 2.4 0 0 1 0 3.38l-9.92 9.92a2 2 0 0 1-.82.52L4 20Z" />,
  <path key="line" d="M13.5 6.5 17.5 10.5" />,
]);

export const RefreshIcon = createIcon([
  <path key="arc" d="M20 12A8 8 0 1 1 7.05 4.46" />,
  <polyline key="arrow" points="8 2 8 8 14 8" />,
]);

export const SwitchIcon = createIcon([
  <rect key="track" x={3} y={8} width={18} height={8} rx={4} />,
  <circle key="knob" cx={9} cy={12} r={3} />,
]);

export const PlusIcon = createIcon([
  <path key="vert" d="M12 5v14" />,
  <path key="horiz" d="M5 12h14" />,
]);

export const FilterIcon = createIcon([
  <path key="body" d="M4 6h16M7 12h10M10 18h4" />,
]);
