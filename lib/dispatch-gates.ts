export type CompanyDispatchSettings = {
  require_bol_before_dispatch?: boolean | null
  require_documents_before_dispatch?: boolean | null
  required_documents?: unknown
}

export type DispatchGateContext = {
  loadId: string
  currentStatus?: string
  nextStatus: string
  settings: CompanyDispatchSettings | null | undefined
  hasBol: boolean
  attachedDocumentTypes: string[]
}

const DISPATCH_STATUSES = new Set(["scheduled", "in_transit"])

export function isDispatchStatus(status: string): boolean {
  return DISPATCH_STATUSES.has(String(status || "").toLowerCase())
}

/** True when moving onto the dispatch path (not when editing an already-dispatched load). */
export function isDispatchTransition(currentStatus: string, nextStatus: string): boolean {
  const current = String(currentStatus || "").toLowerCase()
  const next = String(nextStatus || "").toLowerCase()
  if (!isDispatchStatus(next)) return false
  if (!isDispatchStatus(current)) return true
  return current === "scheduled" && next === "in_transit"
}

function parseRequiredDocumentTypes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((v) => String(v || "").trim().toLowerCase()).filter(Boolean)
}

export function getDispatchGateErrors(ctx: DispatchGateContext): string[] {
  if (!isDispatchStatus(ctx.nextStatus)) return []
  if (
    ctx.currentStatus != null &&
    !isDispatchTransition(ctx.currentStatus, ctx.nextStatus)
  ) {
    return []
  }

  const errors: string[] = []
  const settings = ctx.settings

  if (settings?.require_bol_before_dispatch && !ctx.hasBol) {
    errors.push("A Bill of Lading (BOL) is required before dispatching this load.")
  }

  if (settings?.require_documents_before_dispatch) {
    const required = parseRequiredDocumentTypes(settings.required_documents)
    if (required.length > 0) {
      const attached = new Set(ctx.attachedDocumentTypes.map((t) => t.toLowerCase()))
      const missing = required.filter((docType) => !attached.has(docType))
      if (missing.length > 0) {
        errors.push(`Required documents missing before dispatch: ${missing.join(", ")}.`)
      }
    }
  }

  return errors
}
