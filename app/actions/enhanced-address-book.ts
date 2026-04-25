"use server"

/**
 * Enhanced Address Book Actions
 * Features:
 * - PostGIS Geo-Verification & POI Naming
 * - Role-Based Categorization & Custom Fields
 * - Automated Address Capture from Rate Cons (OCR/AI)
 * - Integration with Map & Zones (Geofencing)
 */

import * as Sentry from "@sentry/nextjs"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { geocodeAddress } from "./integrations-google-maps"
import { analyzeDocument } from "./document-analysis"
import { checkCreatePermission, checkEditPermission, checkDeletePermission } from "@/lib/server-permissions"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


export type AddressBookCategory = 
  | "shipper" 
  | "receiver" 
  | "vendor" 
  | "broker" 
  | "driver" 
  | "warehouse" 
  | "repair_shop" 
  | "fuel_station" 
  | "other"

export interface AddressBookEntry {
  id: string
  company_id: string
  name: string
  company_name?: string
  contact_name?: string
  email?: string
  phone?: string
  fax?: string
  address_line1: string
  address_line2?: string
  city: string
  state: string
  zip_code: string
  country: string
  coordinates?: { lat: number; lng: number } | null
  geocoded_at?: string
  geocoding_status: "pending" | "verified" | "failed" | "manual"
  formatted_address?: string
  place_id?: string
  category: AddressBookCategory
  custom_fields: Record<string, any>
  notes?: string
  is_active: boolean
  is_verified: boolean
  auto_create_geofence: boolean
  geofence_id?: string
  geofence_radius_meters: number
  created_by?: string
  created_at: string
  updated_at: string
  last_used_at?: string
  usage_count: number
}

export interface CreateAddressBookEntryInput {
  name: string
  company_name?: string
  contact_name?: string
  email?: string
  phone?: string
  fax?: string
  address_line1: string
  address_line2?: string
  city: string
  state: string
  zip_code: string
  country?: string
  category: AddressBookCategory
  custom_fields?: Record<string, any>
  notes?: string
  auto_create_geofence?: boolean
  geofence_radius_meters?: number
  auto_geocode?: boolean // Auto-geocode on creation
}

/**
 * Create a new address book entry with optional geocoding
 */
