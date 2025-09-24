import { supabase } from "./supabase";
import { isAuthSessionMissingError } from "./auth-errors";

let cachedUserId = null;

supabase.auth.onAuthStateChange((_event, session) => {
  cachedUserId = session?.user?.id ?? null;
});

export async function getCurrentUserId() {
  if (cachedUserId) return cachedUserId;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    cachedUserId = data.user?.id ?? null;
    return cachedUserId;
  } catch (error) {
    if (isAuthSessionMissingError(error)) {
      cachedUserId = null;
      return null;
    }
    throw error;
  }
}

export function clearCachedUser() {
  cachedUserId = null;
}
