"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getDocuments() {
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

  const { data: documents, error } = await supabase
    .from("documents")
    .select("*")
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: documents, error: null }
}

export async function deleteDocument(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("documents").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/dashboard/documents")
  return { error: null }
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

