"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { sendNotification } from "./notifications"

export async function getRoutes() {
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

  const { data: routes, error } = await supabase
    .from("routes")
    .select("*")
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: routes, error: null }
}

export async function getRoute(id: string) {
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

  const { data: route, error } = await supabase
    .from("routes")
    .select("*")
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: route, error: null }
}

export async function createRoute(formData: {
  name: string
  origin: string
  destination: string
  distance?: string
  estimated_time?: string
  priority?: string
  driver_id?: string
  truck_id?: string
  status?: string
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
    .from("routes")
    .insert({
      company_id: userData.company_id,
      ...formData,
      priority: formData.priority || "normal",
      status: formData.status || "pending",
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/routes")
  return { data, error: null }
}

export async function updateRoute(
  id: string,
  formData: {
    name?: string
    origin?: string
    destination?: string
    distance?: string
    estimated_time?: string
    priority?: string
    driver_id?: string
    truck_id?: string
    status?: string
    estimated_arrival?: string | null
    waypoints?: any
    [key: string]: any
  }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("routes")
    .update({
      name: formData.name,
      origin: formData.origin,
      destination: formData.destination,
      distance: formData.distance,
      estimated_time: formData.estimated_time,
      priority: formData.priority,
      driver_id: formData.driver_id || null,
      truck_id: formData.truck_id || null,
      status: formData.status,
      estimated_arrival: formData.estimated_arrival || null,
      waypoints: formData.waypoints || null,
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  // Send notifications to company users if route was updated
  if (data) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: userData } = await supabase
        .from("users")
        .select("company_id")
        .eq("id", user.id)
        .single()

      if (userData?.company_id) {
        // Get all users in the company
        const { data: companyUsers } = await supabase
          .from("users")
          .select("id")
          .eq("company_id", userData.company_id)

        // Send notifications to all users who want route updates
        if (companyUsers) {
          for (const companyUser of companyUsers) {
            await sendNotification(companyUser.id, "route_update", {
              routeName: data.name,
              status: data.status,
              origin: data.origin,
              destination: data.destination,
            })
          }
        }
      }
    }
  }

  revalidatePath("/dashboard/routes")
  revalidatePath(`/dashboard/routes/${id}`)

  return { data, error: null }
}

export async function deleteRoute(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from("routes").delete().eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/routes")
  return { error: null }
}

