"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

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

// Analyze document using AI
export async function analyzeDocument(fileUrl: string, fileName: string): Promise<{
  data: ExtractedData | null
  error: string | null
}> {
  try {
    // First, extract text from the document
    // For now, we'll use a placeholder - you'll need to integrate with:
    // - PDF parsing library (pdf-parse, pdfjs-dist)
    // - OCR for images (Tesseract.js, Google Vision API)
    // - Or use a service like AWS Textract, Google Document AI
    
    // For this implementation, we'll use OpenAI to analyze the document
    // You'll need to set OPENAI_API_KEY in your environment variables
    
    if (!process.env.OPENAI_API_KEY) {
      return {
        error: "OpenAI API key not configured. Please set OPENAI_API_KEY in environment variables.",
        data: null
      }
    }

    // Determine if this is an image or PDF
    const isImage = fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i)
    const isPdf = fileName.toLowerCase().match(/\.pdf$/i)

    // Build the OpenAI request
    let messages: any[] = [
      {
        role: "system",
        content: `You are an expert at analyzing business documents for a logistics/fleet management company. 
        Analyze the document and extract structured data. 
        
        CRITICAL: A document can contain MULTIPLE types of data. For example:
        - A route document might also contain load information (quantities, cargo details)
        - A load document might reference route information
        
        If the document contains BOTH route and load information, extract BOTH and set "type" to "route_and_load".
        
        IMPORTANT: If the document contains a ROUTE with MULTIPLE STOPS, extract ALL stops and include them in a "stops" array.
        If the document contains a LOAD with MULTIPLE DELIVERY POINTS, extract ALL delivery points and include them in a "delivery_points" array.
        
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
        - If you see a route with multiple stops (like Stop 1, Stop 2, Stop 3, etc.), extract ALL of them into the "stops" array
        - If you see a load with multiple delivery locations, extract ALL of them into the "delivery_points" array
        - If the document contains BOTH route information AND load/shipment information (like quantities, cargo details, shipment numbers), set type to "route_and_load" and extract BOTH
        - For route_and_load: Extract route details (name, stops, etc.) AND load details (shipment_number, quantities, contents, etc.)
        - Extract ALL available details for each stop/delivery point (address, times, quantities, etc.)
        - Don't skip any stops or delivery points - include every single one you find in the document
        - Extract all available information. If a field is not found, omit it.`
      }
    ]

    // For images, use vision API
    if (isImage) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this document image (filename: ${fileName}). Extract all relevant business information and categorize it.

IMPORTANT: 
- If this is a ROUTE document with multiple stops (Stop 1, Stop 2, Stop 3, etc.), extract ALL stops and include them in the "stops" array. Don't skip any stops - extract every single one you see in the document.
- If this is a LOAD document with multiple delivery points, extract ALL delivery points and include them in the "delivery_points" array.
- If the document contains BOTH route information (stops, route name, times) AND load information (shipment numbers, quantities, cargo), set type to "route_and_load" and extract BOTH types of data.`
          },
          {
            type: "image_url",
            image_url: {
              url: fileUrl
            }
          }
        ]
      })
    } else {
      // For PDFs and other documents, we'll need to extract text first
      // For now, we'll try to fetch and convert to base64 or use a text extraction service
      // In production, you should use pdf-parse or similar library
      
      // Try to fetch the document
      const response = await fetch(fileUrl)
      if (!response.ok) {
        return {
          error: "Failed to fetch document",
          data: null
        }
      }

      // For PDFs, we'll need text extraction
      // This is a simplified approach - in production, use pdf-parse
      if (isPdf) {
        // Note: This requires a PDF parsing library
        // For now, we'll return an error suggesting manual entry
        // You can integrate pdf-parse or use OpenAI's file API
        return {
          error: "PDF text extraction not yet implemented. Please use images or Word documents, or manually enter the data.",
          data: null
        }
      }

      // For other document types (Word, etc.), try to get text
      messages.push({
        role: "user",
        content: `Analyze this document (filename: ${fileName}). Extract all relevant business information and categorize it. 
        Note: If this is a PDF or complex document, the text extraction may be limited. Please extract what you can from the filename and any available metadata.`
      })
    }

    // Call OpenAI to analyze the document
    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: isImage ? "gpt-4o-mini" : "gpt-4o-mini", // Use vision-capable model for images
        messages: messages,
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 4000 // Limit tokens to avoid hitting rate limits
      })
    })

    if (!openAIResponse.ok) {
      let errorMessage = "Unknown error"
      
      // Clone the response so we can read it multiple times if needed
      const responseClone = openAIResponse.clone()
      
      try {
        const errorData = await responseClone.json()
        errorMessage = errorData.error?.message || errorData.error || JSON.stringify(errorData)
      } catch (parseError) {
        // If JSON parsing fails, try to get text from original response
        try {
          const errorText = await openAIResponse.text()
          errorMessage = errorText || `HTTP ${openAIResponse.status}: ${openAIResponse.statusText}`
        } catch (textError) {
          errorMessage = `HTTP ${openAIResponse.status}: ${openAIResponse.statusText}`
        }
      }
      
      // Check if it's a rate limit error
      if (errorMessage.includes("Rate limit") || errorMessage.includes("rate_limit")) {
        return {
          error: `OpenAI rate limit reached. ${errorMessage}. Please try again later or add a payment method to increase your limits at https://platform.openai.com/account/billing`,
          data: null
        }
      }
      
      // Check if it's an authentication error
      if (errorMessage.includes("Invalid API key") || errorMessage.includes("authentication") || openAIResponse.status === 401) {
        return {
          error: `OpenAI API authentication failed. Please check that OPENAI_API_KEY is correctly set in your environment variables.`,
          data: null
        }
      }
      
      return {
        error: `OpenAI API error: ${errorMessage}`,
        data: null
      }
    }

    let openAIData
    try {
      openAIData = await openAIResponse.json()
    } catch (jsonError: any) {
      console.error("[DOCUMENT_ANALYSIS] Failed to parse OpenAI response:", jsonError)
      // Try to get the raw text to see what we received
      try {
        const responseText = await openAIResponse.text()
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
    if (!openAIData.choices || !openAIData.choices[0] || !openAIData.choices[0].message || !openAIData.choices[0].message.content) {
      return {
        error: "OpenAI API returned an unexpected response format. Please try again.",
        data: null
      }
    }

    let analysisResult
    try {
      analysisResult = JSON.parse(openAIData.choices[0].message.content)
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

    // Get signed URL (works for private buckets) - valid for 1 hour
    // Extract file path from URL
    let signedUrl = fileUrl
    
    // Try to extract file path and create signed URL
    const pathMatch = fileUrl.match(/\/storage\/v1\/object\/[^/]+\/([^?]+)/)
    if (pathMatch) {
      const filePath = decodeURIComponent(pathMatch[1])
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("documents")
        .createSignedUrl(filePath, 3600) // 1 hour expiry

      if (!signedUrlError && signedUrlData) {
        signedUrl = signedUrlData.signedUrl
      }
    }

    // Save document record to database
    const { data: documentData, error: docError } = await supabase
      .from("documents")
      .insert({
        company_id: userData.company_id,
        name: metadata?.name || fileName,
        type: metadata?.type || "other",
        file_url: fileUrl,
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
