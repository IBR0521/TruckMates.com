import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSamlAppBaseUrl } from "@/lib/sso/sp-metadata"
import { mapLegacyRole, type EmployeeRole } from "@/lib/roles"
import { checkResourceLimit } from "@/lib/plan-enforcement"

export type SamlAssertionExtract = {
  nameID?: string
  attributes?: Record<string, string | string[]>
  response?: Record<string, string | string[]>
  [key: string]: unknown
}

export type ProvisionSsoUserResult =
  | { ok: true; email: string; magicLinkUrl: string }
  | { ok: false; reason: string }

function emailFromAssertion(extract: SamlAssertionExtract): string | null {
  const attrs = extract.attributes || {}
  const candidates = [
    extract.nameID,
    attrs.email,
    attrs.mail,
    attrs.Email,
    attrs["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"],
    attrs["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"],
  ]

  for (const value of candidates) {
    const raw = Array.isArray(value) ? value[0] : value
    if (typeof raw === "string" && raw.includes("@")) {
      return raw.trim().toLowerCase()
    }
  }

  if (typeof extract.nameID === "string" && extract.nameID.includes("@")) {
    return extract.nameID.trim().toLowerCase()
  }

  return null
}

function displayNameFromAssertion(extract: SamlAssertionExtract, email: string): string {
  const attrs = extract.attributes || {}
  const candidates = [
    attrs.displayName,
    attrs.name,
    attrs.givenName,
    attrs["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"],
  ]

  for (const value of candidates) {
    const raw = Array.isArray(value) ? value[0] : value
    if (typeof raw === "string" && raw.trim()) return raw.trim()
  }

  return email.split("@")[0] || "User"
}

async function ensureDriverRow(
  admin: ReturnType<typeof createAdminClient>,
  params: { userId: string; companyId: string; email: string; fullName: string },
) {
  const { data: existingDrivers } = await admin
    .from("drivers")
    .select("id")
    .eq("user_id", params.userId)
    .eq("company_id", params.companyId)
    .limit(1)

  if (existingDrivers?.length) {
    await admin
      .from("drivers")
      .update({
        name: params.fullName,
        email: params.email,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", params.userId)
      .eq("company_id", params.companyId)
  } else {
    await admin.from("drivers").insert({
      user_id: params.userId,
      company_id: params.companyId,
      name: params.fullName,
      email: params.email,
      phone: null,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
}

async function acceptPendingInvitation(
  admin: ReturnType<typeof createAdminClient>,
  params: { companyId: string; email: string; userId: string },
) {
  const acceptPayload = {
    status: "accepted" as const,
    accepted_at: new Date().toISOString(),
    accepted_by: params.userId,
  }

  await admin
    .from("invitation_codes")
    .update(acceptPayload)
    .eq("company_id", params.companyId)
    .eq("email", params.email)
    .eq("status", "pending")
}

/**
 * Ensures the SAML user exists in Supabase Auth + public.users for the SSO company.
 * Mirrors invite/register flows: requires an existing company user or pending invitation.
 */
export async function provisionSsoUserAndCreateSession(params: {
  companyId: string
  emailDomain: string
  assertion: SamlAssertionExtract
}): Promise<ProvisionSsoUserResult> {
  const email = emailFromAssertion(params.assertion)
  if (!email) {
    return { ok: false, reason: "missing_email" }
  }

  const domain = email.split("@")[1]?.toLowerCase()
  if (!domain || domain !== params.emailDomain.toLowerCase()) {
    return { ok: false, reason: "email_domain_mismatch" }
  }

  const admin = createAdminClient()
  const fullName = displayNameFromAssertion(params.assertion, email)

  const { data: profile } = await admin
    .from("users")
    .select("id, email, company_id, role, full_name")
    .eq("email", email)
    .maybeSingle()

  const { data: pendingInvite } = await admin
    .from("invitation_codes")
    .select("id, invited_role")
    .eq("company_id", params.companyId)
    .eq("email", email)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  let role: EmployeeRole
  let userId: string | null = null

  if (profile?.id && profile.company_id === params.companyId) {
    userId = profile.id
    role = mapLegacyRole(String(profile.role || "dispatcher"))
  } else if (pendingInvite) {
    role = mapLegacyRole(String(pendingInvite.invited_role || "dispatcher"))
    const seatCheck = await checkResourceLimit({ companyId: params.companyId, resourceType: "user_seats" })
    if (!seatCheck.allowed) {
      return { ok: false, reason: "seat_limit" }
    }
  } else if (profile?.company_id && profile.company_id !== params.companyId) {
    return { ok: false, reason: "user_other_company" }
  } else {
    return { ok: false, reason: "not_provisioned" }
  }

  if (!userId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
        employee_role: role,
      },
    })

    if (createError || !created.user) {
      if (createError?.message?.toLowerCase().includes("already")) {
        const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const existing = listed.users.find((u) => u.email?.toLowerCase() === email)
        if (!existing) {
          Sentry.captureException(createError)
          return { ok: false, reason: "auth_create_failed" }
        }
        userId = existing.id
      } else {
        Sentry.captureException(createError)
        return { ok: false, reason: "auth_create_failed" }
      }
    } else {
      userId = created.user.id
    }

    const { error: upsertError } = await admin.from("users").upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        role,
        company_id: params.companyId,
        employee_status: "active",
      },
      { onConflict: "id" },
    )

    if (upsertError) {
      Sentry.captureException(upsertError)
      return { ok: false, reason: "profile_upsert_failed" }
    }

    if (role === "driver") {
      try {
        await ensureDriverRow(admin, { userId, companyId: params.companyId, email, fullName })
      } catch (error) {
        Sentry.captureException(error)
      }
    }

    if (pendingInvite) {
      await acceptPendingInvitation(admin, { companyId: params.companyId, email, userId })
    }
  }

  const appUrl = getSamlAppBaseUrl()
  const redirectTo = `${appUrl}/auth/sso-callback?next=${encodeURIComponent("/dashboard")}`

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  })

  const actionLink = linkData?.properties?.action_link
  if (linkError || !actionLink) {
    Sentry.captureException(linkError || new Error("Missing magic link action_link"))
    return { ok: false, reason: "session_link_failed" }
  }

  return { ok: true, email, magicLinkUrl: actionLink }
}

export function extractEmailFromAssertion(assertion: SamlAssertionExtract): string | null {
  return emailFromAssertion(assertion)
}
