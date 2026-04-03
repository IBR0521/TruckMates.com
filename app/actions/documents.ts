"use server"

import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import { resolveDriverIdForSessionUser } from "@/lib/auth/resolve-driver-for-session"
import { mapLegacyRole } from "@/lib/roles"
import { checkViewPermission, checkCreatePermission, checkDeletePermission } from "@/lib/server-permissions"
import * as Sentry from "@sentry/nextjs"

/**
 * Documents:
 * - **driver** — rows tied to their `drivers.id`, uploads under their auth folder (`{userId}/…` in `file_url`), or fleet can set `driver_id` on upload.
 * - **Fleet** — full company document list (unchanged).
 */

function driverCanAccessDocumentRow(args: {
  driver_id: string | null | undefined
  file_url: string | null | undefined
  myDriverId: string | null
  userId: string
}): boolean {
  const path = args.file_url || ""
  const ownUpload = path.startsWith(`${args.userId}/`)
  if (!args.myDriverId) {
    return ownUpload
  }
  return (args.driver_id != null && String(args.driver_id) === args.myDriverId) || ownUpload
}

export async function getDocuments(filters?: {
  limit?: number
  offset?: number
}) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // FIXED: Add RBAC check
    const permissionCheck = await checkViewPermission("documents")
    if (!permissionCheck.allowed) {
      return { error: permissionCheck.error || "You don't have permission to view documents", data: null, count: 0 }
    }

    const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null, count: 0 }
  }

  const role = ctx.user ? mapLegacyRole(ctx.user.role) : null
  const myDriverId = await resolveDriverIdForSessionUser(supabase, ctx.companyId, ctx.userId, role)

  // Build query with pagination (default limit 25 for faster initial loads, max 100)
  const limit = Math.min(filters?.limit || 25, 100)
  const offset = filters?.offset || 0

  let listQuery = supabase
    .from("documents")
    .select("id, name, type, file_url, file_size, upload_date, expiry_date, company_id, truck_id, driver_id", { count: "exact" })
    .eq("company_id", ctx.companyId)
    .order("upload_date", { ascending: false })

  if (role === "driver") {
    if (myDriverId) {
      listQuery = listQuery.or(
        `driver_id.eq.${myDriverId},file_url.like.${ctx.userId}/%`
      )
    } else {
      listQuery = listQuery.like("file_url", `${ctx.userId}/%`)
    }
  }

  const { data: documents, error, count } = await listQuery.range(offset, offset + limit - 1)

  if (error) {
    return { error: error.message, data: null, count: 0 }
  }

  return { data: documents || [], error: null, count: count || 0 }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred"), data: null, count: 0 }
  }
}

export async function deleteDocument(id: string) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    // FIXED: Add RBAC check
    const permissionCheck = await checkDeletePermission("documents")
    if (!permissionCheck.allowed) {
      return { error: permissionCheck.error || "You don't have permission to delete documents" }
    }

    const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated" }
  }

  const role = ctx.user ? mapLegacyRole(ctx.user.role) : null
  const myDriverId = await resolveDriverIdForSessionUser(supabase, ctx.companyId, ctx.userId, role)

  // First, get the document to retrieve the file path (with company_id check)
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("file_url, driver_id")
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .single()

  if (docError || !document) {
    return { error: docError?.message || "Document not found" }
  }

  if (
    role === "driver" &&
    !driverCanAccessDocumentRow({
      driver_id: document.driver_id,
      file_url: document.file_url,
      myDriverId,
      userId: ctx.userId,
    })
  ) {
    return { error: "Document not found" }
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
      Sentry.captureMessage(`Failed to delete file from storage: ${storageError.message}`, "warning")
    }
  }

  // Delete database record (with company_id check)
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.companyId)
  if (error) return { error: error.message }
  
  revalidatePath("/dashboard/documents")
  return { error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "An unexpected error occurred") }
  }
}

// Bulk delete documents
export async function deleteDocuments(ids: string[]) {
  // FIXED: Add RBAC check
  const permissionCheck = await checkDeletePermission("documents")
  if (!permissionCheck.allowed) {
    return { error: permissionCheck.error || "You don't have permission to delete documents", deletedCount: 0 }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", deletedCount: 0 }
  }

  const role = ctx.user ? mapLegacyRole(ctx.user.role) : null
  const myDriverId = await resolveDriverIdForSessionUser(supabase, ctx.companyId, ctx.userId, role)

  if (!ids || ids.length === 0) {
    return { error: "No documents selected" }
  }

  // Get all documents to retrieve file paths (with company filter)
  const { data: documents, error: docError } = await supabase
    .from("documents")
    .select("id, file_url, driver_id")
    .in("id", ids)
    .eq("company_id", ctx.companyId)

  if (docError || !documents || documents.length === 0) {
    return { error: docError?.message || "Documents not found" }
  }

  if (role === "driver") {
    const forbidden = documents.some(
      (d: { driver_id: string | null; file_url: string | null }) =>
        !driverCanAccessDocumentRow({
          driver_id: d.driver_id,
          file_url: d.file_url,
          myDriverId,
          userId: ctx.userId,
        })
    )
    if (forbidden) {
      return { error: "You can only delete your own documents.", deletedCount: 0 }
    }
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
      Sentry.captureMessage(`Failed to delete some files from storage: ${storageError.message}`, "warning")
    }
  }

  // SECURITY: Delete database records with company_id filter
  const { error } = await supabase
    .from("documents")
    .delete()
    .in("id", ids)
    .eq("company_id", ctx.companyId)
  
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const role = ctx.user ? mapLegacyRole(ctx.user.role) : null
  const myDriverId = await resolveDriverIdForSessionUser(supabase, ctx.companyId, ctx.userId, role)

  // FIXED: Get document record with company_id filter to prevent cross-company access
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("file_url, name, driver_id")
    .eq("id", documentId)
    .eq("company_id", ctx.companyId)
    .single()

  if (docError || !document) {
    return { error: docError?.message || "Document not found", data: null }
  }

  if (
    role === "driver" &&
    !driverCanAccessDocumentRow({
      driver_id: document.driver_id,
      file_url: document.file_url,
      myDriverId,
      userId: ctx.userId,
    })
  ) {
    return { error: "Document not found", data: null }
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
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const role = ctx.user ? mapLegacyRole(ctx.user.role) : null
  const myDriverId = await resolveDriverIdForSessionUser(supabase, ctx.companyId, ctx.userId, role)

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
    const fileName = `${ctx.userId}/${Date.now()}.${fileExt}`
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
        company_id: ctx.companyId,
        name: metadata?.name || file.name,
        type: metadata?.type || "other",
        file_url: filePath, // FIXED: Store path, not signed URL
        file_size: file.size,
        upload_date: new Date().toISOString().split("T")[0],
        expiry_date: metadata?.expiry_date || null,
        ...(role === "driver" && myDriverId ? { driver_id: myDriverId } : {}),
      })
      .select()
      .single()

    if (docError) {
      return { error: docError.message, data: null }
    }

    revalidatePath("/dashboard/documents")
    return { data: documentData, error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Upload failed"), data: null }
  }
}

