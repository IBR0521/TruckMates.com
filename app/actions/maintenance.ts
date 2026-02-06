"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getMaintenance() {
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

  const { data: maintenance, error } = await supabase
    .from("maintenance")
    .select("*")
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: maintenance, error: null }
}

export async function createMaintenance(formData: {
  truck_id: string
  service_type: string
  scheduled_date: string
  current_mileage?: number
  priority?: string
  estimated_cost?: number
  notes?: string
  vendor_id?: string
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

  // Validate required fields
  if (!formData.truck_id || !formData.service_type || !formData.scheduled_date) {
    return { error: "Truck, service type, and scheduled date are required", data: null }
  }

  const { data, error } = await supabase
    .from("maintenance")
    .insert({
      company_id: userData.company_id,
      truck_id: formData.truck_id,
      service_type: formData.service_type,
      scheduled_date: formData.scheduled_date,
      current_mileage: formData.current_mileage ? Number(formData.current_mileage) : null,
      priority: formData.priority || "normal",
      estimated_cost: formData.estimated_cost ? Number(formData.estimated_cost) : null,
      notes: formData.notes || null,
      vendor_id: formData.vendor_id || null,
      status: "scheduled",
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/maintenance")
  
  // Trigger webhook
  try {
    const { triggerWebhook } = await import("./webhooks")
    await triggerWebhook(userData.company_id, "maintenance.scheduled", {
      maintenance_id: data.id,
      truck_id: formData.truck_id,
      service_type: formData.service_type,
      scheduled_date: formData.scheduled_date,
    })
  } catch (error) {
    console.warn("[createMaintenance] Webhook trigger failed:", error)
  }
  
  return { data, error: null }
}

export async function getMaintenanceById(id: string) {
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

  const { data: maintenance, error } = await supabase
    .from("maintenance")
    .select(`
      *,
      truck:truck_id (
        id,
        truck_number,
        make,
        model,
        year,
        current_mileage
      )
    `)
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: maintenance, error: null }
}

export async function updateMaintenanceStatus(
  id: string,
  status: string,
  actualCost?: number,
  completedDate?: string
) {
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

  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === "completed") {
    updateData.completed_date = completedDate || new Date().toISOString().split("T")[0]
    if (actualCost !== undefined) {
      updateData.actual_cost = actualCost
    }
  }

  const { data, error } = await supabase
    .from("maintenance")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/maintenance")
  revalidatePath(`/dashboard/maintenance/${id}`)

  return { data, error: null }
}

export async function deleteMaintenance(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from("maintenance").delete().eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/maintenance")
  return { error: null }
}

