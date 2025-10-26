import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { initSyncEngine } from "./lib/sync/SyncEngine";
import { hydrateNativeAppState } from "./lib/native";
import { supabase } from "./lib/supabaseClient";

async function exchangePkceCodeFromUrl() {
  if (typeof window === "undefined") return;
  if (!window.location.href.includes("code=")) return;

  console.info("[auth] Attempting PKCE code exchange", { href: window.location.href });

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
    if (error) throw error;

    console.info("[auth] PKCE exchange success", {
      event: "SIGNED_IN",
      email: data.session?.user?.email ?? null,
    });

    // Clean up OAuth query parameters without triggering a reload.
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    const query = url.searchParams.toString();
    const cleaned = `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
    window.history.replaceState(window.history.state, "", cleaned);
  } catch (error) {
    console.error("[auth] Failed to exchange PKCE code", error);
  }
}

async function bootstrap() {
  await exchangePkceCodeFromUrl();
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
