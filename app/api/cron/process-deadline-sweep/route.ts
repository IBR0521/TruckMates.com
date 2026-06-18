import { NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { logger } from "@/lib/logger"
import { acquireJobLock, releaseJobLock } from "@/lib/cron/job-lock"
import {
  clearDeadline,
  fetchDueDeadlines,
  resolveDeadline,
  upsertDeadline,
  type ScheduledDeadlineRow,
} from "@/lib/deadlines/scheduled-deadlines"
import {
  fetchDriverHosSnapshot,
  recomputeDriverHosDeadline,
} from "@/lib/deadlines/recompute-driver-hos-deadline"
import {
  isLoadStillDelayed,
  nextDetentionRecheckDeadline,
  syncLoadDeadlinesForLoad,
} from "@/lib/deadlines/sync-load-deadlines"
import {
  fireHosViolationAlertIfNeeded,
  hosSummaryHasActiveViolation,
} from "@/lib/hos/hos-violation-alert"
import {
  evaluateDetentionForLoadId,
  fireDetentionAlertIfNeeded,
} from "@/lib/detention/fire-detention-alert"
import { scanDeliveryDelaysForCompany } from "@/app/actions/delivery-delay-notify"
import {
  processDriverLateDeadline,
  processEmergencyEscalationDeadline,
  processMissedCheckCallDeadline,
} from "@/app/actions/dispatch-event-notify"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  DEADLINE_SWEEP_DEDUP,
  hasRecentDeadlineSweepNotification,
} from "@/lib/deadlines/deadline-sweep-dedup"

const JOB_NAME = "process-deadline-sweep"
const LOCK_SECONDS = 90
/** Matches notify dedupe window in dispatch-event-notify (12h). */
const DRIVER_LATE_RECHECK_MS = 12 * 60 * 60 * 1000

function logDeadlineSweep(
  outcome: "alert_fired" | "stale_no_alert" | "recheck_rescheduled" | "dedup_skipped",
  row: ScheduledDeadlineRow,
  extra?: Record<string, unknown>,
) {
  logger.warn("[deadline-sweep]", {
    outcome,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    deadline_reason: row.deadline_reason,
    stored_deadline_at: row.deadline_at,
    ...extra,
  })
}

async function processDriverHosDeadline(row: ScheduledDeadlineRow) {
  const admin = createAdminClient()
  const driverId = row.entity_id

  const { data: driver } = await admin
    .from("drivers")
    .select("id, company_id")
    .eq("id", driverId)
    .maybeSingle()

  if (!driver?.company_id) {
    await clearDeadline("driver_hos", driverId)
    return
  }

  const snapshot = await fetchDriverHosSnapshot(driverId, driver.company_id)
  const violated = hosSummaryHasActiveViolation(snapshot.summary) || snapshot.summary.needsBreak

  if (violated) {
    const deduped = await hasRecentDeadlineSweepNotification({
      companyId: driver.company_id,
      notificationTypes: [...DEADLINE_SWEEP_DEDUP.hos.notificationTypes],
      entityMetadataKeys: [...DEADLINE_SWEEP_DEDUP.hos.entityMetadataKeys],
      entityId: driverId,
    })
    if (deduped) {
      logDeadlineSweep("dedup_skipped", row, {
        company_id: driver.company_id,
        driver_id: driverId,
        violations: snapshot.summary.violations,
      })
    } else {
      const fired = await fireHosViolationAlertIfNeeded({
        companyId: driver.company_id,
        driverId,
        summary: snapshot.summary,
      })
      logDeadlineSweep(fired ? "alert_fired" : "stale_no_alert", row, {
        company_id: driver.company_id,
        violations: snapshot.summary.violations,
      })
    }
  } else {
    logDeadlineSweep("stale_no_alert", row, { company_id: driver.company_id })
  }

  await recomputeDriverHosDeadline(driverId)
}

async function processLoadDetentionDeadline(row: ScheduledDeadlineRow) {
  const loadId = row.entity_id
  const evaluated = await evaluateDetentionForLoadId(loadId)

  if (!evaluated?.evalResult) {
    await clearDeadline("load_detention", loadId)
    logDeadlineSweep("stale_no_alert", row, { reason: "no_dwell_or_load_gone" })
    return
  }

  const { load, evalResult } = evaluated

  if (!evalResult.active) {
    await clearDeadline("load_detention", loadId)
    logDeadlineSweep("stale_no_alert", row, { company_id: load.company_id })
    return
  }

  const deduped = await hasRecentDeadlineSweepNotification({
    companyId: load.company_id,
    notificationTypes: [...DEADLINE_SWEEP_DEDUP.detention.notificationTypes],
    entityMetadataKeys: [...DEADLINE_SWEEP_DEDUP.detention.entityMetadataKeys],
    entityId: loadId,
    metadataEvent: DEADLINE_SWEEP_DEDUP.detention.metadataEvent,
  })
  if (deduped) {
    logDeadlineSweep("dedup_skipped", row, {
      company_id: load.company_id,
      load_id: loadId,
      excess_minutes: evalResult.excessMinutes,
    })
  } else {
    const fired = await fireDetentionAlertIfNeeded({
      companyId: load.company_id,
      load,
      evalResult,
    })

    logDeadlineSweep(fired ? "alert_fired" : "stale_no_alert", row, {
      company_id: load.company_id,
      excess_minutes: evalResult.excessMinutes,
      escalation_tier: evalResult.escalationTier,
    })
  }

  // Detention accrues over time — keep checking on a short interval until dwell ends.
  await upsertDeadline("load_detention", loadId, nextDetentionRecheckDeadline(), row.deadline_reason)
  logDeadlineSweep("recheck_rescheduled", row, {
    company_id: load.company_id,
    next_check_minutes: 15,
  })
}

