import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Admin Supabase client using the service role key.
 *
 * - NEVER import or use this in client components.
 * - ONLY use in secure server environments like API routes, webhooks, and cron jobs.
 * - Bypasses RLS, so all access control must be enforced in application logic.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service role client is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  })
}


