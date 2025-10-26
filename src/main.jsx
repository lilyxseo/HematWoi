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

  try {
    console.info("[HW][auth] exchanging OAuth code from URL");
    const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
    if (error) throw error;

    console.info("[HW][auth] exchangeCodeForSession success", {
      email: data.session?.user?.email ?? null,
    });
    currentUrl.searchParams.delete("code");
    currentUrl.searchParams.delete("state");
    const params = currentUrl.searchParams.toString();
    const cleanUrl = `${currentUrl.pathname}${params ? `?${params}` : ""}${currentUrl.hash}`;
    window.history.replaceState(window.history.state, document.title, cleanUrl);
    return data;
  } catch (error) {
    console.error("[HW][auth] exchangeCodeForSession failed", error);
  }
}

async function bootstrap() {
  await exchangeCodeForSessionFromUrl();
  try {
    await supabase.auth.getSession();
  } catch (error) {
    console.error("[HW][auth] preload getSession failed", error);
  }
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
