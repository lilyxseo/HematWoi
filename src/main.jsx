import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { initSyncEngine } from "./lib/sync/SyncEngine";
import { AccentProvider } from "./context/AccentContext";

const queryClient = new QueryClient();

initSyncEngine();
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AccentProvider>
        <App />
      </AccentProvider>
    </QueryClientProvider>
  </BrowserRouter>
);
