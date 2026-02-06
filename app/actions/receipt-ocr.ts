"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

/**
 * Extract fuel purchase data from receipt image using OpenAI Vision API
 */
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
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { error: "OpenAI API key not configured", data: null }
  }

  try {
    // Get image data
    let imageData: string
    let mimeType: string = "image/jpeg"

    if (imageFile) {
      // Convert file to base64
      const arrayBuffer = await imageFile.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      imageData = buffer.toString("base64")
      mimeType = imageFile.type || "image/jpeg"
    } else if (imageUrl) {
      // Fetch image from URL
      const response = await fetch(imageUrl)
      if (!response.ok) {
        return { error: `Failed to fetch image: ${response.statusText}`, data: null }
      }
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      imageData = buffer.toString("base64")
      
      // Determine mime type from URL or response
      const contentType = response.headers.get("content-type")
      mimeType = contentType || "image/jpeg"
    } else {
      return { error: "No image provided", data: null }
    }

    // Call OpenAI Vision API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract fuel purchase information from this receipt image. Return ONLY a JSON object with the following fields (use null for missing values):
{
  "purchase_date": "YYYY-MM-DD format or null",
  "state": "2-letter state code (e.g., CA, TX) or null",
  "city": "city name or null",
  "station_name": "gas station name (e.g., Shell, Chevron) or null",
  "gallons": number or null,
  "price_per_gallon": number or null,
  "total_cost": number or null,
  "receipt_number": "receipt/invoice number or null",
  "odometer_reading": number or null
}

Look for:
- Date: Usually at top or bottom of receipt
- Location: Address, city, state
- Station name: Brand name (Shell, Chevron, BP, etc.)
- Gallons: Look for "GAL", "Gallons", or similar
- Price per gallon: Look for price with "/GAL" or per gallon notation
- Total: Final total amount
- Receipt number: Invoice #, Receipt #, Transaction #
- Odometer: If visible on receipt

Return ONLY the JSON object, no other text.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageData}`,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.1, // Low temperature for accuracy
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        error: `OpenAI API error: ${errorData.error?.message || response.statusText}`,
        data: null,
      }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return { error: "No content returned from OpenAI", data: null }
    }

    // Parse JSON response
    let extractedData: any
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/)
      const jsonString = jsonMatch ? jsonMatch[1] : content
      extractedData = JSON.parse(jsonString)
    } catch (parseError) {
      return { error: `Failed to parse extracted data: ${parseError}`, data: null }
    }

    // Validate and clean extracted data
    const result: any = {}

    // Date parsing
    if (extractedData.purchase_date) {
      try {
        const date = new Date(extractedData.purchase_date)
        if (!isNaN(date.getTime())) {
          result.purchase_date = date.toISOString().split("T")[0]
        }
      } catch (e) {
        // Try to parse common date formats
        const dateStr = extractedData.purchase_date.toString()
        const dateMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/) || dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/)
        if (dateMatch) {
          if (dateMatch[0].includes("/")) {
            const [month, day, year] = dateMatch[0].split("/")
            result.purchase_date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
          } else {
            result.purchase_date = dateMatch[0]
          }
        }
      }
    }

    // State - ensure 2-letter code
    if (extractedData.state) {
      const stateStr = extractedData.state.toString().toUpperCase().trim()
      if (stateStr.length === 2) {
        result.state = stateStr
      } else {
        // Try to match state name to code
        const stateMap: Record<string, string> = {
          california: "CA",
          texas: "TX",
          florida: "FL",
          newyork: "NY",
          pennsylvania: "PA",
          illinois: "IL",
          ohio: "OH",
          georgia: "GA",
          northcarolina: "NC",
          michigan: "MI",
        }
        const normalized = stateStr.toLowerCase().replace(/\s+/g, "")
        result.state = stateMap[normalized] || stateStr.substring(0, 2).toUpperCase()
      }
    }

    // City
    if (extractedData.city) {
      result.city = extractedData.city.toString().trim()
    }

    // Station name
    if (extractedData.station_name) {
      result.station_name = extractedData.station_name.toString().trim()
    }

    // Numbers - parse and validate
    if (extractedData.gallons !== null && extractedData.gallons !== undefined) {
      const gallons = parseFloat(extractedData.gallons.toString().replace(/[^0-9.]/g, ""))
      if (!isNaN(gallons) && gallons > 0) {
        result.gallons = gallons
      }
    }

    if (extractedData.price_per_gallon !== null && extractedData.price_per_gallon !== undefined) {
      const price = parseFloat(extractedData.price_per_gallon.toString().replace(/[^0-9.]/g, ""))
      if (!isNaN(price) && price > 0) {
        result.price_per_gallon = price
      }
    }

    if (extractedData.total_cost !== null && extractedData.total_cost !== undefined) {
      const total = parseFloat(extractedData.total_cost.toString().replace(/[^0-9.]/g, ""))
      if (!isNaN(total) && total > 0) {
        result.total_cost = total
      }
    }

    // Receipt number
    if (extractedData.receipt_number) {
      result.receipt_number = extractedData.receipt_number.toString().trim()
    }

    // Odometer
    if (extractedData.odometer_reading !== null && extractedData.odometer_reading !== undefined) {
      const odometer = parseInt(extractedData.odometer_reading.toString().replace(/[^0-9]/g, ""))
      if (!isNaN(odometer) && odometer > 0) {
        result.odometer_reading = odometer
      }
    }

    // If we have total_cost and gallons but no price_per_gallon, calculate it
    if (result.total_cost && result.gallons && !result.price_per_gallon) {
      result.price_per_gallon = result.total_cost / result.gallons
    }

    // If we have price_per_gallon and gallons but no total_cost, calculate it
    if (result.price_per_gallon && result.gallons && !result.total_cost) {
      result.total_cost = result.price_per_gallon * result.gallons
    }

    return { data: result, error: null }
  } catch (error: any) {
    console.error("[RECEIPT_OCR] Error:", error)
    return { error: error.message || "Failed to extract receipt data", data: null }
  }
}

/**
 * Upload receipt image and extract fuel purchase data
 */
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
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  if (result.error || !result.company_id) {
    return { error: result.error || "No company found", data: null }
  }

  // Upload receipt to storage
  const fileExt = imageFile.name.split(".").pop() || "jpg"
  const fileName = `receipts/${user.id}/${Date.now()}.${fileExt}`
  const filePath = fileName

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(filePath, imageFile, {
      cacheControl: "3600",
      upsert: false,
    })

  if (uploadError) {
    return { error: `Upload failed: ${uploadError.message}`, data: null }
  }

  // Create signed URL for the uploaded receipt
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from("documents")
    .createSignedUrl(filePath, 3600 * 24 * 7) // 7 days expiry

  const receiptUrl = signedUrlData?.signedUrl || filePath

  // Extract data from receipt
  const extractResult = await extractFuelPurchaseFromReceipt(receiptUrl, imageFile)

  if (extractResult.error) {
    return { error: extractResult.error, data: null }
  }

  return {
    data: {
      ...extractResult.data,
      receipt_url: receiptUrl,
    },
    error: null,
  }
}

