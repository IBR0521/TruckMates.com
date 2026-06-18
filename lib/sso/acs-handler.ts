import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import "@/lib/sso/samlify-init"
import {
  buildIdpInstance,
  buildSpInstance,
  consumeSsoPendingRequest,
  extractInResponseToFromSamlResponse,
  extractIssuerFromSamlResponse,
  getActiveSsoConfigByIssuer,
} from "@/lib/sso/idp-config"
import {
  extractAssertionIdFromSamlResponse,
  extractNotOnOrAfterFromSamlResponse,
  reserveConsumedAssertion,
} from "@/lib/sso/assertion-replay"
import {
  classifySamlParseError,
  createSsoAuditLog,
  shouldCaptureSsoSecurityEvent,
  ssoSecuritySentryLevel,
  type SsoFailureCategory,
} from "@/lib/sso/audit"
import { provisionSsoUserAndCreateSession } from "@/lib/sso/provision-user"
import { getSamlAppBaseUrl } from "@/lib/sso/sp-metadata"
import {
  validateParsedSamlConstraints,
  validateSamlAudienceFromXml,
  validateSamlDestinationFromXml,
} from "@/lib/sso/saml-assertion-checks"

export type SsoAcsRequestContext = {
  ipAddress?: string | null
  userAgent?: string | null
}

function ssoErrorRedirect() {
  const url = new URL("/auth/sso-error", getSamlAppBaseUrl())
  return NextResponse.redirect(url)
}

async function logSsoFailure(params: {
  category: SsoFailureCategory
  companyId?: string | null
  email?: string | null
  emailDomain?: string | null
  issuer?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}) {
  await createSsoAuditLog({
    companyId: params.companyId,
    email: params.email,
    emailDomain: params.emailDomain,
    issuer: params.issuer,
    outcome: "failure",
    failureCategory: params.category,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  })

  if (shouldCaptureSsoSecurityEvent(params.category)) {
    Sentry.captureMessage(`[SSO ACS] ${params.category}`, {
      level: ssoSecuritySentryLevel(params.category),
      tags: { sso_phase: "acs", sso_failure_category: params.category },
      extra: {
        companyId: params.companyId ?? undefined,
        issuer: params.issuer ?? undefined,
        emailDomain: params.emailDomain ?? undefined,
      },
    })
  }
}

async function logSsoSuccess(params: {
  companyId: string
  email: string
  emailDomain: string
  issuer?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}) {
  await createSsoAuditLog({
    companyId: params.companyId,
    email: params.email,
    emailDomain: params.emailDomain,
    issuer: params.issuer,
    outcome: "success",
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  })
}

/**
 * Core ACS handler (Phase 2 flow + Phase 3 hardening). Used by the route and unit tests.
 */
