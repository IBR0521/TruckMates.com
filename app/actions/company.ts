"use server"

import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"

export async function getCompany() {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId || !ctx.userId) {
      return { error: "Not authenticated" }
    }

    // Get company data
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, name, address, phone, email, company_type, created_at, updated_at")
      .eq("id", ctx.companyId)
      .maybeSingle()

    if (companyError) {
      return { error: companyError.message || "Failed to fetch company data" }
    }

    if (!company) {
      return { error: "Company not found" }
    }

    return { data: company }
  } catch (error: any) {
    Sentry.captureException(error)
    return { error: error?.message || "An unexpected error occurred" }
  }
}

export async function updateCompany(formData: FormData) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId || !ctx.userId) {
      return { success: false, error: "Not authenticated" }
    }

    const { getUserRole } = await import("@/lib/server-permissions")
    const role = await getUserRole()
    const MANAGER_ROLES = ["super_admin", "operations_manager"]
    if (!role || !MANAGER_ROLES.includes(role)) {
      return { success: false, error: "Only managers can update company information" }
    }

    const name = formData.get("name") as string
    const email = formData.get("email") as string
    const phone = formData.get("phone") as string
    const companyType = formData.get("company_type") as string | null

    // Validate company_type
    const validCompanyTypes = ['broker', 'carrier', 'both', null]
    const normalizedCompanyType = companyType === "regular" || companyType === "" ? null : companyType
    if (normalizedCompanyType && !validCompanyTypes.includes(normalizedCompanyType)) {
      return { success: false, error: "Invalid company type" }
    }

    // Update company
    const { error: updateError } = await supabase
      .from("companies")
      .update({
        name,
        email,
        phone,
        company_type: normalizedCompanyType || null,
      })
      .eq("id", ctx.companyId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    revalidatePath("/dashboard/settings")
    return { success: true }
  } catch (error: any) {
    Sentry.captureException(error)
    return { success: false, error: error?.message || "An unexpected error occurred" }
  }
}

/**
 * Check if user is linked to a demo company and fix it
 */
export async function checkAndFixDemoCompanyLink() {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId || !ctx.userId) {
      return { error: "Not authenticated", isLinkedToDemo: false }
    }

    // Check if company is a demo company
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", ctx.companyId)
      .maybeSingle()

    if (companyError) {
      return { error: companyError.message || "Failed to fetch company data", isLinkedToDemo: false }
    }

    if (!company) {
      return { error: "Company not found", isLinkedToDemo: false }
    }

    const isDemoCompany = company.name === "Demo Logistics Company" || 
                         company.name?.includes("Demo Logistics Company") ||
                         company.name?.startsWith("Demo Logistics Co.")

    if (isDemoCompany) {
      // User is linked to demo company - create a new company for them
      const userEmail = ctx.user?.email || `user-${ctx.userId.substring(0, 8)}@example.com`
      
      const { data: newCompanyId, error: rpcError } = await supabase.rpc('create_company_for_user', {
        p_name: `My Company (${userEmail})`,
        p_email: userEmail,
        p_phone: "",
        p_user_id: ctx.userId,
        p_company_type: null
      })

      if (rpcError) {
        return { 
          error: `Failed to create new company: ${rpcError.message}`, 
          isLinkedToDemo: true 
        }
      }

      revalidatePath("/dashboard")
      return { 
        success: true, 
        isLinkedToDemo: true, 
        message: "Your account was linked to a demo company. A new company has been created for you.",
        newCompanyId: String(newCompanyId)
      }
    }

    return { success: true, isLinkedToDemo: false }
  } catch (error: any) {
    Sentry.captureException(error)
    return { error: error?.message || "An unexpected error occurred", isLinkedToDemo: false }
  }
}

