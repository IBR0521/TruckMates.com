"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getDrivers() {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  // Get user's company_id
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (userError || !userData?.company_id) {
    return { error: "No company found", data: null }
  }

  // Get drivers for this company
  const { data: drivers, error } = await supabase
    .from("drivers")
    .select("*")
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: drivers, error: null }
}

export async function getDriver(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: driver, error } = await supabase
    .from("drivers")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: driver, error: null }
}

export async function createDriver(formData: {
  name: string
  email: string
  phone: string
  address?: string
  city?: string
  state?: string
  zip?: string
  license_number: string
  license_state?: string
  license_expiry?: string | null
  date_of_birth?: string | null
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_relationship?: string
  hire_date?: string | null
  pay_rate_type?: string
  pay_rate?: number | null
  status?: string
  truck_id?: string | null
  notes?: string
  [key: string]: any // Allow additional fields
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Check subscription limits
  const { canAddDriver } = await import("./subscription-limits")
  const limitCheck = await canAddDriver()
  if (!limitCheck.allowed) {
    return { error: limitCheck.error || "Driver limit reached", data: null }
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
  const driverData: any = {
    company_id: userData.company_id,
    name: formData.name,
    status: formData.status || "active",
  }

  // Add optional fields only if they have values
  if (formData.email) driverData.email = formData.email
  if (formData.phone) driverData.phone = formData.phone
  if (formData.address) driverData.address = formData.address
  if (formData.city) driverData.city = formData.city
  if (formData.state) driverData.state = formData.state
  if (formData.zip) driverData.zip = formData.zip
  if (formData.license_number) driverData.license_number = formData.license_number
  if (formData.license_state) driverData.license_state = formData.license_state
  if (formData.license_expiry) driverData.license_expiry = formData.license_expiry
  if (formData.date_of_birth) driverData.date_of_birth = formData.date_of_birth
  if (formData.emergency_contact_name) driverData.emergency_contact_name = formData.emergency_contact_name
  if (formData.emergency_contact_phone) driverData.emergency_contact_phone = formData.emergency_contact_phone
  if (formData.emergency_contact_relationship) driverData.emergency_contact_relationship = formData.emergency_contact_relationship
  if (formData.hire_date) driverData.hire_date = formData.hire_date
  if (formData.pay_rate_type) driverData.pay_rate_type = formData.pay_rate_type
  if (formData.pay_rate !== undefined) driverData.pay_rate = formData.pay_rate || null
  if (formData.truck_id) driverData.truck_id = formData.truck_id
  if (formData.notes) driverData.notes = formData.notes

  const { data, error } = await supabase
    .from("drivers")
    .insert(driverData)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/drivers")
  return { data, error: null }
}

export async function updateDriver(
  id: string,
  formData: {
    name?: string
    email?: string
    phone?: string
    license_number?: string
    license_expiry?: string | null
    status?: string
    truck_id?: string | null
    [key: string]: any
  }
) {
  const supabase = await createClient()

  // Build update data, only including fields that are provided
  const updateData: any = {}
  
  if (formData.name !== undefined) updateData.name = formData.name
  if (formData.email !== undefined) updateData.email = formData.email
  if (formData.phone !== undefined) updateData.phone = formData.phone
  if (formData.license_number !== undefined) updateData.license_number = formData.license_number
  if (formData.license_expiry !== undefined) updateData.license_expiry = formData.license_expiry || null
  if (formData.status !== undefined) updateData.status = formData.status
  if (formData.truck_id !== undefined) updateData.truck_id = formData.truck_id || null
  if (formData.pay_rate !== undefined) updateData.pay_rate = formData.pay_rate || null

  const { data, error } = await supabase
    .from("drivers")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/drivers")
  revalidatePath(`/dashboard/drivers/${id}`)

  return { data, error: null }
}

export async function deleteDriver(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from("drivers").delete().eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/drivers")
  return { error: null }
}

