"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { checkViewPermission, checkCreatePermission, checkDeletePermission } from "@/lib/server-permissions"

export async function getDocuments(filters?: {
  limit?: number
  offset?: number
}) {
  // FIXED: Add RBAC check
  const permissionCheck = await checkViewPermission("documents")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to view documents", data: null, count: 0 }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null, count: 0 }
  }

  // Use optimized helper with caching
  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id
  const companyError = result.error

  if (companyError || !company_id) {
    return { error: companyError || "No company found", data: null }
  }

  // Build query with pagination (default limit 25 for faster initial loads, max 100)
  const limit = Math.min(filters?.limit || 25, 100)
  const offset = filters?.offset || 0

  const { data: documents, error, count } = await supabase
    .from("documents")
    .select("id, name, type, file_url, file_size, upload_date, expiry_date, company_id, truck_id, driver_id", { count: "exact" })
    .eq("company_id", company_id)
    .order("upload_date", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return { error: error.message, data: null, count: 0 }
  }

  return { data: documents || [], error: null, count: count || 0 }
}

export async function deleteDocument(id: string) {
  // FIXED: Add RBAC check
  const permissionCheck = await checkDeletePermission("documents")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to delete documents" }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  // SECURITY: Get user's company_id and verify document belongs to it
  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found" }
  }

  // First, get the document to retrieve the file path (with company_id check)
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("file_url")
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .single()

  if (docError || !document) {
    return { error: docError?.message || "Document not found" }
  }

  // Extract file path from URL
  let filePath = document.file_url

  // Extract path from public URL
  const publicUrlMatch = filePath.match(/\/storage\/v1\/object\/public\/documents\/(.+)$/)
  if (publicUrlMatch) {
    filePath = publicUrlMatch[1]
  } else {
    // Extract path from signed URL or direct path
    const signedUrlMatch = filePath.match(/\/storage\/v1\/object\/[^/]+\/documents\/(.+?)(\?|$)/)
    if (signedUrlMatch) {
      filePath = signedUrlMatch[1]
    } else if (!filePath.includes('/')) {
      // If it's just a path without the full URL, use it as is
      filePath = filePath.replace(/^\/+/, '')
    }
  }

  // Delete file from storage (if path extraction was successful)
  if (filePath && !filePath.includes('http')) {
    const { error: storageError } = await supabase.storage
      .from("documents")
      .remove([filePath])

    // Log storage error but don't fail if file doesn't exist
    if (storageError && !storageError.message.includes('not found')) {
      console.warn("Failed to delete file from storage:", storageError.message)
    }
  }

  // Delete database record (with company_id check)
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("company_id", userData.company_id)
  if (error) return { error: error.message }
  
  revalidatePath("/dashboard/documents")
  return { error: null }
}

// Bulk delete documents
export async function deleteDocuments(ids: string[]) {
  // FIXED: Add RBAC check
  const permissionCheck = await checkDeletePermission("documents")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to delete documents", deletedCount: 0 }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", deletedCount: 0 }
  }

  if (!ids || ids.length === 0) {
    return { error: "No documents selected" }
  }

  // SECURITY: Get user's company_id first
  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found" }
  }

  // Get all documents to retrieve file paths (with company filter)
  const { data: documents, error: docError } = await supabase
    .from("documents")
    .select("id, file_url")
    .in("id", ids)
    .eq("company_id", userData.company_id)

  if (docError || !documents || documents.length === 0) {
    return { error: docError?.message || "Documents not found" }
  }

  // Extract and collect all file paths
  const filePaths: string[] = []
  for (const document of documents) {
    let filePath = document.file_url

    // Extract path from public URL
    const publicUrlMatch = filePath.match(/\/storage\/v1\/object\/public\/documents\/(.+)$/)
    if (publicUrlMatch) {
      filePath = publicUrlMatch[1]
    } else {
      // Extract path from signed URL or direct path
      const signedUrlMatch = filePath.match(/\/storage\/v1\/object\/[^/]+\/documents\/(.+?)(\?|$)/)
      if (signedUrlMatch) {
        filePath = signedUrlMatch[1]
      } else if (!filePath.includes('/')) {
        filePath = filePath.replace(/^\/+/, '')
      }
    }

    if (filePath && !filePath.includes('http')) {
      filePaths.push(filePath)
    }
  }

  // Delete files from storage (batch delete)
  if (filePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("documents")
      .remove(filePaths)

    // Log storage error but don't fail if files don't exist
    if (storageError && !storageError.message.includes('not found')) {
      console.warn("Failed to delete some files from storage:", storageError.message)
    }
  }

  // SECURITY: Delete database records with company_id filter
  const { error } = await supabase
    .from("documents")
    .delete()
    .in("id", ids)
    .eq("company_id", userData.company_id)
  
  if (error) return { error: error.message }
  
  revalidatePath("/dashboard/documents")
  return { error: null, deletedCount: documents.length }
}

