"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Get current user profile
export async function getUserProfile() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData, error } = await supabase
    .from("users")
    .select("id, email, full_name, phone, role, company_id")
    .eq("id", user.id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: userData, error: null }
}

// Alias for backward compatibility
export async function getCurrentUser() {
  return getUserProfile()
}

// Update user profile
export async function updateUserProfile(formData: {
  full_name?: string
  phone?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const updateData: any = {}
  if (formData.full_name !== undefined) updateData.full_name = formData.full_name
  if (formData.phone !== undefined) updateData.phone = formData.phone || null

  const { error } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", user.id)

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/settings")
  return { data: { success: true }, error: null }
}

// Update user password
export async function updateUserPassword(currentPassword: string, newPassword: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Verify current password by attempting to sign in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  })

  if (signInError) {
    return { error: "Current password is incorrect", data: null }
  }

  // Update password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (updateError) {
    return { error: updateError.message, data: null }
  }

  return { data: { success: true }, error: null }
}
