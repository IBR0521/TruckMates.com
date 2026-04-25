"use server"

import * as Sentry from "@sentry/nextjs"
import { revalidatePath } from "next/cache"
import { getCachedAuthContext } from "@/lib/auth/server"
import { errorMessage } from "@/lib/error-message"
import { escapeHtml } from "@/lib/html-escape"
import { htmlToPdfBuffer } from "@/lib/html-to-pdf-server"
import { checkCreatePermission, checkDeletePermission, checkEditPermission, checkViewPermission } from "@/lib/server-permissions"
import { createClient } from "@/lib/supabase/server"
import { sanitizeString } from "@/lib/validation"

type IncidentType = "accident" | "citation" | "cargo_damage" | "near_miss"

const INCIDENT_SELECT = `
  id, company_id, incident_date, location, type, dot_reportable, injuries, fatalities, hazardous_material_released,
  vehicles_involved, description, driver_id, truck_id, police_report_url, photos, claim_status, insurer_notified_date,
  created_at, updated_at
`

export async function getIncidents(filters?: {
  type?: IncidentType
  driver_id?: string
  truck_id?: string
  limit?: number
  offset?: number
}) {
  try {
    const permission = await checkViewPermission("ifta")
    if (!permission.allowed) return { error: permission.error || "Permission denied", data: null, count: 0 }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null, count: 0 }

    const supabase = await createClient()
    let query = supabase
      .from("incidents")
      .select(
        `${INCIDENT_SELECT},
         driver:drivers(id, name),
         truck:trucks(id, truck_number)`,
        { count: "exact" },
      )
      .eq("company_id", ctx.companyId)
      .order("incident_date", { ascending: false })

    if (filters?.type) query = query.eq("type", filters.type)
    if (filters?.driver_id) query = query.eq("driver_id", filters.driver_id)
    if (filters?.truck_id) query = query.eq("truck_id", filters.truck_id)

    const limit = Math.min(filters?.limit || 200, 500)
    const offset = filters?.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) return { error: "Failed to load incidents", data: null, count: 0 }
    return { data: data || [], error: null, count: count || 0 }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to load incidents"), data: null, count: 0 }
  }
}

export async function createIncident(formData: {
  incident_date: string
  location?: string
  type: IncidentType
  dot_reportable?: boolean
  injuries?: boolean
  fatalities?: boolean
  hazardous_material_released?: boolean
  vehicles_involved?: number
  description?: string
  driver_id?: string
  truck_id?: string
  police_report_url?: string
  photos?: string[]
  claim_status?: string
  insurer_notified_date?: string
}) {
  try {
    const permission = await checkCreatePermission("ifta")
    if (!permission.allowed) return { error: permission.error || "Permission denied", data: null }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }
    if (!formData.incident_date) return { error: "Incident date is required", data: null }
    if (!formData.type) return { error: "Incident type is required", data: null }

    const supabase = await createClient()
    const payload = {
      company_id: ctx.companyId,
      incident_date: formData.incident_date,
      location: formData.location ? sanitizeString(formData.location, 200) : null,
      type: formData.type,
      dot_reportable: Boolean(formData.dot_reportable),
      injuries: Boolean(formData.injuries),
      fatalities: Boolean(formData.fatalities),
      hazardous_material_released: Boolean(formData.hazardous_material_released),
      vehicles_involved: formData.vehicles_involved ?? null,
      description: formData.description ? sanitizeString(formData.description, 4000) : null,
      driver_id: formData.driver_id || null,
      truck_id: formData.truck_id || null,
      police_report_url: formData.police_report_url ? sanitizeString(formData.police_report_url, 2000) : null,
      photos: Array.isArray(formData.photos) ? formData.photos.map((p) => sanitizeString(String(p), 2000)).filter(Boolean) : [],
      claim_status: formData.claim_status || "open",
      insurer_notified_date: formData.insurer_notified_date || null,
    }

    const { data, error } = await supabase.from("incidents").insert(payload).select(INCIDENT_SELECT).single()
    if (error) return { error: "Failed to create incident", data: null }

    revalidatePath("/dashboard/compliance")
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to create incident"), data: null }
  }
}

export async function updateIncident(
  id: string,
  formData: Partial<{
    incident_date: string
    location: string
    type: IncidentType
    dot_reportable: boolean
    injuries: boolean
    fatalities: boolean
    hazardous_material_released: boolean
    vehicles_involved: number
    description: string
    driver_id: string
    truck_id: string
    police_report_url: string
    photos: string[]
    claim_status: string
    insurer_notified_date: string
  }>,
) {
  try {
    const permission = await checkEditPermission("ifta")
    if (!permission.allowed) return { error: permission.error || "Permission denied", data: null }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const updateData: Record<string, unknown> = {}
    if (formData.incident_date !== undefined) updateData.incident_date = formData.incident_date
    if (formData.location !== undefined) updateData.location = formData.location ? sanitizeString(formData.location, 200) : null
    if (formData.type !== undefined) updateData.type = formData.type
    if (formData.dot_reportable !== undefined) updateData.dot_reportable = formData.dot_reportable
    if (formData.injuries !== undefined) updateData.injuries = formData.injuries
    if (formData.fatalities !== undefined) updateData.fatalities = formData.fatalities
    if (formData.hazardous_material_released !== undefined) updateData.hazardous_material_released = formData.hazardous_material_released
    if (formData.vehicles_involved !== undefined) updateData.vehicles_involved = formData.vehicles_involved
    if (formData.description !== undefined) updateData.description = formData.description ? sanitizeString(formData.description, 4000) : null
    if (formData.driver_id !== undefined) updateData.driver_id = formData.driver_id || null
    if (formData.truck_id !== undefined) updateData.truck_id = formData.truck_id || null
    if (formData.police_report_url !== undefined) updateData.police_report_url = formData.police_report_url ? sanitizeString(formData.police_report_url, 2000) : null
    if (formData.photos !== undefined) updateData.photos = (formData.photos || []).map((p) => sanitizeString(String(p), 2000)).filter(Boolean)
    if (formData.claim_status !== undefined) updateData.claim_status = formData.claim_status
    if (formData.insurer_notified_date !== undefined) updateData.insurer_notified_date = formData.insurer_notified_date || null

    if (Object.keys(updateData).length === 0) return { error: "No changes provided", data: null }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("incidents")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .select(INCIDENT_SELECT)
      .single()

    if (error) return { error: "Failed to update incident", data: null }
    revalidatePath("/dashboard/compliance")
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to update incident"), data: null }
  }
}

