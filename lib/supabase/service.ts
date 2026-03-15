import { createClient } from "@supabase/supabase-js"

/**
 * Creates a Supabase client with the service role key.
 * This bypasses RLS policies and should only be used in secure server-side contexts.
 * 
 * WARNING: Never expose the service role key to the client!
 */
export function createServiceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set")
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}