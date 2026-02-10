import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Singleton pattern for connection pooling
// Prevents creating new connections on every API request
// Critical for handling high traffic (1000+ req/min)
let supabaseAdminInstance: SupabaseClient | null = null;

export const getSupabaseAdmin = () => {
  // Return existing instance if available
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY");
  }

  // Create singleton instance with optimized configuration
  supabaseAdminInstance = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
    },
    db: {
      schema: "public",
    },
    global: {
      headers: {
        "x-client-info": "match-note-supabase",
      },
    },
  });

  return supabaseAdminInstance;
};

// Helper to invalidate connection (useful for tests)
export const resetSupabaseConnection = () => {
  supabaseAdminInstance = null;
};
