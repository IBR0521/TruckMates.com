export type SsoFailureCategory =
  | "success"
  | "missing_saml_response"
  | "missing_issuer"
  | "no_active_config"
  | "missing_in_response_to"
  | "request_correlation_failed"
  | "signature_invalid"
  | "expired"
  | "audience_mismatch"
  | "recipient_mismatch"
  | "replay_detected"
  | "rate_limited"
  | "provisioning_failed"
  | "validation_failed"
  | "parse_missing_extract"

export type SsoAuditOutcome = "success" | "failure"

export type SsoAuditLogInput = {
  companyId?: string | null
  email?: string | null
  emailDomain?: string | null
  outcome: SsoAuditOutcome
  failureCategory?: SsoFailureCategory
  ipAddress?: string | null
  userAgent?: string | null
  issuer?: string | null
}

const SENTRY_SECURITY_CATEGORIES: SsoFailureCategory[] = ["replay_detected", "signature_invalid"]

export function shouldCaptureSsoSecurityEvent(category: SsoFailureCategory): boolean {
  return SENTRY_SECURITY_CATEGORIES.includes(category)
}

export function ssoSecuritySentryLevel(category: SsoFailureCategory): "warning" | "error" {
  return category === "replay_detected" ? "error" : "warning"
}

export async function createSsoAuditLog(input: SsoAuditLogInput): Promise<void> {
  if (!input.companyId) {
    return
  }

  const { createAdminClient } = await import("@/lib/supabase/admin")
  const admin = createAdminClient()

  const details: Record<string, unknown> = {
    outcome: input.outcome,
    email_domain: input.emailDomain ?? null,
    email: input.email ?? null,
    issuer: input.issuer ?? null,
  }

  if (input.failureCategory && input.outcome === "failure") {
    details.failure_category = input.failureCategory
  }

  await admin.from("audit_logs").insert({
    company_id: input.companyId,
    user_id: null,
    action: "sso.login_attempt",
    resource_type: "sso",
    resource_id: null,
    details,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
    created_at: new Date().toISOString(),
  })
}

export function classifySamlParseError(error: unknown): SsoFailureCategory {
  const message = String(error instanceof Error ? error.message : error).toLowerCase()
  if (message.includes("audience") || message.includes("audienceuri")) {
    return "audience_mismatch"
  }
  if (message.includes("recipient") || message.includes("assertion consumer")) {
    return "recipient_mismatch"
  }
  if (
    message.includes("err_subject_unconfirmed") ||
    message.includes("err_expired_session") ||
    message.includes("notonorafter") ||
    message.includes("not before") ||
    message.includes("expired") ||
    message.includes("skew")
  ) {
    return "expired"
  }
  if (
    message.includes("failed_to_verify_signature") ||
    message.includes("err_failed_message_signature_verification") ||
    message.includes("signature") ||
    message.includes("digest") ||
    message.includes("certificate") ||
    message.includes("signer")
  ) {
    return "signature_invalid"
  }
  if (message.includes("xml parsing error") || message.includes("xmldom")) {
    return "signature_invalid"
  }
  return "validation_failed"
}
