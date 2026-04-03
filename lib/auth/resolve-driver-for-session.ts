import type { SupabaseClient } from "@supabase/supabase-js"
import { ensureDriverIdForUser } from "@/lib/eld/ensure-driver"
import type { EmployeeRole } from "@/lib/roles"

/**
 * `drivers.id` for the signed-in user when their role is **driver**; otherwise `null`.
 * Fleet roles never use this for scoping — they keep full company access in server actions.
 */
export async function resolveDriverIdForSessionUser(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  role: EmployeeRole | null
): Promise<string | null> {
  if (role !== "driver") return null
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin")
    return await ensureDriverIdForUser(createAdminClient(), companyId, userId)
  } catch {
    const { data } = await supabase
      .from("drivers")
      .select("id")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .maybeSingle()
    return data?.id ? String(data.id) : null
  }
}
