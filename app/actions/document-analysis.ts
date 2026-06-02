"use server"

import crypto from "crypto"
import { errorMessage } from "@/lib/error-message"
import { safeDbError } from "@/lib/utils/error"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { callClaude } from "@/lib/ai/client"
import { LOGISTICS_SYSTEM_PROMPT } from "@/lib/ai/prompts/system"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizePlanTier, hasFeatureAccess } from "@/lib/plan-limits"
import { extractStructuredFieldsFromBase64, type DocumentKind } from "@/lib/ai/documents/structured-extraction"
import { compareExtractedToRecords } from "@/lib/ai/documents/discrepancy"
import { notifyDocumentDiscrepancy } from "@/lib/ai/notifications/document-discrepancies"
import { rateLimitRedis } from "@/lib/rate-limit-redis"

export interface ExtractedDriverData {
  type: "driver"
  [key: string]: unknown
}

export interface ExtractedVehicleData {
  type: "vehicle"
  [key: string]: unknown
}

export interface DeliveryPoint {
  delivery_number: number
  [key: string]: unknown
}

export interface ExtractedLoadData {
  type: "load"
  delivery_points?: DeliveryPoint[]
  [key: string]: unknown
}

export interface RouteStop {
  stop_number: number
  [key: string]: unknown
}

export interface ExtractedRouteData {
  type: "route"
  stops?: RouteStop[]
  [key: string]: unknown
}

export interface ExtractedMaintenanceData {
  type: "maintenance"
  [key: string]: unknown
}

export interface ExtractedInvoiceData {
  type: "invoice"
  [key: string]: unknown
}

export interface ExtractedExpenseData {
  type: "expense"
  [key: string]: unknown
}

export interface ExtractedRouteAndLoadData {
  type: "route_and_load"
  stops?: RouteStop[]
  delivery_points?: DeliveryPoint[]
  [key: string]: unknown
}

export type ExtractedData =
  | ExtractedDriverData
  | ExtractedVehicleData
  | ExtractedLoadData
  | ExtractedRouteData
  | ExtractedRouteAndLoadData
  | ExtractedMaintenanceData
  | ExtractedInvoiceData
  | ExtractedExpenseData

function pickExtensionMediaType(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".pdf")) return "application/pdf"
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".gif")) return "image/gif"
  return "image/jpeg"
}

function normalizeType(type: string): ExtractedData["type"] {
  const t = type.toLowerCase()
  if (t.includes("driver")) return "driver"
  if (t.includes("vehicle")) return "vehicle"
  if (t.includes("bol") || t.includes("bill of lading")) return "load"
  if (t.includes("invoice")) return "invoice"
  if (t.includes("maintenance")) return "maintenance"
  return "expense"
}

function parseDataUrl(input: string): { base64: string; mediaType: string } | null {
  const trimmed = input.trim()
  const match = /^data:([^;,]+)?;base64,(.+)$/i.exec(trimmed)
  if (!match) return null
  return {
    mediaType: match[1] || "application/octet-stream",
    base64: match[2],
  }
}

function looksLikeBase64(input: string): boolean {
  const trimmed = input.trim()
  if (!trimmed) return false
  if (trimmed.startsWith("data:")) return true
  if (trimmed.includes("http://") || trimmed.includes("https://")) return false
  return /^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.replace(/\s+/g, "").length > 32
}

async function toBase64AndMediaType(input: {
  source: string
  fileName: string
}): Promise<{ base64: string; mediaType: string }> {
  const source = String(input.source || "").trim()
  if (!source) throw new Error("No document source provided")

  const parsedDataUrl = parseDataUrl(source)
  if (parsedDataUrl) {
    return parsedDataUrl
  }

  if (looksLikeBase64(source)) {
    return {
      base64: source.replace(/\s+/g, ""),
      mediaType: pickExtensionMediaType(input.fileName),
    }
  }

  const response = await fetch(source)
  if (!response.ok) {
    throw new Error(`Failed to fetch file URL (${response.status})`)
  }
  const mediaType = response.headers.get("content-type") || "application/octet-stream"
  const buffer = Buffer.from(await response.arrayBuffer())
  return { base64: buffer.toString("base64"), mediaType }
}

