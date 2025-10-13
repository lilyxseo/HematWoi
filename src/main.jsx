import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { initSyncEngine } from "./lib/sync/SyncEngine";
import { hydrateMultiplePreferences } from "./lib/native";
import { bootstrapNativeApp } from "./lib/native-auth";

const queryClient = new QueryClient();

async function bootstrap() {
  await hydrateMultiplePreferences(["hw:prefs", "hw:lastUser", "hwTheme"]);
  await bootstrapNativeApp();
  initSyncEngine();

  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Root element not found");
  }

  createRoot(container).render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  );
}

void bootstrap();
