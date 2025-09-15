import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import syncEngine from "./lib/sync/SyncEngine.js";

syncEngine.flushQueue();
window.addEventListener("online", () => syncEngine.flushQueue());
setInterval(() => syncEngine.flushQueue(), 10000);

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