export async function createAddressBookEntry(
  input: CreateAddressBookEntryInput
): Promise<{ data: AddressBookEntry | null; error: string | null }> {
  // Check permission
  const permission = await checkCreatePermission("address_book")
  if (!permission.allowed) {
    return { data: null, error: permission.error || "You don't have permission to create address book entries" }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  try {
    let coordinates: { lat: number; lng: number } | null = null
    let geocoding_status: "pending" | "verified" | "failed" | "manual" = "pending"
    let formatted_address: string | undefined
    let place_id: string | undefined
    let geocoded_at: string | undefined

    // Auto-geocode if requested
    if (input.auto_geocode !== false) {
      // Validate required fields before geocoding
      if (!input.address_line1 || !input.city || !input.state) {
        // Don't fail creation, just mark as pending for manual geocoding
        geocoding_status = "pending"
      } else {
        const addressParts = [
          input.address_line1,
          input.address_line2,
          input.city,
          input.state,
          input.zip_code,
        ].filter(Boolean)

        const fullAddress = addressParts.join(", ")

        // Only geocode if address is complete enough
        if (fullAddress.trim().length >= 10) {
          const geocodeResult = await geocodeAddress(fullAddress)
          
          if (geocodeResult.data) {
            // LOW FIX: Validate coordinate bounds before storing
            const lat = geocodeResult.data.lat
            const lng = geocodeResult.data.lng
            
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
              geocoding_status = "failed"
              Sentry.captureMessage(
                `[Address Book] Invalid coordinates from geocoding: lat=${lat} lng=${lng}`,
                "error",
              )
            } else {
              coordinates = { lat, lng }
              geocoding_status = "verified"
              formatted_address = geocodeResult.data.formatted_address
              place_id = geocodeResult.data.place_id
              geocoded_at = new Date().toISOString()
            }
          } else {
            geocoding_status = "failed"
            Sentry.captureMessage(
              `[Address Book] Auto-geocoding failed: ${geocodeResult.error}`,
              "error",
            )
          }
        } else {
          // Address too short, mark as pending
          geocoding_status = "pending"
        }
      }
    }

    // Build coordinates string for PostGIS
    const coordinatesString = coordinates
      ? `POINT(${coordinates.lng} ${coordinates.lat})`
      : null

    // Insert address book entry
    const { data, error } = await supabase
      .from("address_book")
      .insert({
        company_id: ctx.companyId,
        name: input.name,
        company_name: input.company_name,
        contact_name: input.contact_name,
        email: input.email,
        phone: input.phone,
        fax: input.fax,
        address_line1: input.address_line1,
        address_line2: input.address_line2,
        city: input.city,
        state: input.state,
        zip_code: input.zip_code,
        country: input.country || "USA",
        coordinates: coordinatesString,
        geocoding_status,
        formatted_address,
        place_id,
        geocoded_at,
        category: input.category,
        custom_fields: input.custom_fields || {},
        notes: input.notes,
        auto_create_geofence: input.auto_create_geofence || false,
        geofence_radius_meters: input.geofence_radius_meters || 500,
        created_by: ctx.userId ?? undefined,
      })
      .select(`
        id,
        company_id,
        name,
        company_name,
        contact_name,
        email,
        phone,
        fax,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        country,
        coordinates,
        geocoded_at,
        geocoding_status,
        formatted_address,
        place_id,
        category,
        custom_fields,
        notes,
        is_active,
        is_verified,
        auto_create_geofence,
        geofence_id,
        geofence_radius_meters,
        created_by,
        created_at,
        updated_at,
        last_used_at,
        usage_count
      `)
      .single()

    if (error) {
      return { data: null, error: safeDbError(error) }
    }

    // Convert PostGIS geography to lat/lng for response
    let entryCoordinates: { lat: number; lng: number } | null = null
    if (data.coordinates) {
      const { data: coordData } = await supabase.rpc("get_point_coordinates", {
        point: data.coordinates,
      })
      if (coordData) {
        entryCoordinates = { lat: coordData.lat, lng: coordData.lng }
      }
    }

    return {
      data: {
        ...data,
        coordinates: entryCoordinates,
      } as AddressBookEntry,
      error: null,
    }
  } catch (error: unknown) {
    return { data: null, error: errorMessage(error, "Failed to create address book entry") }
  }
}

/**
 * Get all address book entries with filters
 */
