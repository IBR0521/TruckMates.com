export type CustomerEmailFields = {
  email?: string | null
  primary_contact_email?: string | null
}

/** Prefer main CRM email, then primary contact email. Never use display names. */
export function resolveCustomerEmail(customer: CustomerEmailFields | null | undefined): string | null {
  const main = String(customer?.email ?? "").trim()
  if (isValidEmailAddress(main)) return main

  const primary = String(customer?.primary_contact_email ?? "").trim()
  if (isValidEmailAddress(primary)) return primary

  return null
}

export function isValidEmailAddress(value: string | null | undefined): boolean {
  const v = String(value ?? "").trim()
  if (!v.includes("@")) return false
  const [local, domain] = v.split("@")
  return Boolean(local && domain && domain.includes("."))
}

export function resolveCustomerEmailFromSources(
  sources: Array<string | null | undefined>,
): string | null {
  for (const source of sources) {
    const v = String(source ?? "").trim()
    if (isValidEmailAddress(v)) return v
  }
  return null
}
