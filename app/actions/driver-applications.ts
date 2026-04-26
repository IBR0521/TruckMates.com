"use server"

import React from "react"
import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { checkCreatePermission, checkDeletePermission, checkEditPermission, checkViewPermission } from "@/lib/server-permissions"
import { sanitizeEmail, sanitizePhone, sanitizeString } from "@/lib/validation"
import { revalidatePath } from "next/cache"
import { createDriver } from "@/app/actions/drivers"
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer"

export type DriverApplicationStage = "applied" | "screening" | "interview" | "offer" | "hired" | "rejected"

function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}

function normalizeStage(value?: string): DriverApplicationStage {
  const v = String(value || "").toLowerCase()
  if (v === "screening" || v === "interview" || v === "offer" || v === "hired" || v === "rejected") return v
  return "applied"
}

async function toPdfBytes(value: unknown): Promise<Uint8Array> {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer())
  if (value && typeof value === "object" && "getReader" in value) {
    const buffer = await new Response(value as ReadableStream).arrayBuffer()
    return new Uint8Array(buffer)
  }
  throw new Error("Unsupported PDF output type")
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  heading: { fontSize: 16, fontWeight: 700, marginBottom: 3 },
  subheading: { fontSize: 10, color: "#4b5563", marginBottom: 12 },
  section: { borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 10, padding: 8 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "#6b7280", width: "45%" },
  value: { width: "55%", textAlign: "right" },
  paragraph: { lineHeight: 1.4, marginTop: 6 },
})

function dotEmploymentApplicationDoc(data: {
  applicantName: string
  email: string
  phone: string
  cdlNumber: string
  cdlState: string
  cdlClass: string
  endorsements: string[]
  yearsExperience: string
  appliedDate: string
  notes: string
  companyName: string
}) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "LETTER", style: styles.page },
      React.createElement(Text, { style: styles.heading }, "DOT Employment Application (FMCSA 391.21)"),
      React.createElement(Text, { style: styles.subheading }, `${data.companyName} - Generated ${new Date().toISOString().slice(0, 10)}`),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Applicant Information"),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Applicant Name"), React.createElement(Text, { style: styles.value }, data.applicantName || "N/A")),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Email"), React.createElement(Text, { style: styles.value }, data.email || "N/A")),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Phone"), React.createElement(Text, { style: styles.value }, data.phone || "N/A")),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Applied Date"), React.createElement(Text, { style: styles.value }, data.appliedDate || "N/A")),
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "CDL Information"),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "CDL Number"), React.createElement(Text, { style: styles.value }, data.cdlNumber || "N/A")),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "CDL State"), React.createElement(Text, { style: styles.value }, data.cdlState || "N/A")),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "CDL Class"), React.createElement(Text, { style: styles.value }, data.cdlClass || "N/A")),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Endorsements"), React.createElement(Text, { style: styles.value }, data.endorsements.length ? data.endorsements.join(", ") : "None listed")),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Years Experience"), React.createElement(Text, { style: styles.value }, data.yearsExperience || "N/A")),
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Applicant Statements"),
        React.createElement(
          Text,
          { style: styles.paragraph },
          "This generated template captures core FMCSA 391.21 fields for operational intake. Carrier should collect and retain full DOT employment history, prior employer verification, and required pre-employment compliance artifacts with signatures."
        ),
        React.createElement(Text, { style: styles.paragraph }, data.notes || "No additional notes.")
      )
    )
  )
}

export async function getDriverApplications(filters?: { stage?: string; search?: string }) {
  const permission = await checkViewPermission("drivers")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to view applicants", data: null }
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    let query = supabase
      .from("driver_applications")
      .select("id, applicant_name, email, phone, cdl_number, cdl_state, cdl_class, endorsements, years_experience, stage, applied_date, notes, converted_driver_id, converted_at, created_at", { count: "exact" })
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })
      .limit(500)

    if (filters?.stage) query = query.eq("stage", normalizeStage(filters.stage))
    if (filters?.search) {
      const q = sanitizeString(filters.search, 100).trim()
      if (q) query = query.or(`applicant_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,cdl_number.ilike.%${q}%`)
    }

    const { data, error, count } = await query
    if (error) return { error: safeDbError(error), data: null, count: 0 }
    return { data: data || [], error: null, count: count || 0 }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load applicants"), data: null, count: 0 }
  }
}

