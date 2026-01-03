"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCompanySettings } from "./number-formats"

/**
 * Auto-attach documents to loads based on settings
 */
export async function autoAttachDocumentsToLoad(loadId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
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
  const { data: load } = await supabase
    .from("loads")
    .select("*")
    .eq("id", loadId)
    .eq("company_id", userData.company_id)
    .single()

  if (!load) {
    return { error: "Load not found", data: null }
  }

  // Find BOL document for this load
  const { data: bolDocuments } = await supabase
    .from("documents")
    .select("*")
    .eq("company_id", userData.company_id)
    .eq("load_id", loadId)
    .ilike("type", "%bol%")
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
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id, role")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  if (userData.role !== 'manager') {
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
    .eq("company_id", userData.company_id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/settings/documents")
  return { data, error: null }
}

