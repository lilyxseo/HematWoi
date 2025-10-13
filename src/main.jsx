import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { hydrateNativePreferences } from "./lib/native";
import { initSyncEngine } from "./lib/sync/SyncEngine";

const queryClient = new QueryClient();

initSyncEngine();
await hydrateNativePreferences();
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </BrowserRouter>
);
