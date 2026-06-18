"use server"

import { safeDbError } from "@/lib/utils/error"
import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import { getUserRole } from "@/lib/server-permissions"
import { revalidatePath } from "next/cache"
import { sanitizeString } from "@/lib/validation"
import { requirePlanFeature } from "@/lib/plan-feature-guard"
import { getSpMetadataSummary } from "@/lib/sso/sp-metadata"
import type { EmployeeRole } from "@/lib/roles"

const SSO_ADMIN_ROLES: readonly EmployeeRole[] = ["super_admin"]

const SSO_CONFIG_SELECT =
  "id, company_id, idp_entity_id, idp_sso_url, idp_x509_cert, email_domain, is_active, created_at, updated_at"

export type CompanySsoConfig = {
  id: string
  company_id: string
  idp_entity_id: string
  idp_sso_url: string
  idp_x509_cert: string
  email_domain: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type SsoSettingsFormInput = {
  idp_entity_id: string
  idp_sso_url: string
  idp_x509_cert: string
  email_domain: string
  is_active?: boolean
}

async function requireSsoAdmin() {
  const role = await getUserRole()
  if (!role || !SSO_ADMIN_ROLES.includes(role)) {
    return { error: "Only super admins can manage SSO settings" }
  }
  return { error: null }
}

function normalizeEmailDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@+/, "")
}

function normalizePemCert(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  if (trimmed.includes("BEGIN CERTIFICATE")) return trimmed
  const body = trimmed.replace(/\s+/g, "")
  const lines = body.match(/.{1,64}/g) || [body]
  return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----`
}

function isValidHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:"
  } catch {
    return false
  }
}

function validateSsoInput(input: SsoSettingsFormInput): string | null {
  const entityId = sanitizeString(input.idp_entity_id, 500).trim()
  const ssoUrl = sanitizeString(input.idp_sso_url, 2000).trim()
  const cert = normalizePemCert(input.idp_x509_cert)
  const emailDomain = normalizeEmailDomain(input.email_domain)

  if (!entityId) return "IdP Entity ID is required"
  if (!ssoUrl) return "IdP SSO URL is required"
  if (!isValidHttpsUrl(ssoUrl)) return "IdP SSO URL must be a valid HTTPS URL"
  if (!cert.includes("BEGIN CERTIFICATE")) return "IdP X.509 certificate is required (PEM format)"
  if (!emailDomain) return "Email domain is required"
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(emailDomain)) {
    return "Email domain must be a valid domain (e.g. acmetrucking.com)"
  }

  return null
}

export async function getSsoSettings() {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const planError = await requirePlanFeature(ctx.companyId, "sso")
    if (planError) {
      return { error: planError, data: null, upgrade: { required: true, feature: "sso" as const } }
    }

    const admin = await requireSsoAdmin()
    if (admin.error) return { error: admin.error, data: null }

    const { data, error } = await supabase
      .from("company_sso_config")
      .select(SSO_CONFIG_SELECT)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (error) return { error: safeDbError(error), data: null }

    return {
      data: {
        config: (data as CompanySsoConfig | null) ?? null,
        sp: getSpMetadataSummary(),
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load SSO settings"), data: null }
  }
}

export async function saveSsoSettings(input: SsoSettingsFormInput) {
  const admin = await requireSsoAdmin()
  if (admin.error) return { error: admin.error, data: null }

  const validationError = validateSsoInput(input)
  if (validationError) return { error: validationError, data: null }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const planError = await requirePlanFeature(ctx.companyId, "sso")
    if (planError) {
      return { error: planError, data: null, upgrade: { required: true, feature: "sso" as const } }
    }

    const payload = {
      company_id: ctx.companyId,
      idp_entity_id: sanitizeString(input.idp_entity_id, 500).trim(),
      idp_sso_url: sanitizeString(input.idp_sso_url, 2000).trim(),
      idp_x509_cert: normalizePemCert(input.idp_x509_cert),
      email_domain: normalizeEmailDomain(input.email_domain),
      is_active: Boolean(input.is_active),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("company_sso_config")
      .upsert(payload, { onConflict: "company_id" })
      .select(SSO_CONFIG_SELECT)
      .single()

    if (error) return { error: safeDbError(error), data: null }

    revalidatePath("/dashboard/settings/sso")
    return { data: data as CompanySsoConfig, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to save SSO settings"), data: null }
  }
}

export type SsoLoginAttemptRow = {
  id: string
  created_at: string
  outcome: "success" | "failure"
  failure_category: string | null
  email: string | null
  email_domain: string | null
}

export async function getSsoRecentActivity(limit = 20) {
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const planError = await requirePlanFeature(ctx.companyId, "sso")
    if (planError) {
      return { error: planError, data: null, upgrade: { required: true, feature: "sso" as const } }
    }

    const admin = await requireSsoAdmin()
    if (admin.error) return { error: admin.error, data: null }

    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, created_at, details")
      .eq("company_id", ctx.companyId)
      .eq("action", "sso.login_attempt")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) return { error: safeDbError(error), data: null }

    type AuditLogActivityRow = {
      id: string
      created_at: string
      details: Record<string, unknown> | null
    }

    const rows: SsoLoginAttemptRow[] = ((data || []) as AuditLogActivityRow[]).map((row) => {
      const details = (row.details || {}) as Record<string, unknown>
      return {
        id: row.id,
        created_at: row.created_at,
        outcome: details.outcome === "success" ? "success" : "failure",
        failure_category:
          typeof details.failure_category === "string" ? details.failure_category : null,
        email: typeof details.email === "string" ? details.email : null,
        email_domain: typeof details.email_domain === "string" ? details.email_domain : null,
      }
    })

    return { data: rows, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load SSO activity"), data: null }
  }
}

export async function setSsoActive(isActive: boolean) {
  const admin = await requireSsoAdmin()
  if (admin.error) return { error: admin.error, data: null }

  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    const planError = await requirePlanFeature(ctx.companyId, "sso")
    if (planError) {
      return { error: planError, data: null, upgrade: { required: true, feature: "sso" as const } }
    }

    const { data: existing, error: fetchError } = await supabase
      .from("company_sso_config")
      .select("id")
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (fetchError) return { error: safeDbError(fetchError), data: null }
    if (!existing) {
      return { error: "Save IdP configuration before enabling SSO", data: null }
    }

    const { data, error } = await supabase
      .from("company_sso_config")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("company_id", ctx.companyId)
      .select(SSO_CONFIG_SELECT)
      .single()

    if (error) return { error: safeDbError(error), data: null }

    revalidatePath("/dashboard/settings/sso")
    return { data: data as CompanySsoConfig, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to update SSO status"), data: null }
  }
}
