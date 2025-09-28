import clsx from "clsx";
import { useId } from "react";

const DEFAULT_TITLE = "HematWoi";

export default function Logo({ className, title = DEFAULT_TITLE, ...props }) {
  const rawId = useId().replace(/:/g, "");
  const titleId = `${rawId}-title`;
  const labelled = typeof title === "string" && title.length > 0;

  return (
    <svg
      viewBox="0 0 512 512"
      role="img"
      className={clsx("h-9 w-9", className)}
      aria-labelledby={labelled ? titleId : undefined}
      aria-hidden={labelled ? undefined : true}
      {...props}
    >
      {labelled ? <title id={titleId}>{title}</title> : null}
      <rect
        width="512"
        height="512"
        rx="104"
        fill="var(--brand-soft, #e0e7ff)"
      />
      <g transform="translate(256 256) scale(0.82) translate(-256 -256)">
        <g transform="translate(6.409 -19.23)">
          <polygon
            points="413.394,192.157 430.091,208.854 227.066,411.878 174.789,349.931 162.434,335.287 148.813,348.821 14.858,481.853 160.125,387.43 212.478,449.47 224.905,464.197 238.526,450.58 455.171,233.934 471.868,250.631 484.324,179.701"
            fill="var(--brand-ring, #4f46e5)"
          />
          <polygon
            points="342.179,68.606 342.179,264.18 382.825,223.534 382.825,68.606 342.179,68.606"
            fill="var(--brand, #6366f1)"
          />
          <polygon
            points="109.36,355.494 109.36,317.111 68.715,317.111 68.715,395.863 109.36,355.494"
            fill="var(--brand, #6366f1)"
          />
          <polygon
            points="177.727,318.879 177.727,197.017 137.081,197.017 137.081,327.963 163.364,301.859 177.727,318.879"
            fill="var(--brand, #6366f1)"
          />
          <polygon
            points="246.092,360.262 246.092,236.741 205.447,236.741 205.447,351.728 227.955,378.4 246.092,360.262"
            fill="var(--brand, #6366f1)"
          />
          <polygon
            points="314.459,291.896 314.459,124.033 273.813,124.033 273.813,332.542 314.459,291.896"
            fill="var(--brand, #6366f1)"
          />
        </g>
      </g>
    </svg>
  );
}
