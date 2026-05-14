import { createAdminClient } from "@/lib/supabase/admin"

export async function listLoadIdsNeedingTripSummary(params: {
  companyId: string
  sinceIso: string
}): Promise<{ data: string[]; error: string | null }> {
  const admin = createAdminClient()
  const { data: loads, error: lErr } = await admin
    .from("loads")
    .select("id")
    .eq("company_id", params.companyId)
    .in("status", ["delivered", "invoiced", "paid"])
    .gte("actual_delivery", params.sinceIso)
    .not("actual_delivery", "is", null)
    .limit(500)

  if (lErr) return { data: [], error: lErr.message }
  const loadIds = (loads || []).map((r) => String((r as { id?: string }).id ?? "")).filter(Boolean)
  if (loadIds.length === 0) return { data: [], error: null }

  const { data: sums, error: sErr } = await admin.from("trip_summaries").select("load_id, needs_refresh").in("load_id", loadIds)
  if (sErr) return { data: [], error: sErr.message }
  const sumByLoad = new Map<string, { needs_refresh: boolean }>()
  for (const s of sums || []) {
    const o = s as { load_id?: string; needs_refresh?: boolean }
    if (o.load_id) sumByLoad.set(o.load_id, { needs_refresh: Boolean(o.needs_refresh) })
  }
  const need: string[] = []
  for (const lid of loadIds) {
    const ex = sumByLoad.get(lid)
    if (!ex || ex.needs_refresh) need.push(lid)
  }
  return { data: need, error: null }
}
