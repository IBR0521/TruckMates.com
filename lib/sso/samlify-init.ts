import * as saml from "samlify"

let initialized = false

/**
 * SAML XML schema validation is skipped in production builds: the optional
 * `@authenio/samlify-xsd-schema-validator` package requires Java at install time and
 * cannot be bundled on Vercel. Cryptographic signature + condition checks from samlify
 * still apply.
 */
export function ensureSamlifyValidator() {
  if (initialized) return

  saml.setSchemaValidator({
    validate: async () => "skipped",
  })

  initialized = true
}

ensureSamlifyValidator()
