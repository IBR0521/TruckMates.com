"use server"

import { createClient } from "@/lib/supabase/server"

export async function checkCompanyNameExists(companyName: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('companies')
    .select('id, name')
    .eq('name', companyName.trim())
    .maybeSingle()

  if (error) {
    return { exists: false, error: error.message }
  }

  return { exists: !!data, error: null }
}

export async function createCompanyAndLinkUser(data: {
  companyName: string
  email: string
  phone: string
  userId: string
  companyType?: 'broker' | 'carrier' | 'both' | null
}) {
  const supabase = await createClient()

  // Use the database function to create company (bypasses RLS)
  const { data: companyId, error: functionError } = await supabase.rpc('create_company_for_user', {
    p_name: data.companyName.trim(),
    p_email: data.email,
    p_phone: data.phone,
    p_user_id: data.userId,
    p_company_type: data.companyType || null
  })

  if (functionError) {
    // Fallback to direct insert if function doesn't exist
    console.log("Function not available, trying direct insert:", functionError.message)
    
    // Wait a bit for trigger to create user record
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Create company - this will run on the server with proper permissions
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: data.companyName.trim(),
        email: data.email,
        phone: data.phone,
        company_type: data.companyType || null
      })
      .select()
      .single()

    if (companyError) {
      return { error: companyError.message, data: null }
    }

    // Check if user record exists, if not create it
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', data.userId)
      .maybeSingle()

    if (!existingUser) {
      // Create user record if trigger didn't work
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: data.userId,
          email: data.email,
          full_name: data.companyName.trim(),
          role: 'super_admin',
          company_id: companyData.id,
          phone: data.phone
        })

      if (insertError) {
        return { error: insertError.message || "Failed to create user record", data: null }
      }
    } else {
      // Update existing user record
      const { error: userError } = await supabase
        .from('users')
        .update({ 
          company_id: companyData.id, 
          role: 'super_admin',
          full_name: data.companyName.trim(),
          phone: data.phone
        })
        .eq('id', data.userId)

      if (userError) {
        return { error: userError.message || "Failed to link user to company", data: null }
      }
    }

    return { data: companyData, error: null }
  }

  // If function worked, fetch the company data
  const { data: companyData, error: fetchError } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single()

  if (fetchError) {
    return { error: fetchError.message, data: null }
  }

  return { data: companyData, error: null }
}

