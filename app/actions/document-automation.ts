"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"
import { getCompanySettings } from "./number-formats"
import { checkCreatePermission, checkViewPermission } from "@/lib/server-permissions"
import { sanitizeError } from "@/lib/error-message"
import * as Sentry from "@sentry/nextjs"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


/**
 * Auto-attach documents to loads based on settings
 */
export async function autoAttachDocumentsToLoad(loadId: string) {
  // FIXED: Add RBAC check
  const permissionCheck = await checkCreatePermission("documents")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to attach documents", data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get company settings
  const settingsResult = await getCompanySettings()
  if (settingsResult.error || !settingsResult.data) {
    return { error: "Failed to get company settings", data: null }
  }

  const settings = settingsResult.data

  if (!settings.auto_attach_bol_to_load) {
    return { data: { attached: 0 }, error: null }
  }

  // Get load
  const { data: load, error: loadError } = await supabase
    .from("loads")
    .select("id, company_id, company_name")
    .eq("id", loadId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (loadError) {
    return { error: loadError.message, data: null }
  }

  if (!load) {
    return { error: "Load not found", data: null }
  }

  // Find BOL document for this load
  // FIXED: Use .eq() instead of .ilike() to match exact type
  const { data: bolDocuments } = await supabase
    .from("documents")
    .select("id, company_id, load_id, type, file_name, file_url, created_at")
    .eq("company_id", ctx.companyId)
    .eq("load_id", loadId)
    .eq("type", "bol") // FIXED: Exact match instead of substring
    .limit(1)

  if (bolDocuments && bolDocuments.length > 0) {
    // BOL already attached
    return { data: { attached: 1, document_id: bolDocuments[0].id }, error: null }
  }

  // Auto-email BOL if enabled
  if (settings.auto_email_bol_to_customer && load.company_name) {
    // This would trigger email sending logic
    // For now, just return success
    return { data: { attached: 0, email_sent: false }, error: null }
  }

  return { data: { attached: 0 }, error: null }
}

/**
 * Get document templates
 */
export async function getDocumentTemplates() {
  // FIXED: Add RBAC check
  const permissionCheck = await checkViewPermission("documents")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to view document templates", data: null }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get company settings for templates
  const settingsResult = await getCompanySettings()
  if (settingsResult.error || !settingsResult.data) {
    return { error: "Failed to get company settings", data: null }
  }

  const settings = settingsResult.data

  const templates = {
    bol_template: settings.bol_template || null,
    invoice_email_template: settings.invoice_email_template || null,
  }

  return { data: templates, error: null }
}

/**
 * Update document templates
 */
export async function updateDocumentTemplates(templates: {
  bol_template?: string
  invoice_email_template?: string
}) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { getUserRole } = await import("@/lib/server-permissions")
  const role = await getUserRole()
  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can update templates", data: null }
  }

  const updateData: any = {}
  if (templates.bol_template !== undefined) {
    updateData.bol_template = templates.bol_template
  }
  if (templates.invoice_email_template !== undefined) {
    updateData.invoice_email_template = templates.invoice_email_template
  }

  const { data, error } = await supabase
    .from("company_settings")
    .update(updateData)
    .eq("company_id", ctx.companyId)
    .select()
    .single()

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  revalidatePath("/dashboard/settings/documents")
  return { data, error: null }
}

