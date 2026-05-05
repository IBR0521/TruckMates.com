"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { errorMessage } from "@/lib/error-message"

type FuelReceiptResult = {
  purchase_date?: string
  state?: string
  city?: string
  station_name?: string
  gallons?: number
  price_per_gallon?: number
  total_cost?: number
  receipt_number?: string
  odometer_reading?: number
}

function normalizeFuelReceiptData(raw: unknown): FuelReceiptResult {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const toNumber = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) return value
    const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  const toString = (value: unknown): string | undefined => {
    const text = String(value ?? "").trim()
    return text.length > 0 ? text : undefined
  }

  return {
    purchase_date: toString(obj.purchase_date),
    state: toString(obj.state),
    city: toString(obj.city),
    station_name: toString(obj.station_name),
    gallons: toNumber(obj.gallons),
    price_per_gallon: toNumber(obj.price_per_gallon),
    total_cost: toNumber(obj.total_cost),
    receipt_number: toString(obj.receipt_number),
    odometer_reading: toNumber(obj.odometer_reading),
  }
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  try {
    const parsed = JSON.parse(trimmed)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
  } catch {
    const start = trimmed.indexOf("{")
    const end = trimmed.lastIndexOf("}")
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(trimmed.slice(start, end + 1))
        return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
      } catch {
        return null
      }
    }
    return null
  }
}

async function toBase64AndMediaType(input: {
  imageUrl?: string
  imageFile?: File
}): Promise<{ base64: string; mediaType: string }> {
  if (input.imageFile) {
    const mediaType = input.imageFile.type || "image/jpeg"
    const buffer = Buffer.from(await input.imageFile.arrayBuffer())
    return { base64: buffer.toString("base64"), mediaType }
  }

  const url = String(input.imageUrl || "").trim()
  if (!url) {
    throw new Error("No image source provided")
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch image URL (${response.status})`)
  }
  const contentType = response.headers.get("content-type") || "image/jpeg"
  const buffer = Buffer.from(await response.arrayBuffer())
  return { base64: buffer.toString("base64"), mediaType: contentType }
}

async function runAnthropicFuelReceiptOCR(input: {
  imageUrl?: string
  imageFile?: File
}): Promise<FuelReceiptResult> {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim()
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured")

  const { base64, mediaType } = await toBase64AndMediaType(input)
  const prompt = [
    "Extract fuel receipt fields and return JSON only.",
    "Use null when unknown. No markdown.",
    "Schema:",
    "{",
    '  "purchase_date": "YYYY-MM-DD or null",',
    '  "state": "2-letter code or full name or null",',
    '  "city": "string or null",',
    '  "station_name": "string or null",',
    '  "gallons": "number or null",',
    '  "price_per_gallon": "number or null",',
    '  "total_cost": "number or null",',
    '  "receipt_number": "string or null",',
    '  "odometer_reading": "number or null"',
    "}",
  ].join("\n")

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 900,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Anthropic OCR request failed (${response.status}): ${body.slice(0, 300)}`)
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>
  }
  const text = (payload.content || [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("\n")

  const parsed = extractJsonObject(text)
  if (!parsed) throw new Error("Could not parse structured OCR JSON from Claude response")
  return normalizeFuelReceiptData(parsed)
}

export async function extractFuelPurchaseFromReceipt(
  imageUrl: string,
  imageFile?: File
): Promise<{
  data: {
    purchase_date?: string
    state?: string
    city?: string
    station_name?: string
    gallons?: number
    price_per_gallon?: number
    total_cost?: number
    receipt_number?: string
    odometer_reading?: number
  } | null
  error: string | null
}> {
  try {
    const data = await runAnthropicFuelReceiptOCR({ imageUrl, imageFile })
    return { data, error: null }
  } catch (error: unknown) {
    return { data: null, error: errorMessage(error, "Failed to extract data from receipt") }
  }
}

export async function uploadReceiptAndExtract(imageFile: File): Promise<{
  data: {
    purchase_date?: string
    state?: string
    city?: string
    station_name?: string
    gallons?: number
    price_per_gallon?: number
    total_cost?: number
    receipt_number?: string
    odometer_reading?: number
    receipt_url?: string
  } | null
  error: string | null
}> {
  try {
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { data: null, error: ctx.error || "Not authenticated" }
    }

    const supabase = await createClient()
    const ext = String(imageFile.name.split(".").pop() || "jpg").toLowerCase()
    const filePath = `receipts/${ctx.companyId}/${ctx.userId || "user"}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, imageFile, {
      cacheControl: "3600",
      upsert: false,
    })
    if (uploadError) {
      return { data: null, error: `Receipt upload failed: ${uploadError.message}` }
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from("documents")
      .createSignedUrl(filePath, 60 * 60 * 24 * 30)
    if (signedError || !signedData?.signedUrl) {
      return { data: null, error: `Failed to create signed URL: ${signedError?.message || "Unknown error"}` }
    }

    const parsed = await runAnthropicFuelReceiptOCR({
      imageUrl: signedData.signedUrl,
      imageFile,
    })

    return {
      data: {
        ...parsed,
        receipt_url: signedData.signedUrl,
      },
      error: null,
    }
  } catch (error: unknown) {
    return { data: null, error: errorMessage(error, "Failed to upload and process receipt") }
  }
}
