/**
 * Page container enforcing global vertical rhythm.
 * Applies top and bottom padding using --page-y.
 */
export default function Page({ children }) {
  return (
    <main
      className="mx-auto w-full max-w-5xl min-w-0 px-4"
      style={{ paddingTop: "var(--page-y)", paddingBottom: "var(--page-y)" }}
    >
      {children}
    </main>
  );
}