export async function deleteIncident(id: string) {
  try {
    const permission = await checkDeletePermission("ifta")
    if (!permission.allowed) return { error: permission.error || "Permission denied" }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated" }

    const supabase = await createClient()
    const { error } = await supabase.from("incidents").delete().eq("id", id).eq("company_id", ctx.companyId)
    if (error) return { error: "Failed to delete incident" }

    revalidatePath("/dashboard/compliance")
    return { error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to delete incident") }
  }
}

function buildAccidentRegisterHtml(rows: Array<{
  incident_date: string
  location: string | null
  driver_name: string | null
  injuries: boolean
  fatalities: boolean
  hazardous_material_released: boolean
  dot_reportable: boolean
  description: string | null
}>) {
  const bodyRows = rows
    .map(
      (r, idx) => `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(r.incident_date || "")}</td>
        <td>${escapeHtml(r.location || "")}</td>
        <td>${escapeHtml(r.driver_name || "")}</td>
        <td style="text-align:center">${r.injuries ? "1" : "0"}</td>
        <td style="text-align:center">${r.fatalities ? "1" : "0"}</td>
        <td style="text-align:center">${r.hazardous_material_released ? "Yes" : "No"}</td>
        <td style="text-align:center">${r.dot_reportable ? "Yes" : "No"}</td>
        <td>${escapeHtml(r.description || "")}</td>
      </tr>`,
    )
    .join("")

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>FMCSA Accident Register</title>
  <style>
    body{font-family:Arial,sans-serif;padding:22px;color:#111827}
    h1{margin:0 0 6px 0;font-size:22px}
    p{margin:2px 0;color:#4b5563}
    table{width:100%;border-collapse:collapse;margin-top:14px;font-size:11px}
    th,td{border:1px solid #d1d5db;padding:6px;vertical-align:top}
    th{background:#f3f4f6;text-align:left}
    .muted{font-size:10px;color:#6b7280;margin-top:8px}
  </style>
</head>
<body>
  <h1>FMCSA Accident Register</h1>
  <p>49 CFR 390.15 - accident register (last 3 years)</p>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Date</th>
        <th>Location</th>
        <th>Driver Name</th>
        <th>Injuries</th>
        <th>Fatalities</th>
        <th>Hazmat Release</th>
        <th>DOT Reportable</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows || `<tr><td colspan="9">No accidents in the retention window.</td></tr>`}
    </tbody>
  </table>
  <p class="muted">Generated by TruckMates compliance module.</p>
</body>
</html>`
}

export async function exportAccidentRegisterPdfBase64() {
  try {
    const permission = await checkViewPermission("ifta")
    if (!permission.allowed) return { error: permission.error || "Permission denied", data: null }

    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { error: ctx.error || "Not authenticated", data: null }

    const supabase = await createClient()
    const start = new Date()
    start.setFullYear(start.getFullYear() - 3)
    const startDate = start.toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from("incidents")
      .select("incident_date, location, injuries, fatalities, hazardous_material_released, dot_reportable, description, driver:drivers(name)")
      .eq("company_id", ctx.companyId)
      .eq("type", "accident")
      .gte("incident_date", startDate)
      .order("incident_date", { ascending: false })
      .limit(10000)

    if (error) return { error: "Failed to load accident register data", data: null }

    const rows = (data || []).map((r: any) => ({
      incident_date: String(r.incident_date || ""),
      location: r.location || null,
      driver_name: r.driver?.name || null,
      injuries: Boolean(r.injuries),
      fatalities: Boolean(r.fatalities),
      hazardous_material_released: Boolean(r.hazardous_material_released),
      dot_reportable: Boolean(r.dot_reportable),
      description: r.description || null,
    }))

    const html = buildAccidentRegisterHtml(rows)
    const { pdf, error: pdfError } = await htmlToPdfBuffer(html)
    if (pdfError || !pdf) return { error: pdfError || "Failed to generate PDF", data: null }

    const filename = `fmcsa-accident-register-${new Date().toISOString().slice(0, 10)}.pdf`
    return {
      data: {
        filename,
        base64: Buffer.from(pdf).toString("base64"),
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Failed to export accident register"), data: null }
  }
}

