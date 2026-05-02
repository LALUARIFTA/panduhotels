const { createClient } = require("@supabase/supabase-js");

/**
 * Supabase Admin Client — uses service_role key
 * ONLY use on server-side. Never expose this to the browser.
 * Bypasses Row Level Security for admin operations.
 */
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Supabase Public Client — uses anon key
 * Used for user-facing operations that respect RLS.
 */
const supabasePublic = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * Create a Supabase client scoped to a specific user's JWT.
 * This ensures all queries respect RLS for that user.
 */
function createUserClient(accessToken) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    }
  );
}

module.exports = { supabaseAdmin, supabasePublic, createUserClient };
