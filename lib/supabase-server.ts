import { createClient } from "@supabase/supabase-js";

function getSupabaseServerConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return {
    anonKey,
    url,
  };
}

export function getSupabaseStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET ?? null;
}

export function createSupabaseServerClient(accessToken: string) {
  const config = getSupabaseServerConfig();

  if (!config) {
    return null;
  }

  return createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
