/**
 * Helpers for cron jobs that perform work across companies without a user session.
 * Uses the Supabase service-role client, which bypasses RLS — always scope by `company_id`
 * (or other explicit keys) when querying or mutating rows.
 */

import { createAdminClient } from "@/lib/supabase/admin"

export function getAdminClientForCron() {
  return createAdminClient()
}

export interface CronExecutionContext {
  startedAt: string
  cronName: string
}

export function createCronContext(cronName: string): CronExecutionContext {
  return {
    startedAt: new Date().toISOString(),
    cronName,
  }
}
