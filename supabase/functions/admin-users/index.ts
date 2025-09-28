// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import type { User } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase environment variables for admin-users function");
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const adminClient = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function normalizeBoolean(value: any, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "y"].includes(normalized);
  }
  return fallback;
}

function normalizeProfile(row: any | null | undefined) {
  if (!row) {
    return {
      role: "user" as const,
      is_active: false,
    };
  }

  return {
    role: row.role === "admin" ? "admin" : "user",
    is_active: normalizeBoolean(row.is_active, true),
    full_name: typeof row.full_name === "string" ? row.full_name : undefined,
    username: typeof row.username === "string" ? row.username : undefined,
    avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : undefined,
    locale: typeof row.locale === "string" ? row.locale : undefined,
    timezone: typeof row.timezone === "string" ? row.timezone : undefined,
    theme: typeof row.theme === "string" ? row.theme : undefined,
  };
}

function sanitizeUser(user: User, profile: any | null | undefined) {
  const normalizedProfile = normalizeProfile(profile);
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at ?? null,
    identities: Array.isArray(user.identities)
      ? user.identities.map((identity) => ({
          provider: typeof identity.provider === "string" ? identity.provider : "unknown",
        }))
      : [],
    profile: normalizedProfile,
  };
}

function extractPathSuffix(url: URL) {
  const segments = url.pathname.split("/").filter(Boolean);
  const index = segments.findIndex((segment) => segment === "admin-users");
  if (index === -1) return "/";
  const remaining = segments.slice(index + 1);
  return `/${remaining.join("/")}` || "/";
}

function validateEmail(email: unknown): email is string {
  if (typeof email !== "string") return false;
  const normalized = email.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(normalized.toLowerCase());
}

function validatePassword(password: unknown): password is string {
  if (typeof password !== "string") return false;
  if (password.length < 8) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

function escapeLike(value: string) {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

async function logAudit(
  adminId: string,
  action: string,
  targetId: string,
  details: Record<string, unknown>,
) {
  if (!adminClient) return;
  try {
    await adminClient.from("admin_audit_logs").insert({
      admin_id: adminId,
      action,
      target_user_id: targetId,
      details,
    });
  } catch (error) {
    console.warn("Failed to write admin audit log", error);
  }
}

async function getProfilesByIds(ids: string[]) {
  if (!adminClient) return new Map<string, any>();
  if (!ids.length) return new Map<string, any>();
  const { data, error } = await adminClient
    .from("user_profiles")
    .select(
      "id, role, is_active, full_name, username, avatar_url, locale, timezone, theme",
    )
    .in("id", ids);
  if (error) throw error;
  const map = new Map<string, any>();
  for (const row of data ?? []) {
    if (row?.id) {
      map.set(String(row.id), row);
    }
  }
  return map;
}

async function ensureProfile(userId: string, profilePayload: Record<string, unknown>) {
  if (!adminClient) throw new Error("Admin client unavailable");
  const payload: Record<string, unknown> = { id: userId };

  if (Object.prototype.hasOwnProperty.call(profilePayload, "role")) {
    payload.role = profilePayload.role === "admin" ? "admin" : "user";
  }

  if (Object.prototype.hasOwnProperty.call(profilePayload, "is_active")) {
    payload.is_active = normalizeBoolean(profilePayload.is_active, true);
  }

  const optionalKeys = [
    "full_name",
    "username",
    "avatar_url",
    "locale",
    "timezone",
    "theme",
  ] as const;

  for (const key of optionalKeys) {
    if (Object.prototype.hasOwnProperty.call(profilePayload, key)) {
      const value = profilePayload[key];
      payload[key] = typeof value === "string" ? value : value ?? null;
    }
  }

  const { error } = await adminClient.from("user_profiles").upsert(payload, { onConflict: "id" });
  if (error) throw error;
}

function parseProfilePayload(raw: any) {
  if (!raw || typeof raw !== "object") return {} as Record<string, unknown>;
  const allowed: Record<string, unknown> = {};
  if (raw.role === "admin" || raw.role === "user") {
    allowed.role = raw.role;
  }
  if (raw.is_active !== undefined) {
    allowed.is_active = normalizeBoolean(raw.is_active, true);
  }
  const optionalFields = [
    "full_name",
    "username",
    "avatar_url",
    "locale",
    "timezone",
    "theme",
  ] as const;
  for (const key of optionalFields) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      const value = raw[key];
      if (typeof value === "string") {
        allowed[key] = value;
      } else if (value == null) {
        allowed[key] = null;
      }
    }
  }
  return allowed;
}

