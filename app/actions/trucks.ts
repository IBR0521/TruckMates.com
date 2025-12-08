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

  const { data, error } = await supabase
    .from("trucks")
    .insert({
      company_id: userData.company_id,
      truck_number: formData.truck_number,
      make: formData.make,
      model: formData.model,
      year: formData.year,
      vin: formData.vin,
      license_plate: formData.license_plate,
      status: formData.status || "available",
      current_driver_id: formData.current_driver_id || null,
      current_location: formData.current_location || null,
      fuel_level: formData.fuel_level || null,
      mileage: formData.mileage || null,
    })
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
    [key: string]: any
  }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("trucks")
    .update({
      truck_number: formData.truck_number,
      make: formData.make,
      model: formData.model,
      year: formData.year,
      vin: formData.vin,
      license_plate: formData.license_plate,
      status: formData.status,
      current_driver_id: formData.current_driver_id || null,
      current_location: formData.current_location || null,
      fuel_level: formData.fuel_level || null,
      mileage: formData.mileage || null,
    })
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

