import clsx from "clsx";

/**
 * Page container enforcing global vertical rhythm.
 * Applies top and bottom padding using --page-y.
 */
export default function Page({
  children,
  className,
  maxWidthClassName = "max-w-5xl",
  paddingClassName = "px-4",
}) {
  return (
    <main
      className={clsx(
        "mx-auto w-full min-w-0",
        maxWidthClassName,
        paddingClassName,
        className,
      )}
      style={{ paddingTop: "var(--page-y)", paddingBottom: "var(--page-y)" }}
    >
      {children}
    </main>
  );
}
