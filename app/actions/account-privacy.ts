"use server"

import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"
import { errorMessage } from "@/lib/error-message"

const DELETE_CONFIRM_PHRASE = "DELETE MY ACCOUNT"

/**
 * Permanently delete the signed-in user's auth identity and `public.users` row.
 * Does not delete the company or other users' data.
 */
export async function deleteMyOwnAccount(confirmation: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.userId) {
      return { success: false, error: ctx.error || "Not authenticated" }
    }

    if (String(confirmation || "").trim() !== DELETE_CONFIRM_PHRASE) {
      return {
        success: false,
        error: `Type exactly "${DELETE_CONFIRM_PHRASE}" to confirm account deletion.`,
      }
    }

    const admin = createAdminClient()

    const { data: deleted, error: delErr } = await admin
      .from("users")
      .delete()
      .eq("id", ctx.userId)
      .select("id")
      .maybeSingle()

    if (delErr) {
      return { success: false, error: delErr.message || "Failed to remove profile" }
    }
    if (!deleted) {
      return { success: false, error: "No profile row found for this account." }
    }

    const { error: authErr } = await admin.auth.admin.deleteUser(ctx.userId)
    if (authErr) {
      Sentry.captureException(authErr)
      return { success: false, error: authErr.message || "Failed to delete auth user" }
    }

    return { success: true, error: null }
  } catch (e: unknown) {
    Sentry.captureException(e)
    return { success: false, error: errorMessage(e, "Account deletion failed") }
  }
}