// Get signed URL for viewing/downloading a document
export async function getDocumentUrl(documentId: string) {
  // FIXED: Add RBAC check
  const permissionCheck = await checkViewPermission("documents")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to view documents", data: null }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // FIXED: Get user's company_id and filter document query by it
  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id
  const companyError = result.error

  if (companyError || !company_id) {
    return { error: companyError || "No company found", data: null }
  }

  // FIXED: Get document record with company_id filter to prevent cross-company access
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("file_url, name")
    .eq("id", documentId)
    .eq("company_id", company_id) // FIXED: Add company_id filter
    .single()

  if (docError || !document) {
    return { error: docError?.message || "Document not found", data: null }
  }

  // If file_url is already a full URL, try to extract the path
  // Supabase Storage URLs look like: https://xxx.supabase.co/storage/v1/object/public/documents/path
  // or: https://xxx.supabase.co/storage/v1/object/sign/documents/path
  let filePath = document.file_url

  // Extract path from public URL
  const publicUrlMatch = filePath.match(/\/storage\/v1\/object\/public\/documents\/(.+)$/)
  if (publicUrlMatch) {
    filePath = publicUrlMatch[1]
  } else {
    // Extract path from signed URL
    const signedUrlMatch = filePath.match(/\/storage\/v1\/object\/sign\/documents\/(.+?)(\?|$)/)
    if (signedUrlMatch) {
      filePath = signedUrlMatch[1]
    } else if (!filePath.includes('/')) {
      // If it's just a path without the full URL, use it as is
      // Remove any leading slashes
      filePath = filePath.replace(/^\/+/, '')
    }
  }

  // Try to create a signed URL (works for private buckets)
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from("documents")
    .createSignedUrl(filePath, 3600) // 1 hour expiry

  if (!signedUrlError && signedUrlData) {
    return { data: { url: signedUrlData.signedUrl, name: document.name }, error: null }
  }

  // If signed URL fails, try public URL
  const { data: publicUrlData } = supabase.storage
    .from("documents")
    .getPublicUrl(filePath)

  if (publicUrlData?.publicUrl) {
    return { data: { url: publicUrlData.publicUrl, name: document.name }, error: null }
  }

  // Fallback to stored URL
  return { data: { url: document.file_url, name: document.name }, error: null }
}

// Upload a document
export async function uploadDocument(
  file: File,
  metadata?: {
    name?: string
    type?: string
    expiry_date?: string
  }
) {
  // FIXED: Add RBAC check
  const permissionCheck = await checkCreatePermission("documents")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to upload documents", data: null }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Get company_id
  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id
  const companyError = result.error

  if (companyError || !company_id) {
    return { error: companyError || "No company found", data: null }
  }

  try {
    // FIXED: Validate MIME type against allowlist before upload
    const ALLOWED_MIME_TYPES = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
    ]
    
    if (!file.type || !ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return { 
        error: `File type not allowed. Allowed types: PDF, JPEG, PNG, WebP, GIF. Received: ${file.type || 'unknown'}`, 
        data: null 
      }
    }

    // Upload file to Supabase storage
    const fileExt = file.name.split(".").pop()
    const fileName = `${user.id}/${Date.now()}.${fileExt}`
    const filePath = fileName

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      return { error: `Upload failed: ${uploadError.message}`, data: null }
    }

    // FIXED: Store storage path instead of signed URL (generate signed URLs on-demand)
    // Save document record with storage path (not signed URL)
    const { data: documentData, error: docError } = await supabase
      .from("documents")
      .insert({
        company_id: company_id,
        name: metadata?.name || file.name,
        type: metadata?.type || "other",
        file_url: filePath, // FIXED: Store path, not signed URL
        file_size: file.size,
        upload_date: new Date().toISOString().split("T")[0],
        expiry_date: metadata?.expiry_date || null,
      })
      .select()
      .single()

    if (docError) {
      return { error: docError.message, data: null }
    }

    revalidatePath("/dashboard/documents")
    return { data: documentData, error: null }
  } catch (error: any) {
    return { error: error?.message || "Upload failed", data: null }
  }
}

