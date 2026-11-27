import { createClient } from "@supabase/supabase-js";
import type { Database } from "@bs4u/shared-types";

const supabaseUrl  = import.meta.env["VITE_SUPABASE_URL"] ?? "https://placeholder.supabase.co";
const supabaseKey  = import.meta.env["VITE_SUPABASE_ANON_KEY"] ?? "placeholder";

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "bs4u-manager-auth",
  },
  global: {
    headers: {
      "X-BS4U-App": "manager",
    },
  },
});
