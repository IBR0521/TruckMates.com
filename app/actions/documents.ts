"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedUserCompany } from "@/lib/query-optimizer"

export async function getDocuments(filters?: {
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
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
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  // First, get the document to retrieve the file path
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("file_url")
    .eq("id", id)
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

  // Delete database record
  const { error } = await supabase.from("documents").delete().eq("id", id)
  if (error) return { error: error.message }
  
  revalidatePath("/dashboard/documents")
  return { error: null }
}

// Bulk delete documents
export async function deleteDocuments(ids: string[]) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  if (!ids || ids.length === 0) {
    return { error: "No documents selected" }
  }

  // Get all documents to retrieve file paths
  const { data: documents, error: docError } = await supabase
    .from("documents")
    .select("id, file_url")
    .in("id", ids)

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

  // Delete database records
  const { error } = await supabase.from("documents").delete().in("id", ids)
  if (error) return { error: error.message }
  
  revalidatePath("/dashboard/documents")
  return { error: null, deletedCount: documents.length }
}

// Get signed URL for viewing/downloading a document
export async function getDocumentUrl(documentId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Get document record
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("file_url, name")
    .eq("id", documentId)
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

    // Create signed URL for storage
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from("documents")
      .createSignedUrl(filePath, 31536000) // 1 year expiry

    if (signedError || !signedUrlData?.signedUrl) {
      // Try public URL as fallback
      const { data: publicUrlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath)
      
      const fileUrl = publicUrlData?.publicUrl || filePath

      // Save document record
      const { data: documentData, error: docError } = await supabase
        .from("documents")
        .insert({
          company_id: company_id,
          name: metadata?.name || file.name,
          type: metadata?.type || "other",
          file_url: fileUrl,
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
    }

    // Save document record with signed URL
    const { data: documentData, error: docError } = await supabase
      .from("documents")
      .insert({
        company_id: company_id,
        name: metadata?.name || file.name,
        type: metadata?.type || "other",
        file_url: signedUrlData.signedUrl,
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