async function processLoadDeliveryDeadline(row: ScheduledDeadlineRow) {
  const loadId = row.entity_id
  const admin = createAdminClient()

  const { data: load } = await admin
    .from("loads")
    .select("id, company_id, status, estimated_delivery")
    .eq("id", loadId)
    .maybeSingle()

  if (!load) {
    await clearDeadline("load_delivery", loadId)
    return
  }

  const rowLoad = load as {
    id: string
    company_id: string
    status: string | null
    estimated_delivery: string | null
  }

  if (!isLoadStillDelayed(rowLoad.estimated_delivery, rowLoad.status)) {
    await resolveDeadline("load_delivery", loadId)
    logDeadlineSweep("stale_no_alert", row, { company_id: rowLoad.company_id })
    return
  }

  const deduped = await hasRecentDeadlineSweepNotification({
    companyId: rowLoad.company_id,
    notificationTypes: [...DEADLINE_SWEEP_DEDUP.delivery.notificationTypes],
    entityMetadataKeys: [...DEADLINE_SWEEP_DEDUP.delivery.entityMetadataKeys],
    entityId: loadId,
    metadataEvent: DEADLINE_SWEEP_DEDUP.delivery.metadataEvent,
  })

  if (deduped) {
    logDeadlineSweep("dedup_skipped", row, { company_id: rowLoad.company_id, load_id: loadId })
  } else {
    const result = await scanDeliveryDelaysForCompany(rowLoad.company_id)
    const notified = result.data?.notified ?? 0

    logDeadlineSweep(notified > 0 ? "alert_fired" : "stale_no_alert", row, {
      company_id: rowLoad.company_id,
      notified,
      load_id: loadId,
    })
  }

  await resolveDeadline("load_delivery", loadId)
}

async function processCheckCallMissedDeadline(row: ScheduledDeadlineRow) {
  const checkCallId = row.entity_id
  const result = await processMissedCheckCallDeadline(checkCallId)

  logDeadlineSweep(result.outcome, row, {
    notified: result.notified,
    marked: result.marked,
  })

  await resolveDeadline("check_call_missed", checkCallId)
}

async function processDriverLateDeadlineRow(row: ScheduledDeadlineRow) {
  const loadId = row.entity_id
  const result = await processDriverLateDeadline(loadId)

  logDeadlineSweep(result.outcome, row, {
    notified: result.notified,
    still_late: result.stillLate,
  })

  if (result.stillLate) {
    await upsertDeadline(
      "driver_late",
      loadId,
      new Date(Date.now() + DRIVER_LATE_RECHECK_MS),
      row.deadline_reason,
    )
    logDeadlineSweep("recheck_rescheduled", row, { recheck_hours: 12 })
  } else {
    await clearDeadline("driver_late", loadId)
  }
}

async function processEmergencyEscalationDeadlineRow(row: ScheduledDeadlineRow) {
  const checkCallId = row.entity_id
  const result = await processEmergencyEscalationDeadline(checkCallId)

  logDeadlineSweep(result.outcome, row, { notified: result.notified })

  await resolveDeadline("emergency_escalation", checkCallId)
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const vercelCronHeader = request.headers.get("x-vercel-cron")
  const cronSecret = process.env.CRON_SECRET
  const isAuthorizedBySecret = !!cronSecret && authHeader === `Bearer ${cronSecret}`
  const isAuthorizedByVercelCron = !!vercelCronHeader

  if (!isAuthorizedBySecret && !isAuthorizedByVercelCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const locked = await acquireJobLock(JOB_NAME, LOCK_SECONDS)
  if (!locked) {
    return NextResponse.json({ success: true, skipped: true, reason: "lock_held" })
  }

  let processed = 0
  let alerts = 0
  let stale = 0

  try {
    const due = await fetchDueDeadlines()

    for (const row of due) {
      processed += 1
      try {
        if (row.entity_type === "driver_hos") {
          await processDriverHosDeadline(row)
        } else if (row.entity_type === "load_detention") {
          await processLoadDetentionDeadline(row)
        } else if (row.entity_type === "load_delivery") {
          await processLoadDeliveryDeadline(row)
        } else if (row.entity_type === "check_call_missed") {
          await processCheckCallMissedDeadline(row)
        } else if (row.entity_type === "driver_late") {
          await processDriverLateDeadlineRow(row)
        } else if (row.entity_type === "emergency_escalation") {
          await processEmergencyEscalationDeadlineRow(row)
        }
      } catch (err: unknown) {
        logger.error("[deadline-sweep] row failed", err, {
          entity_type: row.entity_type,
          entity_id: row.entity_id,
        })
      }
    }

    return NextResponse.json({ success: true, processed, alerts, stale })
  } catch (error: unknown) {
    logger.error("[deadline-sweep] failed", error)
    return NextResponse.json(
      { success: false, error: errorMessage(error, "Deadline sweep failed") },
      { status: 500 },
    )
  } finally {
    await releaseJobLock(JOB_NAME)
  }
}
