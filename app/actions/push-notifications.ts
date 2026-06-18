"use server"

import * as Sentry from "@sentry/nextjs"
import { getCachedAuthContext } from "@/lib/auth/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getFirebaseAdminMessaging } from "@/lib/firebase/admin"
import { safeDbError } from "@/lib/utils/error"
import { logger } from "@/lib/logger"

let firebasePushConfigWarned = false

function firebasePushConfigError(): string | null {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim()
  if (projectId && clientEmail && privateKey) return null

  if (!firebasePushConfigWarned) {
    firebasePushConfigWarned = true
    logger.warn(
      "[push-notifications] Push not configured — set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY",
    )
  }
  return "Push notifications not configured (missing Firebase env vars)"
}

export async function saveFcmToken(fcmToken: string) {
  const token = String(fcmToken || "").trim()
  if (!token) return { error: "FCM token is required", data: null }

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  const supabase = await createClient()
  const { error } = await supabase
    .from("users")
    .update({ fcm_token: token } as Record<string, unknown>)
    .eq("id", ctx.userId)
    .eq("company_id", ctx.companyId)

  if (error) return { error: safeDbError(error, "Failed to save FCM token"), data: null }
  return { error: null, data: { saved: true } }
}

export async function clearFcmToken() {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }
  const supabase = await createClient()
  const { error } = await supabase
    .from("users")
    .update({ fcm_token: null } as Record<string, unknown>)
    .eq("id", ctx.userId)
    .eq("company_id", ctx.companyId)
  return { error: error ? safeDbError(error, "Failed to clear FCM token") : null, data: { cleared: !error } }
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; data?: Record<string, string> },
) {
  try {
    const configError = firebasePushConfigError()
    if (configError) return { sent: false, error: configError }

    const messaging = getFirebaseAdminMessaging()
    if (!messaging) return { sent: false, error: "Firebase admin is not configured" }

    const supabase = createAdminClient()
    const { data: user } = await supabase.from("users").select("fcm_token").eq("id", userId).maybeSingle()
    const token = String((user as { fcm_token?: string | null } | null)?.fcm_token || "").trim()
    if (!token) return { sent: false, error: "User has no registered FCM token" }

    await messaging.send({
      token,
      notification: { title: payload.title, body: payload.body },
      data: payload.data || {},
      webpush: { fcmOptions: { link: payload.data?.link || "/dashboard/notifications" } },
    })
    return { sent: true, error: null }
  } catch (error) {
    Sentry.captureException(error)
    return { sent: false, error: "Failed to send push notification" }
  }
}

export async function sendPushToCompanyRoles(
  companyId: string,
  roles: string[],
  payload: { title: string; body: string; data?: Record<string, string> },
) {
  try {
    const configError = firebasePushConfigError()
    if (configError) return { sent: 0, error: configError }

    const messaging = getFirebaseAdminMessaging()
    if (!messaging) return { sent: 0, error: "Firebase admin is not configured" }

    const supabase = createAdminClient()
    const { data: users } = await supabase
      .from("users")
      .select("id, fcm_token, role")
      .eq("company_id", companyId)
      .in("role", roles)
      .not("fcm_token", "is", null)

    const tokens = (users || [])
      .map((u: { fcm_token?: string | null }) => String(u.fcm_token || "").trim())
      .filter((t: string) => Boolean(t))
    if (tokens.length === 0) return { sent: 0, error: null }

    const result = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data || {},
      webpush: { fcmOptions: { link: payload.data?.link || "/dashboard/notifications" } },
    })
    return { sent: result.successCount, error: null }
  } catch (error) {
    Sentry.captureException(error)
    return { sent: 0, error: "Failed to send push notifications" }
  }
}
