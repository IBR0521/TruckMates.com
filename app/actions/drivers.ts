"use server"

import * as Sentry from "@sentry/nextjs"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { cache, cacheKeys } from "@/lib/cache"
import { validateDriverData, sanitizeString, sanitizeEmail, sanitizePhone } from "@/lib/validation"
import { checkViewPermission, checkCreatePermission, checkEditPermission, checkDeletePermission } from "@/lib/server-permissions"
import { mapLegacyRole } from "@/lib/roles"
import { requireActiveSubscriptionForWrite } from "@/lib/subscription-access"
import { capturePostHogServerEvent } from "@/lib/analytics/posthog-server"
import {
  collapseDuplicateDriversByEmail,
  purgeAllDriversKeepOneForCompany,
} from "@/lib/drivers/collapse-duplicate-driver-rows"

function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}

function toNormalizedPhone(raw: string | null | undefined): string | null {
  const value = String(raw || "").trim()
  if (!value) return null
  if (value.startsWith("+")) return value.replace(/\s/g, "")
  const digits = value.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return digits ? `+${digits}` : null
}

const DRIVER_LIST_SELECT =
  "id, name, email, phone, status, license_number, license_expiry, truck_id, terminal_id, created_at"

function invalidateDriverDashboardCaches(companyId: string) {
  cache.delete(cacheKeys.dashboardStats(companyId))
}

/**
 * Emergency: merge the entire driver table for this company down to **one** row
 * (prefers a row with `user_id` set), repointing FKs first. Typed confirmation required.
 */
export async function emergencyPurgeDriversKeepOne(confirmPhrase: string) {
  try {
    const expected = "CONFIRM PURGE KEEP ONE DRIVER"
    if ((confirmPhrase || "").trim() !== expected) {
      return { error: `Type exactly: ${expected}`, deleted: 0, keptId: null as string | null }
    }

    const permission = await checkDeletePermission("drivers")
    if (!permission.allowed) {
      return { error: permission.error || "You don't have permission to delete drivers", deleted: 0, keptId: null }
    }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", deleted: 0, keptId: null }
    }

    const { createAdminClient } = await import("@/lib/supabase/admin")
    const admin = createAdminClient()

    const { keptId, deleted } = await purgeAllDriversKeepOneForCompany(admin, ctx.companyId)

    invalidateDriverDashboardCaches(ctx.companyId)
    revalidatePath("/dashboard/drivers")
    revalidatePath("/dashboard")

    return { error: null, deleted, keptId }
  } catch (e: unknown) {
    Sentry.captureException(e)
    return {
      error: errorMessage(e, "Purge failed"),
      deleted: 0,
      keptId: null as string | null,
    }
  }
}

