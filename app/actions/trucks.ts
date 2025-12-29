"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getTrucks() {
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

  const { data: trucks, error } = await supabase
    .from("trucks")
    .select("*")
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: trucks, error: null }
}

export async function getTruck(id: string) {
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

  const { data: truck, error } = await supabase
    .from("trucks")
    .select("*")
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: truck, error: null }
}

export async function createTruck(formData: {
  truck_number: string
  make?: string
  model?: string
  year?: number
  vin?: string
  license_plate?: string
  status?: string
  current_driver_id?: string | null
  current_location?: string | null
  fuel_level?: number | null
  mileage?: number | null
  // Extended TruckLogics fields
  height?: string
  serial_number?: string
  gross_vehicle_weight?: number
  license_expiry_date?: string
  inspection_date?: string
  insurance_provider?: string
  insurance_policy_number?: string
  insurance_expiry_date?: string
  owner_name?: string
  cost?: number
  color?: string
  documents?: any[]
  [key: string]: any
}) {
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

  // Build insert data, only including fields that have values
  const truckData: any = {
    company_id: userData.company_id,
    truck_number: formData.truck_number,
    status: formData.status || "available",
  }

  // Add optional fields only if they have values
  if (formData.make) truckData.make = formData.make
  if (formData.model) truckData.model = formData.model
  if (formData.year !== undefined && formData.year !== null) truckData.year = formData.year
  if (formData.vin) truckData.vin = formData.vin
  if (formData.license_plate) truckData.license_plate = formData.license_plate
  if (formData.current_driver_id) truckData.current_driver_id = formData.current_driver_id
  if (formData.current_location) truckData.current_location = formData.current_location
  if (formData.fuel_level !== undefined && formData.fuel_level !== null) truckData.fuel_level = formData.fuel_level
  if (formData.mileage !== undefined && formData.mileage !== null) truckData.mileage = formData.mileage
  
  // Extended TruckLogics fields
  if (formData.height) truckData.height = formData.height
  if (formData.serial_number) truckData.serial_number = formData.serial_number
  if (formData.gross_vehicle_weight !== undefined && formData.gross_vehicle_weight !== null) truckData.gross_vehicle_weight = formData.gross_vehicle_weight
  if (formData.license_expiry_date) truckData.license_expiry_date = formData.license_expiry_date
  if (formData.inspection_date) truckData.inspection_date = formData.inspection_date
  if (formData.insurance_provider) truckData.insurance_provider = formData.insurance_provider
  if (formData.insurance_policy_number) truckData.insurance_policy_number = formData.insurance_policy_number
  if (formData.insurance_expiry_date) truckData.insurance_expiry_date = formData.insurance_expiry_date
  if (formData.owner_name) truckData.owner_name = formData.owner_name
  if (formData.cost !== undefined && formData.cost !== null) truckData.cost = formData.cost
  if (formData.color) truckData.color = formData.color
  if (formData.documents && Array.isArray(formData.documents)) truckData.documents = formData.documents

  const { data, error } = await supabase
    .from("trucks")
    .insert(truckData)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/trucks")
  return { data, error: null }
}

export async function updateTruck(
  id: string,
  formData: {
    truck_number?: string
    make?: string
    model?: string
    year?: number
    vin?: string
    license_plate?: string
    status?: string
    current_driver_id?: string | null
    current_location?: string | null
    fuel_level?: number | null
    mileage?: number | null
    // Extended TruckLogics fields
    height?: string
    serial_number?: string
    gross_vehicle_weight?: number
    license_expiry_date?: string
    inspection_date?: string
    insurance_provider?: string
    insurance_policy_number?: string
    insurance_expiry_date?: string
    owner_name?: string
    cost?: number
    color?: string
    documents?: any[]
    [key: string]: any
  }
) {
  const supabase = await createClient()

  // Build update data, only including fields that are provided
  const updateData: any = {}
  
  if (formData.truck_number !== undefined) updateData.truck_number = formData.truck_number
  if (formData.make !== undefined) updateData.make = formData.make
  if (formData.model !== undefined) updateData.model = formData.model
  if (formData.year !== undefined) updateData.year = formData.year || null
  if (formData.vin !== undefined) updateData.vin = formData.vin
  if (formData.license_plate !== undefined) updateData.license_plate = formData.license_plate
  if (formData.status !== undefined) updateData.status = formData.status
  if (formData.current_driver_id !== undefined) updateData.current_driver_id = formData.current_driver_id || null
  if (formData.current_location !== undefined) updateData.current_location = formData.current_location || null
  if (formData.fuel_level !== undefined) updateData.fuel_level = formData.fuel_level || null
  if (formData.mileage !== undefined) updateData.mileage = formData.mileage || null
  
  // Extended TruckLogics fields
  if (formData.height !== undefined) updateData.height = formData.height || null
  if (formData.serial_number !== undefined) updateData.serial_number = formData.serial_number || null
  if (formData.gross_vehicle_weight !== undefined) updateData.gross_vehicle_weight = formData.gross_vehicle_weight || null
  if (formData.license_expiry_date !== undefined) updateData.license_expiry_date = formData.license_expiry_date || null
  if (formData.inspection_date !== undefined) updateData.inspection_date = formData.inspection_date || null
  if (formData.insurance_provider !== undefined) updateData.insurance_provider = formData.insurance_provider || null
  if (formData.insurance_policy_number !== undefined) updateData.insurance_policy_number = formData.insurance_policy_number || null
  if (formData.insurance_expiry_date !== undefined) updateData.insurance_expiry_date = formData.insurance_expiry_date || null
  if (formData.owner_name !== undefined) updateData.owner_name = formData.owner_name || null
  if (formData.cost !== undefined) updateData.cost = formData.cost || null
  if (formData.color !== undefined) updateData.color = formData.color || null
  if (formData.documents !== undefined) updateData.documents = formData.documents || []

  const { data, error } = await supabase
    .from("trucks")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/trucks")
  revalidatePath(`/dashboard/trucks/${id}`)

  return { data, error: null }
}

export async function deleteTruck(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from("trucks").delete().eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/trucks")
  return { error: null }
}

