"use server"

// Polyfill for DOMMatrix and other browser APIs needed for pdfjs-dist in Node.js
// MUST be set up BEFORE importing pdfjs-dist
if (typeof globalThis.DOMMatrix === 'undefined') {
  try {
    const dommatrix = require('dommatrix')
    if (dommatrix.DOMMatrix) {
      globalThis.DOMMatrix = dommatrix.DOMMatrix
      globalThis.DOMMatrixReadOnly = dommatrix.DOMMatrixReadOnly || dommatrix.DOMMatrix
    } else {
      globalThis.DOMMatrix = dommatrix
      globalThis.DOMMatrixReadOnly = dommatrix
    }
  } catch (e) {
    console.warn("[DOCUMENT_ANALYSIS] Failed to load dommatrix, using fallback:", e)
    // Minimal DOMMatrix polyfill
    globalThis.DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
      constructor(init?: string | number[]) {
        if (typeof init === 'string') {
          const m = init.match(/matrix\(([^)]+)\)/)?.[1]?.split(',').map(Number)
          if (m && m.length >= 6) {
            this.a = m[0]; this.b = m[1]; this.c = m[2]
            this.d = m[3]; this.e = m[4]; this.f = m[5]
          }
        } else if (Array.isArray(init) && init.length >= 6) {
          this.a = init[0]; this.b = init[1]; this.c = init[2]
          this.d = init[3]; this.e = init[4]; this.f = init[5]
        }
      }
      multiply() { return this }
      translate() { return this }
      scale() { return this }
      rotate() { return this }
    } as any
    globalThis.DOMMatrixReadOnly = globalThis.DOMMatrix
  }
}

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import * as pdfjsLib from "pdfjs-dist"
import { createCanvas } from "canvas"
// Types for extracted data
export interface ExtractedDriverData {
  type: "driver"
  name?: string
  email?: string
  phone?: string
  license_number?: string
  license_expiry?: string
  status?: string
  [key: string]: any
}

export interface ExtractedVehicleData {
  type: "vehicle"
  truck_number?: string
  make?: string
  model?: string
  year?: number
  vin?: string
  license_plate?: string
  status?: string
  [key: string]: any
}

export interface DeliveryPoint {
  delivery_number: number
  location_name?: string
  location_id?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  contact_name?: string
  contact_phone?: string
  scheduled_delivery_date?: string
  scheduled_delivery_time?: string
  time_window_start?: string
  time_window_end?: string
  weight_kg?: number
  weight_lbs?: number
  pieces?: number
  pallets?: number
  boxes?: number
  carts?: number
  priority?: string
  delivery_instructions?: string
  notes?: string
}

export interface ExtractedLoadData {
  type: "load"
  shipment_number?: string
  origin?: string
  destination?: string
  weight?: string
  weight_kg?: number
  contents?: string
  value?: number
  status?: string
  delivery_type?: string
  delivery_points?: DeliveryPoint[]
  [key: string]: any
}

export interface RouteStop {
  stop_number: number
  location_name?: string
  location_id?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  contact_name?: string
  contact_phone?: string
  arrive_time?: string
  depart_time?: string
  service_time_minutes?: number
  travel_time_minutes?: number
  time_window_1_open?: string
  time_window_1_close?: string
  time_window_2_open?: string
  time_window_2_close?: string
  carts?: number
  boxes?: number
  pallets?: number
  orders?: number
  priority?: string
  stop_type?: string
  special_instructions?: string
  notes?: string
}

export interface ExtractedRouteData {
  type: "route"
  name?: string
  origin?: string
  destination?: string
  distance?: string
  estimated_time?: string
  priority?: string
  status?: string
  depot_name?: string
  depot_address?: string
  route_start_time?: string
  route_complete_time?: string
  pre_route_time_minutes?: number
  post_route_time_minutes?: number
  stops?: RouteStop[]
  [key: string]: any
}

export interface ExtractedMaintenanceData {
  type: "maintenance"
  truck_id?: string
  service_type?: string
  scheduled_date?: string
  estimated_cost?: number
  vendor?: string
  notes?: string
  [key: string]: any
}

export interface ExtractedInvoiceData {
  type: "invoice"
  invoice_number?: string
  customer_name?: string
  amount?: number
  issue_date?: string
  due_date?: string
  status?: string
  [key: string]: any
}

export interface ExtractedExpenseData {
  type: "expense"
  category?: string
  description?: string
  amount?: number
  date?: string
  vendor?: string
  [key: string]: any
}