export async function getDrivers(filters?: {
  status?: string
  search?: string
  terminal_id?: string
  sortBy?: "name" | "status" | "license_expiry" | "created_at"
  limit?: number
  offset?: number
}) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // Check permission
    const permission = await checkViewPermission("drivers")
    if (!permission.allowed) {
      return { error: permission.error || "You don't have permission to view drivers", data: null, count: 0 }
    }

    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null, count: 0 }
    }

    // Reconcile: ensure that any user whose role is 'driver' also has a row in `public.drivers`
    // so the Drivers list stays in sync (Drivers list is driven by `public.drivers` only).
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin")
      const admin = createAdminClient()

      // Fetch all users for the company and normalize role in JS.
      // This avoids any SQL/syntax quirks with case-insensitive filters.
      const { data: companyUsers } = await admin
        .from("users")
        .select("id, email, full_name, phone, role")
        .eq("company_id", ctx.companyId)

      const { data: existingDrivers } = await admin
        .from("drivers")
        .select("user_id, email")
        .eq("company_id", ctx.companyId)

      // Never treat String(null) as a real id — that was causing a new insert on every page load
      // when duplicate rows had user_id null (Set contained the literal "null", not the auth UUID).
      const existingByUserId = new Set(
        (existingDrivers || [])
          .filter((d: { user_id?: string | null }) => d.user_id != null && String(d.user_id).length > 0)
          .map((d: { user_id: string }) => String(d.user_id))
      )
      const existingByEmail = new Set(
        (existingDrivers || [])
          .map((d: { email?: string | null }) => (d.email || "").toLowerCase().trim())
          .filter(Boolean)
      )

      // Link orphan rows (user_id null, same email) to the auth user — avoids another duplicate insert.
      for (const u of companyUsers || []) {
        if (!u?.id) continue
        if (mapLegacyRole(String(u.role ?? "").trim()) !== "driver") continue
        if (existingByUserId.has(String(u.id))) continue
        const emailLower = (u.email || "").toLowerCase().trim()
        if (!emailLower) continue
        if (!existingByEmail.has(emailLower)) continue
        const { data: orphan } = await admin
          .from("drivers")
          .select("id")
          .eq("company_id", ctx.companyId)
          .eq("email", emailLower)
          .is("user_id", null)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
        if (orphan?.id) {
          await admin
            .from("drivers")
            .update({ user_id: String(u.id), updated_at: new Date().toISOString() })
            .eq("id", orphan.id)
          existingByUserId.add(String(u.id))
        }
      }

      const missing = (companyUsers || [])
        .filter((u: any) => {
          if (!u?.id) return false
          const normalizedRole = mapLegacyRole(String(u?.role ?? "").trim())
          if (normalizedRole !== "driver") return false
          const uid = String(u.id)
          if (existingByUserId.has(uid)) return false
          const emailLower = (u.email || "").toLowerCase().trim()
          if (emailLower && existingByEmail.has(emailLower)) return false
          return true
        })
        .map((u: any) => {
          const emailLower = (u.email || "").toLowerCase().trim()
          const name =
            (u.full_name || "").toString().trim() ||
            (emailLower ? emailLower.split("@")[0] : "") ||
            "Driver"

          return {
            user_id: String(u.id),
            company_id: ctx.companyId,
            name,
            email: emailLower || null,
            phone: u.phone || null,
            status: "active",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        })

      if (missing.length > 0) {
        await admin.from("drivers").insert(missing)
      }

      // Merge existing duplicate rows (same email) so the Drivers UI and HOS are not repeated.
      const { data: emailRows } = await admin.from("drivers").select("email").eq("company_id", ctx.companyId)
      const emailDupCounts = new Map<string, number>()
      for (const d of emailRows || []) {
        const em = (d.email || "").toLowerCase().trim()
        if (!em) continue
        emailDupCounts.set(em, (emailDupCounts.get(em) || 0) + 1)
      }
      if ([...emailDupCounts.values()].some((c) => c > 1)) {
        await collapseDuplicateDriversByEmail(admin, ctx.companyId)
        invalidateDriverDashboardCaches(ctx.companyId)
        revalidatePath("/dashboard")
      }
    } catch (e: unknown) {
      // Do not fail the Drivers list if reconciliation fails.
      Sentry.captureException(e)
    }

    // Build query with selective columns and pagination
    let query = supabase
      .from("drivers")
      .select(DRIVER_LIST_SELECT, { count: "exact" })
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })

    // Apply filters
    if (filters?.status) {
      query = query.eq("status", filters.status)
    }
    if (filters?.terminal_id) {
      query = query.eq("terminal_id", filters.terminal_id)
    }

    if (filters?.search) {
      const q = sanitizeString(filters.search).trim()
      if (q.length > 0) {
        query = query.or(
          `name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,license_number.ilike.%${q}%`
        )
      }
    }

    if (filters?.sortBy === "name") {
      query = query.order("name", { ascending: true })
    } else if (filters?.sortBy === "status") {
      query = query.order("status", { ascending: true })
    } else if (filters?.sortBy === "license_expiry") {
      query = query.order("license_expiry", { ascending: true, nullsFirst: false })
    }

    // Apply pagination (default limit 25 for faster initial loads, max 100)
    const limit = Math.min(filters?.limit || 25, 100)
    const offset = filters?.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data: drivers, error, count } = await query

    if (error) {
      return { error: safeDbError(error), data: null, count: 0 }
    }

    return { data: drivers || [], error: null, count: count || 0 }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "An unexpected error occurred"
    return { error: message, data: null, count: 0 }
  }
}