async function runClaudeDocumentAnalysis(
  source: string,
  fileName: string,
  companyId: string | null
): Promise<{
  extractedData: ExtractedData | null
  error: string | null
}> {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim()
  if (!apiKey) {
    return { extractedData: null, error: "Document analysis unavailable" }
  }

  const { base64, mediaType: detectedType } = await toBase64AndMediaType({ source, fileName })
  const mediaType = detectedType !== "application/octet-stream" ? detectedType : pickExtensionMediaType(fileName)

  const prompt = [
    "You are a freight operations document parser.",
    "Detect the document type and extract key fields.",
    "Supported document kinds: driver license, vehicle registration, BOL, invoice, maintenance record.",
    "Return JSON only with this shape:",
    "{",
    '  "type": "driver|vehicle|load|invoice|maintenance|expense",',
    '  "document_kind": "driver_license|vehicle_registration|bol|invoice|maintenance_record|unknown",',
    '  "confidence": 0-1 number,',
    '  "fields": { key: value },',
    '  "delivery_points": [{ "delivery_number": number, "...": "..." }],',
    '  "stops": [{ "stop_number": number, "...": "..." }]',
    "}",
    "Guidance:",
    "- type=driver for driver license",
    "- type=vehicle for vehicle registration",
    "- type=load for BOL",
    "- type=invoice for invoice",
    "- type=maintenance for maintenance record",
    "",
    `File name: ${fileName}`,
    `Media type: ${mediaType}`,
    "Base64 content:",
    base64,
  ].join("\n")
  const claude = await callClaude<Record<string, unknown>>(
    `${LOGISTICS_SYSTEM_PROMPT}\n\nParse logistics documents into structured JSON.`,
    prompt,
    {
      expectJson: true,
      maxTokens: 1600,
      model: "sonnet",
      feature: "document_analysis",
      companyId: companyId || undefined,
    },
  )
  if (claude.error || !claude.data) {
    return { extractedData: null, error: claude.error || "Document analysis unavailable" }
  }
  const parsed = claude.data

  const normalizedType = normalizeType(String(parsed.type || "expense"))
  const fields =
    parsed.fields && typeof parsed.fields === "object" ? (parsed.fields as Record<string, unknown>) : {}
  const deliveryPoints = Array.isArray(parsed.delivery_points) ? parsed.delivery_points : undefined
  const stops = Array.isArray(parsed.stops) ? parsed.stops : undefined

  if (normalizedType === "load") {
    return {
      extractedData: {
      type: "load",
      ...fields,
      delivery_points: deliveryPoints as DeliveryPoint[] | undefined,
      },
      error: null,
    }
  }
  if (normalizedType === "route") {
    return {
      extractedData: {
        type: "route",
        ...fields,
        stops: stops as RouteStop[] | undefined,
      },
      error: null,
    }
  }
  return {
    extractedData: {
      type: normalizedType as Exclude<ExtractedData["type"], "route" | "load">,
      ...fields,
    } as ExtractedData,
    error: null,
  }
}

export async function analyzeDocument(source: string, fileName: string): Promise<{
  data: ExtractedData | null
  error: string | null
  warning?: string | null
}> {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { data: null, error: ctx.error || "Not authenticated", warning: null }
    }
    const docRl = await rateLimitRedis(`doc_analysis:${ctx.companyId}`, { limit: 15, window: 60 })
    if (!docRl.success) {
      return { data: null, error: "Too many document analysis requests. Please wait.", warning: null }
    }
    const result = await runClaudeDocumentAnalysis(source, fileName, ctx.companyId)
    if (result.error) {
      return { data: null, error: result.error, warning: null }
    }
    return { data: result.extractedData, error: null, warning: null }
  } catch (error: unknown) {
    return { data: null, error: errorMessage(error, "Document analysis failed"), warning: null }
  }
}

export async function analyzeDocumentFromUrl(
  fileUrl: string,
  fileName: string,
  fileSize: number,
  metadata?: {
    name?: string
    type?: string
  }
): Promise<{
  data: {
    documentId: string
    extractedData: ExtractedData | null
    fileUrl: string
    warning?: string | null
  } | null
  error: string | null
}> {
  void fileSize
  void metadata
  try {
    const analysis = await analyzeDocument(fileUrl, fileName)
    if (analysis.error) return { data: null, error: analysis.error }
    return {
      data: {
        documentId: crypto.randomUUID(),
        extractedData: analysis.data,
        fileUrl,
        warning: analysis.warning || null,
      },
      error: null,
    }
  } catch (error: unknown) {
    return { data: null, error: errorMessage(error, "Failed to analyze document") }
  }
}

