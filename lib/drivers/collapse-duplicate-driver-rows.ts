import type { SupabaseClient } from "@supabase/supabase-js"

const IN_CHUNK = 400

function chunkIds(ids: string[]): string[][] {
  if (ids.length === 0) return []
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    out.push(ids.slice(i, i + IN_CHUNK))
  }
  return out
}

const DRIVER_ID_TABLES = [
  "eld_logs",
  "eld_events",
  "eld_locations",
  "loads",
  "routes",
  "expenses",
  "documents",
  "settlements",
  "dvir",
  "trip_sheets",
  "idle_time_sessions",
  "state_crossings",
  "driver_badges",
  "driver_performance_scores",
  "detention_tracking",
  "zone_visits",
  "chat_threads",
  "alerts",
  "reminders",
  "check_calls",
  "eta_updates",
  "fuel_purchases",
] as const

/**
 * Nuclear cleanup: keep exactly one driver row for the company (canonical),
 * repoint all FKs from every other row onto canonical, then delete the extras.
 * Use when thousands of duplicate rows were created (e.g. same name, missing/wrong email).
 */
export async function purgeAllDriversKeepOneForCompany(
  admin: SupabaseClient,
  companyId: string
): Promise<{ keptId: string; deleted: number }> {
  const { data: rows } = await admin
    .from("drivers")
    .select("id, user_id")
    .eq("company_id", companyId)

  type Row = { id: string; user_id: string | null }
  const list = (rows || []) as Row[]
  if (list.length === 0) {
    return { keptId: "", deleted: 0 }
  }
  if (list.length === 1) {
    return { keptId: list[0].id, deleted: 0 }
  }

  const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id))
  const withUser = sorted.filter((r) => r.user_id)
  const canonical =
    withUser.length > 0 ? withUser.sort((a, b) => a.id.localeCompare(b.id))[0] : sorted[0]
  const loserIds = sorted.filter((r) => r.id !== canonical.id).map((r) => r.id)

  await repointDriverForeignKeysBatch(admin, loserIds, canonical.id)

  let deleted = 0
  for (const batch of chunkIds(loserIds)) {
    const { error } = await admin.from("drivers").delete().in("id", batch)
    if (error) {
      console.error("purgeAllDriversKeepOneForCompany: batch delete failed", error.message)
      throw new Error(error.message)
    }
    deleted += batch.length
  }

  return { keptId: canonical.id, deleted }
}

/**
 * Merges duplicate `drivers` rows that share the same normalized email within a company.
 * Keeps one canonical row (prefer a row with `user_id` set, else smallest `id`),
 * repoints FKs in batch, then deletes extras in batch (fast enough to await in getDrivers).
 */
export async function collapseDuplicateDriversByEmail(
  admin: SupabaseClient,
  companyId: string
): Promise<void> {
  const { data: rows } = await admin
    .from("drivers")
    .select("id, email, user_id")
    .eq("company_id", companyId)

  type Row = { id: string; email: string | null; user_id: string | null }
  const byEmail = new Map<string, Row[]>()
  for (const r of (rows || []) as Row[]) {
    const em = (r.email || "").toLowerCase().trim()
    if (!em) continue
    if (!byEmail.has(em)) byEmail.set(em, [])
    byEmail.get(em)!.push(r)
  }

  for (const [, group] of byEmail) {
    if (group.length < 2) continue

    const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id))
    const withUser = sorted.filter((r) => r.user_id)
    const canonical =
      withUser.length > 0 ? withUser.sort((a, b) => a.id.localeCompare(b.id))[0] : sorted[0]
    const loserIds = sorted.filter((r) => r.id !== canonical.id).map((r) => r.id)
    if (loserIds.length === 0) continue

    await repointDriverForeignKeysBatch(admin, loserIds, canonical.id)
    for (const batch of chunkIds(loserIds)) {
      const { error } = await admin.from("drivers").delete().in("id", batch)
      if (error) {
        console.error("collapseDuplicateDriversByEmail: batch delete failed", error.message)
      }
    }
  }
}

async function repointDriverForeignKeysBatch(
  admin: SupabaseClient,
  loserIds: string[],
  canonicalId: string
) {
  if (loserIds.length === 0) return

  for (const batch of chunkIds(loserIds)) {
    await Promise.all([
      ...DRIVER_ID_TABLES.map(async (table) => {
        const { error } = await admin.from(table).update({ driver_id: canonicalId }).in("driver_id", batch)
        if (error) {
          console.warn(`collapseDuplicateDriversByEmail: repoint ${table}.driver_id`, error.message)
        }
      }),
      (async () => {
        const { error } = await admin
          .from("trucks")
          .update({ current_driver_id: canonicalId })
          .in("current_driver_id", batch)
        if (error) {
          console.warn(`collapseDuplicateDriversByEmail: repoint trucks.current_driver_id`, error.message)
        }
      })(),
    ])
  }

  await repointEldDriverMappingsBatch(admin, loserIds, canonicalId)
  for (const loserId of loserIds) {
    await repointDriverOnboarding(admin, loserId, canonicalId)
  }
}

async function repointEldDriverMappingsBatch(
  admin: SupabaseClient,
  loserIds: string[],
  canonicalId: string
) {
  for (const batch of chunkIds(loserIds)) {
    const { data: rows } = await admin
      .from("eld_driver_mappings")
      .select("id, eld_device_id, provider_driver_id")
      .in("internal_driver_id", batch)

    await Promise.all(
      (rows || []).map(async (r) => {
        const { data: clash } = await admin
          .from("eld_driver_mappings")
          .select("id")
          .eq("internal_driver_id", canonicalId)
          .eq("eld_device_id", r.eld_device_id)
          .eq("provider_driver_id", r.provider_driver_id)
          .maybeSingle()
        if (clash?.id) {
          const { error } = await admin.from("eld_driver_mappings").delete().eq("id", r.id)
          if (error) {
            console.warn("collapseDuplicateDriversByEmail: delete duplicate eld_driver_mappings", error.message)
          }
        } else {
          const { error } = await admin
            .from("eld_driver_mappings")
            .update({ internal_driver_id: canonicalId })
            .eq("id", r.id)
          if (error) {
            console.warn("collapseDuplicateDriversByEmail: repoint eld_driver_mappings", error.message)
          }
        }
      })
    )
  }
}

async function repointDriverOnboarding(admin: SupabaseClient, fromId: string, toId: string) {
  const { data: loser } = await admin.from("driver_onboarding").select("id").eq("driver_id", fromId).maybeSingle()
  if (!loser?.id) return
  const { data: canonical } = await admin.from("driver_onboarding").select("id").eq("driver_id", toId).maybeSingle()
  if (canonical?.id) {
    const { error } = await admin.from("driver_onboarding").delete().eq("driver_id", fromId)
    if (error) {
      console.warn("collapseDuplicateDriversByEmail: delete duplicate driver_onboarding", error.message)
    }
  } else {
    const { error } = await admin.from("driver_onboarding").update({ driver_id: toId }).eq("driver_id", fromId)
    if (error) {
      console.warn("collapseDuplicateDriversByEmail: repoint driver_onboarding", error.message)
    }
  }
}