export async function getDriver(id: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // SECURITY FIX: Use explicit column selection instead of select("*")
    const { data: driver, error } = await supabase
      .from("drivers")
      .select(`
        id,
        company_id,
        name,
        email,
        phone,
        status,
        license_number,
        license_expiry,
        license_state,
        license_type,
        license_endorsements,
        driver_id,
        employee_type,
        address,
        city,
        state,
        zip,
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relationship,
        date_of_birth,
        hire_date,
        pay_rate_type,
        pay_rate,
        notes,
        custom_fields,
        truck_id,
        created_at,
        updated_at
      `)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    if (!driver) {
      return { error: "Driver not found", data: null }
    }

    // Fetch truck data separately if truck_id exists (since there's no FK relationship)
    if (driver.truck_id) {
      const { data: truck } = await supabase
        .from("trucks")
        .select("id, truck_number, make, model")
        .eq("id", driver.truck_id)
        .eq("company_id", ctx.companyId)
        .maybeSingle()
      
      // Add truck data to driver object
      if (truck) {
        (driver as any).truck = truck
      }
    }

    return { data: driver, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "An unexpected error occurred"
    return { error: message, data: null }
  }
}

export async function createDriver(formData: {
  name: string
  email: string
  phone: string
  license_number: string
  license_expiry?: string | null
  status?: string
  truck_id?: string | null
  terminal_id?: string | null
  [key: string]: any // Allow additional fields
}) {
  // Check permission
  const permission = await checkCreatePermission("drivers")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to create drivers", data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const subscriptionAccess = await requireActiveSubscriptionForWrite()
  if (!subscriptionAccess.allowed) {
    return { error: subscriptionAccess.error || "Subscription inactive", data: null }
  }

  // BUG-061 FIX: Check subscription plan limits before creating driver
  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select(`
      plan_id,
      subscription_plans!inner(max_drivers)
    `)
    .eq("company_id", ctx.companyId)
    .in("status", ["active", "trialing"])
    .maybeSingle()

  if (subscriptionError) {
    return { error: subscriptionError.message, data: null }
  }

  if (subscription?.subscription_plans?.max_drivers) {
    // Count current active drivers
    const { count: currentDriverCount } = await supabase
      .from("drivers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", ctx.companyId)
      .eq("status", "active")

    if (currentDriverCount !== null && currentDriverCount >= subscription.subscription_plans.max_drivers) {
      return {
        error: `Driver limit reached. Your plan allows ${subscription.subscription_plans.max_drivers} drivers. Please upgrade your subscription to add more drivers.`,
        data: null,
        upgrade: {
          required: true,
          feature: "drivers_limit",
        },
      }
    }
  }

  // Professional validation
  const driverValidation = validateDriverData({
    name: formData.name,
    email: formData.email,
    phone: formData.phone,
    license_number: formData.license_number,
    license_expiry: formData.license_expiry || undefined,
  })

  if (!driverValidation.valid) {
    return { error: driverValidation.errors.join("; "), data: null }
  }

  // BUG-023 FIX: Only validate license expiry date on creation when status is "active"
  // Allow expired licenses for inactive drivers or when editing existing drivers
  if (formData.license_expiry && (formData.status === "active" || !formData.status)) {
    const expiryDate = new Date(formData.license_expiry)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (expiryDate < today) {
      return { 
        error: "Cannot create an active driver with an expired license. Please set status to 'inactive' or update the license expiry date.", 
        data: null 
      }
    }
  }

  // ERROR HANDLING FIX: Use maybeSingle() when checking for duplicates (might not exist)
  // Check for duplicate email if provided
  if (formData.email) {
    const { data: existingDriver, error: emailCheckError } = await supabase
      .from("drivers")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("email", sanitizeEmail(formData.email))
      .maybeSingle()

    // Only treat as error if it's not a "not found" case
    if (emailCheckError && emailCheckError.code !== "PGRST116") {
      return { error: emailCheckError.message || "Failed to check for duplicate email", data: null }
    }

    if (existingDriver) {
      return { error: "Driver with this email already exists", data: null }
    }
  }

  // ERROR HANDLING FIX: Use maybeSingle() when checking for duplicates (might not exist)
  // Check for duplicate license number if provided
  if (formData.license_number) {
    const { data: existingLicense, error: licenseCheckError } = await supabase
      .from("drivers")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("license_number", sanitizeString(formData.license_number, 20).toUpperCase())
      .maybeSingle()

    // Only treat as error if it's not a "not found" case
    if (licenseCheckError && licenseCheckError.code !== "PGRST116") {
      return { error: licenseCheckError.message || "Failed to check for duplicate license", data: null }
    }

    if (existingLicense) {
      return { error: "Driver with this license number already exists", data: null }
    }
  }

  // Validate truck assignment if provided
  if (formData.truck_id) {
    // ERROR HANDLING FIX: Use maybeSingle() when checking if record exists (might not exist)
    const { data: truck, error: truckError } = await supabase
      .from("trucks")
      .select("id, status, company_id, current_driver_id")
      .eq("id", formData.truck_id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (truckError) {
      return { error: truckError.message || "Failed to validate truck", data: null }
    }

    if (!truck) {
      return { error: "Invalid truck selected", data: null }
    }

    if (truck.current_driver_id) {
      return { error: "Truck is already assigned to another driver", data: null }
    }
  }

  // Build insert data with professional sanitization
  // Include all extended fields from the drivers table schema
  const driverData: any = {
    company_id: ctx.companyId,
    name: sanitizeString(formData.name, 100),
    status: formData.status || "active",
  }
  if (formData.terminal_id) driverData.terminal_id = formData.terminal_id

  // Add optional fields with validation and sanitization
  if (formData.email) driverData.email = sanitizeEmail(formData.email)
  if (formData.phone) driverData.phone = sanitizePhone(formData.phone)
  if (formData.phone) driverData.normalized_phone = toNormalizedPhone(sanitizePhone(formData.phone))
  if (formData.license_number) driverData.license_number = sanitizeString(formData.license_number, 20).toUpperCase()
  if (formData.license_expiry) driverData.license_expiry = formData.license_expiry
  if (formData.truck_id) driverData.truck_id = formData.truck_id
  
  // Extended fields
  if (formData.driver_id) driverData.driver_id = sanitizeString(formData.driver_id, 50)
  if (formData.employee_type) driverData.employee_type = formData.employee_type
  if (formData.date_of_birth) driverData.date_of_birth = formData.date_of_birth
  if (formData.address) driverData.address = sanitizeString(formData.address, 200)
  if (formData.city) driverData.city = sanitizeString(formData.city, 100)
  if (formData.state) driverData.state = sanitizeString(formData.state, 2).toUpperCase()
  if (formData.zip) driverData.zip = sanitizeString(formData.zip, 10)
  if (formData.license_state) driverData.license_state = sanitizeString(formData.license_state, 2).toUpperCase()
  if (formData.license_type) driverData.license_type = formData.license_type
  if (formData.license_endorsements) driverData.license_endorsements = sanitizeString(formData.license_endorsements, 200)
  if (formData.hire_date) driverData.hire_date = formData.hire_date
  if (formData.pay_rate_type) driverData.pay_rate_type = formData.pay_rate_type
  if (formData.pay_rate !== undefined && formData.pay_rate !== null) driverData.pay_rate = Number.parseFloat(String(formData.pay_rate))
  if (formData.emergency_contact_name) driverData.emergency_contact_name = sanitizeString(formData.emergency_contact_name, 100)
  if (formData.emergency_contact_phone) driverData.emergency_contact_phone = sanitizePhone(formData.emergency_contact_phone)
  if (formData.emergency_contact_relationship) driverData.emergency_contact_relationship = sanitizeString(formData.emergency_contact_relationship, 50)
  if (formData.notes) driverData.notes = sanitizeString(formData.notes, 1000)
  if (formData.custom_fields && typeof formData.custom_fields === "object" && !Array.isArray(formData.custom_fields)) {
    driverData.custom_fields = formData.custom_fields
  }

  const DRIVER_RETURNING_SELECT = `
      id,
      company_id,
      name,
      email,
      phone,
      status,
      license_number,
      license_expiry,
      license_state,
      license_type,
      license_endorsements,
      driver_id,
      employee_type,
      address,
      city,
      state,
      zip,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relationship,
      date_of_birth,
      hire_date,
      pay_rate_type,
      pay_rate,
      notes,
      custom_fields,
      truck_id,
      created_at,
      updated_at
    `

  // Use user-scoped client first (respects RLS), then fallback to admin client when
  // policy wiring is inconsistent but app-level permission checks already passed.
  let { data, error } = await supabase
    .from("drivers")
    .insert(driverData)
    .select(DRIVER_RETURNING_SELECT)
    .single()

  const rlsInsertBlocked =
    !!error &&
    (String((error as { code?: string }).code || "") === "42501" ||
      String(error.message || "").toLowerCase().includes("row-level security"))

  if (rlsInsertBlocked) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin")
      const admin = createAdminClient()
      const adminInsert = await admin
        .from("drivers")
        .insert(driverData)
        .select(DRIVER_RETURNING_SELECT)
        .single()
      data = adminInsert.data
      error = adminInsert.error as typeof error
    } catch (adminError: unknown) {
      Sentry.captureException(adminError)
      return { error: "Driver creation failed due to permissions configuration.", data: null }
    }
  }

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  await capturePostHogServerEvent(ctx.userId || `company:${ctx.companyId}`, "driver_added", {
    company_id: ctx.companyId,
    user_id: ctx.userId || null,
    driver_id: data?.id || null,
    driver_name: data?.name || null,
  })

  revalidatePath("/dashboard/drivers")
  return { data, error: null }
}

