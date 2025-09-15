import React from "react";
export function Page({ title, actions, children }) {
  return (
    <div className="container page">
      <div className="page-header">
        <h1 style={{ fontSize: "var(--fs-700)", margin: 0 }}>{title}</h1>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {actions}
        </div>
      </div>
      {children}
    </div>
  );
}
export default { Page };
