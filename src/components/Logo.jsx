import clsx from "clsx";

import logoPlaceholder from "../assets/aAXTdp01.svg";

export default function Logo({ className, ...props }) {
  return (
    <img
      src={logoPlaceholder}
      alt="HematWoi"
      className={clsx("h-10 w-10", className)}
      {...props}
    />
  );
}