export async function updateDriver(
  id: string,
  formData: {
    name?: string
    email?: string
    phone?: string
    license_number?: string
    license_expiry?: string | null
    status?: string
    truck_id?: string | null
    [key: string]: any
  }
) {
  // Check permission
  const permission = await checkEditPermission("drivers")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to edit drivers", data: null }
  }

  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const subscriptionAccess = await requireActiveSubscriptionForWrite()
  if (!subscriptionAccess.allowed) {
    return { error: subscriptionAccess.error || "Subscription inactive", data: null }
  }

  // ERROR HANDLING FIX: Use maybeSingle() when checking if record exists (might not exist)
  // SECURITY FIX: Use explicit column selection instead of select("*")
  // Get current driver data for audit trail (with company_id verification)
  const { data: currentDriver, error: fetchError } = await supabase
    .from("drivers")
    .select(`
      id,
      company_id,
      name,
      email,
      phone,
      status,
      license_number,
      license_expiry,
      license_state,
      license_type,
      license_endorsements,
      driver_id,
      employee_type,
      address,
      city,
      state,
      zip,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relationship,
      date_of_birth,
      hire_date,
      pay_rate_type,
      pay_rate,
      notes,
      custom_fields,
      truck_id,
      created_at,
      updated_at
    `)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (fetchError) {
    return { error: fetchError.message || "Failed to fetch driver", data: null }
  }

  if (!currentDriver) {
    return { error: "Driver not found", data: null }
  }

  // Build update data, only including fields that are provided
  // Include all extended fields from the drivers table schema
  const updateData: any = {}
  const changes: Array<{ field: string; old_value: any; new_value: any }> = []
  
  // Helper function to check and update field
  const updateField = (field: string, newValue: any, oldValue: any = null) => {
    const currentValue = oldValue !== null ? oldValue : (currentDriver[field] ?? null)
    if (newValue !== undefined && newValue !== currentValue) {
      updateData[field] = newValue === "" ? null : newValue
      changes.push({ field, old_value: currentValue, new_value: newValue })
    }
  }
  
  // Basic fields
  updateField("name", formData.name)
  updateField("email", formData.email)
  updateField("phone", formData.phone)
  updateField("license_number", formData.license_number)
  updateField("license_expiry", formData.license_expiry || null)
  updateField("status", formData.status)
  updateField("truck_id", formData.truck_id || null)
  
  // Extended fields
  updateField("driver_id", formData.driver_id)
  updateField("employee_type", formData.employee_type)
  updateField("date_of_birth", formData.date_of_birth)
  updateField("address", formData.address)
  updateField("city", formData.city)
  updateField("state", formData.state)
  updateField("zip", formData.zip)
  updateField("license_state", formData.license_state)
  updateField("license_type", formData.license_type)
  updateField("license_endorsements", formData.license_endorsements)
  updateField("hire_date", formData.hire_date)
  updateField("pay_rate_type", formData.pay_rate_type)
  if (formData.pay_rate !== undefined) {
    updateField("pay_rate", formData.pay_rate ? Number.parseFloat(String(formData.pay_rate)) : null)
  }
  updateField("emergency_contact_name", formData.emergency_contact_name)
  updateField("emergency_contact_phone", formData.emergency_contact_phone)
  updateField("emergency_contact_relationship", formData.emergency_contact_relationship)
  updateField("notes", formData.notes)
  
  // Sanitize string fields
  if (updateData.name) updateData.name = sanitizeString(updateData.name, 100)
  if (updateData.email) updateData.email = sanitizeEmail(updateData.email)
  if (updateData.phone) updateData.phone = sanitizePhone(updateData.phone)
  if (updateData.phone) updateData.normalized_phone = toNormalizedPhone(updateData.phone)
  if (updateData.license_number) updateData.license_number = sanitizeString(updateData.license_number, 20).toUpperCase()
  if (updateData.driver_id) updateData.driver_id = sanitizeString(updateData.driver_id, 50)
  if (updateData.address) updateData.address = sanitizeString(updateData.address, 200)
  if (updateData.city) updateData.city = sanitizeString(updateData.city, 100)
  if (updateData.state) updateData.state = sanitizeString(updateData.state, 2).toUpperCase()
  if (updateData.zip) updateData.zip = sanitizeString(updateData.zip, 10)
  if (updateData.license_state) updateData.license_state = sanitizeString(updateData.license_state, 2).toUpperCase()
  if (updateData.license_endorsements) updateData.license_endorsements = sanitizeString(updateData.license_endorsements, 200)
  if (updateData.emergency_contact_name) updateData.emergency_contact_name = sanitizeString(updateData.emergency_contact_name, 100)
  if (updateData.emergency_contact_phone) updateData.emergency_contact_phone = sanitizePhone(updateData.emergency_contact_phone)
  if (updateData.emergency_contact_relationship) updateData.emergency_contact_relationship = sanitizeString(updateData.emergency_contact_relationship, 50)
  if (updateData.notes) updateData.notes = sanitizeString(updateData.notes, 1000)

  // If no changes, return early
  if (Object.keys(updateData).length === 0) {
    // CRITICAL FIX: Ensure currentDriver is JSON-serializable
    const serializableCurrentDriver = currentDriver ? JSON.parse(JSON.stringify(currentDriver, (key, value) => {
      if (value instanceof Date) return value.toISOString()
      if (typeof value === 'bigint') return value.toString()
      return value
    })) : null
    return { data: serializableCurrentDriver, error: null }
  }

  const { data, error } = await supabase
    .from("drivers")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .select(`
      id,
      company_id,
      name,
      email,
      phone,
      status,
      license_number,
      license_expiry,
      license_state,
      license_type,
      license_endorsements,
      driver_id,
      employee_type,
      address,
      city,
      state,
      zip,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relationship,
      date_of_birth,
      hire_date,
      pay_rate_type,
      pay_rate,
      notes,
      custom_fields,
      truck_id,
      created_at,
      updated_at
    `)
    .single()

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  // Fetch truck data separately if truck_id exists (since there's no FK relationship)
  if (data?.truck_id) {
    const { data: truck } = await supabase
      .from("trucks")
      .select("id, truck_number, make, model")
      .eq("id", data.truck_id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()
    
    // Add truck data to driver object
    if (truck) {
      (data as any).truck = truck
    }
  }

  // CRITICAL FIX: Ensure data is JSON-serializable for Next.js server actions
  // Convert Date objects and other non-serializable values to strings
  const serializableData = data ? JSON.parse(JSON.stringify(data, (key, value) => {
    // Convert Date objects to ISO strings
    if (value instanceof Date) {
      return value.toISOString()
    }
    // Handle other non-serializable types
    if (typeof value === 'bigint') {
      return value.toString()
    }
    return value
  })) : null

  // Create audit log entries for each change
  if (changes.length > 0) {
    try {
      const { createAuditLog } = await import("@/lib/audit-log")
      if (ctx.userId) {
        // Log each field change separately for better audit trail
        for (const change of changes) {
          try {
            await createAuditLog({
              action: change.field === "status" ? "status_updated" : "data.updated",
              resource_type: "driver",
              resource_id: id,
              details: {
                field: change.field,
                old_value: change.old_value,
                new_value: change.new_value,
              },
            })
            Sentry.captureMessage(`[updateDriver] Audit log created for field: ${change.field}`, "info")
          } catch (err: unknown) {
            Sentry.captureException(err)
            const msg = err instanceof Error ? errorMessage(err) : String(err)
            const code =
              err && typeof err === "object" && "code" in err
                ? String((err as { code?: unknown }).code)
                : ""
            if (code === "42P01" || msg.includes("relation") || msg.includes("does not exist")) {
              Sentry.captureMessage(
                "[updateDriver] audit_logs table may not exist. Run: supabase/audit_logs_schema.sql",
                "warning",
              )
            }
            if (code === "42501" || msg.includes("permission denied") || msg.includes("policy")) {
              Sentry.captureMessage(
                "[updateDriver] RLS may block audit log insert; update supabase/audit_logs_schema.sql INSERT policy",
                "warning",
              )
            }
          }
        }
      } else {
        Sentry.captureMessage("[updateDriver] No user found for audit logging", "warning")
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? errorMessage(err) : String(err)
      Sentry.captureMessage(`[updateDriver] Failed to import audit log module: ${msg}`, "error")
    }
  }

  revalidatePath("/dashboard/drivers")
  revalidatePath(`/dashboard/drivers/${id}`)

  return { data: serializableData, error: null }
}

export async function deleteDriver(id: string) {
  try {
    // Check permission
    const permission = await checkDeletePermission("drivers")
    if (!permission.allowed) {
      return { error: permission.error || "You don't have permission to delete drivers" }
    }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated" }
    }

    const subscriptionAccess = await requireActiveSubscriptionForWrite()
    if (!subscriptionAccess.allowed) {
      return { error: subscriptionAccess.error || "Subscription inactive" }
    }

    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!id || !uuidRegex.test(id)) {
      return { error: "Invalid driver ID format" }
    }

    const { createAdminClient } = await import("@/lib/supabase/admin")
    const admin = createAdminClient()

    const { data: driverRow } = await admin
      .from("drivers")
      .select("id")
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (!driverRow?.id) {
      return { error: "Driver not found" }
    }

    // BUG-024 FIX: Check for dependencies before deleting driver (admin: consistent with RLS)
    const { data: activeLoads } = await admin
      .from("loads")
      .select("id, shipment_number, status")
      .eq("driver_id", id)
      .eq("company_id", ctx.companyId)
      .in("status", ["assigned", "in_transit", "delivered", "pending"])

    if (activeLoads && activeLoads.length > 0) {
      const loadNumbers = activeLoads.map((l: { shipment_number: string }) => l.shipment_number).join(", ")
      return {
        error: `Cannot delete driver. Driver is assigned to ${activeLoads.length} active load(s): ${loadNumbers}. Please reassign or complete these loads first.`,
      }
    }

    const { data: openDVIRs } = await admin
      .from("dvir")
      .select("id, inspection_date")
      .eq("driver_id", id)
      .eq("company_id", ctx.companyId)
      .eq("status", "pending")

    if (openDVIRs && openDVIRs.length > 0) {
      return {
        error: `Cannot delete driver. Driver has ${openDVIRs.length} unsubmitted DVIR(s). Please submit or delete these DVIRs first.`,
      }
    }

    const { data: eldDevices } = await admin
      .from("eld_devices")
      .select("id, device_name")
      .eq("driver_id", id)
      .eq("company_id", ctx.companyId)

    if (eldDevices && eldDevices.length > 0) {
      const deviceNames = eldDevices.map((d: { device_name?: string; id: string }) => d.device_name || d.id).join(", ")
      return {
        error: `Cannot delete driver. Driver is mapped to ${eldDevices.length} ELD device(s): ${deviceNames}. Please unassign these devices first.`,
      }
    }

    const { error, count } = await admin
      .from("drivers")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("company_id", ctx.companyId)

    if (error) {
      return { error: safeDbError(error) }
    }
    if (count === 0) {
      return { error: "Could not delete driver" }
    }

    invalidateDriverDashboardCaches(ctx.companyId)
    revalidatePath("/dashboard/drivers")
    revalidatePath("/dashboard")
    return { error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "Failed to delete driver"
    return { error: message }
  }
}

