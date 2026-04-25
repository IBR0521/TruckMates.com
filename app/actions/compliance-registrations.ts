"use server"

import * as Sentry from "@sentry/nextjs"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import { errorMessage } from "@/lib/error-message"
import { checkCreatePermission, checkDeletePermission, checkEditPermission, checkViewPermission } from "@/lib/server-permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { sanitizeString } from "@/lib/validation"
import { sendNotification } from "./notifications"

export type ComplianceRegistrationType = "ucr" | "irp" | "mcs150" | "operating_authority"
export type ComplianceRegistrationStatus = "active" | "pending_renewal" | "expired" | "inactive"

const REGISTRATION_SELECT = `
  id, company_id, type, status, filed_date, expiry_date, state, notes, created_at, updated_at
`

export async function getComplianceRegistrations(filters?: {
  type?: ComplianceRegistrationType
  status?: ComplianceRegistrationStatus
  limit?: number
  offset?: number
}) {
  try {
    const permission = await checkViewPermission("ifta")
    if (!permission.allowed) return { error: permission.error || "Permission denied", data: null, count: 0 }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null, count: 0 }

    const supabase = await createClient()
    let query = supabase
      .from("compliance_registrations")
      .select(REGISTRATION_SELECT, { count: "exact" })
      .eq("company_id", ctx.companyId)
      .order("expiry_date", { ascending: true })

    if (filters?.type) query = query.eq("type", filters.type)
    if (filters?.status) query = query.eq("status", filters.status)

    const limit = Math.min(filters?.limit || 100, 500)
    const offset = filters?.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) return { error: "Failed to load compliance registrations", data: null, count: 0 }
    return { data: data || [], error: null, count: count || 0 }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load compliance registrations"), data: null, count: 0 }
  }
}

export async function createComplianceRegistration(formData: {
  type: ComplianceRegistrationType
  status?: ComplianceRegistrationStatus
  filed_date?: string
  expiry_date: string
  state?: string
  notes?: string
}) {
  try {
    const permission = await checkCreatePermission("ifta")
    if (!permission.allowed) return { error: permission.error || "Permission denied", data: null }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    if (!formData.type) return { error: "Registration type is required", data: null }
    if (!formData.expiry_date) return { error: "Expiry date is required", data: null }

    const supabase = await createClient()
    const payload = {
      company_id: ctx.companyId,
      type: formData.type,
      status: formData.status || "active",
      filed_date: formData.filed_date || null,
      expiry_date: formData.expiry_date,
      state: formData.state ? sanitizeString(formData.state, 32).toUpperCase() : null,
      notes: formData.notes ? sanitizeString(formData.notes, 1000) : null,
    }

    const { data, error } = await supabase.from("compliance_registrations").insert(payload).select(REGISTRATION_SELECT).single()
    if (error) return { error: "Failed to create compliance registration", data: null }

    revalidatePath("/dashboard/compliance")
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to create compliance registration"), data: null }
  }
}

export async function updateComplianceRegistration(
  id: string,
  formData: Partial<{
    type: ComplianceRegistrationType
    status: ComplianceRegistrationStatus
    filed_date: string
    expiry_date: string
    state: string
    notes: string
  }>,
) {
  try {
    const permission = await checkEditPermission("ifta")
    if (!permission.allowed) return { error: permission.error || "Permission denied", data: null }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const updateData: Record<string, unknown> = {}
    if (formData.type !== undefined) updateData.type = formData.type
    if (formData.status !== undefined) updateData.status = formData.status
    if (formData.filed_date !== undefined) updateData.filed_date = formData.filed_date || null
    if (formData.expiry_date !== undefined) updateData.expiry_date = formData.expiry_date
    if (formData.state !== undefined) updateData.state = formData.state ? sanitizeString(formData.state, 32).toUpperCase() : null
    if (formData.notes !== undefined) updateData.notes = formData.notes ? sanitizeString(formData.notes, 1000) : null

    if (Object.keys(updateData).length === 0) return { error: "No changes provided", data: null }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("compliance_registrations")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .select(REGISTRATION_SELECT)
      .single()

    if (error) return { error: "Failed to update compliance registration", data: null }
    revalidatePath("/dashboard/compliance")
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to update compliance registration"), data: null }
  }
}

export async function deleteComplianceRegistration(id: string) {
  try {
    const permission = await checkDeletePermission("ifta")
    if (!permission.allowed) return { error: permission.error || "Permission denied" }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated" }

    const supabase = await createClient()
    const { error } = await supabase.from("compliance_registrations").delete().eq("id", id).eq("company_id", ctx.companyId)
    if (error) return { error: "Failed to delete compliance registration" }

    revalidatePath("/dashboard/compliance")
    return { error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to delete compliance registration") }
  }
}

function registrationEventType(type: ComplianceRegistrationType): string {
  switch (type) {
    case "ucr":
      return "ucr_expiry"
    case "irp":
      return "irp_expiry"
    case "mcs150":
      return "mcs150_expiry"
    case "operating_authority":
      return "operating_authority_expiry"
  }
}

export async function processComplianceRegistrationExpiryAlerts() {
  try {
    const admin = createAdminClient()
    const { data: registrations, error } = await admin
      .from("compliance_registrations")
      .select(REGISTRATION_SELECT)
      .in("status", ["active", "pending_renewal"])
      .not("expiry_date", "is", null)
      .limit(10000)

    if (error) return { error: "Failed to load compliance registrations", data: null }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = today.toISOString()

    let alertsCreated = 0
    for (const reg of registrations || []) {
      const expiry = new Date(reg.expiry_date)
      if (Number.isNaN(expiry.getTime())) continue
      expiry.setHours(0, 0, 0, 0)

      const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (![60, 30, 7].includes(daysUntilExpiry)) continue

      const eventType = registrationEventType(reg.type as ComplianceRegistrationType)
      const { data: exists } = await admin
        .from("alerts")
        .select("id")
        .eq("company_id", reg.company_id)
        .eq("event_type", eventType)
        .contains("metadata", { registration_id: reg.id, days_until_expiry: daysUntilExpiry })
        .gte("created_at", todayIso)
        .limit(1)

      if (exists && exists.length > 0) continue

      const title = `${String(reg.type).toUpperCase()} renewal due in ${daysUntilExpiry} days`
      const message = `${String(reg.type).toUpperCase()} registration expires on ${reg.expiry_date}.`
      const priority = daysUntilExpiry <= 7 ? "high" : "normal"

      const { data: insertedAlert, error: insertError } = await admin
        .from("alerts")
        .insert({
          company_id: reg.company_id,
          title,
          message,
          event_type: eventType,
          priority,
          status: "active",
          metadata: {
            registration_id: reg.id,
            registration_type: reg.type,
            days_until_expiry: daysUntilExpiry,
            expiry_date: reg.expiry_date,
            state: reg.state || null,
          },
        })
        .select("id")
        .single()

      if (insertError || !insertedAlert) continue
      alertsCreated += 1

      const { data: users } = await admin
        .from("users")
        .select("id, role")
        .eq("company_id", reg.company_id)
        .in("role", ["super_admin", "operations_manager", "owner", "admin", "manager", "safety_compliance"])

      for (const user of users || []) {
        await sendNotification(user.id, "reminder_due", {
          title,
          message,
          reminder_type: "registration_expiry",
          due_date: reg.expiry_date,
          registration_type: reg.type,
          days_until_expiry: daysUntilExpiry,
        }).catch(() => {})
      }
    }

    return { data: { alerts_created: alertsCreated }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to process compliance expiry alerts"), data: null }
  }
}

