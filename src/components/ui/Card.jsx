import React from "react";
export function Card({ className = "", children }) {
  return (
    <section
      className={`card ${className}`}
      style={{ containerType: "inline-size", containerName: "card" }}
    >
      {children}
    </section>
  );
}
export function CardHeader({ title, subtitle, extra }) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        flexWrap: "wrap",
      }}
    >
      <div>
        {title && <div className="card-title">{title}</div>}
        {subtitle && <div className="card-sub">{subtitle}</div>}
      </div>
      {extra && (
        <div
          className="actions"
          style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
        >
          {extra}
        </div>
      )}
    </header>
  );
}
export function CardBody({ children }) {
  return <div>{children}</div>;
}
export function CardFooter({ children }) {
  return <footer style={{ marginTop: "auto" }}>{children}</footer>;
}
export default { Card, CardHeader, CardBody, CardFooter };
