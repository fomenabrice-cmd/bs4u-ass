import { createClient } from "@supabase/supabase-js";
import type { Database } from "@bs4u/shared-types";

// strip BOM (U+FEFF) that some env editors paste inadvertently
const supabaseUrl  = (import.meta.env["VITE_SUPABASE_URL"] ?? "https://placeholder.supabase.co").replace(/^﻿/, "");
const supabaseKey  = (import.meta.env["VITE_SUPABASE_ANON_KEY"] ?? "placeholder").replace(/^﻿/, "");

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
