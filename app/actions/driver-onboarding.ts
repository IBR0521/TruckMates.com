"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { revalidatePath } from "next/cache"

/**
 * Initialize driver onboarding when driver is created
 */
export async function initializeDriverOnboarding(driverId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: "Not authenticated" }
  }

  const { company_id } = await getCachedUserCompany(user.id)

  // Get driver info
  const { data: driver } = await supabase
    .from("drivers")
    .select("*")
    .eq("id", driverId)
    .eq("company_id", company_id)
    .single()

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

  // Create onboarding record
  const { data, error } = await supabase
    .from("driver_onboarding")
    .insert({
      driver_id: driverId,
      company_id,
      status: "in_progress",
      current_step: 1,
      total_steps: 5,
      completion_percentage: 0,
      started_at: new Date().toISOString(),
      documents_required: requiredDocuments,
      documents_completed: [],
      documents_missing: requiredDocuments,
      assigned_to_user_id: user.id,
      assigned_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error("[initializeDriverOnboarding] Error:", error)
    return { data: null, error: error.message }
  }

  revalidatePath("/dashboard/drivers")
  return { data, error: null }
}

/**
 * Get driver onboarding status
 */
export async function getDriverOnboarding(driverId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: "Not authenticated" }
  }

  const { company_id } = await getCachedUserCompany(user.id)

  const { data, error } = await supabase
    .from("driver_onboarding")
    .select(`
      *,
      driver:driver_id(id, name, email, phone),
      assigned_to:assigned_to_user_id(id, full_name, email)
    `)
    .eq("driver_id", driverId)
    .eq("company_id", company_id)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      // No onboarding record exists, return null
      return { data: null, error: null }
    }
    console.error("[getDriverOnboarding] Error:", error)
    return { data: null, error: error.message }
  }

  return { data, error: null }
}

/**
 * Update onboarding step
 */
export async function updateOnboardingStep(driverId: string, step: number) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: "Not authenticated" }
  }

  const { company_id } = await getCachedUserCompany(user.id)

  // Calculate completion percentage
  const totalSteps = 5
  const completionPercentage = Math.round((step / totalSteps) * 100)

  const { data, error } = await supabase
    .from("driver_onboarding")
    .update({
      current_step: step,
      completion_percentage: completionPercentage,
      updated_at: new Date().toISOString(),
    })
    .eq("driver_id", driverId)
    .eq("company_id", company_id)
    .select()
    .single()

  if (error) {
    console.error("[updateOnboardingStep] Error:", error)
    return { data: null, error: error.message }
  }

  revalidatePath("/dashboard/drivers")
  return { data, error: null }
}

/**
 * Mark document as uploaded
 */
export async function markDocumentUploaded(driverId: string, documentType: string, documentId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: "Not authenticated" }
  }

  const { company_id } = await getCachedUserCompany(user.id)

  // Get current onboarding status
  const { data: onboarding } = await supabase
    .from("driver_onboarding")
    .select("*")
    .eq("driver_id", driverId)
    .eq("company_id", company_id)
    .single()

  if (!onboarding) {
    return { data: null, error: "Onboarding record not found" }
  }

  // Update document status
  const documentsCompleted = Array.isArray(onboarding.documents_completed)
    ? [...onboarding.documents_completed, documentId]
    : [documentId]

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

  // Recalculate completion percentage
  const requiredDocs = Array.isArray(onboarding.documents_required) ? onboarding.documents_required.length : 5
  const completedDocs = documentsCompleted.length
  const docCompletion = requiredDocs > 0 ? Math.round((completedDocs / requiredDocs) * 100) : 0

  // Overall completion includes steps and documents
  const stepCompletion = (onboarding.current_step / onboarding.total_steps) * 50
  const documentCompletion = (docCompletion / 100) * 50
  const overallCompletion = Math.min(100, Math.round(stepCompletion + documentCompletion))

  updateData.completion_percentage = overallCompletion

  const { data, error } = await supabase
    .from("driver_onboarding")
    .update(updateData)
    .eq("driver_id", driverId)
    .eq("company_id", company_id)
    .select()
    .single()

  if (error) {
    console.error("[markDocumentUploaded] Error:", error)
    return { data: null, error: error.message }
  }

  revalidatePath("/dashboard/drivers")
  return { data, error: null }
}

/**
 * Complete onboarding
 */
export async function completeDriverOnboarding(driverId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: "Not authenticated" }
  }

  const { company_id } = await getCachedUserCompany(user.id)

  // Verify all required documents are uploaded
  const { data: onboarding } = await supabase
    .from("driver_onboarding")
    .select("*")
    .eq("driver_id", driverId)
    .eq("company_id", company_id)
    .single()

  if (!onboarding) {
    return { data: null, error: "Onboarding record not found" }
  }

  // Check if all required documents are uploaded
  const requiredDocs = Array.isArray(onboarding.documents_required) ? onboarding.documents_required : []
  const completedDocs = Array.isArray(onboarding.documents_completed) ? onboarding.documents_completed : []

  if (completedDocs.length < requiredDocs.length) {
    return { data: null, error: "Not all required documents have been uploaded" }
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
    .eq("company_id", company_id)
    .select()
    .single()

  if (error) {
    console.error("[completeDriverOnboarding] Error:", error)
    return { data: null, error: error.message }
  }

  // Update driver status to active (if not already)
  await supabase
    .from("drivers")
    .update({ status: "active" })
    .eq("id", driverId)
    .eq("company_id", company_id)

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: "Not authenticated" }
  }

  const { company_id } = await getCachedUserCompany(user.id)

  let query = supabase
    .from("driver_onboarding")
    .select(`
      *,
      driver:driver_id(id, name, email, phone, status),
      assigned_to:assigned_to_user_id(id, full_name, email)
    `)
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  if (filters?.assigned_to) {
    query = query.eq("assigned_to_user_id", filters.assigned_to)
  }

  const { data, error } = await query

  if (error) {
    console.error("[getAllDriverOnboarding] Error:", error)
    return { data: null, error: error.message }
  }

  return { data: data || [], error: null }
}





