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
