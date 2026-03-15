import { createClient } from "@supabase/supabase-js"

/**
 * Server-only Supabase client using the service role key.
 * RLS is disabled, so this is the standard server-side client.
 * Use in API routes and server components.
 */
export function createServerDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