export async function createDriverApplication(input: {
  applicant_name: string
  email?: string
  phone?: string
  cdl_number?: string
  cdl_state?: string
  cdl_class?: string
  endorsements?: string[]
  years_experience?: number
  stage?: DriverApplicationStage
  applied_date?: string
  notes?: string
}) {
  const permission = await checkCreatePermission("drivers")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to create applicants", data: null }
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const payload = {
      company_id: ctx.companyId,
      applicant_name: sanitizeString(input.applicant_name, 120).trim(),
      email: input.email ? sanitizeEmail(input.email) : null,
      phone: input.phone ? sanitizePhone(input.phone) : null,
      cdl_number: input.cdl_number ? sanitizeString(input.cdl_number, 50).toUpperCase() : null,
      cdl_state: input.cdl_state ? sanitizeString(input.cdl_state, 2).toUpperCase() : null,
      cdl_class: input.cdl_class ? sanitizeString(input.cdl_class, 20).toUpperCase() : null,
      endorsements: (input.endorsements || []).map((e) => sanitizeString(e, 10).toUpperCase()).filter(Boolean),
      years_experience: input.years_experience ?? null,
      stage: normalizeStage(input.stage),
      applied_date: input.applied_date || new Date().toISOString().slice(0, 10),
      notes: input.notes ? sanitizeString(input.notes, 4000) : null,
    }
    if (!payload.applicant_name) return { error: "Applicant name is required", data: null }

    const { data, error } = await supabase.from("driver_applications").insert(payload).select("*").single()
    if (error) return { error: safeDbError(error), data: null }

    revalidatePath("/dashboard/drivers")
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to create applicant"), data: null }
  }
}

export async function updateDriverApplication(id: string, input: {
  applicant_name?: string
  email?: string
  phone?: string
  cdl_number?: string
  cdl_state?: string
  cdl_class?: string
  endorsements?: string[]
  years_experience?: number
  stage?: DriverApplicationStage
  applied_date?: string
  notes?: string
}) {
  const permission = await checkEditPermission("drivers")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to update applicants", data: null }
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const patch: Record<string, unknown> = {}
    if (input.applicant_name !== undefined) patch.applicant_name = sanitizeString(input.applicant_name, 120).trim()
    if (input.email !== undefined) patch.email = input.email ? sanitizeEmail(input.email) : null
    if (input.phone !== undefined) patch.phone = input.phone ? sanitizePhone(input.phone) : null
    if (input.cdl_number !== undefined) patch.cdl_number = input.cdl_number ? sanitizeString(input.cdl_number, 50).toUpperCase() : null
    if (input.cdl_state !== undefined) patch.cdl_state = input.cdl_state ? sanitizeString(input.cdl_state, 2).toUpperCase() : null
    if (input.cdl_class !== undefined) patch.cdl_class = input.cdl_class ? sanitizeString(input.cdl_class, 20).toUpperCase() : null
    if (input.endorsements !== undefined) patch.endorsements = input.endorsements.map((e) => sanitizeString(e, 10).toUpperCase()).filter(Boolean)
    if (input.years_experience !== undefined) patch.years_experience = input.years_experience
    if (input.stage !== undefined) patch.stage = normalizeStage(input.stage)
    if (input.applied_date !== undefined) patch.applied_date = input.applied_date || null
    if (input.notes !== undefined) patch.notes = input.notes ? sanitizeString(input.notes, 4000) : null

    const { data, error } = await supabase
      .from("driver_applications")
      .update(patch)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .select("*")
      .single()
    if (error) return { error: safeDbError(error), data: null }

    revalidatePath("/dashboard/drivers")
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to update applicant"), data: null }
  }
}

