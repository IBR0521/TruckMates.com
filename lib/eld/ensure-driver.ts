import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Ensures `public.drivers` has a row for this auth user + company.
 * Mobile sync sends auth `user_id`; `eld_logs.driver_id` FK must be `drivers.id`.
 * Without this row, logs insert with null driver_id and the dispatcher HOS widget never sees them.
 */
export async function ensureDriverIdForUser(
  supabase: SupabaseClient,
  companyId: string,
  userId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("drivers")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existing?.id) {
    return String(existing.id)
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle()

  const email = (userRow?.email || "").toLowerCase().trim() || null

  // Link an orphan row (same company + email, user_id null) instead of inserting again.
  // Prefer exact normalized email; then case-insensitive scan of unlinked rows.
  if (email) {
    const { data: exactOrphan } = await supabase
      .from("drivers")
      .select("id")
      .eq("company_id", companyId)
      .eq("email", email)
      .is("user_id", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    let orphanId = exactOrphan?.id as string | undefined

    if (!orphanId) {
      const { data: orphanList } = await supabase
        .from("drivers")
        .select("id, email")
        .eq("company_id", companyId)
        .is("user_id", null)
        .limit(300)

      orphanId = (orphanList || []).find(
        (r) => (r.email || "").toLowerCase().trim() === email
      )?.id
    }

    if (orphanId) {
      const { error: upErr } = await supabase
        .from("drivers")
        .update({ user_id: userId, email, updated_at: new Date().toISOString() })
        .eq("id", orphanId)
      if (!upErr) {
        return String(orphanId)
      }
    }
  }
  const name =
    (userRow?.full_name || "").toString().trim() ||
    (email ? email.split("@")[0] : "") ||
    "Driver"

  const now = new Date().toISOString()
  const { data: inserted, error } = await supabase
    .from("drivers")
    .insert({
      user_id: userId,
      company_id: companyId,
      name,
      email,
      phone: null,
      status: "active",
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single()

  if (!error && inserted?.id) {
    return String(inserted.id)
  }

  // Concurrent insert or unique conflict: fetch by user_id again
  const { data: afterRace } = await supabase
    .from("drivers")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle()

  if (afterRace?.id) {
    return String(afterRace.id)
  }

  return null
}
