"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedAuthContext } from "@/lib/auth/server"
import { encryptCredential, decryptCredential } from "@/lib/crypto/eld-credentials"
import { generateTotpSecret, generateTotpUri, verifyTotpCode } from "@/lib/auth/totp"
import { isSafeRelativeLoginNext, resolvePostLoginRedirect } from "@/lib/auth/post-login-redirect"

const PENDING_TOTP_MINUTES = 5

export async function getTotpStatus(): Promise<{
  data: { enabled: boolean; verified_at: string | null } | null
  error: string | null
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId) return { data: null, error: ctx.error || "Not authenticated" }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("user_totp_secrets")
    .select("verified_at")
    .eq("user_id", ctx.userId)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  const verifiedAt = (data as { verified_at?: string | null } | null)?.verified_at ?? null
  return {
    data: { enabled: Boolean(verifiedAt), verified_at: verifiedAt },
    error: null,
  }
}

export async function initiateTotpSetup(): Promise<{
  data: { otpauthUri: string; secret: string } | null
  error: string | null
}> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId || !ctx.user?.email) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from("user_totp_secrets")
    .select("verified_at")
    .eq("user_id", ctx.userId)
    .maybeSingle()

  if (existing?.verified_at) {
    return { data: null, error: "Two-factor authentication is already enabled. Disable it first to set up again." }
  }

  const secret = generateTotpSecret()
  const encrypted = encryptCredential(secret)
  const { error } = await admin.from("user_totp_secrets").upsert(
    {
      user_id: ctx.userId,
      encrypted_secret: encrypted,
      verified_at: null,
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )

  if (error) return { data: null, error: error.message }

  return {
    data: {
      otpauthUri: generateTotpUri(secret, ctx.user.email),
      secret,
    },
    error: null,
  }
}

export async function confirmTotpSetup(code: string): Promise<{ data: { enabled: boolean } | null; error: string | null }> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId) return { data: null, error: ctx.error || "Not authenticated" }

  const admin = createAdminClient()
  const { data: row, error } = await admin
    .from("user_totp_secrets")
    .select("encrypted_secret, verified_at")
    .eq("user_id", ctx.userId)
    .maybeSingle()

  if (error || !row) return { data: null, error: "No pending two-factor setup found. Start setup again." }
  if (row.verified_at) return { data: null, error: "Two-factor authentication is already enabled." }

  const secret = decryptCredential(String(row.encrypted_secret))
  if (!verifyTotpCode(secret, code)) {
    return { data: null, error: "Invalid verification code. Check your authenticator app and try again." }
  }

  const { error: upErr } = await admin
    .from("user_totp_secrets")
    .update({ verified_at: new Date().toISOString() })
    .eq("user_id", ctx.userId)

  if (upErr) return { data: null, error: upErr.message }
  return { data: { enabled: true }, error: null }
}

export async function disableTotp(code: string): Promise<{ data: { disabled: boolean } | null; error: string | null }> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId) return { data: null, error: ctx.error || "Not authenticated" }

  const admin = createAdminClient()
  const { data: row, error } = await admin
    .from("user_totp_secrets")
    .select("encrypted_secret, verified_at")
    .eq("user_id", ctx.userId)
    .maybeSingle()

  if (error || !row?.verified_at) {
    return { data: null, error: "Two-factor authentication is not enabled." }
  }

  const secret = decryptCredential(String(row.encrypted_secret))
  if (!verifyTotpCode(secret, code)) {
    return { data: null, error: "Invalid verification code. Two-factor authentication was not disabled." }
  }

  const { error: delErr } = await admin.from("user_totp_secrets").delete().eq("user_id", ctx.userId)
  if (delErr) return { data: null, error: delErr.message }
  return { data: { disabled: true }, error: null }
}

export async function completeTotpLoginChallenge(params: {
  pendingId: string
  code: string
  next?: string | null
}): Promise<{ data: { redirectTo: string } | null; error: string | null }> {
  const pendingId = String(params.pendingId || "").trim()
  if (!pendingId) return { data: null, error: "Missing login challenge." }

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()
  const { data: pending, error: pendingErr } = await admin
    .from("pending_totp_sessions")
    .select("id, user_id, expires_at")
    .eq("id", pendingId)
    .gt("expires_at", nowIso)
    .maybeSingle()

  if (pendingErr || !pending) {
    return { data: null, error: "Your sign-in challenge expired. Please log in again." }
  }

  const userId = String(pending.user_id)
  const { data: totpRow, error: totpErr } = await admin
    .from("user_totp_secrets")
    .select("encrypted_secret, verified_at")
    .eq("user_id", userId)
    .not("verified_at", "is", null)
    .maybeSingle()

  if (totpErr || !totpRow) {
    await admin.from("pending_totp_sessions").delete().eq("id", pendingId)
    return { data: null, error: "Two-factor authentication is not configured for this account." }
  }

  const secret = decryptCredential(String(totpRow.encrypted_secret))
  if (!verifyTotpCode(secret, params.code)) {
    return { data: null, error: "Invalid verification code." }
  }

  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId)
  const email = userData?.user?.email
  if (userErr || !email) {
    return { data: null, error: "Unable to complete sign-in. Please try again." }
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  })

  if (linkErr || !linkData?.properties?.hashed_token) {
    return { data: null, error: linkErr?.message || "Unable to complete sign-in." }
  }

  const supabase = await createClient()
  const { error: otpErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
    email,
  })

  if (otpErr) {
    return { data: null, error: otpErr.message || "Unable to complete sign-in." }
  }

  await admin.from("pending_totp_sessions").delete().eq("id", pendingId)

  const rawNext = params.next?.trim() || null
  const safeNext = isSafeRelativeLoginNext(rawNext) ? rawNext : "/dashboard"
  const redirectTo = await resolvePostLoginRedirect(supabase, safeNext)
  return { data: { redirectTo }, error: null }
}

export async function createPendingTotpSession(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const expiresAt = new Date(Date.now() + PENDING_TOTP_MINUTES * 60 * 1000).toISOString()
  const { data, error } = await admin
    .from("pending_totp_sessions")
    .insert({ user_id: userId, expires_at: expiresAt })
    .select("id")
    .single()

  if (error || !data?.id) return null
  return String(data.id)
}

export async function userHasVerifiedTotp(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("user_totp_secrets")
    .select("verified_at")
    .eq("user_id", userId)
    .not("verified_at", "is", null)
    .maybeSingle()
  return Boolean(data?.verified_at)
}
