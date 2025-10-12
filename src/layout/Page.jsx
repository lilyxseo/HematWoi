import clsx from "clsx";

/**
 * Page container enforcing global vertical rhythm.
 * Applies top and bottom padding using --page-y.
 */
export default function Page({ children, className, maxWidthClass = "max-w-5xl" }) {
  return (
    <main
      className={clsx(
        "mx-auto w-full min-w-0 px-4",
        maxWidthClass,
        className,
      )}
      style={{ paddingTop: "var(--page-y)", paddingBottom: "var(--page-y)" }}
    >
      {children}
    </main>
  );
}
