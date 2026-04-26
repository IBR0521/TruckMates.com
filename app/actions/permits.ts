"use server"

import * as Sentry from "@sentry/nextjs"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { checkCreatePermission, checkViewPermission } from "@/lib/server-permissions"
import { validateFileMagicBytes } from "@/lib/file-signature"

function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}

export async function getPermits(filters?: { load_id?: string; truck_id?: string }) {
  const permission = await checkViewPermission("documents")
  if (!permission.allowed) return { error: permission.error || "Not allowed", data: null }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  let query = supabase
    .from("permits")
    .select("id, permit_number, issuing_state, permit_type, issued_date, expiry_date, max_weight, max_height, max_width, max_length, route_restriction, load_id, truck_id, document_id")
    .eq("company_id", ctx.companyId)
    .order("expiry_date", { ascending: true, nullsFirst: false })

  if (filters?.load_id) query = query.eq("load_id", filters.load_id)
  if (filters?.truck_id) query = query.eq("truck_id", filters.truck_id)

  const { data, error } = await query
  if (error) return { error: safeDbError(error), data: null }
  return { data: data || [], error: null }
}

export async function createPermit(input: {
  permit_number: string
  issuing_state: string
  permit_type: string
  issued_date?: string
  expiry_date?: string
  max_weight?: number
  max_height?: number
  max_width?: number
  max_length?: number
  route_restriction?: string
  load_id?: string
  truck_id?: string
}) {
  const permission = await checkCreatePermission("documents")
  if (!permission.allowed) return { error: permission.error || "Not allowed", data: null }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

  const { data, error } = await supabase
    .from("permits")
    .insert({
      company_id: ctx.companyId,
      permit_number: input.permit_number,
      issuing_state: input.issuing_state,
      permit_type: input.permit_type,
      issued_date: input.issued_date || null,
      expiry_date: input.expiry_date || null,
      max_weight: input.max_weight ?? null,
      max_height: input.max_height ?? null,
      max_width: input.max_width ?? null,
      max_length: input.max_length ?? null,
      route_restriction: input.route_restriction || null,
      load_id: input.load_id || null,
      truck_id: input.truck_id || null,
    })
    .select("*")
    .single()

  if (error) return { error: safeDbError(error), data: null }

  if (input.load_id) revalidatePath(`/dashboard/loads/${input.load_id}`)
  revalidatePath("/dashboard/documents")
  return { data, error: null }
}

export async function uploadPermitDocument(permitId: string, file: File) {
  const permission = await checkCreatePermission("documents")
  if (!permission.allowed) return { error: permission.error || "Not allowed", data: null }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) return { error: ctx.error || "Not authenticated", data: null }

  try {
    const { data: permit, error: permitError } = await supabase
      .from("permits")
      .select("id, load_id, permit_number")
      .eq("id", permitId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()
    if (permitError || !permit) return { error: "Permit not found", data: null }

    const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"]
    if (!file.type || !ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return { error: "File type not allowed. Use PDF/JPG/PNG/WebP.", data: null }
    }
    const magicValidation = await validateFileMagicBytes(file, ALLOWED_MIME_TYPES)
    if (!magicValidation.valid) {
      return { error: "File content does not match declared type.", data: null }
    }

    const fileExt = file.name.split(".").pop() || "pdf"
    const filePath = `${ctx.userId}/permits/${permitId}-${Date.now()}.${fileExt}`
    const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    })
    if (uploadError) return { error: `Upload failed: ${uploadError.message}`, data: null }

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .insert({
        company_id: ctx.companyId,
        load_id: permit.load_id || null,
        name: `Permit ${permit.permit_number}`,
        type: "permit",
        file_url: filePath,
        file_size: file.size,
        upload_date: new Date().toISOString().split("T")[0],
      })
      .select("id")
      .single()
    if (docError || !doc) return { error: docError?.message || "Failed to save document row", data: null }

    const { error: linkError } = await supabase
      .from("permits")
      .update({ document_id: doc.id, updated_at: new Date().toISOString() })
      .eq("id", permitId)
      .eq("company_id", ctx.companyId)
    if (linkError) return { error: safeDbError(linkError), data: null }

    if (permit.load_id) revalidatePath(`/dashboard/loads/${permit.load_id}`)
    revalidatePath("/dashboard/documents")
    return { data: { document_id: doc.id }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to upload permit document"), data: null }
  }
}
