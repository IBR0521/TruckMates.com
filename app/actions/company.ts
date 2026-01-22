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
    .single()

  if (userDataError || !userData?.company_id) {
    return { success: false, error: "No company found" }
  }

  // Only managers can update company
  if (userData.role !== "manager") {
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

