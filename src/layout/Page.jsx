/**
 * Page container enforcing global vertical rhythm.
 * Applies top and bottom padding using --page-y.
 */
export default function Page({ children }) {
  return (
    <main
      className="mx-auto w-full min-w-0 px-4 sm:px-6 lg:max-w-6xl lg:px-8 xl:max-w-7xl xl:px-10 2xl:max-w-[88rem] 2xl:px-12"
      style={{ paddingTop: "var(--page-y)", paddingBottom: "var(--page-y)" }}
    >
      {children}
    </main>
  );
}
