import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serverClient: SupabaseClient | null | undefined;

function getSupabaseServerConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;

  if (!url || !serviceRoleKey || !bucket) {
    return null;
  }

  return {
    bucket,
    serviceRoleKey,
    url,
  };
}

export function getSupabaseStorageBucket() {
  return getSupabaseServerConfig()?.bucket ?? null;
}

export function getSupabaseServerClient() {
  if (serverClient !== undefined) {
    return serverClient;
  }

  const config = getSupabaseServerConfig();

  if (!config) {
    serverClient = null;
    return serverClient;
  }

  serverClient = createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return serverClient;
}
