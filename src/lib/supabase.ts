import { createClient } from "@supabase/supabase-js";

export const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY");
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
    },
  });
};
