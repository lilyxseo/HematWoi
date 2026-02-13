import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { initSyncEngine } from "./lib/sync/SyncEngine";
import { hydrateNativeAppState } from "./lib/native";
import { supabase } from "./lib/supabase";

async function bootstrap() {
  if (typeof window !== "undefined") {
    const currentUrl = window.location.href;
    if (currentUrl.includes("code=")) {
      try {
        console.info("[AUTH] Exchanging PKCE code for session");
        const { data, error } = await supabase.auth.exchangeCodeForSession(currentUrl);
        if (error) throw error;

        const url = new URL(currentUrl);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        // Remove the PKCE params without triggering a reload so the router sees a clean URL
        window.history.replaceState(
          window.history.state,
          "",
          `${url.pathname}${url.search}${url.hash}`
        );
        console.info("[AUTH] PKCE exchange succeeded", data.session?.user?.email ?? null);
      } catch (error) {
        console.error("[AUTH] Failed to exchange PKCE code", error);
      }
    }
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    console.info("[AUTH] Bootstrap session", data.session?.user?.email ?? null);
  } catch (error) {
    console.error("[AUTH] Failed to fetch bootstrap session", error);
  }

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
