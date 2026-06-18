import { createAdminClient } from "@/lib/supabase/admin"

/** Prefix for per-company geofence telemetry processing locks. */
export const GEOFENCE_PROCESSING_LOCK_PREFIX = "geofence-processing:" as const

export function geofenceProcessingLockKey(companyId: string): string {
  return `${GEOFENCE_PROCESSING_LOCK_PREFIX}${companyId}`
}

/**
 * Prevents overlapping runs for the same job or arbitrary lock key.
 * Uses `cron_job_locks` (service_role); lock auto-expires after `durationSeconds`.
 */
export async function acquireJobLock(
  jobName: string,
  durationSeconds: number,
): Promise<boolean> {
  const admin = createAdminClient()
  const now = new Date()
  const lockedUntil = new Date(now.getTime() + durationSeconds * 1000).toISOString()
  const nowIso = now.toISOString()

  const { data: existing } = await admin
    .from("cron_job_locks")
    .select("job_name, locked_until")
    .eq("job_name", jobName)
    .maybeSingle()

  if (existing?.locked_until && new Date(existing.locked_until).getTime() > now.getTime()) {
    return false
  }

  const { error } = await admin.from("cron_job_locks").upsert(
    {
      job_name: jobName,
      locked_until: lockedUntil,
      locked_at: nowIso,
    },
    { onConflict: "job_name" },
  )

  return !error
}

export async function releaseJobLock(jobName: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from("cron_job_locks").delete().eq("job_name", jobName)
}
