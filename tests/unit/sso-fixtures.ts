import * as saml from "samlify"
import forge from "node-forge"

saml.setSchemaValidator({ validate: async () => "valid" })

export type TestKeyMaterial = { privateKey: string; signingCert: string }

export const TEST_APP_URL = "http://localhost:3000"
export const TEST_SP_ENTITY_ID = `${TEST_APP_URL}/api/sso/sp`
export const TEST_ACS_URL = `${TEST_APP_URL}/api/sso/acs`
export const TEST_IDP_ENTITY_ID = "https://idp.test/entity"
export const TEST_EMAIL_DOMAIN = "test.com"
export const TEST_COMPANY_ID = "company-sso-test-001"

/** Cached once — RSA generation is too slow to repeat per test. */
let cachedSpKeys: TestKeyMaterial | null = null
let cachedIdpKeys: TestKeyMaterial | null = null

export function createKeyMaterial(): TestKeyMaterial {
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = "01"
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1)
  const attrs = [{ name: "commonName", value: "sso-test" }]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.sign(keys.privateKey)
  return {
    privateKey: forge.pki.privateKeyToPem(keys.privateKey),
    signingCert: forge.pki.certificateToPem(cert),
  }
}

export function getCachedSpKeys(): TestKeyMaterial {
  if (!cachedSpKeys) cachedSpKeys = createKeyMaterial()
  return cachedSpKeys
}

export function getCachedIdpKeys(): TestKeyMaterial {
  if (!cachedIdpKeys) cachedIdpKeys = createKeyMaterial()
  return cachedIdpKeys
}

export function generateKeyMaterialFresh(): TestKeyMaterial {
  return createKeyMaterial()
}

export function applySsoTestEnv(sp: TestKeyMaterial) {
  process.env.NEXT_PUBLIC_APP_URL = TEST_APP_URL
  process.env.SAML_SP_PRIVATE_KEY = sp.privateKey
  process.env.SAML_SP_CERT = sp.signingCert
}

export function buildTestSsoConfig(idp: TestKeyMaterial) {
  return {
    id: "cfg-1",
    company_id: TEST_COMPANY_ID,
    idp_entity_id: TEST_IDP_ENTITY_ID,
    idp_sso_url: "https://idp.test/sso",
    idp_x509_cert: idp.signingCert,
    email_domain: TEST_EMAIL_DOMAIN,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    planAllowsSso: true as const,
  }
}

export async function createSignedSamlResponse(params: {
  sp: TestKeyMaterial
  idp: TestKeyMaterial
  inResponseTo?: string
  spEntityId?: string
  userEmail?: string
}) {
  const spEntityId = params.spEntityId ?? TEST_SP_ENTITY_ID
  const spInstance = saml.ServiceProvider({
    entityID: spEntityId,
    privateKey: params.sp.privateKey,
    signingCert: params.sp.signingCert,
    authnRequestsSigned: true,
    wantAssertionsSigned: true,
    wantMessageSigned: true,
    assertionConsumerService: [
      {
        Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
        Location: TEST_ACS_URL,
        isDefault: true,
      },
    ],
  })

  const idpInstance = saml.IdentityProvider({
    entityID: TEST_IDP_ENTITY_ID,
    privateKey: params.idp.privateKey,
    signingCert: params.idp.signingCert,
    wantAuthnRequestsSigned: true,
    singleSignOnService: [
      {
        Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
        Location: "https://idp.test/sso",
        isDefault: true,
      },
    ],
  })

  const loginRequest = spInstance.createLoginRequest(idpInstance, "redirect")
  const requestId = params.inResponseTo ?? loginRequest.id
  if (!requestId) {
    throw new Error("missing AuthnRequest id")
  }

  const response = await idpInstance.createLoginResponse(
    spInstance,
    { extract: { request: { id: requestId } } },
    "post",
    { email: params.userEmail ?? `user@${TEST_EMAIL_DOMAIN}` },
    {},
  )

  if (!response.context) {
    throw new Error("missing SAML response context")
  }

  const xml = Buffer.from(response.context, "base64").toString("utf8")
  const assertionIdMatch = xml.match(/<(?:[\w-]+:)?Assertion\b[^>]*\sID="([^"]+)"/i)

  return {
    samlResponse: response.context,
    requestId,
    assertionId: assertionIdMatch?.[1] ?? "",
    xml,
  }
}

export function tamperAssertionContent(base64: string): string {
  const xml = Buffer.from(base64, "base64").toString("utf8")
  const tampered = xml.replace(/user@/g, "hacker@")
  return Buffer.from(tampered, "utf8").toString("base64")
}

export function tamperResponseWrapper(base64: string): string {
  const xml = Buffer.from(base64, "base64").toString("utf8")
  const assertionMatch = xml.match(/<saml:Assertion[\s\S]*<\/saml:Assertion>/)
  if (!assertionMatch) {
    throw new Error("missing assertion for wrapping fixture")
  }

  const inResponseTo = xml.match(/InResponseTo="([^"]+)"/)?.[1] || ""
  const issueInstant = xml.match(/IssueInstant="([^"]+)"/)?.[1] || new Date().toISOString()
  const issuer = xml.match(/<saml:Issuer>([^<]+)<\/saml:Issuer>/)?.[1] || TEST_IDP_ENTITY_ID

  const wrapped =
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
    `ID="_evil-wrapper" Version="2.0" IssueInstant="${issueInstant}" ` +
    `Destination="https://evil.example/acs" InResponseTo="${inResponseTo}">` +
    `<saml:Issuer>${issuer}</saml:Issuer>` +
    `<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>` +
    `${assertionMatch[0]}</samlp:Response>`

  return Buffer.from(wrapped, "utf8").toString("base64")
}

export async function createExpiredSamlResponse(params: {
  sp: TestKeyMaterial
  idp: TestKeyMaterial
  inResponseTo: string
}) {
  const RealDate = globalThis.Date
  const skewedMs = RealDate.now() - 60 * 60 * 1000

  class SkewedDate extends RealDate {
    constructor(...args: [] | [number | string | Date]) {
      if (args.length === 0) {
        super(skewedMs)
      } else {
        super(args[0])
      }
    }

    static now() {
      return skewedMs
    }
  }

  globalThis.Date = SkewedDate as DateConstructor

  try {
    return await createSignedSamlResponse({
      sp: params.sp,
      idp: params.idp,
      inResponseTo: params.inResponseTo,
    })
  } finally {
    globalThis.Date = RealDate
  }
}