export async function handleSsoAcsPost(
  samlResponse: string,
  relayState: string | null | undefined,
  context: SsoAcsRequestContext = {},
): Promise<NextResponse> {
  let issuer: string | null = null
  let companyId: string | undefined
  let emailDomain: string | undefined

  try {
    if (!samlResponse) {
      await logSsoFailure({
        category: "missing_saml_response",
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      })
      return ssoErrorRedirect()
    }

    issuer = extractIssuerFromSamlResponse(samlResponse)
    if (!issuer) {
      await logSsoFailure({
        category: "missing_issuer",
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      })
      return ssoErrorRedirect()
    }

    const config = await getActiveSsoConfigByIssuer(issuer)
    if (!config) {
      await logSsoFailure({
        category: "no_active_config",
        issuer,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      })
      return ssoErrorRedirect()
    }

    companyId = config.company_id
    emailDomain = config.email_domain

    const inResponseTo = extractInResponseToFromSamlResponse(samlResponse)
    if (!inResponseTo) {
      await logSsoFailure({
        category: "missing_in_response_to",
        companyId,
        emailDomain,
        issuer,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      })
      return ssoErrorRedirect()
    }

    const pendingOk = await consumeSsoPendingRequest({
      requestId: inResponseTo,
      emailDomain: config.email_domain,
    })
    if (!pendingOk) {
      await logSsoFailure({
        category: "request_correlation_failed",
        companyId,
        emailDomain,
        issuer,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      })
      return ssoErrorRedirect()
    }

    const audienceXmlIssue = validateSamlAudienceFromXml(samlResponse)
    if (audienceXmlIssue) {
      await logSsoFailure({
        category: audienceXmlIssue,
        companyId,
        emailDomain,
        issuer,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      })
      return ssoErrorRedirect()
    }

    const destinationXmlIssue = validateSamlDestinationFromXml(samlResponse)
    if (destinationXmlIssue) {
      await logSsoFailure({
        category: destinationXmlIssue,
        companyId,
        emailDomain,
        issuer,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      })
      return ssoErrorRedirect()
    }

    const sp = buildSpInstance()
    const idp = buildIdpInstance(config)

    const httpRequest = {
      body: {
        SAMLResponse: samlResponse,
        RelayState: relayState ?? undefined,
      },
    }

    const parseResult = await sp.parseLoginResponse(idp, "post", httpRequest)
    const extract = parseResult?.extract
    if (!extract) {
      await logSsoFailure({
        category: "parse_missing_extract",
        companyId,
        emailDomain,
        issuer,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      })
      return ssoErrorRedirect()
    }

    const constraintIssue = validateParsedSamlConstraints(extract)
    if (constraintIssue) {
      await logSsoFailure({
        category: constraintIssue,
        companyId,
        emailDomain,
        issuer,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      })
      return ssoErrorRedirect()
    }

    const assertionId = extractAssertionIdFromSamlResponse(samlResponse)
    if (!assertionId) {
      await logSsoFailure({
        category: "validation_failed",
        companyId,
        emailDomain,
        issuer,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      })
      return ssoErrorRedirect()
    }

    const notOnOrAfter = extractNotOnOrAfterFromSamlResponse(samlResponse)
    const replay = await reserveConsumedAssertion({
      assertionId,
      companyId: config.company_id,
      notOnOrAfter,
    })
    if (replay === "replay") {
      await logSsoFailure({
        category: "replay_detected",
        companyId,
        emailDomain,
        issuer,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      })
      return ssoErrorRedirect()
    }

    const provisioned = await provisionSsoUserAndCreateSession({
      companyId: config.company_id,
      emailDomain: config.email_domain,
      assertion: extract,
    })

    if (!provisioned.ok) {
      await logSsoFailure({
        category: "provisioning_failed",
        companyId,
        emailDomain,
        email: undefined,
        issuer,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      })
      return ssoErrorRedirect()
    }

    await logSsoSuccess({
      companyId: config.company_id,
      email: provisioned.email,
      emailDomain: config.email_domain,
      issuer,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    })

    return NextResponse.redirect(provisioned.magicLinkUrl)
  } catch (error: unknown) {
    const category = classifySamlParseError(error)
    await logSsoFailure({
      category,
      companyId,
      emailDomain,
      issuer,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    })

    if (!shouldCaptureSsoSecurityEvent(category)) {
      Sentry.captureException(error, {
        level: "warning",
        tags: { sso_phase: "acs", sso_failure_category: category },
        extra: { issuer: issuer || "unknown", companyId: companyId || "unknown" },
      })
    }

    return ssoErrorRedirect()
  }
}

export async function POST(request: NextRequest) {
  const { getClientIP } = await import("@/lib/rate-limit-redis")
  const { checkSsoAcsRateLimit } = await import("@/lib/sso/rate-limits")
  const { retryAfterFromReset } = await import("@/lib/rate-limit-redis")
  const { createSsoAuditLog } = await import("@/lib/sso/audit")

  const ipAddress = getClientIP(request)
  const rate = await checkSsoAcsRateLimit(ipAddress)
  if (!rate.success) {
    await createSsoAuditLog({
      outcome: "failure",
      failureCategory: "rate_limited",
      ipAddress,
      userAgent: request.headers.get("user-agent"),
    })
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": retryAfterFromReset(rate.reset) } },
    )
  }

  const form = await request.formData()
  const samlResponse = String(form.get("SAMLResponse") || "")
  const relayState = form.get("RelayState")

  return handleSsoAcsPost(samlResponse, relayState ? String(relayState) : null, {
    ipAddress,
    userAgent: request.headers.get("user-agent"),
  })
}
