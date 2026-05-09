"use server"

import { safeDbError } from "@/lib/utils/error"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
/**
 * Get the company type for the current user
 * Returns 'broker', 'carrier', 'both', or null (regular company)
 */
export async function getCompanyType() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const { data: company, error } = await supabase
    .from("companies")
    .select("company_type")
    .eq("id", ctx.companyId)
    .single()

  if (error) {
    return { data: null, error: safeDbError(error) }
  }

  return { data: company?.company_type || null, error: null }
}