// Bulk operations for workflow optimization
export async function bulkDeleteDrivers(ids: string[]) {
  const permission = await checkDeletePermission("drivers")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to delete drivers", data: null }
  }

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const subscriptionAccess = await requireActiveSubscriptionForWrite()
  if (!subscriptionAccess.allowed) {
    return { error: subscriptionAccess.error || "Subscription inactive", data: null }
  }

  if (!ids.length) {
    return { error: "No drivers selected", data: null }
  }

  const { createAdminClient } = await import("@/lib/supabase/admin")
  const admin = createAdminClient()

  const { data: owned } = await admin
    .from("drivers")
    .select("id")
    .in("id", ids)
    .eq("company_id", ctx.companyId)

  const validIds = (owned || []).map((r: { id: string }) => r.id)
  if (validIds.length === 0) {
    return { error: "No matching drivers found for your company", data: null }
  }

  const { data: activeLoads } = await admin
    .from("loads")
    .select("id, driver_id, shipment_number, status")
    .in("driver_id", validIds)
    .in("status", ["scheduled", "in_transit"])
    .eq("company_id", ctx.companyId)

  if (activeLoads && activeLoads.length > 0) {
    const blockedDriverIds = [
      ...new Set(
        activeLoads.map(
          (load: { driver_id: string | null }) => load.driver_id
        ).filter(Boolean) as string[]
      ),
    ]
    const { data: blockedDrivers } = await admin
      .from("drivers")
      .select("id, name")
      .in("id", blockedDriverIds)
      .eq("company_id", ctx.companyId)

    if (blockedDrivers && blockedDrivers.length > 0) {
      const driverNames = blockedDrivers.map((d: { name: string | null }) => d.name).join(", ")
      return {
        error: `Cannot delete drivers with active loads: ${driverNames}. Please reassign or complete their loads first.`,
        data: null,
      }
    }
  }

  const DELETE_CHUNK = 400
  for (let i = 0; i < validIds.length; i += DELETE_CHUNK) {
    const chunk = validIds.slice(i, i + DELETE_CHUNK)
    const { error } = await admin.from("drivers").delete().in("id", chunk).eq("company_id", ctx.companyId)
    if (error) {
      return { error: safeDbError(error), data: null }
    }
  }

  invalidateDriverDashboardCaches(ctx.companyId)
  revalidatePath("/dashboard/drivers")
  revalidatePath("/dashboard")
  return { data: { deleted: validIds.length }, error: null }
}

export async function bulkUpdateDriverStatus(ids: string[], status: string) {
  // Check permission
  const permission = await checkEditPermission("drivers")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to edit drivers", data: null }
  }

  // Validate status value
  const validStatuses = ["active", "inactive", "on_leave"]
  if (!validStatuses.includes(status)) {
    return { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`, data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const subscriptionAccess = await requireActiveSubscriptionForWrite()
  if (!subscriptionAccess.allowed) {
    return { error: subscriptionAccess.error || "Subscription inactive", data: null }
  }

  const { error } = await supabase
    .from("drivers")
    .update({ status })
    .in("id", ids)
    .eq("company_id", ctx.companyId)

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  revalidatePath("/dashboard/drivers")
  return { data: { updated: ids.length }, error: null }
}

