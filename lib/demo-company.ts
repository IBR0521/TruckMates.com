"use server"

import { createAdminClient } from "@/lib/supabase/admin"

type CompanyRow = {
  name?: string | null
  setup_data?: Record<string, unknown> | null
}

export async function isDemoCompanyById(companyId: string | null | undefined): Promise<boolean> {
  if (!companyId) return false

  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from("companies")
      .select("name, setup_data")
      .eq("id", companyId)
      .maybeSingle()

    const row = (data || null) as CompanyRow | null
    const name = String(row?.name || "").toLowerCase()
    const setupData = (row?.setup_data || {}) as Record<string, unknown>
    const flag = setupData.is_demo

    return flag === true || String(flag).toLowerCase() === "true" || name.includes("demo logistics company")
  } catch {
    return false
  }
}
