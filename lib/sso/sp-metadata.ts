import * as saml from "samlify"

/**
 * SAML SP key pair (server-only). Generate once and store in env / secrets manager:
 *
 *   openssl req -x509 -newkey rsa:2048 -keyout saml-sp.key -out saml-sp.crt -days 3650 -nodes \
 *     -subj "/CN=TruckMates SAML SP/O=TruckMates"
 *
 * Then set:
 *   SAML_SP_PRIVATE_KEY — PEM contents of saml-sp.key (include -----BEGIN/END----- lines)
 *   SAML_SP_CERT        — PEM contents of saml-sp.crt
 *
 * ACS login flow is Phase 2; ACS URL is included in metadata for IdP setup now.
 */

const SAML_POST_BINDING = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"

export function getSamlAppBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  return raw.replace(/\/+$/, "")
}

export function getSpEntityId(): string {
  return `${getSamlAppBaseUrl()}/api/sso/sp`
}

export function getSpAcsUrl(): string {
  return `${getSamlAppBaseUrl()}/api/sso/acs`
}

export function getSpMetadataDownloadUrl(): string {
  return `${getSamlAppBaseUrl()}/api/sso/metadata`
}

function normalizePem(value: string | undefined, label: string): string {
  const trimmed = (value || "").trim()
  if (!trimmed) {
    throw new Error(`${label} is not configured`)
  }
  return trimmed.includes("\\n") ? trimmed.replace(/\\n/g, "\n") : trimmed
}

function getSpKeyMaterial(): { privateKey: string; signingCert: string } {
  return {
    privateKey: normalizePem(process.env.SAML_SP_PRIVATE_KEY, "SAML_SP_PRIVATE_KEY"),
    signingCert: normalizePem(process.env.SAML_SP_CERT, "SAML_SP_CERT"),
  }
}

export function createServiceProvider() {
  const { privateKey, signingCert } = getSpKeyMaterial()

  return saml.ServiceProvider({
    entityID: getSpEntityId(),
    privateKey,
    signingCert,
    authnRequestsSigned: true,
    wantAssertionsSigned: true,
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

export function generateSpMetadataXml(): string {
  const sp = createServiceProvider()
  return sp.getMetadata()
}

export function getSpMetadataSummary() {
  return {
    entityId: getSpEntityId(),
    acsUrl: getSpAcsUrl(),
    metadataUrl: getSpMetadataDownloadUrl(),
  }
}
