import { createClient } from "@supabase/supabase-js";
import { config, configured } from "../config/app";
export const supabase = configured
  ? createClient(config.supabaseUrl!, config.supabaseKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: window.sessionStorage,
        detectSessionInUrl: false,
      },
    })
  : null;
