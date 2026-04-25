"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { updateUserProfile, updateUserPassword } from "@/lib/auth/server"
import { sanitizeError } from "@/lib/error-message"
import * as Sentry from "@sentry/nextjs"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


export async function getAccountSettings() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { data: userData, error } = await supabase
    .from("users")
    .select("id, email, full_name, phone, role")
    .eq("id", ctx.userId)
    .maybeSingle()

  if (error) {
    return { error: safeDbError(error), data: null }
  }
  if (!userData) {
    return { error: "User not found", data: null }
  }

  return { data: userData, error: null }
}

export async function updateAccountSettings(settings: {
  full_name?: string
  phone?: string
}) {
  const result = await updateUserProfile(settings)
  
  if (result.error) {
    return { error: result.error, success: false }
  }

  revalidatePath("/dashboard/settings/account")
  return { success: true, error: null }
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const result = await updateUserPassword(currentPassword, newPassword)
  
  if (result.error) {
    return { error: result.error, success: false }
  }

  return { success: true, error: null }
}












