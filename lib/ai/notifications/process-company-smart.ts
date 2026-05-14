import { createAdminClient } from "@/lib/supabase/admin"
import { hasFeatureAccess, normalizePlanTier, type PlanTier } from "@/lib/plan-limits"
import { scoreNotificationBatch, type NotificationToScore } from "@/lib/ai/notifications/scorer"
import { generateProactiveAlerts, type ProactiveAlert } from "@/lib/ai/notifications/proactive"

function tierFromRow(raw: string | null | undefined): PlanTier {
  return normalizePlanTier(raw ?? undefined)
}

function extractRelated(meta: Record<string, unknown>): { type: string | null; id: string | null } {
  if (typeof meta.load_id === "string") return { type: "load", id: meta.load_id }
  if (typeof meta.driver_id === "string") return { type: "driver", id: meta.driver_id }
  if (typeof meta.truck_id === "string") return { type: "truck", id: meta.truck_id }
  if (typeof meta.route_id === "string") return { type: "route", id: meta.route_id }
  return { type: null, id: null }
}

async function buildCompanyContext(admin: ReturnType<typeof createAdminClient>, companyId: string): Promise<string> {
  const [loads, drivers, trucks] = await Promise.all([
    admin.from("loads").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    admin.from("drivers").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    admin.from("trucks").select("id", { count: "exact", head: true }).eq("company_id", companyId),
  ])
  return [
    `Loads (all time): ${loads.count ?? 0}`,
    `Drivers: ${drivers.count ?? 0}`,
    `Trucks: ${trucks.count ?? 0}`,
  ].join("; ")
}

async function shouldThrottleCompany(admin: ReturnType<typeof createAdminClient>, companyId: string): Promise<boolean> {
  const { data } = await admin.from("ai_smart_notification_cron_state").select("last_run_at").eq("company_id", companyId).maybeSingle()
  const row = data as { last_run_at?: string } | null
  if (!row?.last_run_at) return false
  const last = new Date(row.last_run_at).getTime()
  return Date.now() - last < 10 * 60 * 1000
}

async function touchCronState(admin: ReturnType<typeof createAdminClient>, companyId: string): Promise<void> {
  const now = new Date().toISOString()
  await admin.from("ai_smart_notification_cron_state").upsert({ company_id: companyId, last_run_at: now }, { onConflict: "company_id" })
}

async function companyHasSmartModeUser(admin: ReturnType<typeof createAdminClient>, companyId: string): Promise<boolean> {
  const { count } = await admin
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("notification_smart_mode", true)
    .limit(1)
  return (count || 0) > 0
}

async function pickRecipientUserId(admin: ReturnType<typeof createAdminClient>, companyId: string): Promise<string | null> {
  const { data: preferred } = await admin
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .eq("notification_smart_mode", true)
    .neq("role", "driver")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (preferred && typeof (preferred as { id: string }).id === "string") return (preferred as { id: string }).id

  const { data: anyUser } = await admin
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .neq("role", "driver")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  return anyUser && typeof (anyUser as { id: string }).id === "string" ? (anyUser as { id: string }).id : null
}

function mapAiPriorityToLegacy(p: ProactiveAlert["priority"]): string {
  if (p === "critical") return "critical"
  if (p === "high") return "high"
  return "normal"
}

async function insertProactiveIfNew(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  alert: ProactiveAlert,
): Promise<"created" | "skipped" | "failed"> {
  const { data: open } = await admin
    .from("ai_proactive_alerts")
    .select("id")
    .eq("company_id", companyId)
    .eq("alert_type", alert.alert_type)
    .eq("alert_key", alert.alert_key)
    .eq("resolved", false)
    .maybeSingle()
  if (open?.id) return "skipped"

  const userId = await pickRecipientUserId(admin, companyId)
  if (!userId) return "failed"

  const { data: notif, error: nErr } = await admin
    .from("notifications")
    .insert({
      user_id: userId,
      company_id: companyId,
      type: "info",
      title: alert.title,
      message: alert.body,
      priority: mapAiPriorityToLegacy(alert.priority),
      metadata: { ...alert.details, ai_proactive: true, alert_type: alert.alert_type },
      read: false,
      source: "ai_proactive",
      ai_priority: alert.priority,
      ai_reasoning: "Template-based proactive detection (no generative rewrite).",
      ai_processed_at: new Date().toISOString(),
      ai_suppressed: false,
    })
    .select("id")
    .single()

  if (nErr || !notif) return "failed"
  const notificationId = String((notif as { id: string }).id)

  const { error: aErr } = await admin.from("ai_proactive_alerts").insert({
    company_id: companyId,
    alert_type: alert.alert_type,
    alert_key: alert.alert_key,
    notification_id: notificationId,
    details: alert.details,
    resolved: false,
  })

  if (aErr) {
    await admin.from("notifications").delete().eq("id", notificationId)
    return "failed"
  }

  return "created"
}

