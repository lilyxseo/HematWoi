import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { initSyncEngine } from "./lib/sync/SyncEngine";
import { hydrateNativeAppState } from "./lib/native";

async function bootstrap() {
  await hydrateNativeAppState();
  initSyncEngine();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
      mutations: {
        retry: 1,
      },
    },
  });
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Root element tidak ditemukan");
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
