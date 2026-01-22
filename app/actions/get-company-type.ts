"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

/**
 * Get the company type for the current user
 * Returns 'broker', 'carrier', 'both', or null (regular company)
 */
export async function getCompanyType() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: "Not authenticated" }
  }

  const { company_id, error: companyError } = await getCachedUserCompany(user.id)

  if (companyError || !company_id) {
    return { data: null, error: companyError || "No company found" }
  }

  const { data: company, error } = await supabase
    .from("companies")
    .select("company_type")
    .eq("id", company_id)
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  return { data: company?.company_type || null, error: null }
}

