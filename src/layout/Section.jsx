import clsx from "clsx";

/**
 * Section block to manage vertical spacing between page sections.
 * Don't add local mt/mb on children—use this component instead.
 */
export default function Section({ children, className, first = false }) {
  return (
    <section className={clsx(!first && "mt-[var(--section-y)]", className)}>
      {children}
    </section>
  );
}
