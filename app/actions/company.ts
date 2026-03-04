"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getCompany() {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: "Not authenticated" }
  }

  // Get user's company_id
  const { data: userData, error: userDataError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (userDataError || !userData?.company_id) {
    return { error: "No company found" }
  }

  // Get company data
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("*")
    .eq("id", userData.company_id)
    .single()

  if (companyError) {
    return { error: companyError.message }
  }

  return { data: company }
}

export async function updateCompany(formData: FormData) {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { success: false, error: "Not authenticated" }
  }

  // Get user's company_id
  const { data: userData, error: userDataError } = await supabase
    .from("users")
    .select("company_id, role")
    .eq("id", user.id)
    .maybeSingle()

  if (userDataError) {
    return { success: false, error: userDataError.message || "Failed to fetch user data" }
  }

  if (!userData?.company_id) {
    return { success: false, error: "No company found" }
  }

  // SEC-006 FIX: Use correct role names - super_admin and operations_manager (not "manager")
  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!MANAGER_ROLES.includes(userData.role)) {
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
    .eq("id", userData.company_id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  revalidatePath("/dashboard/settings")
  return { success: true }
}

/**
 * Check if user is linked to a demo company and fix it
 */
export async function checkAndFixDemoCompanyLink() {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: "Not authenticated", isLinkedToDemo: false }
  }

  // Get user's company
  const { data: userData, error: userDataError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (userDataError || !userData?.company_id) {
    return { error: "No company found", isLinkedToDemo: false }
  }

  // Check if company is a demo company
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", userData.company_id)
    .single()

  if (companyError) {
    return { error: companyError.message, isLinkedToDemo: false }
  }

  const isDemoCompany = company.name === "Demo Logistics Company" || 
                       company.name?.includes("Demo Logistics Company") ||
                       company.name?.startsWith("Demo Logistics Co.")

  if (isDemoCompany) {
    // User is linked to demo company - create a new company for them
    const { data: { user: authUser } } = await supabase.auth.getUser()
    const userEmail = authUser?.email || `user-${user.id.substring(0, 8)}@example.com`
    
    const { data: newCompanyId, error: rpcError } = await supabase.rpc('create_company_for_user', {
      p_name: `My Company (${userEmail})`,
      p_email: userEmail,
      p_phone: "",
      p_user_id: user.id,
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
}