export async function getAddressBookEntries(filters?: {
  search?: string
  category?: AddressBookCategory | "all"
  is_active?: boolean
  geocoding_status?: "pending" | "verified" | "failed" | "manual"
  limit?: number
  offset?: number
}): Promise<{ data: AddressBookEntry[]; error: string | null }> {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: [], error: ctx.error || "Not authenticated" }
  }

  try {
    // SECURITY FIX: Use explicit column selection instead of select("*")
    // CRITICAL FIX: Supabase doesn't support PostGIS functions (ST_X, ST_Y) directly in SELECT
    // Select all columns and extract coordinates via RPC function
    let query = supabase
      .from("address_book")
      .select(`
        id,
        company_id,
        name,
        company_name,
        contact_name,
        email,
        phone,
        fax,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        country,
        coordinates,
        geocoded_at,
        geocoding_status,
        formatted_address,
        place_id,
        category,
        custom_fields,
        notes,
        is_active,
        is_verified,
        auto_create_geofence,
        geofence_id,
        geofence_radius_meters,
        created_by,
        created_at,
        updated_at,
        last_used_at,
        usage_count
      `)
      .eq("company_id", ctx.companyId)

    if (filters?.category && filters.category !== "all") {
      query = query.eq("category", filters.category)
    }

    if (filters?.is_active !== undefined) {
      query = query.eq("is_active", filters.is_active)
    }

    if (filters?.geocoding_status) {
      query = query.eq("geocoding_status", filters.geocoding_status)
    }

    if (filters?.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%,address_line1.ilike.%${filters.search}%,city.ilike.%${filters.search}%,state.ilike.%${filters.search}%`
      )
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
    }

    query = query.order("name", { ascending: true })

    const { data, error } = await query

    if (error) {
      return { data: [], error: safeDbError(error) }
    }

    // OPTIMIZED: Batch extract coordinates for all entries in a single RPC call
    // This eliminates N+1 queries - processes all points at once
    const entriesWithCoordinates = (data || []).filter((entry: any) => entry.coordinates)
    const coordinatesArray = entriesWithCoordinates.map((entry: any) => entry.coordinates)
    
    let coordinatesMap: Map<number, { lat: number; lng: number }> = new Map()
    
    if (coordinatesArray.length > 0) {
      // Single batch RPC call for all coordinates
      const { data: batchCoords, error: coordError } = await supabase.rpc("get_batch_point_coordinates", {
        p_points: coordinatesArray,
      })
      
      if (!coordError && batchCoords) {
        // Map coordinates by index
        batchCoords.forEach((coord: any) => {
          coordinatesMap.set(coord.point_index, { lat: Number(coord.lat), lng: Number(coord.lng) })
        })
      }
    }
    
    // Merge coordinates back into entries
    let coordIndex = 0
    const entries: AddressBookEntry[] = (data || []).map((entry: any) => {
      let coordinates: { lat: number; lng: number } | null = null
      if (entry.coordinates) {
        const coords = coordinatesMap.get(coordIndex)
        if (coords) {
          coordinates = coords
        }
        coordIndex++
      }
      
      return {
        ...entry,
        coordinates,
      } as AddressBookEntry
    })

    return { data: entries, error: null }
  } catch (error: unknown) {
    return { data: [], error: errorMessage(error, "Failed to fetch address book entries") }
  }
}

/**
 * Find nearby address book entries using PostGIS
 */
export async function findNearbyAddresses(
  latitude: number,
  longitude: number,
  options?: {
    radius_km?: number
    category?: AddressBookCategory
    limit?: number
  }
): Promise<{
  data: Array<AddressBookEntry & { distance_km: number }> | null
  error: string | null
}> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  try {
    // OPTIMIZED: Use the new RPC function that returns coordinates directly
    // This eliminates all coordinate extraction queries - single database call
    const { data, error } = await supabase.rpc("find_nearby_addresses_with_coords", {
      p_company_id: ctx.companyId,
      p_latitude: latitude,
      p_longitude: longitude,
      p_radius_km: options?.radius_km || 10.0,
      p_category: options?.category || null,
      p_limit: options?.limit || 10,
    })

    if (error) {
      return { data: null, error: safeDbError(error) }
    }

    // Coordinates are already extracted in the RPC function - no additional queries needed
    const entries = (data || []).map((entry: any) => ({
      ...entry,
      coordinates: entry.lat && entry.lng ? { lat: Number(entry.lat), lng: Number(entry.lng) } : null,
    }))

    return { data: entries, error: null }
  } catch (error: unknown) {
    return { data: null, error: errorMessage(error, "Failed to find nearby addresses") }
  }
}

/**
 * Geocode an existing address book entry
 */
export async function geocodeAddressBookEntry(
  entryId: string
): Promise<{ data: AddressBookEntry | null; error: string | null }> {
  // Check permission
  const permission = await checkEditPermission("address_book")
  if (!permission.allowed) {
    return { data: null, error: permission.error || "You don't have permission to geocode address book entries" }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  try {
    // SECURITY FIX: Use explicit column selection instead of select("*")
    // Get entry
    const { data: entry, error: fetchError } = await supabase
      .from("address_book")
      .select(`
        id,
        company_id,
        name,
        company_name,
        contact_name,
        email,
        phone,
        fax,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        country,
        coordinates,
        geocoded_at,
        geocoding_status,
        formatted_address,
        place_id,
        category,
        custom_fields,
        notes,
        is_active,
        is_verified,
        auto_create_geofence,
        geofence_id,
        geofence_radius_meters,
        created_by,
        created_at,
        updated_at,
        last_used_at,
        usage_count
      `)
      .eq("id", entryId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (fetchError || !entry) {
      return { data: null, error: "Address book entry not found" }
    }

    // Geocode address - build full address string
    const addressParts = [
      entry.address_line1,
      entry.address_line2,
      entry.city,
      entry.state,
      entry.zip_code,
    ].filter(Boolean)

    // Validate that we have minimum required fields
    if (!entry.address_line1 || !entry.city || !entry.state) {
      await supabase
        .from("address_book")
        .update({ geocoding_status: "failed" })
        .eq("id", entryId)
        .eq("company_id", ctx.companyId)

      return { 
        data: null, 
        error: "Address is incomplete. Please provide at least: Street Address, City, and State." 
      }
    }

    const fullAddress = addressParts.join(", ")

    // Additional validation - address should be meaningful
    if (fullAddress.trim().length < 10) {
      await supabase
        .from("address_book")
        .update({ geocoding_status: "failed" })
        .eq("id", entryId)
        .eq("company_id", ctx.companyId)

      return { 
        data: null, 
        error: "Address is too short. Please provide a complete address with street, city, state, and zip code." 
      }
    }

    const geocodeResult = await geocodeAddress(fullAddress)

    if (!geocodeResult.data) {
      // Update status to failed
      await supabase
        .from("address_book")
        .update({ geocoding_status: "failed" })
        .eq("id", entryId)
        .eq("company_id", ctx.companyId)

      return { data: null, error: geocodeResult.error || "Failed to geocode address" }
    }

    // LOW FIX: Validate coordinate bounds before storing
    const lat = geocodeResult.data.lat
    const lng = geocodeResult.data.lng
    
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      await supabase
        .from("address_book")
        .update({ geocoding_status: "failed" })
        .eq("id", entryId)
        .eq("company_id", ctx.companyId)
      
      return { 
        data: null, 
        error: "Invalid coordinates returned from geocoding service. Please try again or enter coordinates manually." 
      }
    }

    // Update entry with geocoded coordinates
    const coordinatesString = `POINT(${lng} ${lat})`

    // SECURITY FIX: Use explicit column selection instead of select()
    const { data: updatedEntry, error: updateError } = await supabase
      .from("address_book")
      .update({
        coordinates: coordinatesString,
        geocoding_status: "verified",
        formatted_address: geocodeResult.data.formatted_address,
        place_id: geocodeResult.data.place_id,
        geocoded_at: new Date().toISOString(),
      })
      .eq("id", entryId)
      .eq("company_id", ctx.companyId)
      .select(`
        id,
        company_id,
        name,
        company_name,
        contact_name,
        email,
        phone,
        fax,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        country,
        coordinates,
        geocoded_at,
        geocoding_status,
        formatted_address,
        place_id,
        category,
        custom_fields,
        notes,
        is_active,
        is_verified,
        auto_create_geofence,
        geofence_id,
        geofence_radius_meters,
        created_by,
        created_at,
        updated_at,
        last_used_at,
        usage_count
      `)
      .single()

    if (updateError) {
      return { data: null, error: updateError.message }
    }

    // Convert coordinates for response
    let entryCoordinates: { lat: number; lng: number } | null = {
      lat: geocodeResult.data.lat,
      lng: geocodeResult.data.lng,
    }

    return {
      data: {
        ...updatedEntry,
        coordinates: entryCoordinates,
      } as AddressBookEntry,
      error: null,
    }
  } catch (error: unknown) {
    return { data: null, error: errorMessage(error, "Failed to geocode address") }
  }
}

/**
 * Extract addresses from Rate Confirmation PDF using OCR/AI
 */
export async function extractAddressesFromRateCon(
  fileUrl: string,
  fileName: string
): Promise<{
  data: {
    shipper?: CreateAddressBookEntryInput
    receiver?: CreateAddressBookEntryInput
  } | null
  error: string | null
}> {
  try {
    // Use document analysis to extract data
    const analysisResult = await analyzeDocument(fileUrl, fileName)

    if (analysisResult.error || !analysisResult.data) {
      return { data: null, error: analysisResult.error || "Failed to analyze document" }
    }

    const extracted = analysisResult.data

    // Extract shipper and receiver addresses from load/route data
    const shipper: CreateAddressBookEntryInput | undefined = extracted.type === "load" || extracted.type === "route_and_load"
      ? {
          name: (extracted.data as any).shipper_name || "Shipper",
          company_name: (extracted.data as any).shipper_company,
          address_line1: (extracted.data as any).origin_address || (extracted.data as any).origin,
          city: (extracted.data as any).origin_city,
          state: (extracted.data as any).origin_state,
          zip_code: (extracted.data as any).origin_zip,
          category: "shipper",
          custom_fields: {
            pickup_notes: (extracted.data as any).pickup_notes,
            special_instructions: (extracted.data as any).special_instructions,
          },
          auto_geocode: true,
        }
      : undefined

    const receiver: CreateAddressBookEntryInput | undefined = extracted.type === "load" || extracted.type === "route_and_load"
      ? {
          name: (extracted.data as any).receiver_name || "Receiver",
          company_name: (extracted.data as any).receiver_company,
          address_line1: (extracted.data as any).destination_address || (extracted.data as any).destination,
          city: (extracted.data as any).destination_city,
          state: (extracted.data as any).destination_state,
          zip_code: (extracted.data as any).destination_zip,
          category: "receiver",
          custom_fields: {
            delivery_notes: (extracted.data as any).delivery_notes,
            special_instructions: (extracted.data as any).special_instructions,
          },
          auto_geocode: true,
        }
      : undefined

    return {
      data: {
        shipper: shipper && shipper.address_line1 ? shipper : undefined,
        receiver: receiver && receiver.address_line1 ? receiver : undefined,
      },
      error: null,
    }
  } catch (error: unknown) {
    return { data: null, error: errorMessage(error, "Failed to extract addresses from document") }
  }
}

/**
 * Update address book entry
 */
export async function updateAddressBookEntry(
  entryId: string,
  updates: Partial<CreateAddressBookEntryInput & { is_active?: boolean; is_verified?: boolean }>
): Promise<{ data: AddressBookEntry | null; error: string | null }> {
  // Check permission
  const permission = await checkEditPermission("address_book")
  if (!permission.allowed) {
    return { data: null, error: permission.error || "You don't have permission to edit address book entries" }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  try {
    const updateData: any = {}

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.company_name !== undefined) updateData.company_name = updates.company_name
    if (updates.contact_name !== undefined) updateData.contact_name = updates.contact_name
    if (updates.email !== undefined) updateData.email = updates.email
    if (updates.phone !== undefined) updateData.phone = updates.phone
    if (updates.fax !== undefined) updateData.fax = updates.fax
    if (updates.address_line1 !== undefined) updateData.address_line1 = updates.address_line1
    if (updates.address_line2 !== undefined) updateData.address_line2 = updates.address_line2
    if (updates.city !== undefined) updateData.city = updates.city
    if (updates.state !== undefined) updateData.state = updates.state
    if (updates.zip_code !== undefined) updateData.zip_code = updates.zip_code
    if (updates.country !== undefined) updateData.country = updates.country
    if (updates.category !== undefined) updateData.category = updates.category
    if (updates.custom_fields !== undefined) updateData.custom_fields = updates.custom_fields
    if (updates.notes !== undefined) updateData.notes = updates.notes
    if (updates.is_active !== undefined) updateData.is_active = updates.is_active
    if (updates.is_verified !== undefined) updateData.is_verified = updates.is_verified
    if (updates.auto_create_geofence !== undefined) updateData.auto_create_geofence = updates.auto_create_geofence
    if (updates.geofence_radius_meters !== undefined) updateData.geofence_radius_meters = updates.geofence_radius_meters

    // Re-geocode if address actually changed (not just present in updates)
    if (updates.address_line1 !== undefined || updates.city !== undefined || updates.state !== undefined || updates.zip_code !== undefined) {
      // SECURITY FIX: Use explicit column selection - only need address fields for comparison
      const { data: currentEntry, error: currentEntryError } = await supabase
        .from("address_book")
        .select(`
          address_line1,
          address_line2,
          city,
          state,
          zip_code
        `)
        .eq("id", entryId)
        .eq("company_id", ctx.companyId)
        .maybeSingle()

      if (currentEntryError) {
        return { error: currentEntryError.message, data: null }
      }

      if (currentEntry) {
        // Check if any address field actually changed
        const addressChanged = 
          (updates.address_line1 !== undefined && updates.address_line1 !== currentEntry.address_line1) ||
          (updates.city !== undefined && updates.city !== currentEntry.city) ||
          (updates.state !== undefined && updates.state !== currentEntry.state) ||
          (updates.zip_code !== undefined && updates.zip_code !== currentEntry.zip_code)

        if (addressChanged) {
          const fullAddress = [
            updateData.address_line1 || currentEntry.address_line1,
            updateData.address_line2 || currentEntry.address_line2,
            updateData.city || currentEntry.city,
            updateData.state || currentEntry.state,
            updateData.zip_code || currentEntry.zip_code,
          ]
            .filter(Boolean)
            .join(", ")

          const geocodeResult = await geocodeAddress(fullAddress)
          if (geocodeResult.data) {
            updateData.coordinates = `POINT(${geocodeResult.data.lng} ${geocodeResult.data.lat})`
            updateData.geocoding_status = "verified"
            updateData.formatted_address = geocodeResult.data.formatted_address
            updateData.place_id = geocodeResult.data.place_id
            updateData.geocoded_at = new Date().toISOString()
          } else {
            updateData.geocoding_status = "failed"
          }
        }
      }
    }

    // SECURITY FIX: Use explicit column selection instead of select()
    const { data, error } = await supabase
      .from("address_book")
      .update(updateData)
      .eq("id", entryId)
      .eq("company_id", ctx.companyId)
      .select(`
        id,
        company_id,
        name,
        company_name,
        contact_name,
        email,
        phone,
        fax,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        country,
        coordinates,
        geocoded_at,
        geocoding_status,
        formatted_address,
        place_id,
        category,
        custom_fields,
        notes,
        is_active,
        is_verified,
        auto_create_geofence,
        geofence_id,
        geofence_radius_meters,
        created_by,
        created_at,
        updated_at,
        last_used_at,
        usage_count
      `)
      .single()

    if (error) {
      return { data: null, error: safeDbError(error) }
    }

    // Convert coordinates for response
    let entryCoordinates: { lat: number; lng: number } | null = null
    if (data.coordinates) {
      const { data: coordData } = await supabase.rpc("get_point_coordinates", {
        point: data.coordinates,
      })
      if (coordData) {
        entryCoordinates = { lat: coordData.lat, lng: coordData.lng }
      }
    }

    return {
      data: {
        ...data,
        coordinates: entryCoordinates,
      } as AddressBookEntry,
      error: null,
    }
  } catch (error: unknown) {
    return { data: null, error: errorMessage(error, "Failed to update address book entry") }
  }
}

/**
 * Delete address book entry
 */
export async function deleteAddressBookEntry(
  entryId: string
): Promise<{ error: string | null }> {
  // Check permission
  const permission = await checkDeletePermission("address_book")
  if (!permission.allowed) {
    return { error: permission.error || "You don't have permission to delete address book entries" }
  }

  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated" }
  }

  try {
    // LOW FIX: Check if entry is referenced by active loads before deletion
    const { data: referencedLoads } = await supabase
      .from("loads")
      .select("id, shipment_number")
      .eq("company_id", ctx.companyId)
      .or(`shipper_address_book_id.eq.${entryId},consignee_address_book_id.eq.${entryId}`)
      .not("status", "in", '("delivered","cancelled","completed")')
      .limit(1)
    
    if (referencedLoads && referencedLoads.length > 0) {
      return { 
        error: `Cannot delete address book entry: It is referenced by active load(s) (e.g., ${referencedLoads[0].shipment_number || referencedLoads[0].id}). Please complete or cancel the load(s) first.` 
      }
    }
    
    const { error } = await supabase
      .from("address_book")
      .delete()
      .eq("id", entryId)
      .eq("company_id", ctx.companyId)

    if (error) {
      return { error: safeDbError(error) }
    }

    return { error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to delete address book entry") }
  }
}

/**
 * Increment usage count when address is used in a load/route
 */
export async function incrementAddressUsage(entryId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated" }
  }

  try {
    // Verify entry belongs to user's company before incrementing
    const { data: entry, error: entryError } = await supabase
      .from("address_book")
      .select("id")
      .eq("id", entryId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (entryError || !entry) {
      return { error: "Address book entry not found or access denied" }
    }

    const { error } = await supabase.rpc("increment_address_usage", {
      p_address_id: entryId,
      p_company_id: ctx.companyId,
    })

    if (error) {
      return { error: safeDbError(error) }
    }

    return { error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to increment usage") }
  }
}