export async function deleteDriverApplication(id: string) {
  const permission = await checkDeletePermission("drivers")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to delete applicants", data: null }
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }
    const { error } = await supabase
      .from("driver_applications")
      .delete()
      .eq("id", id)
      .eq("company_id", ctx.companyId)
    if (error) return { error: safeDbError(error), data: null }
    revalidatePath("/dashboard/drivers")
    return { data: { success: true }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to delete applicant"), data: null }
  }
}

export async function convertApplicantToDriver(applicationId: string, options?: { stage?: DriverApplicationStage }) {
  const permission = await checkCreatePermission("drivers")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to convert applicants", data: null }
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const { data: app, error: appError } = await supabase
      .from("driver_applications")
      .select("*")
      .eq("id", applicationId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()
    if (appError || !app) return { error: "Applicant not found", data: null }
    if (app.converted_driver_id) return { error: "Applicant already converted", data: null }

    const driver = await createDriver({
      name: app.applicant_name,
      email: app.email || "",
      phone: app.phone || "",
      license_number: app.cdl_number || "",
      license_expiry: null,
      status: "active",
      license_state: app.cdl_state || undefined,
      license_type: app.cdl_class ? `class_${String(app.cdl_class).toLowerCase()}` : undefined,
      license_endorsements: Array.isArray(app.endorsements) ? app.endorsements.join(",") : undefined,
      notes: app.notes || undefined,
    })
    if (driver.error || !driver.data?.id) return { error: driver.error || "Failed to create driver", data: null }

    const nextStage = options?.stage ? normalizeStage(options.stage) : "hired"
    const { error: updateError } = await supabase
      .from("driver_applications")
      .update({
        stage: nextStage,
        converted_driver_id: driver.data.id,
        converted_at: new Date().toISOString(),
      })
      .eq("id", applicationId)
      .eq("company_id", ctx.companyId)
    if (updateError) return { error: safeDbError(updateError), data: null }

    revalidatePath("/dashboard/drivers")
    return { data: { driver_id: driver.data.id }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to convert applicant"), data: null }
  }
}

export async function generateDriverApplicationPdf(applicationId: string) {
  const permission = await checkViewPermission("drivers")
  if (!permission.allowed) return { error: permission.error || "You don't have permission to generate application PDF", data: null }
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const { data: app, error: appError } = await supabase
      .from("driver_applications")
      .select("*")
      .eq("id", applicationId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()
    if (appError || !app) return { error: "Applicant not found", data: null }

    const { data: company } = await supabase.from("companies").select("name").eq("id", ctx.companyId).maybeSingle()

    const doc = dotEmploymentApplicationDoc({
      applicantName: app.applicant_name || "N/A",
      email: app.email || "",
      phone: app.phone || "",
      cdlNumber: app.cdl_number || "",
      cdlState: app.cdl_state || "",
      cdlClass: app.cdl_class || "",
      endorsements: Array.isArray(app.endorsements) ? app.endorsements : [],
      yearsExperience: app.years_experience != null ? String(app.years_experience) : "",
      appliedDate: app.applied_date || "",
      notes: app.notes || "",
      companyName: company?.name || "Carrier",
    })

    const pdfOutput = await pdf(doc).toBuffer()
    const pdfBytes = await toPdfBytes(pdfOutput)
    const filePath = `driver-applications/${ctx.companyId}/${applicationId}-fmcsa-391.21.pdf`
    const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    })
    if (uploadError) return { error: `Failed to upload PDF: ${uploadError.message}`, data: null }

    const { data: documentRow, error: docError } = await supabase
      .from("documents")
      .insert({
        company_id: ctx.companyId,
        name: `DOT-Application-${sanitizeString(app.applicant_name || "applicant", 50)}.pdf`,
        type: "dot_employment_application",
        file_url: filePath,
        file_size: pdfBytes.byteLength,
        upload_date: new Date().toISOString().slice(0, 10),
        notes: `Generated from applicant ${applicationId}`,
      })
      .select("id, file_url")
      .single()
    if (docError) return { error: safeDbError(docError, "PDF uploaded but metadata insert failed"), data: null }

    revalidatePath("/dashboard/drivers")
    revalidatePath("/dashboard/documents")
    return { data: { documentId: documentRow.id, filePath: documentRow.file_url }, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to generate DOT application PDF"), data: null }
  }
}
