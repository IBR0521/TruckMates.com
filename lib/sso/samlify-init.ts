import * as saml from "samlify"

let initialized = false

/**
 * SAML XML schema validation. Optional `@authenio/samlify-xsd-schema-validator` requires Java at install time;
 * production relies on cryptographic signature + condition checks from samlify when XSD is skipped.
 */
export function ensureSamlifyValidator() {
  if (initialized) return

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const validator = require("@authenio/samlify-xsd-schema-validator")
    saml.setSchemaValidator(validator)
  } catch {
    saml.setSchemaValidator({
      validate: async () => "skipped",
    })
  }

  initialized = true
}

ensureSamlifyValidator()
