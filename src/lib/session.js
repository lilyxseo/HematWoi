import { supabase } from "./supabase";

let cachedUserId = null;

supabase.auth.onAuthStateChange((_event, session) => {
  cachedUserId = session?.user?.id ?? null;
});

export async function getCurrentUserId() {
  if (cachedUserId) return cachedUserId;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  cachedUserId = data.user?.id ?? null;
  return cachedUserId;
}

export function clearCachedUser() {
  cachedUserId = null;
}

export async function getUserToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token ?? null;
  if (!accessToken) {
    throw new Error("Not signed in");
  }
  return accessToken;
}
