import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "./serverEnv";

let client: SupabaseClient | null = null;

export const getServiceSupabaseClient = (): SupabaseClient => {
  if (client) {
    return client;
  }

  client = createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: {
      persistSession: false
    }
  });

  return client;
};
