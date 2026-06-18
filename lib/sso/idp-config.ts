import "@/lib/sso/samlify-init"
import * as saml from "samlify"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkFeatureAccess } from "@/lib/plan-enforcement"
import { getSpAcsUrl, getSpEntityId } from "@/lib/sso/sp-metadata"
import type { CompanySsoConfig } from "@/app/actions/sso-settings"

const SAML_POST_BINDING = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
const SAML_REDIRECT_BINDING = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"

const SSO_CONFIG_SELECT =
  "id, company_id, idp_entity_id, idp_sso_url, idp_x509_cert, email_domain, is_active, created_at, updated_at"

export type ActiveSsoConfig = CompanySsoConfig & {
  planAllowsSso: true
}

function normalizePem(value: string): string {
  const trimmed = value.trim()
  return trimmed.includes("\\n") ? trimmed.replace(/\\n/g, "\n") : trimmed
}

function getSpKeyMaterial(): { privateKey: string; signingCert: string } {
  const privateKey = normalizePem(process.env.SAML_SP_PRIVATE_KEY || "")
  const signingCert = normalizePem(process.env.SAML_SP_CERT || "")
  if (!privateKey || !signingCert) {
    throw new Error("SAML SP keys are not configured")
  }
  return { privateKey, signingCert }
}

export function extractEmailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase()
  const at = trimmed.lastIndexOf("@")
  if (at <= 0 || at === trimmed.length - 1) return null
  const domain = trimmed.slice(at + 1)
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
    return null
  }
  return domain
}

export async function getActiveSsoConfigForDomain(
  emailDomain: string,
): Promise<ActiveSsoConfig | null> {
  const domain = emailDomain.trim().toLowerCase().replace(/^@+/, "")
  if (!domain) return null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("company_sso_config")
    .select(SSO_CONFIG_SELECT)
    .eq("email_domain", domain)
    .eq("is_active", true)
    .maybeSingle()

  if (error || !data) return null

  const gate = await checkFeatureAccess({ companyId: data.company_id, feature: "sso" })
  if (!gate.allowed) return null

  return { ...(data as CompanySsoConfig), planAllowsSso: true }
}

export async function getActiveSsoConfigByIssuer(
  issuer: string,
): Promise<ActiveSsoConfig | null> {
  const normalizedIssuer = issuer.trim()
  if (!normalizedIssuer) return null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("company_sso_config")
    .select(SSO_CONFIG_SELECT)
    .eq("idp_entity_id", normalizedIssuer)
    .eq("is_active", true)
    .maybeSingle()

  if (error || !data) return null

  const gate = await checkFeatureAccess({ companyId: data.company_id, feature: "sso" })
  if (!gate.allowed) return null

  return { ...(data as CompanySsoConfig), planAllowsSso: true }
}

export function buildIdpInstance(config: Pick<CompanySsoConfig, "idp_entity_id" | "idp_sso_url" | "idp_x509_cert">) {
  return saml.IdentityProvider({
    entityID: config.idp_entity_id,
    signingCert: normalizePem(config.idp_x509_cert),
    wantAuthnRequestsSigned: true,
    singleSignOnService: [
      {
        Binding: SAML_REDIRECT_BINDING,
        Location: config.idp_sso_url,
        isDefault: true,
      },
      {
        Binding: SAML_POST_BINDING,
        Location: config.idp_sso_url,
      },
    ],
  })
}

export function buildSpInstance() {
  const { privateKey, signingCert } = getSpKeyMaterial()

  return saml.ServiceProvider({
    entityID: getSpEntityId(),
    privateKey,
    signingCert,
    authnRequestsSigned: true,
    wantAssertionsSigned: true,
    wantMessageSigned: true,
    assertionConsumerService: [
      {
        Binding: SAML_POST_BINDING,
        Location: getSpAcsUrl(),
        isDefault: true,
      },
    ],
    nameIDFormat: ["urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"],
  })
}

/** Untrusted peek — used only to select IdP metadata before cryptographic validation. */
export function extractIssuerFromSamlResponse(samlResponseBase64: string): string | null {
  try {
    const xml = Buffer.from(samlResponseBase64, "base64").toString("utf8")
    const match = xml.match(/<(?:[\w-]+:)?Issuer\b[^>]*>([^<]+)<\/(?:[\w-]+:)?Issuer>/i)
    return match?.[1]?.trim() || null
  } catch {
    return null
  }
}

export function extractInResponseToFromSamlResponse(samlResponseBase64: string): string | null {
  try {
    const xml = Buffer.from(samlResponseBase64, "base64").toString("utf8")
    const match = xml.match(/InResponseTo="([^"]+)"/i)
    return match?.[1]?.trim() || null
  } catch {
    return null
  }
}

export async function purgeExpiredSsoPendingRequests(): Promise<void> {
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  await admin.from("sso_pending_requests").delete().lt("created_at", cutoff)
}

export async function consumeSsoPendingRequest(params: {
  requestId: string
  emailDomain: string
}): Promise<boolean> {
  await purgeExpiredSsoPendingRequests()
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const { data, error } = await admin
    .from("sso_pending_requests")
    .select("id")
    .eq("request_id", params.requestId)
    .eq("email_domain", params.emailDomain)
    .gte("created_at", cutoff)
    .maybeSingle()

  if (error || !data) return false

  const { error: deleteError } = await admin.from("sso_pending_requests").delete().eq("id", data.id)
  return !deleteError
}

export async function storeSsoPendingRequest(params: {
  requestId: string
  emailDomain: string
}): Promise<void> {
  await purgeExpiredSsoPendingRequests()
  const admin = createAdminClient()
  const { error } = await admin.from("sso_pending_requests").insert({
    request_id: params.requestId,
    email_domain: params.emailDomain,
  })
  if (error) {
    throw new Error(error.message)
  }
}

export async function isSsoAvailableForEmail(email: string): Promise<boolean> {
  const domain = extractEmailDomain(email)
  if (!domain) return false
  const config = await getActiveSsoConfigForDomain(domain)
  return Boolean(config)
}