function normalizeDocKindFromType(type: string, fileName: string): DocumentKind | null {
  const t = `${type} ${fileName}`.toLowerCase()
  if (t.includes("rate") && (t.includes("confirm") || t.includes("con"))) return "rate_confirmation"
  if (t.includes("rate_confirmation")) return "rate_confirmation"
  if (t.includes("bol") || t.includes("bill of lading")) return "bol"
  return null
}

/**
 * Structured extraction (rate confirmations + BOLs) + discrepancy surfacing.
 * Best-effort: never throws; safely no-ops when plan/browser/env does not support extraction.
 */
export async function extractAndCheckStructuredDocument(documentId: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) return { ok: false, error: ctx.error || "Not authenticated" }

    const admin = createAdminClient()
    const { data: companyRow } = await admin
      .from("companies")
      .select("subscription_tier")
      .eq("id", ctx.companyId)
      .maybeSingle()
    const tier = normalizePlanTier((companyRow as { subscription_tier?: string } | null)?.subscription_tier)
    if (!hasFeatureAccess(tier, "ai_document_extraction")) {
      return { ok: true, error: null }
    }

    const { data: doc, error: docErr } = await admin
      .from("documents")
      .select("id, company_id, file_url, name, type, load_id, invoice_id")
      .eq("id", documentId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()
    if (docErr || !doc) return { ok: false, error: "Document not found" }

    const row = doc as {
      id: string
      file_url: string | null
      name: string | null
      type: string | null
      load_id: string | null
      invoice_id: string | null
    }
    const fileUrlOrPath = String(row.file_url || "").trim()
    const fileName = String(row.name || "").trim() || "document"
    if (!fileUrlOrPath) return { ok: false, error: "Document file URL missing" }

    const hintedKind = normalizeDocKindFromType(String(row.type || ""), fileName)
    if (!hintedKind) {
      // Only rate confirmations and BOLs for v1.
      return { ok: true, error: null }
    }

    const apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim()
    if (!apiKey) return { ok: false, error: "Document extraction unavailable" }

    // Documents store storage path; generate signed URL for fetch.
    const supabase = await createClient()
    let source = fileUrlOrPath
    if (!fileUrlOrPath.startsWith("http://") && !fileUrlOrPath.startsWith("https://")) {
      const signed = await supabase.storage.from("documents").createSignedUrl(fileUrlOrPath, 300)
      if (signed.error || !signed.data?.signedUrl) {
        return { ok: false, error: "Could not access document file" }
      }
      source = signed.data.signedUrl
    }

    const { base64, mediaType: detectedType } = await toBase64AndMediaType({ source, fileName })
    const mediaType = detectedType !== "application/octet-stream" ? detectedType : pickExtensionMediaType(fileName)

    const extracted = await extractStructuredFieldsFromBase64({
      base64,
      mediaType,
      fileName,
      companyId: ctx.companyId,
      hintedKind,
    })
    if (extracted.error || !extracted.data) return { ok: false, error: extracted.error || "Extraction failed" }

    // Load matching records (if linked).
    const [loadRes, invRes] = await Promise.all([
      row.load_id
        ? admin
            .from("loads")
            .select("id, origin, destination, load_date, estimated_delivery, rate, total_rate, fuel_surcharge, accessorial_charges, bol_number")
            .eq("company_id", ctx.companyId)
            .eq("id", row.load_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      row.invoice_id
        ? admin
            .from("invoices")
            .select("id, amount, customer_name, status")
            .eq("company_id", ctx.companyId)
            .eq("id", row.invoice_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    const discrepancies = compareExtractedToRecords({
      extracted: extracted.data,
      load: (loadRes as { data: unknown }).data as never,
      invoice: (invRes as { data: unknown }).data as never,
    })

    // Persist extraction row (upsert latest for doc+kind; history is not needed for v1).
    await admin.from("ai_document_extractions").upsert(
      {
        company_id: ctx.companyId,
        document_id: documentId,
        document_kind: extracted.data.document_kind,
        extracted: extracted.data,
        confidence: extracted.data.confidence,
        model: extracted.model,
        load_id: row.load_id,
        invoice_id: row.invoice_id,
        discrepancies,
        has_discrepancy: discrepancies.length > 0,
        extracted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,document_id,document_kind" },
    )

    if (discrepancies.length > 0) {
      const title = extracted.data.document_kind === "rate_confirmation" ? "Rate confirmation discrepancy" : "BOL discrepancy"
      const message = discrepancies[0]?.message || "Discrepancy detected between document and records."
      void notifyDocumentDiscrepancy({
        companyId: ctx.companyId,
        documentId,
        title,
        message,
        priority: discrepancies.some((d) => d.severity === "high") ? "high" : "normal",
        metadata: {
          document_kind: extracted.data.document_kind,
          discrepancies,
          load_id: row.load_id,
          invoice_id: row.invoice_id,
        },
      })
    }

    return { ok: true, error: null }
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error, "Structured extraction failed") }
  }
}

export async function createRecordFromExtractedData(
  extractedData: ExtractedData
): Promise<{
  data: { id: string; type: string } | null
  error: string | null
}> {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { data: null, error: ctx.error || "Not authenticated" }
    }
    const supabase = await createClient()

    const asString = (value: unknown): string | null => {
      const text = String(value ?? "").trim()
      return text.length > 0 ? text : null
    }
    const asNumber = (value: unknown): number | null => {
      if (typeof value === "number" && Number.isFinite(value)) return value
      const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
      return Number.isFinite(n) ? n : null
    }
    const asDate = (value: unknown, fallback?: string): string => {
      const text = asString(value)
      if (text) return text
      return fallback || new Date().toISOString().slice(0, 10)
    }

    const nowDate = new Date().toISOString().slice(0, 10)
    const suffix = Date.now().toString().slice(-6)
    const source = extractedData as Record<string, unknown>

    if (extractedData.type === "driver") {
      const name = asString(source.name || source.full_name || source.driver_name)
      if (!name) return { data: null, error: "AI extracted driver data is missing required field: name" }
      const payload = {
        company_id: ctx.companyId,
        name,
        email: asString(source.email),
        phone: asString(source.phone),
        license_number: asString(source.license_number || source.cdl_number || source.license_id),
        license_expiry: asString(source.license_expiry || source.expiry_date),
        status: asString(source.status) || "active",
      }
      const { data, error } = await supabase.from("drivers").insert(payload).select("id").single()
      if (error) return { data: null, error: safeDbError(error, "Failed to create driver record") }
      return { data: { id: String(data.id), type: extractedData.type }, error: null }
    }

    if (extractedData.type === "vehicle") {
      const truckNumber = asString(source.truck_number || source.unit_number || source.vehicle_number)
      if (!truckNumber) return { data: null, error: "AI extracted vehicle data is missing required field: truck_number" }
      const payload = {
        company_id: ctx.companyId,
        truck_number: truckNumber,
        make: asString(source.make),
        model: asString(source.model),
        year: asNumber(source.year),
        vin: asString(source.vin),
        license_plate: asString(source.license_plate || source.plate_number),
        status: asString(source.status) || "available",
      }
      const { data, error } = await supabase.from("trucks").insert(payload).select("id").single()
      if (error) return { data: null, error: safeDbError(error, "Failed to create vehicle record") }
      return { data: { id: String(data.id), type: extractedData.type }, error: null }
    }

    if (extractedData.type === "route") {
      const origin = asString(source.origin)
      const destination = asString(source.destination)
      if (!origin || !destination) return { data: null, error: "AI extracted route data requires origin and destination" }
      const payload = {
        company_id: ctx.companyId,
        name: asString(source.name) || `AI Route ${suffix}`,
        origin,
        destination,
        distance: asString(source.distance),
        estimated_time: asString(source.estimated_time),
        priority: asString(source.priority) || "normal",
        status: asString(source.status) || "pending",
        waypoints: Array.isArray((extractedData as ExtractedRouteData).stops)
          ? (extractedData as ExtractedRouteData).stops
          : null,
      }
      const { data, error } = await supabase.from("routes").insert(payload).select("id").single()
      if (error) return { data: null, error: safeDbError(error, "Failed to create route record") }
      return { data: { id: String(data.id), type: extractedData.type }, error: null }
    }

    if (extractedData.type === "load") {
      const origin = asString(source.origin)
      const destination = asString(source.destination)
      if (!origin || !destination) return { data: null, error: "AI extracted load data requires origin and destination" }
      const payload = {
        company_id: ctx.companyId,
        shipment_number: asString(source.shipment_number) || `AI-SHP-${suffix}`,
        origin,
        destination,
        weight: asString(source.weight),
        contents: asString(source.contents || source.commodity),
        value: asNumber(source.value),
        status: asString(source.status) || "pending",
        load_date: asDate(source.load_date || source.pickup_date, nowDate),
        estimated_delivery: asDate(source.estimated_delivery || source.delivery_date, nowDate),
      }
      const { data, error } = await supabase.from("loads").insert(payload).select("id").single()
      if (error) return { data: null, error: safeDbError(error, "Failed to create load record") }
      return { data: { id: String(data.id), type: extractedData.type }, error: null }
    }

    if (extractedData.type === "route_and_load") {
      const routeData: ExtractedRouteData = { type: "route", ...source }
      const routeResult = await createRecordFromExtractedData(routeData)
      if (routeResult.error || !routeResult.data) return routeResult

      const loadPayloadSource = {
        ...source,
        route_id: routeResult.data.id,
      }
      const loadData: ExtractedLoadData = { type: "load", ...loadPayloadSource }
      const loadResult = await createRecordFromExtractedData(loadData)
      if (loadResult.error || !loadResult.data) return loadResult
      return { data: { id: loadResult.data.id, type: extractedData.type }, error: null }
    }

    if (extractedData.type === "invoice") {
      const customerName = asString(source.customer_name || source.bill_to || source.customer)
      const amount = asNumber(source.amount || source.total || source.total_amount)
      if (!customerName || amount === null) {
        return { data: null, error: "AI extracted invoice data requires customer_name and amount" }
      }
      const payload = {
        company_id: ctx.companyId,
        invoice_number: asString(source.invoice_number) || `AI-INV-${suffix}`,
        customer_name: customerName,
        amount,
        status: asString(source.status) || "pending",
        issue_date: asDate(source.issue_date, nowDate),
        due_date: asDate(source.due_date, nowDate),
        payment_terms: asString(source.payment_terms),
        description: asString(source.description),
        items: Array.isArray(source.items) ? source.items : null,
      }
      const { data, error } = await supabase.from("invoices").insert(payload).select("id").single()
      if (error) return { data: null, error: safeDbError(error, "Failed to create invoice record") }
      return { data: { id: String(data.id), type: extractedData.type }, error: null }
    }

    if (extractedData.type === "maintenance") {
      const truckId = asString(source.truck_id)
      const serviceType = asString(source.service_type || source.maintenance_type)
      if (!truckId || !serviceType) {
        return { data: null, error: "AI extracted maintenance data requires truck_id and service_type" }
      }
      const payload = {
        company_id: ctx.companyId,
        truck_id: truckId,
        service_type: serviceType,
        scheduled_date: asDate(source.scheduled_date || source.service_date, nowDate),
        status: asString(source.status) || "scheduled",
        priority: asString(source.priority) || "normal",
        estimated_cost: asNumber(source.estimated_cost),
        actual_cost: asNumber(source.actual_cost),
        vendor: asString(source.vendor),
        technician: asString(source.technician),
        notes: asString(source.notes || source.description),
      }
      const { data, error } = await supabase.from("maintenance").insert(payload).select("id").single()
      if (error) return { data: null, error: safeDbError(error, "Failed to create maintenance record") }
      return { data: { id: String(data.id), type: extractedData.type }, error: null }
    }

    {
      const category = asString(source.category) || "other"
      const description = asString(source.description || source.memo || source.note)
      const amount = asNumber(source.amount || source.total || source.total_cost)
      if (!description || amount === null) {
        return { data: null, error: "AI extracted expense data requires description and amount" }
      }
      const payload = {
        company_id: ctx.companyId,
        category,
        description,
        amount,
        date: asDate(source.date || source.expense_date, nowDate),
        vendor: asString(source.vendor || source.merchant),
        mileage: asNumber(source.mileage || source.odometer_reading),
        payment_method: asString(source.payment_method),
        receipt_url: asString(source.receipt_url || source.file_url),
        has_receipt: Boolean(asString(source.receipt_url || source.file_url)),
      }
      const { data, error } = await supabase.from("expenses").insert(payload).select("id").single()
      if (error) return { data: null, error: safeDbError(error, "Failed to create expense record") }
      return { data: { id: String(data.id), type: extractedData.type }, error: null }
    }
  } catch (error: unknown) {
    return { data: null, error: errorMessage(error, "Failed to create record from extracted data") }
  }
}
