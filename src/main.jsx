import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { initSyncEngine } from "./lib/sync/SyncEngine";
import { hydrateNativeAppState } from "./lib/native";
import { supabase } from "./lib/supabaseClient";

async function exchangeCodeForSessionFromUrl() {
  if (typeof window === "undefined") return;
  const currentUrl = new URL(window.location.href);
  if (!currentUrl.searchParams.has("code")) return;

  console.info("[AUTH] Detected OAuth code in URL. Exchanging for session...");
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(currentUrl.toString());
    if (error) throw error;
    console.info("[AUTH] exchangeCodeForSession success", {
      event: "SIGNED_IN",
      email: data.session?.user?.email ?? null,
    });

    // Clean up PKCE params without reloading the page so the router keeps the current view.
    currentUrl.searchParams.delete("code");
    currentUrl.searchParams.delete("state");
    const cleanPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    window.history.replaceState(window.history.state, "", cleanPath);
  } catch (error) {
    console.error("[AUTH] Failed to exchange OAuth code for session", error);
  }
}

async function bootstrap() {
  await exchangeCodeForSessionFromUrl();
  await hydrateNativeAppState();
  initSyncEngine();
  const queryClient = new QueryClient();
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
