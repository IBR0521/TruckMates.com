"use server"

/**
 * CRM Document Management Actions
 * Handles W9, COI, MC certificates, insurance policies, etc. with expiration tracking
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { revalidatePath } from "next/cache"

export interface CRMDocument {
  id: string
  company_id: string
  customer_id: string | null
  vendor_id: string | null
  document_type: "w9" | "coi" | "mc_certificate" | "insurance_policy" | "license" | "contract" | "other"
  name: string
  description: string | null
  storage_url: string
  file_size: number | null
  mime_type: string | null
  expiration_date: string | null
  expiration_alert_sent: boolean
  uploaded_by: string | null
  uploaded_at: string
  created_at: string
  updated_at: string
  customer_name?: string | null
  vendor_name?: string | null
}

export interface ExpiringDocument extends CRMDocument {
  days_until_expiration: number
}

/**
 * Upload a CRM document
 */
export async function uploadCRMDocument(
  file: File,
  metadata: {
    customer_id?: string
    vendor_id?: string
    document_type: CRMDocument["document_type"]
    name: string
    description?: string
    expiration_date?: string
  }
): Promise<{ data: CRMDocument | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  // Validate that either customer_id or vendor_id is provided
  if (!metadata.customer_id && !metadata.vendor_id) {
    return { error: "Either customer_id or vendor_id must be provided", data: null }
  }

  try {
    // Upload file to Supabase Storage
    const fileExt = file.name.split(".").pop()
    const fileName = `crm/${user.id}/${Date.now()}.${fileExt}`
    const filePath = fileName

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) {
      return { error: `Upload failed: ${uploadError.message}`, data: null }
    }

    // Create signed URL for storage
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from("documents")
      .createSignedUrl(filePath, 31536000) // 1 year expiry

    const fileUrl = signedError
      ? `https://${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("https://", "").split("/")[0]}/storage/v1/object/public/documents/${filePath}`
      : signedUrlData?.signedUrl || filePath

    // Save document record
    const { data: documentData, error: docError } = await supabase
      .from("crm_documents")
      .insert({
        company_id: company_id,
        customer_id: metadata.customer_id || null,
        vendor_id: metadata.vendor_id || null,
        document_type: metadata.document_type,
        name: metadata.name,
        description: metadata.description || null,
        storage_url: fileUrl,
        file_size: file.size,
        mime_type: file.type,
        expiration_date: metadata.expiration_date || null,
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (docError) {
      return { error: docError.message, data: null }
    }

    revalidatePath("/dashboard/crm")
    return { data: documentData as CRMDocument, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to upload document", data: null }
  }
}

/**
 * Get all documents for a customer or vendor
 */
export async function getCRMDocuments(filters?: {
  customer_id?: string
  vendor_id?: string
  document_type?: CRMDocument["document_type"]
  include_expired?: boolean
}): Promise<{ data: CRMDocument[] | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    let query = supabase
      .from("crm_documents")
      .select(`
        *,
        customers:customer_id(name),
        vendors:vendor_id(name)
      `)
      .eq("company_id", company_id)

    if (filters?.customer_id) {
      query = query.eq("customer_id", filters.customer_id)
    }
    if (filters?.vendor_id) {
      query = query.eq("vendor_id", filters.vendor_id)
    }
    if (filters?.document_type) {
      query = query.eq("document_type", filters.document_type)
    }
    if (!filters?.include_expired) {
      query = query.or("expiration_date.is.null,expiration_date.gte." + new Date().toISOString().split("T")[0])
    }

    const { data, error } = await query.order("created_at", { ascending: false })

    if (error) {
      return { error: error.message, data: null }
    }

    // Format the response
    const formattedData = (data || []).map((doc: any) => ({
      ...doc,
      customer_name: doc.customers?.name || null,
      vendor_name: doc.vendors?.name || null,
    }))

    return { data: formattedData as CRMDocument[], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get documents", data: null }
  }
}

/**
 * Get expiring documents
 */
export async function getExpiringCRMDocuments(
  daysAhead: number = 30
): Promise<{ data: ExpiringDocument[] | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    // If the RPC function doesn't exist, fall back to direct query
    const { data, error } = await supabase.rpc("get_expiring_crm_documents", {
      days_ahead: daysAhead,
    })

    if (error) {
      // Fallback: Query directly if RPC function doesn't exist
      console.warn("[CRM Documents] RPC function error, using direct query:", error.message)
      
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + daysAhead)
      
      const { data: directData, error: directError } = await supabase
        .from("crm_documents")
        .select(`
          *,
          customers:customer_id(name),
          vendors:vendor_id(name)
        `)
        .eq("company_id", company_id)
        .not("expiration_date", "is", null)
        .gte("expiration_date", new Date().toISOString().split("T")[0])
        .lte("expiration_date", endDate.toISOString().split("T")[0])
        .order("expiration_date", { ascending: true })

      if (directError) {
        return { error: directError.message, data: null }
      }

      // Calculate days until expiration
      const formattedData = (directData || []).map((doc: any) => {
        const expirationDate = new Date(doc.expiration_date)
        const today = new Date()
        const daysUntil = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        
        return {
          ...doc,
          customer_name: doc.customers?.name || null,
          vendor_name: doc.vendors?.name || null,
          days_until_expiration: daysUntil,
        } as ExpiringDocument
      })

      return { data: formattedData, error: null }
    }

    return { data: data as ExpiringDocument[], error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get expiring documents", data: null }
  }
}

/**
 * Delete a CRM document
 */
export async function deleteCRMDocument(documentId: string): Promise<{
  data: boolean | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    // Get document to find storage path
    const { data: document, error: fetchError } = await supabase
      .from("crm_documents")
      .select("storage_url, company_id")
      .eq("id", documentId)
      .eq("company_id", company_id)
      .single()

    if (fetchError || !document) {
      return { error: "Document not found", data: null }
    }

    // Delete from storage (extract path from URL)
    const storagePath = document.storage_url.split("/").slice(-2).join("/")
    if (storagePath) {
      await supabase.storage.from("documents").remove([storagePath])
    }

    // Delete from database
    const { error: deleteError } = await supabase.from("crm_documents").delete().eq("id", documentId)

    if (deleteError) {
      return { error: deleteError.message, data: null }
    }

    revalidatePath("/dashboard/crm")
    return { data: true, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to delete document", data: null }
  }
}

/**
 * Update document expiration alert status
 */
export async function markExpirationAlertSent(
  documentId: string
): Promise<{ data: boolean | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    const { error } = await supabase
      .from("crm_documents")
      .update({ expiration_alert_sent: true })
      .eq("id", documentId)
      .eq("company_id", company_id)

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: true, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to update alert status", data: null }
  }
}


