"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkCreatePermission } from "@/lib/server-permissions"
import { revalidatePath } from "next/cache"
import * as Sentry from "@sentry/nextjs"
import { createLoad, getLoad } from "./loads"
import {
  extractTemplateDataFromLoad,
  templateDataToCreateLoadPayload,
  type LoadTemplateFormData,
} from "@/lib/load-template-data"

export type LoadTemplateRow = {
  id: string
  company_id: string
  name: string
  created_by: string | null
  template_data: LoadTemplateFormData
  created_at: string
  updated_at: string
}

async function authCreateLoads() {
  const permission = await checkCreatePermission("loads")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to manage load templates", ctx: null }
  }
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", ctx: null }
  }
  return { error: null, ctx }
}

export async function listLoadTemplates(): Promise<{
  data: LoadTemplateRow[] | null
  error: string | null
}> {
  const { error: authErr, ctx } = await authCreateLoads()
  if (authErr || !ctx) return { error: authErr, data: null }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("load_templates")
    .select("id, company_id, name, created_by, template_data, created_at, updated_at")
    .eq("company_id", ctx.companyId)
    .order("name", { ascending: true })

  if (error) {
    Sentry.captureException(error)
    return { error: error.message, data: null }
  }
  return { data: (data ?? []) as LoadTemplateRow[], error: null }
}

export async function createLoadTemplate(params: {
  name: string
  fromLoadId?: string
  templateData?: LoadTemplateFormData
}): Promise<{ data: LoadTemplateRow | null; error: string | null }> {
  const { error: authErr, ctx } = await authCreateLoads()
  if (authErr || !ctx) return { error: authErr, data: null }

  const name = params.name?.trim()
  if (!name) return { error: "Template name is required", data: null }

  const supabase = await createClient()
  let templateData: LoadTemplateFormData = params.templateData ?? {}

  if (params.fromLoadId) {
    const loadResult = await getLoad(params.fromLoadId)
    if (loadResult.error || !loadResult.data) {
      return { error: loadResult.error || "Load not found", data: null }
    }

    templateData = extractTemplateDataFromLoad(
      loadResult.data as Record<string, unknown>,
    )

    const { data: points } = await supabase
      .from("load_delivery_points")
      .select(
        "sequence, company_name, contact_name, address_line1, city, state, zip_code, instructions, stop_type, phone",
      )
      .eq("load_id", params.fromLoadId)
      .eq("company_id", ctx.companyId)
      .order("sequence", { ascending: true })

    if (points && points.length > 0) {
      templateData.deliveryPoints = points.map((p: Record<string, unknown>) => ({
        delivery_number: Number(p.sequence) || 1,
        location_name:
          String(p.company_name || p.contact_name || "Stop"),
        address: String(p.address_line1 || ""),
        city: typeof p.city === "string" ? p.city : undefined,
        state: typeof p.state === "string" ? p.state : undefined,
        zip: typeof p.zip_code === "string" ? p.zip_code : undefined,
        contact_name: typeof p.contact_name === "string" ? p.contact_name : undefined,
        phone: typeof p.phone === "string" ? p.phone : undefined,
        delivery_type: typeof p.stop_type === "string" ? p.stop_type : undefined,
        notes: typeof p.instructions === "string" ? p.instructions : undefined,
      }))
      templateData.deliveryType = "multi"
      templateData.destination = "Multiple Locations"
    }
  }

  if (!templateData.origin && !templateData.destination) {
    return { error: "Template must include at least origin or destination", data: null }
  }

  const { data, error } = await supabase
    .from("load_templates")
    .insert({
      company_id: ctx.companyId,
      name,
      created_by: ctx.userId ?? null,
      template_data: templateData,
    })
    .select("id, company_id, name, created_by, template_data, created_at, updated_at")
    .maybeSingle()

  if (error) {
    if (error.code === "23505") {
      return { error: "A template with this name already exists", data: null }
    }
    Sentry.captureException(error)
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/loads")
  revalidatePath("/dashboard/loads/add")
  return { data: data as LoadTemplateRow, error: null }
}

export async function renameLoadTemplate(
  id: string,
  name: string,
): Promise<{ error: string | null }> {
  const { error: authErr, ctx } = await authCreateLoads()
  if (authErr || !ctx) return { error: authErr }

  const trimmed = name?.trim()
  if (!trimmed) return { error: "Template name is required" }

  const supabase = await createClient()
  const { error } = await supabase
    .from("load_templates")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", ctx.companyId)

  if (error) {
    if (error.code === "23505") return { error: "A template with this name already exists" }
    return { error: error.message }
  }

  revalidatePath("/dashboard/loads")
  revalidatePath("/dashboard/loads/add")
  return { error: null }
}

export async function deleteLoadTemplate(id: string): Promise<{ error: string | null }> {
  const { error: authErr, ctx } = await authCreateLoads()
  if (authErr || !ctx) return { error: authErr }

  const supabase = await createClient()
  const { error } = await supabase
    .from("load_templates")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.companyId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/loads")
  revalidatePath("/dashboard/loads/add")
  return { error: null }
}

export async function createLoadFromTemplate(
  templateId: string,
  overrides?: {
    shipment_number?: string
    load_date?: string | null
    estimated_delivery?: string | null
    driver_id?: string
    truck_id?: string
    status?: string
  },
): Promise<{ data: { id: string } | null; error: string | null }> {
  const { error: authErr, ctx } = await authCreateLoads()
  if (authErr || !ctx) return { error: authErr, data: null }

  const supabase = await createClient()
  const { data: template, error: tErr } = await supabase
    .from("load_templates")
    .select("id, template_data")
    .eq("id", templateId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (tErr || !template) {
    return { error: tErr?.message || "Template not found", data: null }
  }

  const templateData = (template as { template_data: LoadTemplateFormData }).template_data

  let shipmentNumber = overrides?.shipment_number
  if (!shipmentNumber) {
    const { generateLoadNumber } = await import("./number-formats")
    const numResult = await generateLoadNumber()
    if (numResult.error || !numResult.data) {
      return { error: numResult.error || "Failed to generate load number", data: null }
    }
    shipmentNumber = numResult.data
  }

  const payload = templateDataToCreateLoadPayload(templateData, {
    shipment_number: shipmentNumber,
    load_date: overrides?.load_date ?? undefined,
    estimated_delivery: overrides?.estimated_delivery ?? undefined,
    driver_id: overrides?.driver_id,
    truck_id: overrides?.truck_id,
    status: overrides?.status ?? "pending",
  })

  const result = await createLoad(payload)
  if (result.error || !result.data) {
    return { error: result.error || "Failed to create load from template", data: null }
  }

  const newLoadId = (result.data as { id: string }).id
  const points = templateData.deliveryPoints
  if (points && points.length > 0) {
    const { createLoadDeliveryPoint } = await import("./load-delivery-points")
    for (const point of points) {
      await createLoadDeliveryPoint(newLoadId, point).catch((e: unknown) => {
        Sentry.captureException(e)
      })
    }
  }

  revalidatePath("/dashboard/loads")
  return { data: { id: newLoadId }, error: null }
}

export async function getLoadTemplate(id: string): Promise<{
  data: LoadTemplateRow | null
  error: string | null
}> {
  const { error: authErr, ctx } = await authCreateLoads()
  if (authErr || !ctx) return { error: authErr, data: null }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("load_templates")
    .select("id, company_id, name, created_by, template_data, created_at, updated_at")
    .eq("id", id)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (error) return { error: error.message, data: null }
  if (!data) return { error: "Template not found", data: null }
  return { data: data as LoadTemplateRow, error: null }
}
