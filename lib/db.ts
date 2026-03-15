import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "./serverEnv";

let client: SupabaseClient | null = null;

export const getServiceSupabaseClient = (): SupabaseClient => {
  if (client) {
    return client;
  }

  if (!serverEnv.supabaseUrl || !serverEnv.supabaseServiceRoleKey) {
    throw new Error("Missing required environment variables: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  }

  client = createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: {
      persistSession: false
    }
  });

  return client;
};
