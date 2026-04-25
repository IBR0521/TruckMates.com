"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { getUserRole } from "@/lib/server-permissions"
import type { EmployeeRole } from "@/lib/roles"
import { revalidatePath } from "next/cache"
import * as Sentry from "@sentry/nextjs"
import { sanitizeError } from "@/lib/error-message"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


const MANAGER_ROLES: readonly EmployeeRole[] = ["super_admin", "operations_manager"]

/** Matches `public.driver_onboarding` in supabase/driver_onboarding_schema.sql */
const DRIVER_ONBOARDING_SELECT = `
  id, driver_id, company_id, status, current_step, total_steps, completion_percentage,
  started_at, completed_at, estimated_completion_date,
  documents_required, documents_completed, documents_missing,
  license_uploaded, medical_card_uploaded, insurance_uploaded, w9_uploaded, i9_uploaded,
  background_check_completed, drug_test_completed,
  orientation_completed, orientation_date, training_completed, training_modules,
  notes, onboarding_notes, rejection_reason,
  assigned_to_user_id, assigned_at, created_at, updated_at
`

/**
 * Initialize driver onboarding when driver is created
 */
export async function initializeDriverOnboarding(driverId: string) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const role = await getUserRole()
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { data: null, error: "Only managers can initialize driver onboarding" }
  }

  // Get driver info
  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .select("id")
    .eq("id", driverId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (driverError) {
    return { data: null, error: driverError.message }
  }

  if (!driver) {
    return { data: null, error: "Driver not found" }
  }

  // Define required documents based on driver type
  const requiredDocuments = [
    "license",
    "medical_card",
    "insurance",
    "w9",
    "i9",
  ]

  // MEDIUM FIX 14: Check for existing onboarding record before inserting
  const { data: existing } = await supabase
    .from("driver_onboarding")
    .select("id")
    .eq("driver_id", driverId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (existing) {
    return { data: existing, error: null } // Return existing record
  }

  // Create onboarding record
  const { data, error } = await supabase
    .from("driver_onboarding")
    .insert({
      driver_id: driverId,
      company_id: ctx.companyId,
      status: "in_progress",
      current_step: 1,
      total_steps: 5,
      completion_percentage: 0,
      started_at: new Date().toISOString(),
      documents_required: requiredDocuments,
      documents_completed: [],
      documents_missing: requiredDocuments,
      assigned_to_user_id: ctx.userId ?? null,
      assigned_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    Sentry.captureException(error)
    return { data: null, error: safeDbError(error) }
  }

  revalidatePath("/dashboard/drivers")
  return { data, error: null }
}

/**
 * Get driver onboarding status
 */
export async function getDriverOnboarding(driverId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const role = await getUserRole()
  const isManager = role && MANAGER_ROLES.includes(role)
  if (!isManager) {
    const { data: driver } = await supabase
      .from("drivers")
      .select("id, user_id")
      .eq("id", driverId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (!driver || driver.user_id !== ctx.userId) {
      return { data: null, error: "You can only view your own onboarding status" }
    }
  }

  const { data, error } = await supabase
    .from("driver_onboarding")
    .select(`
      ${DRIVER_ONBOARDING_SELECT},
      driver:driver_id(id, name, email, phone),
      assigned_to:assigned_to_user_id(id, full_name, email)
    `)
    .eq("driver_id", driverId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (error) {
    Sentry.captureException(error)
    return { data: null, error: safeDbError(error) }
  }

  if (!data) {
    // No onboarding record exists, return null
    return { data: null, error: null }
  }

  return { data, error: null }
}

/**
 * Update onboarding step
 */
export async function updateOnboardingStep(driverId: string, step: number) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const role = await getUserRole()
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { data: null, error: "Only managers can update onboarding steps" }
  }

  // MEDIUM FIX 13: Validate step bounds
  const totalSteps = 5
  if (step < 1 || step > totalSteps) {
    return { data: null, error: `Step must be between 1 and ${totalSteps}` }
  }

  // Calculate completion percentage and clamp to [0, 100]
  const completionPercentage = Math.max(0, Math.min(100, Math.round((step / totalSteps) * 100)))

  const { data, error } = await supabase
    .from("driver_onboarding")
    .update({
      current_step: step,
      completion_percentage: completionPercentage,
      updated_at: new Date().toISOString(),
    })
    .eq("driver_id", driverId)
    .eq("company_id", ctx.companyId)
    .select()
    .single()

  if (error) {
    Sentry.captureException(error)
    return { data: null, error: safeDbError(error) }
  }

  revalidatePath("/dashboard/drivers")
  return { data, error: null }
}

/**
 * Mark document as uploaded
 */
export async function markDocumentUploaded(driverId: string, documentType: string, documentId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const role = await getUserRole()
  const isManager = role && MANAGER_ROLES.includes(role)
  if (!isManager) {
    const { data: driver } = await supabase
      .from("drivers")
      .select("id, user_id")
      .eq("id", driverId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (!driver || driver.user_id !== ctx.userId) {
      return { data: null, error: "You can only mark documents for your own onboarding" }
    }
  }

  // Get current onboarding status
  const { data: onboarding, error: onboardingError } = await supabase
    .from("driver_onboarding")
    .select(DRIVER_ONBOARDING_SELECT)
    .eq("driver_id", driverId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (onboardingError) {
    return { data: null, error: onboardingError.message }
  }

  if (!onboarding) {
    return { data: null, error: "Onboarding record not found" }
  }

  // MEDIUM FIX 11 & 12: Track documents by type, not just ID, and prevent duplicates
  // Handle both old format (array of UUIDs) and new format (array of objects)
  const existingCompleted = Array.isArray(onboarding.documents_completed) 
    ? onboarding.documents_completed 
    : []
  
  // MEDIUM FIX 12: Check for duplicate documentId (works for both formats)
  const isDuplicate = existingCompleted.some((doc: any) => {
    if (typeof doc === 'string') {
      return doc === documentId
    }
    if (typeof doc === 'object' && doc.documentId) {
      return doc.documentId === documentId
    }
    return false
  })
  
  if (isDuplicate) {
    return { data: null, error: "This document has already been marked as uploaded" }
  }

  // MEDIUM FIX 11: Store as object with type for proper validation
  // New format: [{ type: "license", documentId: "uuid" }, ...]
  const newDocumentEntry = { type: documentType, documentId }
  const documentsCompleted = [...existingCompleted, newDocumentEntry]

  const documentsMissing = Array.isArray(onboarding.documents_missing)
    ? onboarding.documents_missing.filter((doc: string) => doc !== documentType)
    : []

  // Update specific document flag
  const updateData: any = {
    documents_completed: documentsCompleted,
    documents_missing: documentsMissing,
    updated_at: new Date().toISOString(),
  }

  // Set specific document flags
  if (documentType === "license") updateData.license_uploaded = true
  if (documentType === "medical_card") updateData.medical_card_uploaded = true
  if (documentType === "insurance") updateData.insurance_uploaded = true
  if (documentType === "w9") updateData.w9_uploaded = true
  if (documentType === "i9") updateData.i9_uploaded = true

  // MEDIUM FIX 11: Recalculate completion percentage based on unique document types
  const requiredDocs = Array.isArray(onboarding.documents_required) ? onboarding.documents_required : []
  // Count unique document types completed (handle both old UUID format and new object format)
  const completedTypes = new Set(
    documentsCompleted
      .map((doc: any) => {
        if (typeof doc === 'object' && doc.type) {
          return doc.type // New format: { type, documentId }
        }
        // Old format: just UUID - we can't determine type, so skip for type-based counting
        // This will require migration or re-uploading documents
        return null
      })
      .filter((type: string | null) => type !== null)
  )
  const uniqueCompletedCount = completedTypes.size
  const docCompletion = requiredDocs.length > 0 ? Math.round((uniqueCompletedCount / requiredDocs.length) * 100) : 0

  // Overall completion includes steps and documents
  const stepCompletion = (onboarding.current_step / onboarding.total_steps) * 50
  const documentCompletion = (docCompletion / 100) * 50
  const overallCompletion = Math.min(100, Math.round(stepCompletion + documentCompletion))

  updateData.completion_percentage = overallCompletion

  const { data, error } = await supabase
    .from("driver_onboarding")
    .update(updateData)
    .eq("driver_id", driverId)
    .eq("company_id", ctx.companyId)
    .select()
    .single()

  if (error) {
    Sentry.captureException(error)
    return { data: null, error: safeDbError(error) }
  }

  revalidatePath("/dashboard/drivers")
  return { data, error: null }
}

/**
 * Complete onboarding
 */
export async function completeDriverOnboarding(driverId: string) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const role = await getUserRole()
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { data: null, error: "Only managers can complete driver onboarding" }
  }

  // Verify all required documents are uploaded
  const { data: onboarding, error: onboardingError } = await supabase
    .from("driver_onboarding")
    .select(DRIVER_ONBOARDING_SELECT)
    .eq("driver_id", driverId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (onboardingError) {
    return { data: null, error: onboardingError.message }
  }

  if (!onboarding) {
    return { data: null, error: "Onboarding record not found" }
  }

  // MEDIUM FIX 11: Check if all required document types are uploaded (not just count)
  const requiredDocs = Array.isArray(onboarding.documents_required) ? onboarding.documents_required : []
  const completedDocs = Array.isArray(onboarding.documents_completed) ? onboarding.documents_completed : []

  // Extract unique document types from completed documents (handle both formats)
  const completedTypes = new Set(
    completedDocs
      .map((doc: any) => {
        if (typeof doc === 'object' && doc.type) {
          return doc.type // New format
        }
        // Old format: UUID only - can't determine type
        return null
      })
      .filter((type: string | null) => type !== null)
  )

  // Check that each required document type has been uploaded
  const missingDocs = requiredDocs.filter((type: string) => !completedTypes.has(type))
  if (missingDocs.length > 0) {
    return { data: null, error: `Missing required documents: ${missingDocs.join(", ")}` }
  }

  // Mark onboarding as completed
  const { data, error } = await supabase
    .from("driver_onboarding")
    .update({
      status: "completed",
      current_step: onboarding.total_steps,
      completion_percentage: 100,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("driver_id", driverId)
    .eq("company_id", ctx.companyId)
    .select()
    .single()

  if (error) {
    Sentry.captureException(error)
    return { data: null, error: safeDbError(error) }
  }

  // Update driver status to active (if not already)
  await supabase
    .from("drivers")
    .update({ status: "active" })
    .eq("id", driverId)
    .eq("company_id", ctx.companyId)

  revalidatePath("/dashboard/drivers")
  return { data, error: null }
}

/**
 * Get all onboarding records for company
 */
export async function getAllDriverOnboarding(filters?: {
  status?: string
  assigned_to?: string
}) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const role = await getUserRole()
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { data: null, error: "Only managers can view all onboarding records" }
  }

  let query = supabase
    .from("driver_onboarding")
    .select(`
      *,
      driver:driver_id(id, name, email, phone, status),
      assigned_to:assigned_to_user_id(id, full_name, email)
    `)
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: false })

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  if (filters?.assigned_to) {
    query = query.eq("assigned_to_user_id", filters.assigned_to)
  }

  const { data, error } = await query

  if (error) {
    Sentry.captureException(error)
    return { data: null, error: safeDbError(error) }
  }

  return { data: data || [], error: null }
}





