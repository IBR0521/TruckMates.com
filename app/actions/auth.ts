"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * Check if company name is available
 * Returns only plain JSON-serializable data
 */
export async function checkCompanyName(companyName: string) {
  try {
    const supabase = await createClient()
    
    const result = await supabase
      .from('companies')
      .select('id')
      .eq('name', companyName.trim())
      .maybeSingle()

    const exists = result.data !== null && result.data !== undefined
    const errorMsg = result.error ? String(result.error.message || result.error) : null

    if (errorMsg) {
      return { available: false, error: errorMsg.substring(0, 200) }
    }

    return { available: !exists, error: null }
  } catch (error: any) {
    return { 
      available: false, 
      error: String(error?.message || error || "Unknown error").substring(0, 200) 
    }
  }
}

/**
 * Register super admin and create company
 * Returns only plain JSON-serializable data
 */
export async function registerSuperAdmin(data: {
  companyName: string
  email: string
  phone: string
  password: string
  companyType?: 'broker' | 'carrier' | 'both' | null
}) {
  try {
    const supabase = await createClient()

    // Step 1: Check company name availability
    const nameCheck = await checkCompanyName(data.companyName)
    if (nameCheck.error) {
      return { data: null, error: nameCheck.error }
    }
    if (!nameCheck.available) {
      return { data: null, error: "Company name already exists" }
    }

    // Step 2: Create auth user with employee_role in metadata
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.companyName.trim(),
          role: 'super_admin',
          employee_role: 'super_admin' // Set in auth metadata for role-based access
        }
      }
    })

    if (authError || !authData.user) {
      const errorMsg = authError?.message || String(authError) || "Failed to create user"
      return { data: null, error: errorMsg.substring(0, 200) }
    }

    // Step 3: Create company using RPC function (bypasses RLS)
    const rpcResult = await supabase.rpc('create_company_for_user', {
      p_name: data.companyName.trim(),
      p_email: data.email,
      p_phone: data.phone,
      p_user_id: authData.user.id,
      p_company_type: data.companyType || null
    })

    // Handle RPC errors - ensure error is serializable
    if (rpcResult.error) {
      const errorMsg = rpcResult.error?.message || String(rpcResult.error) || "Failed to create company"
      return { data: null, error: String(errorMsg).substring(0, 200) }
    }

    // Get company ID and convert to string immediately
    const companyIdRaw = rpcResult.data
    if (!companyIdRaw) {
      return { data: null, error: "Failed to create company: No company ID returned" }
    }

    // Convert to string - handle both UUID and TEXT return types
    const companyId = typeof companyIdRaw === 'string' ? companyIdRaw : String(companyIdRaw)

    // Step 4: Return success without fetching company (avoid Date serialization issues)
    // The RPC function already created everything, we just need to return success
    const result = {
      data: {
        userId: String(authData.user.id),
        companyId: String(companyId),
        companyName: String(data.companyName.trim()),
        email: String(data.email),
        phone: String(data.phone || ""),
      },
      error: null
    }

    // Final safety: ensure JSON serializable by double-serializing
    try {
      return JSON.parse(JSON.stringify(result))
    } catch {
      // If JSON serialization fails, return minimal safe data
      return {
        data: {
          userId: String(authData.user.id),
          companyId: String(companyId),
          companyName: String(data.companyName.trim()),
          email: String(data.email),
          phone: String(data.phone || ""),
        },
        error: null
      }
    }
  } catch (error: any) {
    return { 
      data: null, 
      error: String(error?.message || error || "Registration failed").substring(0, 200) 
    }
  }
}

/**
 * Register employee (joins existing company)
 * Returns only plain JSON-serializable data
 */
export async function registerEmployee(data: {
  fullName: string
  email: string
  password: string
  role: string
  companyId?: string
}) {
  try {
    const supabase = await createClient()

    // Create auth user with employee_role in metadata
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName.trim(),
          role: data.role,
          employee_role: data.role // Set in auth metadata for role-based access
        }
      }
    })

    if (authError || !authData.user) {
      const errorMsg = authError?.message || String(authError) || "Failed to create user"
      return { data: null, error: errorMsg.substring(0, 200) }
    }

    // Update user record
    const updateData: any = {
      full_name: data.fullName.trim(),
      role: data.role
    }

    if (data.companyId) {
      updateData.company_id = data.companyId
    }

    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', authData.user.id)

    if (updateError) {
      const errorMsg = updateError.message || String(updateError) || "Failed to update user"
      return { data: null, error: errorMsg.substring(0, 200) }
    }

    return {
      data: {
        userId: String(authData.user.id),
        email: String(authData.user.email || ""),
        role: String(data.role),
      },
      error: null
    }
  } catch (error: any) {
    return { 
      data: null, 
      error: String(error?.message || error || "Registration failed").substring(0, 200) 
    }
  }
}

