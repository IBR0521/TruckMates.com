import { createAdminClient } from "@/lib/supabase/admin"
import { hasFeatureAccess, normalizePlanTier, type PlanTier } from "@/lib/plan-limits"
import { scoreNotificationBatch, type NotificationToScore } from "@/lib/ai/notifications/scorer"
import { generateProactiveAlerts, type ProactiveAlert, OTD_DECLINE_REFIRE_COOLDOWN_DAYS } from "@/lib/ai/notifications/proactive"
import { computeOnTimeDeliveryByCustomer } from "@/lib/analytics/on-time-delivery"
import { executeToolForChat } from "@/lib/ai/tools/executor"
import { proactiveRecommendationForceConfirmation } from "@/lib/ai/briefing-staging"
import type { AppRole } from "@/lib/ai/tools/types"

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

/**
 * Inserts a proactive notification for the company (dedup-scoped via `ai_proactive_alerts`).
 * Returns "skipped" when an identical unresolved alert already exists. Reused by the
 * ai-proactive-insights cron so all proactive surfacing shares one notification path.
 */
export async function insertProactiveIfNew(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  alert: ProactiveAlert,
  ctx: { userId: string; userRole: AppRole; companyTier: PlanTier },
): Promise<"created" | "skipped" | "failed"> {
  // 1) Dedup check (must happen before any staging / recipient logic).
  const { data: open } = await admin
    .from("ai_proactive_alerts")
    .select("id")
    .eq("company_id", companyId)
    .eq("alert_type", alert.alert_type)
    .eq("alert_key", alert.alert_key)
    .eq("resolved", false)
    .maybeSingle()
  if (open?.id) return "skipped"

  // Rolling-window OTD metrics can re-cross threshold immediately after resolve; enforce cooldown.
  if (alert.alert_type === "customer_otd_decline") {
    const cutoff = new Date(Date.now() - OTD_DECLINE_REFIRE_COOLDOWN_DAYS * 86400000).toISOString()
    const { data: recentResolved } = await admin
      .from("ai_proactive_alerts")
      .select("id")
      .eq("company_id", companyId)
      .eq("alert_type", alert.alert_type)
      .eq("alert_key", alert.alert_key)
      .eq("resolved", true)
      .not("resolved_at", "is", null)
      .gte("resolved_at", cutoff)
      .limit(1)
      .maybeSingle()
    if (recentResolved?.id) return "skipped"
  }

  // 2) Recipient lookup (must succeed before any tool staging).
  const userId = await pickRecipientUserId(admin, companyId)
  if (!userId) return "failed"

  let recommendedAuditId: string | null = null
  let recommendedSummary: string | null = null
  let recommendedToolName: string | null = null
  let recommendedStatus: "pending_confirmation" | "auto_executed" | "executed" | "failed" | "blocked" | null = null

  // 3) Optional staging: never block notification creation if it fails.
  if (alert.recommendation && alert.recommendation.tool_name && alert.recommendation.tool_input) {
    try {
      const toolUseId = crypto.randomUUID()
      const conversationId = `proactive:${companyId}:${alert.alert_type}:${alert.alert_key}`
      const forceConfirmation = proactiveRecommendationForceConfirmation(
        alert.alert_type,
        alert.recommendation.tool_name,
      )

      const exec = await executeToolForChat({
        toolName: alert.recommendation.tool_name,
        toolInput: alert.recommendation.tool_input,
        toolUseId,
        conversationId,
        messageId: null,
        companyId,
        userId,
        userRole: ctx.userRole,
        companyTier: ctx.companyTier,
        forceConfirmation,
        destructiveSlotsRemaining: 3,
      })

      if (exec.auditId) {
        recommendedAuditId = exec.auditId
        recommendedSummary = alert.recommendation.summary
        recommendedToolName = alert.recommendation.tool_name
        recommendedStatus = exec.status
      }
    } catch (e: unknown) {
      // Use lightweight server-side logging; staging failure must not drop the underlying alert.
      console.error("[ai_proactive] Recommendation staging failed", {
        companyId,
        alert_type: alert.alert_type,
        alert_key: alert.alert_key,
        tool_name: alert.recommendation.tool_name,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  const title =
    recommendedStatus === "auto_executed"
      ? `AI already did: ${recommendedSummary || alert.title}`
      : recommendedStatus === "pending_confirmation"
        ? `AI recommends: ${recommendedSummary || alert.title}`
        : alert.title

  // 4) Notification insert last (uses staged audit id when available).
  const { data: notif, error: nErr } = await admin
    .from("notifications")
    .insert({
      user_id: userId,
      company_id: companyId,
      type: "info",
      title,
      message: alert.body,
      priority: mapAiPriorityToLegacy(alert.priority),
      metadata: {
        ...alert.details,
        ai_proactive: true,
        alert_type: alert.alert_type,
        ...(recommendedAuditId
          ? {
              recommended_action_audit_id: recommendedAuditId,
              recommended_action_summary: recommendedSummary,
              recommended_action_tool_name: recommendedToolName,
              recommended_action_status: recommendedStatus,
            }
          : {}),
      },
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

  const alertRow = {
    company_id: companyId,
    alert_type: alert.alert_type,
    alert_key: alert.alert_key,
    notification_id: notificationId,
    details: alert.details,
    resolved: false,
  }

  let { error: aErr } = await admin.from("ai_proactive_alerts").insert(alertRow)
  if (aErr) {
    ;({ error: aErr } = await admin.from("ai_proactive_alerts").insert(alertRow))
  }

  if (aErr) {
    // Keep the notification when staging produced an audit row — the alert insert failed
    // but the audit trail (and any auto-executed side effects) must remain reachable.
    if (!recommendedAuditId) {
      await admin.from("notifications").delete().eq("id", notificationId)
      return "failed"
    }
    console.error("[ai_proactive] ai_proactive_alerts insert failed after retry; notification kept without dedup row", {
      companyId,
      alert_type: alert.alert_type,
      alert_key: alert.alert_key,
      notification_id: notificationId,
      recommended_audit_id: recommendedAuditId,
      error: aErr.message,
    })
    return "created"
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

    if (row.alert_type === "customer_otd_decline") {
      const customerId = typeof details.customer_id === "string" ? details.customer_id : null
      if (customerId) {
        const end = new Date().toISOString().slice(0, 10)
        const start = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
        const { data: otd } = await computeOnTimeDeliveryByCustomer(admin, companyId, {
          start_date: start,
          end_date: `${end}T23:59:59.999Z`,
          customer_id: customerId,
        })
        const c = otd?.customers[0]
        if (!c || c.total_loads < 5) {
          shouldResolve = true
        } else {
          const lowOnTime = c.on_time_percentage < 80
          const chronicLateness = c.late_loads >= 3 && c.average_days_late >= 1
          if (!lowOnTime && !chronicLateness) shouldResolve = true
        }
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

  const throttled = await shouldThrottleCompany(admin, companyId)

  const smartUser = await companyHasSmartModeUser(admin, companyId)
  if (!smartUser) {
    await touchCronState(admin, companyId)
    return {
      scored: 0,
      proactive_created: 0,
      resolved: 0,
      deleted: 0,
      skippedThrottle: throttled,
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

  let proactive_created = 0
  let proactiveError: string | null = null
  if (!throttled) {
    const proactive = await generateProactiveAlerts({ companyId })
    proactiveError = proactive.error
    if (!proactive.error && proactive.data) {
      const recipientUserId = await pickRecipientUserId(admin, companyId)
      if (recipientUserId) {
        const companyTier = tierFromRow((company as { subscription_tier?: string } | null)?.subscription_tier)
        const insertCtx: { userId: string; userRole: AppRole; companyTier: PlanTier } = {
          userId: recipientUserId,
          userRole: "operations_manager",
          companyTier,
        }
      for (const alert of proactive.data) {
        const ins = await insertProactiveIfNew(admin, companyId, alert, insertCtx)
        if (ins === "created") proactive_created += 1
      }
      }
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
    skippedThrottle: throttled,
    skippedPlan: false,
    skippedNoSmartUser: false,
    error: proactiveError,
  }
}
