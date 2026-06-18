import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import {
  buildIdpInstance,
  buildSpInstance,
  extractEmailDomain,
  getActiveSsoConfigForDomain,
  storeSsoPendingRequest,
} from "@/lib/sso/idp-config"
import { createSsoAuditLog } from "@/lib/sso/audit"
import { checkSsoLoginRateLimit } from "@/lib/sso/rate-limits"
import { getClientIP, retryAfterFromReset } from "@/lib/rate-limit-redis"

const GENERIC_SSO_ERROR = "SSO is not available for this email address."

/**
 * SP-initiated SAML login (HTTP-Redirect AuthnRequest).
 */
export async function GET(request: NextRequest) {
  const ipAddress = getClientIP(request)
  const userAgent = request.headers.get("user-agent")

  try {
    const email = request.nextUrl.searchParams.get("email")?.trim() || ""
    const domain = extractEmailDomain(email)

    if (!domain) {
      return NextResponse.json({ error: GENERIC_SSO_ERROR }, { status: 400 })
    }

    const rate = await checkSsoLoginRateLimit(domain)
    if (!rate.success) {
      await createSsoAuditLog({
        email,
        emailDomain: domain,
        outcome: "failure",
        failureCategory: "rate_limited",
        ipAddress,
        userAgent,
      })
      return NextResponse.json(
        { error: GENERIC_SSO_ERROR },
        { status: 429, headers: { "Retry-After": retryAfterFromReset(rate.reset) } },
      )
    }

    const config = await getActiveSsoConfigForDomain(domain)
    if (!config) {
      await createSsoAuditLog({
        email,
        emailDomain: domain,
        outcome: "failure",
        failureCategory: "no_active_config",
        ipAddress,
        userAgent,
      })
      return NextResponse.json({ error: GENERIC_SSO_ERROR }, { status: 400 })
    }

    const sp = buildSpInstance()
    const idp = buildIdpInstance(config)
    const loginRequest = sp.createLoginRequest(idp, "redirect")

    const requestId = loginRequest.id
    if (!requestId || !loginRequest.context) {
      Sentry.captureMessage("[SSO login] Failed to create AuthnRequest", "error")
      await createSsoAuditLog({
        companyId: config.company_id,
        email,
        emailDomain: domain,
        outcome: "failure",
        failureCategory: "validation_failed",
        ipAddress,
        userAgent,
      })
      return NextResponse.json({ error: GENERIC_SSO_ERROR }, { status: 400 })
    }

    await storeSsoPendingRequest({ requestId, emailDomain: domain })

    await createSsoAuditLog({
      companyId: config.company_id,
      email,
      emailDomain: domain,
      outcome: "success",
      ipAddress,
      userAgent,
    })

    return NextResponse.redirect(loginRequest.context)
  } catch (error: unknown) {
    Sentry.captureException(error, { tags: { sso_phase: "login" } })
    return NextResponse.json({ error: GENERIC_SSO_ERROR }, { status: 400 })
  }
}
