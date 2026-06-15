"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

/** Lightweight flags for dispatch UI (confirmation dialogs). */
export async function getDispatchWorkflowFlags() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { data, error } = await supabase
    .from("company_settings")
    .select("require_confirmation_before_dispatch, allow_bulk_dispatch")
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (error) {
    return { error: error.message || "Failed to load dispatch settings", data: null }
  }

  return {
    data: {
      require_confirmation_before_dispatch: Boolean(data?.require_confirmation_before_dispatch),
      allow_bulk_dispatch: data?.allow_bulk_dispatch !== false,
    },
    error: null,
  }
}