export interface ExtractedRouteAndLoadData {
  type: "route_and_load"
  // Route fields
  route_name?: string
  route_origin?: string
  route_destination?: string
  route_distance?: string
  route_estimated_time?: string
  route_priority?: string
  route_status?: string
  depot_name?: string
  depot_address?: string
  route_start_time?: string
  route_complete_time?: string
  pre_route_time_minutes?: number
  post_route_time_minutes?: number
  stops?: RouteStop[]
  // Load fields
  shipment_number?: string
  load_origin?: string
  load_destination?: string
  weight?: string
  weight_kg?: number
  contents?: string
  value?: number
  load_status?: string
  delivery_type?: string
  delivery_points?: DeliveryPoint[]
  [key: string]: any
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

// Analyze document using AI (OpenAI Vision)
export async function analyzeDocument(fileUrl: string, fileName: string): Promise<{
  data: ExtractedData | null
  error: string | null
}> {
  try {
    // Use OpenAI Vision API to analyze the document
    // You'll need to set OPENAI_API_KEY in your environment variables
    
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY
    
    if (!OPENAI_API_KEY) {
      return {
        error: "OpenAI API key not configured. Please set OPENAI_API_KEY in environment variables.",
        data: null
      }
    }

    // Determine if this is an image or PDF
    const isImage = fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i)
    const isPdf = fileName.toLowerCase().match(/\.pdf$/i)

    // Build the prompt for OpenAI - Enhanced with better extraction
    const systemPrompt = `You are an expert at analyzing business documents for a logistics/fleet management company. 
Analyze the document carefully and extract ALL structured data with maximum accuracy.
        
        CRITICAL: A document can contain MULTIPLE types of data. For example:
        - A route document might also contain load information (quantities, cargo details)
        - A load document might reference route information
- An invoice might reference a load or driver
- An expense receipt might reference a vehicle or driver
        
        If the document contains BOTH route and load information, extract BOTH and set "type" to "route_and_load".
        
        IMPORTANT: If the document contains a ROUTE with MULTIPLE STOPS, extract ALL stops and include them in a "stops" array.
        If the document contains a LOAD with MULTIPLE DELIVERY POINTS, extract ALL delivery points and include them in a "delivery_points" array.

ENHANCED EXTRACTION RULES:
1. Look for ANY identifying information: names, numbers, dates, addresses, amounts
2. Extract partial information - don't require all fields to be present
3. If you see driver information (name, license, phone), classify as "driver"
4. If you see vehicle information (truck number, VIN, plate), classify as "vehicle"
5. If you see shipment/load information (origin, destination, weight, cargo), classify as "load"
6. If you see route/stop information (stops, addresses, times), classify as "route"
7. If you see invoice information (invoice number, customer, amount), classify as "invoice"
8. If you see expense information (receipt, vendor, amount, date), classify as "expense"
9. If you see maintenance information (service type, truck, date, cost), classify as "maintenance"
        
        Return ONLY valid JSON in this format:
        {
          "type": "driver" | "vehicle" | "load" | "route" | "route_and_load" | "maintenance" | "invoice" | "expense",
          "data": {
            // relevant fields based on type
            // For driver: name, email, phone, license_number, license_expiry, status
            // For vehicle: truck_number, make, model, year, vin, license_plate, status
            // For load: shipment_number, origin, destination, weight, weight_kg, contents, value, status, delivery_points (array)
            //   delivery_points: [{ delivery_number, location_name, address, city, state, zip, scheduled_delivery_date, weight_kg, pieces, pallets, boxes, carts, notes }]
            // For route: name, origin, destination, distance, estimated_time, priority, status, depot_name, depot_address, route_start_time, route_complete_time, stops (array)
            //   stops: [{ stop_number, location_name, address, city, state, zip, arrive_time, depart_time, service_time_minutes, travel_time_minutes, time_window_1_open, time_window_1_close, carts, boxes, pallets, orders, priority, notes }]
            // For route_and_load: include ALL route fields AND load fields (shipment_number, origin, destination, weight, contents, value, delivery_points array)
            //   This is for documents that contain both route planning AND load/shipment information
            // For maintenance: truck_id (or truck_number), service_type, scheduled_date, estimated_cost, vendor, notes
            // For invoice: invoice_number, customer_name, amount, issue_date, due_date, status
            // For expense: category, description, amount, date, vendor
          }
        }
        
        CRITICAL INSTRUCTIONS:
- Extract information even if incomplete - partial data is better than no data
        - If you see a route with multiple stops (like Stop 1, Stop 2, Stop 3, etc.), extract ALL of them into the "stops" array
        - If you see a load with multiple delivery locations, extract ALL of them into the "delivery_points" array
        - If the document contains BOTH route information AND load/shipment information (like quantities, cargo details, shipment numbers), set type to "route_and_load" and extract BOTH
        - For route_and_load: Extract route details (name, stops, etc.) AND load details (shipment_number, quantities, contents, etc.)
        - Extract ALL available details for each stop/delivery point (address, times, quantities, etc.)
        - Don't skip any stops or delivery points - include every single one you find in the document
- Look for patterns: invoice numbers, shipment numbers, truck numbers, driver names, etc.
- Extract dates in ISO format (YYYY-MM-DD) when possible
- Extract amounts as numbers (not strings with currency symbols)
- Return ONLY valid JSON, no markdown formatting, no code blocks.
- If the document is unclear or doesn't match any category well, still try to extract what you can and choose the closest match.`

    // Build OpenAI request content
    const messages: any[] = []
    const content: any[] = []

    // Add the prompt as text
    content.push({
            type: "text",
      text: `${systemPrompt}\n\nAnalyze this document (filename: ${fileName}). Extract all relevant business information and categorize it.

IMPORTANT: 
- If this is a ROUTE document with multiple stops (Stop 1, Stop 2, Stop 3, etc.), extract ALL stops and include them in the "stops" array. Don't skip any stops - extract every single one you see in the document.
- If this is a LOAD document with multiple delivery points, extract ALL delivery points and include them in the "delivery_points" array.
- If the document contains BOTH route information (stops, route name, times) AND load information (shipment numbers, quantities, cargo), set type to "route_and_load" and extract BOTH types of data.`
    })

    // Handle images - fetch and convert to base64
    if (isImage) {
      try {
        // Try to fetch the image with better error handling
        let imageResponse: Response
        let retryCount = 0
        const maxRetries = 2
        
        while (retryCount <= maxRetries) {
          try {
            imageResponse = await fetch(fileUrl, {
              method: 'GET',
              headers: {
                'Accept': 'image/*',
              },
            })
            
            if (imageResponse.ok) {
              break
            }
            
            // If 403/404, try to get a new signed URL if this is a Supabase URL
            if ((imageResponse.status === 403 || imageResponse.status === 404) && retryCount < maxRetries) {
              const pathMatch = fileUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/documents\/([^?]+)/)
              if (pathMatch) {
                // This is a Supabase URL - we might need a fresh signed URL
                // But we can't create one here since we don't have supabase client
                // Just retry once more
                retryCount++
                await new Promise(resolve => setTimeout(resolve, 1000))
                continue
              }
            }
            
            let errorText = await imageResponse.text().catch(() => `HTTP ${imageResponse.status}`)
            // Try to parse as JSON for better error messages
            try {
              const errorJson = JSON.parse(errorText)
              if (errorJson.message?.includes("Bucket not found") || errorJson.error?.includes("Bucket not found")) {
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "not set"
                errorText = `Storage bucket 'documents' not found when trying to fetch image.

DIAGNOSTICS:
• Supabase URL: ${supabaseUrl}
• File URL: ${fileUrl.substring(0, 100)}...
• Status: ${imageResponse.status}

This error occurs when fetching the image for analysis.
The bucket check passed, but the actual file fetch failed.

POSSIBLE CAUSES:
1. Bucket was just created - try refreshing and uploading again
2. File URL is malformed - check the file was uploaded correctly
3. Permissions issue - verify storage policies are set up correctly

ACTION:
1. Go to Supabase Dashboard → Storage → Check if 'documents' bucket exists
2. If it exists, verify policies: Run supabase/storage_bucket_setup.sql
3. Try uploading the document again
4. If still failing, check browser console for more details`
    } else {
                errorText = errorJson.message || errorJson.error || errorText
              }
            } catch {
              // Not JSON, use as is
            }
            return {
              error: `Failed to fetch image document: ${errorText} (Status: ${imageResponse.status})`,
              data: null
            }
          } catch (fetchError: any) {
            if (retryCount >= maxRetries) {
              return {
                error: `Failed to fetch image document: ${fetchError?.message || "Network error"}. Please ensure the file URL is accessible.`,
                data: null
              }
            }
            retryCount++
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        
        if (!imageResponse!.ok) {
        return {
            error: `Failed to fetch image document: HTTP ${imageResponse!.status} ${imageResponse!.statusText}`,
          data: null
        }
      }

        const imageBuffer = await imageResponse!.arrayBuffer()
        const imageBase64 = Buffer.from(imageBuffer).toString('base64')
        const mimeType = imageResponse!.headers.get('content-type') || 
                        (fileName.toLowerCase().endsWith('.png') ? 'image/png' : 
                         fileName.toLowerCase().endsWith('.gif') ? 'image/gif' : 
                         fileName.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg')
        
        // Validate base64 data
        if (!imageBase64 || imageBase64.length === 0) {
        return {
            error: "Failed to process image: Empty or invalid image data",
          data: null
        }
      }

        // Check file size (OpenAI Vision has limits - typically 20MB for base64)
        const base64SizeMB = imageBase64.length / (1024 * 1024)
        console.log("[DOCUMENT_ANALYSIS] Image processed:", {
          mimeType,
          sizeMB: base64SizeMB.toFixed(2),
          base64Length: imageBase64.length,
          fileName
        })
        
        if (base64SizeMB > 20) {
          return {
            error: `Image file is too large (${base64SizeMB.toFixed(2)}MB). Maximum size is 20MB. Please use a smaller image.`,
            data: null
          }
        }
        
        // OpenAI Vision API uses data URL format
        content.push({
            type: "image_url",
            image_url: {
            url: `data:${mimeType};base64,${imageBase64}`
          }
        })
      } catch (fetchError: any) {
        console.error("[DOCUMENT_ANALYSIS] Image fetch error:", fetchError)
        return {
          error: `Failed to process image document: ${fetchError?.message || "Unknown error"}. Please check the file URL and try again.`,
          data: null
        }
      }
    } else if (isPdf) {
      // For PDFs, fetch and convert to base64
      try {
        let pdfResponse: Response
        let retryCount = 0
        const maxRetries = 2
        
        while (retryCount <= maxRetries) {
          try {
            pdfResponse = await fetch(fileUrl, {
              method: 'GET',
              headers: {
                'Accept': 'application/pdf',
              },
            })
            
            if (pdfResponse.ok) {
              break
            }
            
            if ((pdfResponse.status === 403 || pdfResponse.status === 404) && retryCount < maxRetries) {
              retryCount++
              await new Promise(resolve => setTimeout(resolve, 1000))
              continue
            }
            
            const errorText = await pdfResponse.text().catch(() => `HTTP ${pdfResponse.status}`)
        return {
              error: `Failed to fetch PDF document: ${errorText} (Status: ${pdfResponse.status})`,
          data: null
            }
          } catch (fetchError: any) {
            if (retryCount >= maxRetries) {
              return {
                error: `Failed to fetch PDF document: ${fetchError?.message || "Network error"}. Please ensure the file URL is accessible.`,
                data: null
              }
            }
            retryCount++
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        
        if (!pdfResponse!.ok) {
        return {
            error: `Failed to fetch PDF document: HTTP ${pdfResponse!.status} ${pdfResponse!.statusText}`,
          data: null
        }
      }

        const pdfBuffer = await pdfResponse!.arrayBuffer()
        const pdfBase64 = Buffer.from(pdfBuffer).toString('base64')
        
        // Validate base64 data
        if (!pdfBase64 || pdfBase64.length === 0) {
          return {
            error: "Failed to process PDF: Empty or invalid PDF data",
            data: null
          }
        }
        
        // Check file size (OpenAI Vision has limits)
        const base64SizeMB = pdfBase64.length / (1024 * 1024)
        console.log("[DOCUMENT_ANALYSIS] PDF processed:", {
          sizeMB: base64SizeMB.toFixed(2),
          base64Length: pdfBase64.length,
          fileName
        })
        
        if (base64SizeMB > 20) {
          return {
            error: `PDF file is too large (${base64SizeMB.toFixed(2)}MB). Maximum size is 20MB. Please use a smaller PDF.`,
            data: null
          }
        }
        
        // Convert PDF to image using pdfjs-dist and canvas
        try {
          console.log("[DOCUMENT_ANALYSIS] Converting PDF to image...")
          
          // Load PDF document (no worker needed for server-side)
          const loadingTask = pdfjsLib.getDocument({
            data: Buffer.from(pdfBase64, 'base64'),
            useSystemFonts: true,
            verbosity: 0 // Suppress warnings
          })
          
          const pdfDocument = await loadingTask.promise
          console.log("[DOCUMENT_ANALYSIS] PDF loaded, pages:", pdfDocument.numPages)
          
          // Get first page (or you could loop through all pages)
          const page = await pdfDocument.getPage(1)
          const viewport = page.getViewport({ scale: 2.0 }) // Scale for better quality
          
          // Create canvas
          const canvas = createCanvas(viewport.width, viewport.height)
          const context = canvas.getContext('2d')
          
          // Render PDF page to canvas
          await page.render({
            canvasContext: context as any,
            viewport: viewport
          }).promise
          
          // Convert canvas to base64 image (PNG)
          const imageBuffer = canvas.toBuffer('image/png')
          const imageBase64 = imageBuffer.toString('base64')
          const mimeType = 'image/png'
          
          console.log("[DOCUMENT_ANALYSIS] PDF converted to image:", {
            width: viewport.width,
            height: viewport.height,
            sizeMB: (imageBase64.length / (1024 * 1024)).toFixed(2)
          })
          
          // Check size
          const base64SizeMB = imageBase64.length / (1024 * 1024)
          if (base64SizeMB > 20) {
            return {
              error: `Converted PDF image is too large (${base64SizeMB.toFixed(2)}MB). Maximum size is 20MB. Please use a smaller PDF or fewer pages.`,
              data: null
            }
          }
          
          // Add converted image to content
          content.push({
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`
            }
          })
          
          // If PDF has multiple pages, add a note in the prompt
          if (pdfDocument.numPages > 1) {
            content[0].text += `\n\nNOTE: This PDF has ${pdfDocument.numPages} pages. Only the first page is being analyzed. If important information is on other pages, please upload those pages separately as images.`
          }
        } catch (pdfError: any) {
          console.error("[DOCUMENT_ANALYSIS] PDF conversion error:", pdfError)
          return {
            error: `Failed to convert PDF to image: ${pdfError?.message || "Unknown error"}. Please try converting the PDF to images manually and upload those instead.`,
            data: null
          }
        }
      } catch (fetchError: any) {
        console.error("[DOCUMENT_ANALYSIS] PDF fetch error:", fetchError)
        return {
          error: `Failed to process PDF document: ${fetchError?.message || "Unknown error"}. Please check the file URL and try again.`,
          data: null
        }
      }
    }

      messages.push({
        role: "user",
      content: content
    })

    // Call OpenAI Vision API
    let openaiResponse: Response
    const modelUsed = "gpt-4o" // Using gpt-4o which has vision capabilities
    
    try {
      openaiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
            model: modelUsed,
        messages: messages,
        temperature: 0.1,
            max_tokens: 4000,
            response_format: { type: "json_object" }
          })
        }
      )
    } catch (fetchError: any) {
      return {
        error: `Failed to connect to OpenAI API: ${fetchError?.message || "Network error"}. Please check your internet connection and try again.`,
        data: null
      }
    }

    if (!openaiResponse.ok) {
      let errorMessage = "Unknown error"
      let errorDetails: any = null
      let rawErrorText = ""
      
      try {
        rawErrorText = await openaiResponse.text()
        console.error("[DOCUMENT_ANALYSIS] OpenAI API raw error response:", rawErrorText)
        
        try {
          errorDetails = JSON.parse(rawErrorText)
          errorMessage = errorDetails.error?.message || 
                        errorDetails.message || 
                        JSON.stringify(errorDetails)
        } catch {
          errorMessage = rawErrorText || `HTTP ${openaiResponse.status}: ${openaiResponse.statusText}`
        }
        } catch (textError) {
        errorMessage = `HTTP ${openaiResponse.status}: ${openaiResponse.statusText}`
      }
      
      console.error("[DOCUMENT_ANALYSIS] OpenAI API error details:", {
        status: openaiResponse.status,
        statusText: openaiResponse.statusText,
        error: errorMessage,
        rawResponse: rawErrorText.substring(0, 500),
        details: errorDetails,
        model: modelUsed
      })
      
      // Check if it's a rate limit error
      if (errorMessage.includes("quota") || errorMessage.includes("rate") || errorMessage.includes("rate_limit") || openaiResponse.status === 429) {
        return {
          error: `OpenAI API rate limit reached. ${errorMessage}. Please try again later or check your API usage.`,
          data: null
        }
      }
      
      // Check for model not found errors
      if (errorMessage.includes("model") && (errorMessage.includes("not found") || errorMessage.includes("not available"))) {
        return {
          error: `OpenAI API model error: The model "${modelUsed}" may not be available for your API key. ${errorMessage}. Please check your OPENAI_API_KEY and ensure you have access to GPT-4 Vision models.`,
          data: null
        }
      }
      
      // Check if it's an authentication error
      if (errorMessage.includes("API key") || errorMessage.includes("authentication") || errorMessage.includes("Invalid") || openaiResponse.status === 401 || openaiResponse.status === 403) {
        return {
          error: `OpenAI API authentication failed. Please check that OPENAI_API_KEY is correctly set in your environment variables.`,
          data: null
        }
      }
      
      // For 400 errors, provide more details
      if (openaiResponse.status === 400) {
        const detailedError = errorDetails?.error?.message || 
                             errorDetails?.message || 
                             rawErrorText.substring(0, 500)
      
      return {
          error: `OpenAI API Bad Request (400): ${detailedError}\n\nCommon causes:\n1. Invalid request format\n2. Image data is corrupted or too large\n3. API key doesn't have access to the model\n4. Request exceeds size limits (max 20MB for images)\n\nFull error logged in console.`,
        data: null
      }
    }

      return {
        error: `OpenAI API error (${openaiResponse.status}): ${errorMessage}`,
        data: null
      }
    }

    let openaiData
    try {
      openaiData = await openaiResponse.json()
    } catch (jsonError: any) {
      console.error("[DOCUMENT_ANALYSIS] Failed to parse OpenAI response:", jsonError)
      try {
        const responseText = await openaiResponse.text()
        console.error("[DOCUMENT_ANALYSIS] Raw response text:", responseText.substring(0, 500))
      } catch (textError) {
        console.error("[DOCUMENT_ANALYSIS] Could not read response text:", textError)
      }
      return {
        error: "Failed to parse OpenAI response. The API returned an unexpected format. Please try again.",
        data: null
      }
    }

    // Validate response structure
    if (!openaiData.choices || !openaiData.choices[0] || !openaiData.choices[0].message || !openaiData.choices[0].message.content) {
      return {
        error: "OpenAI API returned an unexpected response format. Please try again.",
        data: null
      }
    }

    let analysisResult
    try {
      const responseText = openaiData.choices[0].message.content
      // Remove markdown code blocks if present
      const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      analysisResult = JSON.parse(cleanedText)
    } catch (parseError) {
      return {
        error: `Failed to parse AI analysis result. The AI may have returned invalid JSON. Error: ${parseError instanceof Error ? parseError.message : "Unknown parsing error"}`,
        data: null
      }
    }

    // Structure the response
    let extractedData: ExtractedData
    
    if (analysisResult.type === "route_and_load") {
      // For route_and_load, merge route and load data properly
      extractedData = {
        type: "route_and_load",
        ...analysisResult.data
      } as ExtractedRouteAndLoadData
    } else {
      extractedData = {
        type: analysisResult.type,
        ...analysisResult.data
      }
    }

    return {
      data: extractedData,
      error: null
    }
  } catch (error: any) {
    console.error("[DOCUMENT_ANALYSIS] Error:", error)
    
    // Provide more specific error messages
    if (error?.message?.includes("fetch")) {
      return {
        error: "Failed to connect to OpenAI API. Please check your internet connection and try again.",
        data: null
      }
    }
    
    if (error?.message?.includes("JSON")) {
      return {
        error: "Failed to parse response from OpenAI. Please try again.",
        data: null
      }
    }
    
    return {
      error: error?.message || "An unexpected error occurred while analyzing the document. Please try again.",
      data: null
    }
  }
}

// Analyze document from file URL (file already uploaded to Supabase)
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
  } | null
  error: string | null
}> {
  try {
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

    // Bucket check removed - let the actual operations fail if bucket doesn't exist
    // This avoids false positives from listBuckets() permissions issues

    // Get signed URL (works for private buckets) - valid for 1 hour
    // IMPORTANT: For private buckets, we MUST use signed URLs
    // Public URLs (/public/documents/) don't work for private buckets
    let signedUrl = fileUrl
    
    // Extract file path from URL - handle different Supabase URL formats:
    // - /storage/v1/object/public/documents/path (public URL - won't work for private bucket)
    // - /storage/v1/object/sign/documents/path (already a signed URL)
    // - https://project.supabase.co/storage/v1/object/public/documents/path
    let filePath: string | null = null
    
    // Try to extract path from public URL format
    const publicMatch = fileUrl.match(/\/storage\/v1\/object\/public\/documents\/([^?]+)/)
    if (publicMatch) {
      filePath = decodeURIComponent(publicMatch[1])
      console.log("[DOCUMENT_ANALYSIS] Detected public URL format, extracting path:", filePath)
    } else {
      // Try signed URL format
      const signMatch = fileUrl.match(/\/storage\/v1\/object\/sign\/documents\/([^?]+)/)
      if (signMatch) {
        // Already a signed URL, but extract path to create a fresh one
        filePath = decodeURIComponent(signMatch[1])
        console.log("[DOCUMENT_ANALYSIS] Detected signed URL format, extracting path:", filePath)
      } else {
        // Try generic format
        const genericMatch = fileUrl.match(/\/storage\/v1\/object\/[^/]+\/documents\/([^?]+)/)
        if (genericMatch) {
          filePath = decodeURIComponent(genericMatch[1])
          console.log("[DOCUMENT_ANALYSIS] Detected generic URL format, extracting path:", filePath)
        }
      }
    }
    
    // If we have a file path, create a signed URL (required for private buckets)
    if (filePath) {
      console.log("[DOCUMENT_ANALYSIS] Creating signed URL for path:", filePath)
      
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("documents")
        .createSignedUrl(filePath, 3600) // 1 hour expiry

      if (signedUrlError) {
        console.error("[DOCUMENT_ANALYSIS] Failed to create signed URL:", signedUrlError)
        
        // If signed URL creation fails, this is CRITICAL for private buckets
        // We cannot use public URLs for private buckets
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        return {
          error: `Cannot create signed URL - required for private bucket access.

DIAGNOSTICS:
• Supabase URL: ${supabaseUrl}
• File path: ${filePath}
• Original URL: ${fileUrl.substring(0, 100)}...
• Error: ${signedUrlError.message}

The bucket is PRIVATE, so public URLs won't work.
Signed URL creation failed, which means we cannot access the file.

POSSIBLE CAUSES:
1. Storage policies not set up correctly
2. File path is incorrect
3. Bucket permissions issue

ACTION:
1. Go to Supabase Dashboard → Storage → documents bucket
2. Verify bucket is Private (not Public)
3. Run supabase/storage_bucket_setup.sql to set up policies
4. Delete the old document and upload a NEW one
5. Check browser console for detailed error logs`,
          data: null
        }
      } else if (signedUrlData?.signedUrl) {
        signedUrl = signedUrlData.signedUrl
        console.log("[DOCUMENT_ANALYSIS] Successfully created signed URL:", signedUrl.substring(0, 100) + "...")
      } else {
        // Signed URL data is null - this shouldn't happen, but fail safely
        console.error("[DOCUMENT_ANALYSIS] Signed URL data is null!")
        return {
          error: `Signed URL creation returned no data. This is unexpected.

DIAGNOSTICS:
• File path: ${filePath}
• Original URL: ${fileUrl.substring(0, 100)}...

Please try uploading a NEW document.`,
          data: null
        }
      }
    } else {
      // If we can't extract path, this is a problem for private buckets
      console.error("[DOCUMENT_ANALYSIS] Could not extract file path from URL:", fileUrl)
      return {
        error: `Cannot extract file path from URL. The URL format may be incorrect.

DIAGNOSTICS:
• File URL: ${fileUrl.substring(0, 150)}...
• Expected format: .../storage/v1/object/public/documents/path or .../storage/v1/object/sign/documents/path

This usually happens when:
1. The file was uploaded with an old version of the code
2. The URL format is malformed

ACTION:
1. Delete the old document
2. Upload a NEW document (will use the fixed code)
3. The new upload will create proper signed URLs`,
        data: null
      }
    }
    
    // CRITICAL: If we still have a public URL and bucket is private, this will fail
    // Make sure we're using the signed URL
    if (signedUrl.includes('/public/documents/')) {
      console.error("[DOCUMENT_ANALYSIS] Still using public URL after signed URL creation attempt!")
      return {
        error: `Cannot use public URL for private bucket. Signed URL creation may have failed.

DIAGNOSTICS:
• Original URL: ${fileUrl.substring(0, 100)}...
• Current URL: ${signedUrl.substring(0, 100)}...
• File path extracted: ${filePath || 'none'}

The bucket is private, so public URLs won't work.
Please try uploading a NEW document - old uploads may have incorrect URLs.`,
        data: null
      }
    }

    // Save document record to database
    // Store the signed URL (it will expire, but we can regenerate signed URLs when needed)
    const { data: documentData, error: docError } = await supabase
      .from("documents")
      .insert({
        company_id: userData.company_id,
        name: metadata?.name || fileName,
        type: metadata?.type || "other",
        file_url: signedUrl, // Store the signed URL we just created
        file_size: fileSize,
        upload_date: new Date().toISOString().split("T")[0],
      })
      .select()
      .single()

    if (docError) {
      return { error: docError.message, data: null }
    }

    // Analyze the document using signed URL (works with private buckets)
    const analysisResult = await analyzeDocument(signedUrl, fileName)

    if (analysisResult.error) {
      // Document uploaded but analysis failed - return document info
      return {
        data: {
          documentId: documentData.id,
          extractedData: null,
          fileUrl: signedUrl
        },
        error: `Document uploaded but analysis failed: ${analysisResult.error}`
      }
    }

    revalidatePath("/dashboard/documents")
    
    return {
      data: {
        documentId: documentData.id,
        extractedData: analysisResult.data,
        fileUrl: signedUrl
      },
      error: null
    }
  } catch (error: any) {
    return {
      error: error?.message || "An unexpected error occurred",
      data: null
    }
  }
}

// Create record from extracted data
export async function createRecordFromExtractedData(
  extractedData: ExtractedData
): Promise<{
  data: { id: string; type: string } | null
  error: string | null
}> {
  try {
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

    let result: any = null
    let error: string | null = null

    switch (extractedData.type) {
      case "driver": {
        const { data, error: driverError } = await supabase
          .from("drivers")
          .insert({
            company_id: userData.company_id,
            name: (extractedData as ExtractedDriverData).name || "",
            email: (extractedData as ExtractedDriverData).email,
            phone: (extractedData as ExtractedDriverData).phone,
            license_number: (extractedData as ExtractedDriverData).license_number,
            license_expiry: (extractedData as ExtractedDriverData).license_expiry,
            status: (extractedData as ExtractedDriverData).status || "active",
          })
          .select()
          .single()
        result = data
        error = driverError?.message || null
        break
      }

      case "vehicle": {
        const { data, error: vehicleError } = await supabase
          .from("trucks")
          .insert({
            company_id: userData.company_id,
            truck_number: (extractedData as ExtractedVehicleData).truck_number || "",
            make: (extractedData as ExtractedVehicleData).make,
            model: (extractedData as ExtractedVehicleData).model,
            year: (extractedData as ExtractedVehicleData).year,
            vin: (extractedData as ExtractedVehicleData).vin,
            license_plate: (extractedData as ExtractedVehicleData).license_plate,
            status: (extractedData as ExtractedVehicleData).status || "available",
          })
          .select()
          .single()
        result = data
        error = vehicleError?.message || null
        break
      }

      case "load": {
        const loadData = extractedData as ExtractedLoadData
        const { data, error: loadError } = await supabase
          .from("loads")
          .insert({
            company_id: userData.company_id,
            shipment_number: loadData.shipment_number || `LOAD-${Date.now()}`,
            origin: loadData.origin || "",
            destination: loadData.destination || "",
            weight: loadData.weight,
            weight_kg: loadData.weight_kg,
            contents: loadData.contents,
            value: loadData.value,
            status: loadData.status || "pending",
            delivery_type: loadData.delivery_points && loadData.delivery_points.length > 1 ? "multi" : "single",
            total_delivery_points: loadData.delivery_points?.length || 1,
          })
          .select()
          .single()
        
        if (loadError) {
          result = null
          error = loadError.message
          break
        }

        result = data

        // Create delivery points if they exist
        if (loadData.delivery_points && loadData.delivery_points.length > 0 && data?.id) {
          const { createLoadDeliveryPoint } = await import("./load-delivery-points")
          
          for (const point of loadData.delivery_points) {
            await createLoadDeliveryPoint(data.id, {
              delivery_number: point.delivery_number,
              location_name: point.location_name || "",
              location_id: point.location_id,
              address: point.address || "",
              city: point.city,
              state: point.state,
              zip: point.zip,
              phone: point.phone,
              contact_name: point.contact_name,
              contact_phone: point.contact_phone,
              scheduled_delivery_date: point.scheduled_delivery_date,
              scheduled_delivery_time: point.scheduled_delivery_time,
              time_window_start: point.time_window_start,
              time_window_end: point.time_window_end,
              weight_kg: point.weight_kg,
              weight_lbs: point.weight_lbs,
              pieces: point.pieces || 0,
              pallets: point.pallets || 0,
              boxes: point.boxes || 0,
              carts: point.carts || 0,
              priority: point.priority,
              delivery_instructions: point.delivery_instructions,
              notes: point.notes,
            })
          }
        }

        error = null
        break
      }

      case "route_and_load": {
        // Create both route and load records
        const routeLoadData = extractedData as ExtractedRouteAndLoadData
        
        // First, create the route
        const { data: routeData, error: routeError } = await supabase
          .from("routes")
          .insert({
            company_id: userData.company_id,
            name: routeLoadData.route_name || `Route-${Date.now()}`,
            origin: routeLoadData.route_origin || "",
            destination: routeLoadData.route_destination || "",
            distance: routeLoadData.route_distance,
            estimated_time: routeLoadData.route_estimated_time,
            priority: routeLoadData.route_priority || "normal",
            status: routeLoadData.route_status || "pending",
            depot_name: routeLoadData.depot_name,
            depot_address: routeLoadData.depot_address,
            route_start_time: routeLoadData.route_start_time,
            route_complete_time: routeLoadData.route_complete_time,
            pre_route_time_minutes: routeLoadData.pre_route_time_minutes,
            post_route_time_minutes: routeLoadData.post_route_time_minutes,
          })
          .select()
          .single()
        
        if (routeError) {
          result = null
          error = routeError.message
          break
        }

        // Create route stops if they exist
        if (routeLoadData.stops && routeLoadData.stops.length > 0 && routeData?.id) {
          const { createRouteStop } = await import("./route-stops")
          
          for (const stop of routeLoadData.stops) {
            await createRouteStop(routeData.id, {
              stop_number: stop.stop_number,
              location_name: stop.location_name || "",
              location_id: stop.location_id,
              address: stop.address || "",
              city: stop.city,
              state: stop.state,
              zip: stop.zip,
              phone: stop.phone,
              contact_name: stop.contact_name,
              contact_phone: stop.contact_phone,
              arrive_time: stop.arrive_time,
              depart_time: stop.depart_time,
              service_time_minutes: stop.service_time_minutes,
              travel_time_minutes: stop.travel_time_minutes,
              time_window_1_open: stop.time_window_1_open,
              time_window_1_close: stop.time_window_1_close,
              time_window_2_open: stop.time_window_2_open,
              time_window_2_close: stop.time_window_2_close,
              carts: stop.carts || 0,
              boxes: stop.boxes || 0,
              pallets: stop.pallets || 0,
              orders: stop.orders || 0,
              priority: stop.priority,
              stop_type: stop.stop_type || "delivery",
              special_instructions: stop.special_instructions,
              notes: stop.notes,
            })
          }
        }

        // Then, create the load
        const { data: loadData, error: loadError } = await supabase
          .from("loads")
          .insert({
            company_id: userData.company_id,
            shipment_number: routeLoadData.shipment_number || `LOAD-${Date.now()}`,
            origin: routeLoadData.load_origin || routeLoadData.route_origin || "",
            destination: routeLoadData.load_destination || routeLoadData.route_destination || "",
            weight: routeLoadData.weight,
            weight_kg: routeLoadData.weight_kg,
            contents: routeLoadData.contents,
            value: routeLoadData.value,
            status: routeLoadData.load_status || "pending",
            delivery_type: routeLoadData.delivery_points && routeLoadData.delivery_points.length > 1 ? "multi" : "single",
            total_delivery_points: routeLoadData.delivery_points?.length || 1,
            route_id: routeData.id, // Link load to route
          })
          .select()
          .single()
        
        if (loadError) {
          // Route was created but load failed - return route as result
          result = routeData
          error = `Route created but load creation failed: ${loadError.message}`
          break
        }

        // Create delivery points if they exist
        if (routeLoadData.delivery_points && routeLoadData.delivery_points.length > 0 && loadData?.id) {
          const { createLoadDeliveryPoint } = await import("./load-delivery-points")
          
          for (const point of routeLoadData.delivery_points) {
            await createLoadDeliveryPoint(loadData.id, {
              delivery_number: point.delivery_number,
              location_name: point.location_name || "",
              location_id: point.location_id,
              address: point.address || "",
              city: point.city,
              state: point.state,
              zip: point.zip,
              phone: point.phone,
              contact_name: point.contact_name,
              contact_phone: point.contact_phone,
              scheduled_delivery_date: point.scheduled_delivery_date,
              scheduled_delivery_time: point.scheduled_delivery_time,
              time_window_start: point.time_window_start,
              time_window_end: point.time_window_end,
              weight_kg: point.weight_kg,
              weight_lbs: point.weight_lbs,
              pieces: point.pieces || 0,
              pallets: point.pallets || 0,
              boxes: point.boxes || 0,
              carts: point.carts || 0,
              priority: point.priority,
              delivery_instructions: point.delivery_instructions,
              notes: point.notes,
            })
          }
        }

        // Return the load as the primary result (since it's usually what users care about)
        result = loadData
        error = null
        break
      }

      case "route": {
        const routeData = extractedData as ExtractedRouteData
        const { data, error: routeError } = await supabase
          .from("routes")
          .insert({
            company_id: userData.company_id,
            name: routeData.name || `Route-${Date.now()}`,
            origin: routeData.origin || "",
            destination: routeData.destination || "",
            distance: routeData.distance,
            estimated_time: routeData.estimated_time,
            priority: routeData.priority || "normal",
            status: routeData.status || "pending",
            depot_name: routeData.depot_name,
            depot_address: routeData.depot_address,
            route_start_time: routeData.route_start_time,
            route_complete_time: routeData.route_complete_time,
            pre_route_time_minutes: routeData.pre_route_time_minutes,
            post_route_time_minutes: routeData.post_route_time_minutes,
          })
          .select()
          .single()
        
        if (routeError) {
          result = null
          error = routeError.message
          break
        }

        result = data

        // Create route stops if they exist
        if (routeData.stops && routeData.stops.length > 0 && data?.id) {
          const { createRouteStop } = await import("./route-stops")
          
          for (const stop of routeData.stops) {
            await createRouteStop(data.id, {
              stop_number: stop.stop_number,
              location_name: stop.location_name || "",
              location_id: stop.location_id,
              address: stop.address || "",
              city: stop.city,
              state: stop.state,
              zip: stop.zip,
              phone: stop.phone,
              contact_name: stop.contact_name,
              contact_phone: stop.contact_phone,
              arrive_time: stop.arrive_time,
              depart_time: stop.depart_time,
              service_time_minutes: stop.service_time_minutes,
              travel_time_minutes: stop.travel_time_minutes,
              time_window_1_open: stop.time_window_1_open,
              time_window_1_close: stop.time_window_1_close,
              time_window_2_open: stop.time_window_2_open,
              time_window_2_close: stop.time_window_2_close,
              carts: stop.carts || 0,
              boxes: stop.boxes || 0,
              pallets: stop.pallets || 0,
              orders: stop.orders || 0,
              priority: stop.priority,
              stop_type: stop.stop_type || "delivery",
              special_instructions: stop.special_instructions,
              notes: stop.notes,
            })
          }
        }

        error = null
        break
      }

      case "maintenance": {
        const maintData = extractedData as ExtractedMaintenanceData
        // If truck_number is provided, find the truck_id
        let truckId = maintData.truck_id
        if (maintData.truck_number && !truckId) {
          const { data: truckData } = await supabase
            .from("trucks")
            .select("id")
            .eq("truck_number", maintData.truck_number)
            .eq("company_id", userData.company_id)
            .single()
          truckId = truckData?.id
        }

        if (!truckId) {
          return { error: "Truck ID or truck number is required for maintenance records", data: null }
        }

        const { data, error: maintError } = await supabase
          .from("maintenance")
          .insert({
            company_id: userData.company_id,
            truck_id: truckId,
            service_type: maintData.service_type || "",
            scheduled_date: maintData.scheduled_date || new Date().toISOString().split("T")[0],
            estimated_cost: maintData.estimated_cost,
            vendor: maintData.vendor,
            notes: maintData.notes,
            status: "scheduled",
          })
          .select()
          .single()
        result = data
        error = maintError?.message || null
        break
      }

      case "invoice": {
        const invoiceData = extractedData as ExtractedInvoiceData
        const { data, error: invoiceError } = await supabase
          .from("invoices")
          .insert({
            company_id: userData.company_id,
            invoice_number: invoiceData.invoice_number || `INV-${Date.now()}`,
            customer_name: invoiceData.customer_name || "",
            amount: invoiceData.amount || 0,
            issue_date: invoiceData.issue_date || new Date().toISOString().split("T")[0],
            due_date: invoiceData.due_date,
            status: invoiceData.status || "pending",
          })
          .select()
          .single()
        result = data
        error = invoiceError?.message || null
        break
      }

      case "expense": {
        const expenseData = extractedData as ExtractedExpenseData
        const { data, error: expenseError } = await supabase
          .from("expenses")
          .insert({
            company_id: userData.company_id,
            category: expenseData.category || "other",
            description: expenseData.description || "",
            amount: expenseData.amount || 0,
            date: expenseData.date || new Date().toISOString().split("T")[0],
            vendor: expenseData.vendor,
          })
          .select()
          .single()
        result = data
        error = expenseError?.message || null
        break
      }

      default:
        return { error: `Unknown data type: ${(extractedData as any).type}`, data: null }
    }

    if (error) {
      return { error, data: null }
    }

    // Revalidate relevant paths
    revalidatePath("/dashboard/drivers")
    revalidatePath("/dashboard/trucks")
    revalidatePath("/dashboard/loads")
    revalidatePath("/dashboard/routes")
    revalidatePath("/dashboard/maintenance")
    revalidatePath("/dashboard/invoices")
    revalidatePath("/dashboard/expenses")

    return {
      data: {
        id: result.id,
        type: extractedData.type
      },
      error: null
    }
  } catch (error: any) {
    return {
      error: error?.message || "An unexpected error occurred",
      data: null
    }
  }
}