export async function resolveProactiveAlertsForCompany(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
): Promise<number> {
  const { data: rows } = await admin
    .from("ai_proactive_alerts")
    .select("id, alert_type, alert_key, details, notification_id, resolved")
    .eq("company_id", companyId)
    .eq("resolved", false)
    .limit(200)

  let resolved = 0
  for (const row of (rows || []) as Array<{
    id: string
    alert_type: string
    details: Record<string, unknown>
    notification_id: string | null
  }>) {
    let shouldResolve = false
    const details =
      row.details && typeof row.details === "object" && !Array.isArray(row.details)
        ? (row.details as Record<string, unknown>)
        : {}
    const loadId = typeof details.load_id === "string" ? details.load_id : null
    const truckId = typeof details.truck_id === "string" ? details.truck_id : null
    const driverId = typeof details.driver_id === "string" ? details.driver_id : null
    const marketplaceId = typeof details.marketplace_id === "string" ? details.marketplace_id : null
    const dayKey = typeof details.date === "string" ? details.date : null

    if (row.alert_type === "late_delivery_predicted" && loadId) {
      const { data: load } = await admin.from("loads").select("status, estimated_delivery").eq("id", loadId).maybeSingle()
      const st = String((load as { status?: string } | null)?.status || "")
      if (st === "delivered" || st === "cancelled") shouldResolve = true
    }

    if (row.alert_type === "profit_at_risk" && loadId) {
      const { data: load } = await admin.from("loads").select("total_rate, rate, status").eq("id", loadId).maybeSingle()
      const l = load as { total_rate?: number | null; rate?: number | null; status?: string } | null
      const negotiated = Number(l?.total_rate ?? l?.rate ?? 0)
      const { data: exp } = await admin.from("expenses").select("amount").eq("company_id", companyId).eq("load_id", loadId)
      let sum = 0
      for (const e of (exp || []) as Array<{ amount?: number | null }>) sum += Number(e.amount || 0)
      if (negotiated > 0 && sum / negotiated < 0.8) shouldResolve = true
      if (l?.status === "delivered" || l?.status === "cancelled") shouldResolve = true
    }

    if (row.alert_type === "capacity_gap" && dayKey) {
      if (dayKey < new Date().toISOString().slice(0, 10)) shouldResolve = true
    }

    if (row.alert_type === "stale_marketplace_listing" && marketplaceId) {
      const { data: mp } = await admin.from("load_marketplace").select("status").eq("id", marketplaceId).maybeSingle()
      if (String((mp as { status?: string } | null)?.status || "") !== "available") shouldResolve = true
    }

    if (row.alert_type === "idle_truck" && truckId) {
      const { data: busy } = await admin
        .from("loads")
        .select("id")
        .eq("company_id", companyId)
        .eq("truck_id", truckId)
        .in("status", ["scheduled", "in_transit", "confirmed"])
        .limit(1)
        .maybeSingle()
      if (busy?.id) shouldResolve = true
    }

    if (row.alert_type === "compliance_expiry" && driverId) {
      const { data: rem } = await admin
        .from("reminders")
        .select("id")
        .eq("company_id", companyId)
        .eq("driver_id", driverId)
        .eq("reminder_type", "license_renewal")
        .in("status", ["pending", "sent"])
        .limit(1)
        .maybeSingle()
      if (rem?.id) shouldResolve = true
    }

    if (row.alert_type === "coaching_follow_up_due") {
      const sid = typeof details.coaching_session_id === "string" ? details.coaching_session_id : null
      if (sid) {
        const { data: sess } = await admin
          .from("driver_coaching_sessions")
          .select("follow_up_completed")
          .eq("id", sid)
          .maybeSingle()
        if ((sess as { follow_up_completed?: boolean } | null)?.follow_up_completed) shouldResolve = true
      }
    }

    if (shouldResolve) {
      await admin
        .from("ai_proactive_alerts")
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", row.id)
      resolved += 1
    }
  }
  return resolved
}

