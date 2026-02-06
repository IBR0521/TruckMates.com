"use server"

/**
 * Get comprehensive load details for dispatch board flyout
 * Includes all contextual data needed for dispatcher decision-making
 */

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

export interface LoadDetails {
  id: string
  shipment_number: string
  origin: string
  destination: string
  status: string
  status_color: string
  priority: string
  urgency_score: number
  load_date: string | null
  estimated_delivery: string | null
  weight_kg: number | null
  contents: string | null
  value: number | null
  rate: number | null
  driver: {
    id: string
    name: string
    phone: string | null
    email: string | null
    remaining_drive_hours: number
    remaining_on_duty_hours: number
    current_status: string
  } | null
  truck: {
    id: string
    truck_number: string
    make: string | null
    model: string | null
  } | null
  broker: {
    id: string
    name: string
    phone: string | null
    email: string | null
    w9_url: string | null
    insurance_url: string | null
  } | null
  customer: {
    id: string
    name: string
    phone: string | null
    email: string | null
  } | null
  delivery_points: Array<{
    id: string
    delivery_number: number
    location_name: string
    address: string
    scheduled_delivery_date: string | null
  }>
  notes: Array<{
    id: string
    note: string
    created_at: string
    created_by: string | null
  }>
  special_instructions: string | null
  pickup_notes: string | null
  delivery_notes: string | null
}

export async function getLoadDetails(loadId: string): Promise<{
  data: LoadDetails | null
  error: string | null
}> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    // Get load with all related data
    // Note: broker_id and customer_id may not exist in all schemas, so we'll handle gracefully
    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select(`
        *,
        driver:driver_id (
          id,
          name,
          phone,
          email
        ),
        truck:truck_id (
          id,
          truck_number,
          make,
          model
        ),
        shipper_address_book:shipper_address_book_id (
          id,
          name,
          company_name,
          custom_fields,
          geocoding_status,
          formatted_address
        ),
        consignee_address_book:consignee_address_book_id (
          id,
          name,
          company_name,
          custom_fields,
          geocoding_status,
          formatted_address
        )
      `)
      .eq("id", loadId)
      .eq("company_id", company_id)
      .single()
    
    // Try to get broker and customer separately if columns exist
    let broker = null
    let customer = null
    
    if (load && (load as any).broker_id) {
      try {
        const { data: brokerData } = await supabase
          .from("brokers")
          .select("id, name, phone, email, w9_url, insurance_url")
          .eq("id", (load as any).broker_id)
          .single()
        if (brokerData) broker = brokerData
      } catch (error) {
        // Broker table might not exist, that's okay
      }
    }
    
    if (load && (load as any).customer_id) {
      try {
        const { data: customerData } = await supabase
          .from("customers")
          .select("id, name, phone, email")
          .eq("id", (load as any).customer_id)
          .single()
        if (customerData) customer = customerData
      } catch (error) {
        // Customer might be in different table or not exist
      }
    }

    if (loadError || !load) {
      return { error: loadError?.message || "Load not found", data: null }
    }

    // Get delivery points
    const { data: deliveryPoints } = await supabase
      .from("load_delivery_points")
      .select("id, delivery_number, location_name, address, scheduled_delivery_date")
      .eq("load_id", loadId)
      .order("delivery_number", { ascending: true })

    // Get notes (if notes table exists)
    let notes: any[] = []
    try {
      const { data: notesData } = await supabase
        .from("load_notes")
        .select("id, note, created_at, created_by")
        .eq("load_id", loadId)
        .order("created_at", { ascending: false })
        .limit(10)
      
      if (notesData) {
        notes = notesData
      }
    } catch (error) {
      // Notes table might not exist, that's okay
      console.log("[getLoadDetails] Notes table not found")
    }

    // Get driver HOS if driver is assigned
    let driverHOS = null
    if (load.driver_id) {
      try {
        const { calculateRemainingHOS } = await import("./eld-advanced")
        const hosResult = await calculateRemainingHOS(load.driver_id)
        
        // Get current status
        const { data: latestLog } = await supabase
          .from("eld_logs")
          .select("log_type, end_time")
          .eq("driver_id", load.driver_id)
          .order("start_time", { ascending: false })
          .limit(1)
          .single()

        const currentStatus = latestLog?.end_time === null 
          ? latestLog?.log_type || "off_duty"
          : "off_duty"

        driverHOS = {
          remaining_drive_hours: hosResult.data?.remainingDriving || 0,
          remaining_on_duty_hours: hosResult.data?.remainingOnDuty || 0,
          current_status: currentStatus,
        }
      } catch (error) {
        console.error("[getLoadDetails] Failed to get driver HOS:", error)
      }
    }

    // Build response
    const loadDetails: LoadDetails = {
      id: load.id,
      shipment_number: load.shipment_number,
      origin: load.origin,
      destination: load.destination,
      status: load.status,
      status_color: load.status_color || "#6B7280",
      priority: load.priority || "normal",
      urgency_score: load.urgency_score || 0,
      load_date: load.load_date,
      estimated_delivery: load.estimated_delivery,
      weight_kg: load.weight_kg,
      contents: load.contents,
      value: load.value || load.rate,
      rate: load.rate,
      driver: load.driver_id && load.driver ? {
        id: load.driver.id,
        name: load.driver.name,
        phone: load.driver.phone,
        email: load.driver.email,
        ...(driverHOS || {
          remaining_drive_hours: 0,
          remaining_on_duty_hours: 0,
          current_status: "off_duty",
        }),
      } : null,
      truck: load.truck_id && load.truck ? {
        id: load.truck.id,
        truck_number: load.truck.truck_number,
        make: load.truck.make,
        model: load.truck.model,
      } : null,
      broker: broker ? {
        id: broker.id,
        name: broker.name,
        phone: broker.phone,
        email: broker.email,
        w9_url: broker.w9_url,
        insurance_url: broker.insurance_url,
      } : null,
      customer: customer ? {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
      } : null,
      delivery_points: deliveryPoints || [],
      notes: notes,
      special_instructions: (load as any).special_instructions || (load as any).pickup_instructions || null,
      pickup_notes: (load as any).pickup_notes || (load as any).pickup_instructions || null,
      delivery_notes: (load as any).delivery_notes || (load as any).delivery_instructions || null,
      shipper_address_book: (load as any).shipper_address_book ? {
        id: (load as any).shipper_address_book.id,
        name: (load as any).shipper_address_book.name,
        company_name: (load as any).shipper_address_book.company_name,
        custom_fields: (load as any).shipper_address_book.custom_fields || {},
        geocoding_status: (load as any).shipper_address_book.geocoding_status,
        formatted_address: (load as any).shipper_address_book.formatted_address,
      } : null,
      consignee_address_book: (load as any).consignee_address_book ? {
        id: (load as any).consignee_address_book.id,
        name: (load as any).consignee_address_book.name,
        company_name: (load as any).consignee_address_book.company_name,
        custom_fields: (load as any).consignee_address_book.custom_fields || {},
        geocoding_status: (load as any).consignee_address_book.geocoding_status,
        formatted_address: (load as any).consignee_address_book.formatted_address,
      } : null,
    }

    return { data: loadDetails, error: null }
  } catch (error: any) {
    return { error: error.message || "Failed to get load details", data: null }
  }
}