async function fetchUserById(id: string) {
  if (!adminClient) throw new Error("Admin client unavailable");
  const { data, error } = await adminClient.auth.admin.getUserById(id);
  if (error) throw error;
  if (!data?.user) throw new Error("User not found");
  const profileMap = await getProfilesByIds([id]);
  return sanitizeUser(data.user, profileMap.get(id));
}

async function listUsersHandler(url: URL) {
  if (!adminClient) {
    return jsonResponse(500, {
      ok: false,
      error: { code: "service/unavailable", message: "Admin client is not configured" },
    });
  }

  const q = (url.searchParams.get("q") ?? "").trim();
  const roleFilter = url.searchParams.get("role");
  const statusFilter = url.searchParams.get("status");
  const order = (url.searchParams.get("order") ?? "created_at.desc").toLowerCase();
  const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20;

  const cursorParam = url.searchParams.get("cursor");
  const offsetParam = url.searchParams.get("offset");
  let page = 1;
  if (cursorParam) {
    const parsedCursor = Number.parseInt(cursorParam, 10);
    if (Number.isFinite(parsedCursor) && parsedCursor > 0) {
      page = parsedCursor;
    }
  } else if (offsetParam) {
    const offset = Number.parseInt(offsetParam, 10);
    if (Number.isFinite(offset) && offset >= 0) {
      page = Math.floor(offset / limit) + 1;
    }
  }

  try {
    let users: User[] = [];
    let pagination = {
      page,
      perPage: limit,
      nextCursor: null as string | null,
      prevCursor: page > 1 ? String(page - 1) : null,
      hasMore: false,
    };

    if (q) {
      const matches = new Map<string, User>();

      if (q.includes("@")) {
        const { data: emailData } = await adminClient.auth.admin.getUserByEmail(q);
        if (emailData?.user) {
          matches.set(emailData.user.id, emailData.user);
        }
      }

      const escaped = escapeLike(q).replace(/'/g, "''");
      const { data: profileMatches, error: profileSearchError } = await adminClient
        .from("user_profiles")
        .select("id")
        .or(`full_name.ilike.%${escaped}%,username.ilike.%${escaped}%`)
        .limit(50);

      if (profileSearchError) throw profileSearchError;

      for (const row of profileMatches ?? []) {
        if (!row?.id || matches.has(row.id)) continue;
        try {
          const { data: userData } = await adminClient.auth.admin.getUserById(row.id);
          if (userData?.user) {
            matches.set(userData.user.id, userData.user);
          }
        } catch (err) {
          console.warn("Failed to fetch user while searching", err);
        }
      }

      users = Array.from(matches.values());
      pagination = {
        page: 1,
        perPage: limit,
        nextCursor: null,
        prevCursor: null,
        hasMore: false,
      };
    } else {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage: limit,
      });
      if (error) throw error;
      users = data?.users ?? [];
      pagination = {
        page,
        perPage: limit,
        nextCursor: data?.nextPage ? String(data.nextPage) : null,
        prevCursor: page > 1 ? String(page - 1) : null,
        hasMore: Boolean(data?.nextPage),
      };
    }

    const ids = users.map((user) => user.id);
    const profiles = await getProfilesByIds(ids);

    let items = users.map((user) => sanitizeUser(user, profiles.get(user.id)));

    if (roleFilter === "admin" || roleFilter === "user") {
      items = items.filter((item) => item.profile.role === roleFilter);
    }

    if (statusFilter === "active") {
      items = items.filter((item) => item.profile.is_active);
    } else if (statusFilter === "inactive") {
      items = items.filter((item) => !item.profile.is_active);
    }

    const orderParts = order.split(".");
    const orderField = orderParts[0];
    const direction = orderParts[1] === "asc" ? 1 : -1;
    items.sort((a, b) => {
      const valueA = orderField === "last_sign_in_at"
        ? a.last_sign_in_at ?? ""
        : orderField === "email"
          ? a.email ?? ""
          : a.created_at ?? "";
      const valueB = orderField === "last_sign_in_at"
        ? b.last_sign_in_at ?? ""
        : orderField === "email"
          ? b.email ?? ""
          : b.created_at ?? "";
      if (valueA < valueB) return -1 * direction;
      if (valueA > valueB) return 1 * direction;
      return 0;
    });

    if (items.length > limit) {
      items = items.slice(0, limit);
    }

    return jsonResponse(200, {
      ok: true,
      data: {
        items,
        pagination,
      },
    });
  } catch (error) {
    console.error("Failed to list users", error);
    return jsonResponse(500, {
      ok: false,
      error: {
        code: "users/list_failed",
        message: "Tidak dapat memuat daftar pengguna",
        details: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

async function createUserHandler(req: Request, adminId: string) {
  if (!adminClient) {
    return jsonResponse(500, {
      ok: false,
      error: { code: "service/unavailable", message: "Admin client is not configured" },
    });
  }

  let payload: any = null;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, {
      ok: false,
      error: { code: "request/invalid", message: "Body harus berupa JSON" },
    });
  }

  const { email, password, profile, sendEmailInvite } = payload ?? {};

  if (!validateEmail(email)) {
    return jsonResponse(422, {
      ok: false,
      error: { code: "validation/invalid_email", message: "Email tidak valid" },
    });
  }

  if (!sendEmailInvite && !validatePassword(password)) {
    return jsonResponse(422, {
      ok: false,
      error: {
        code: "validation/invalid_password",
        message: "Password minimal 8 karakter dan mengandung huruf besar, kecil, dan angka",
      },
    });
  }

  const profilePayload = parseProfilePayload(profile);
  if (profilePayload.is_active === undefined) {
    profilePayload.is_active = true;
  }
  if (!profilePayload.role) {
    profilePayload.role = "user";
  }

  try {
    let user: User | null = null;
    if (sendEmailInvite) {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email);
      if (error) {
        if (error.status === 409) {
          return jsonResponse(409, {
            ok: false,
            error: {
              code: "users/email_conflict",
              message: "Email sudah terdaftar",
            },
          });
        }
        throw error;
      }
      user = data?.user ?? null;
    } else {
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) {
        if (error.status === 409) {
          return jsonResponse(409, {
            ok: false,
            error: {
              code: "users/email_conflict",
              message: "Email sudah terdaftar",
            },
          });
        }
        throw error;
      }
      user = data?.user ?? null;
    }

    if (!user) {
      throw new Error("Supabase tidak mengembalikan data pengguna baru");
    }

    await ensureProfile(user.id, profilePayload);

    await logAudit(adminId, "create", user.id, {
      email,
      profile: profilePayload,
      sendEmailInvite: Boolean(sendEmailInvite),
    });

    const response = await fetchUserById(user.id);
    return jsonResponse(201, { ok: true, data: response });
  } catch (error) {
    console.error("Failed to create user", error);
    return jsonResponse(500, {
      ok: false,
      error: {
        code: "users/create_failed",
        message: "Tidak dapat membuat pengguna",
        details: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

async function updateUserHandler(req: Request, adminId: string, userId: string) {
  if (!adminClient) {
    return jsonResponse(500, {
      ok: false,
      error: { code: "service/unavailable", message: "Admin client is not configured" },
    });
  }

  let payload: any = null;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, {
      ok: false,
      error: { code: "request/invalid", message: "Body harus berupa JSON" },
    });
  }

  const updates: { email?: string; password?: string } = {};

  if (payload.email !== undefined) {
    if (!validateEmail(payload.email)) {
      return jsonResponse(422, {
        ok: false,
        error: { code: "validation/invalid_email", message: "Email tidak valid" },
      });
    }
    updates.email = payload.email.trim();
  }

  if (payload.password !== undefined) {
    if (!validatePassword(payload.password)) {
      return jsonResponse(422, {
        ok: false,
        error: {
          code: "validation/invalid_password",
          message: "Password minimal 8 karakter dan mengandung huruf besar, kecil, dan angka",
        },
      });
    }
    updates.password = payload.password;
  }

  const profilePayload = parseProfilePayload(payload.profile);

  if (!updates.email && !updates.password && Object.keys(profilePayload).length === 0) {
    return jsonResponse(400, {
      ok: false,
      error: {
        code: "request/empty",
        message: "Tidak ada perubahan yang diberikan",
      },
    });
  }

  try {
    if (updates.email || updates.password) {
      const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, updates);
      if (updateError) {
        if (updateError.status === 409) {
          return jsonResponse(409, {
            ok: false,
            error: {
              code: "users/email_conflict",
              message: "Email sudah terdaftar",
            },
          });
        }
        throw updateError;
      }
    }

    if (Object.keys(profilePayload).length > 0) {
      await ensureProfile(userId, profilePayload);
    }

    await logAudit(adminId, "update", userId, {
      updates,
      profile: profilePayload,
    });

    const response = await fetchUserById(userId);
    return jsonResponse(200, { ok: true, data: response });
  } catch (error) {
    console.error("Failed to update user", error);
    return jsonResponse(500, {
      ok: false,
      error: {
        code: "users/update_failed",
        message: "Tidak dapat memperbarui pengguna",
        details: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

async function deleteUserHandler(req: Request, adminId: string, userId: string) {
  if (!adminClient) {
    return jsonResponse(500, {
      ok: false,
      error: { code: "service/unavailable", message: "Admin client is not configured" },
    });
  }

  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "hard").toLowerCase();

  try {
    if (mode === "soft") {
      await ensureProfile(userId, { is_active: false });
      await logAudit(adminId, "toggle_active", userId, { is_active: false, mode: "soft" });
    } else {
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw error;
      await adminClient.from("user_profiles").delete().eq("id", userId);
      await logAudit(adminId, "delete", userId, { mode: "hard" });
    }

    return jsonResponse(200, { ok: true });
  } catch (error) {
    console.error("Failed to delete user", error);
    return jsonResponse(500, {
      ok: false,
      error: {
        code: "users/delete_failed",
        message: "Tidak dapat menghapus pengguna",
        details: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !adminClient) {
    return jsonResponse(500, {
      ok: false,
      error: { code: "service/unconfigured", message: "Supabase environment variables are missing" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse(401, {
      ok: false,
      error: { code: "auth/unauthorized", message: "Token otorisasi diperlukan" },
    });
  }

  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  try {
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData?.user) {
      return jsonResponse(401, {
        ok: false,
        error: { code: "auth/unauthorized", message: "Session tidak valid" },
      });
    }

    const currentUser = authData.user;
    const { data: profile, error: profileError } = await supabaseClient
      .from("user_profiles")
      .select("id, role, is_active")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to load admin profile", profileError);
      return jsonResponse(500, {
        ok: false,
        error: {
          code: "auth/profile_error",
          message: "Tidak dapat memeriksa peran admin",
        },
      });
    }

    if (!profile || profile.role !== "admin" || !normalizeBoolean(profile.is_active, false)) {
      return jsonResponse(403, {
        ok: false,
        error: { code: "auth/forbidden", message: "Akses admin diperlukan" },
      });
    }

    const url = new URL(req.url);
    const pathSuffix = extractPathSuffix(url);

    if (req.method === "GET" && pathSuffix === "/") {
      return await listUsersHandler(url);
    }

    if (req.method === "POST" && pathSuffix === "/") {
      return await createUserHandler(req, currentUser.id);
    }

    const idMatch = pathSuffix.match(/^\/(.+)$/);
    if (idMatch) {
      const userId = idMatch[1];
      if (req.method === "PATCH") {
        return await updateUserHandler(req, currentUser.id, userId);
      }
      if (req.method === "DELETE") {
        return await deleteUserHandler(req, currentUser.id, userId);
      }
    }

    return jsonResponse(404, {
      ok: false,
      error: { code: "route/not_found", message: "Endpoint tidak ditemukan" },
    });
  } catch (error) {
    console.error("Unexpected error in admin-users function", error);
    return jsonResponse(500, {
      ok: false,
      error: {
        code: "server/error",
        message: "Terjadi kesalahan tidak terduga",
        details: error instanceof Error ? error.message : String(error),
      },
    });
  }
});