export async function deleteOldResolvedProactiveNotifications(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: rows } = await admin
    .from("ai_proactive_alerts")
    .select("notification_id")
    .eq("company_id", companyId)
    .eq("resolved", true)
    .not("notification_id", "is", null)
    .lt("resolved_at", cutoff)

  const ids = (rows || [])
    .map((r: { notification_id: string | null }) => r.notification_id)
    .filter((id): id is string => typeof id === "string")

  if (ids.length === 0) return 0
  const { error } = await admin.from("notifications").delete().in("id", ids).eq("company_id", companyId)
  return error ? 0 : ids.length
}

export async function processSmartNotificationsForCompany(companyId: string): Promise<{
  scored: number
  proactive_created: number
  resolved: number
  deleted: number
  skippedThrottle: boolean
  skippedPlan: boolean
  skippedNoSmartUser: boolean
  error: string | null
}> {
  const admin = createAdminClient()

  const { data: company } = await admin.from("companies").select("subscription_tier").eq("id", companyId).maybeSingle()
  const tier = tierFromRow((company as { subscription_tier?: string } | null)?.subscription_tier)

  if (!hasFeatureAccess(tier, "ai_smart_notifications")) {
    return {
      scored: 0,
      proactive_created: 0,
      resolved: 0,
      deleted: 0,
      skippedThrottle: false,
      skippedPlan: true,
      skippedNoSmartUser: false,
      error: null,
    }
  }

  if (await shouldThrottleCompany(admin, companyId)) {
    return {
      scored: 0,
      proactive_created: 0,
      resolved: 0,
      deleted: 0,
      skippedThrottle: true,
      skippedPlan: false,
      skippedNoSmartUser: false,
      error: null,
    }
  }

  const smartUser = await companyHasSmartModeUser(admin, companyId)
  if (!smartUser) {
    await touchCronState(admin, companyId)
    return {
      scored: 0,
      proactive_created: 0,
      resolved: 0,
      deleted: 0,
      skippedThrottle: false,
      skippedPlan: false,
      skippedNoSmartUser: true,
      error: null,
    }
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: unscored } = await admin
    .from("notifications")
    .select("id, type, title, message, metadata, created_at, company_id")
    .eq("company_id", companyId)
    .is("ai_processed_at", null)
    .eq("source", "event")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50)

  const rows = (unscored || []) as Array<{
    id: string
    type: string
    title: string
    message: string | null
    metadata: Record<string, unknown> | null
    created_at: string
  }>

  let scored = 0
  if (rows.length > 0) {
    const companyContext = await buildCompanyContext(admin, companyId)
    const toScore: NotificationToScore[] = rows.map((r) => {
      const meta = r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata) ? r.metadata : {}
      const rel = extractRelated(meta)
      return {
        id: r.id,
        type: r.type,
        title: r.title,
        body: String(r.message || ""),
        metadata: meta,
        created_at: r.created_at,
        related_resource_type: rel.type,
        related_resource_id: rel.id,
      }
    })

    for (let i = 0; i < toScore.length; i += 20) {
      const batch = toScore.slice(i, i + 20)
      const scoredBatch = await scoreNotificationBatch({ companyId, notifications: batch, companyContext })
      if (scoredBatch.error || !scoredBatch.data) {
        return {
          scored,
          proactive_created: 0,
          resolved: 0,
          deleted: 0,
          skippedThrottle: false,
          skippedPlan: false,
          skippedNoSmartUser: false,
          error: scoredBatch.error || "Scoring failed",
        }
      }
      for (const s of scoredBatch.data) {
        const { error: upErr } = await admin
          .from("notifications")
          .update({
            ai_priority: s.priority,
            ai_cluster_id: s.clusterId,
            ai_reasoning: s.reasoning,
            ai_suppressed: s.suppress,
            ai_processed_at: new Date().toISOString(),
          })
          .eq("id", s.notificationId)
          .eq("company_id", companyId)
        if (!upErr) scored += 1
      }
    }
  }

  const proactive = await generateProactiveAlerts({ companyId })
  let proactive_created = 0
  if (!proactive.error && proactive.data) {
    for (const alert of proactive.data) {
      const ins = await insertProactiveIfNew(admin, companyId, alert)
      if (ins === "created") proactive_created += 1
    }
  }

  const resolved = await resolveProactiveAlertsForCompany(admin, companyId)
  const deleted = await deleteOldResolvedProactiveNotifications(admin, companyId)

  await touchCronState(admin, companyId)

  return {
    scored,
    proactive_created,
    resolved,
    deleted,
    skippedThrottle: false,
    skippedPlan: false,
    skippedNoSmartUser: false,
    error: proactive.error,
  }
}
