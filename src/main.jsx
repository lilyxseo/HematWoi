import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AppShell from "./layout/AppShell";
import "./index.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <BrowserRouter>
    <AppShell />
  </BrowserRouter>
);
