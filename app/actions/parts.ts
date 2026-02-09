"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedUserCompany } from "@/lib/query-optimizer"

// Get all parts for company
export async function getParts(filters?: {
  category?: string
  low_stock?: boolean
  search?: string
}) {
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

  let query = supabase
    .from("parts")
    .select("*")
    .eq("company_id", result.company_id)
    .order("name", { ascending: true })

  if (filters?.category) {
    query = query.eq("category", filters.category)
  }

  if (filters?.low_stock) {
    query = query.lte("quantity", supabase.raw("min_quantity"))
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,part_number.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }

  const { data, error } = await query

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

// Get single part
export async function getPart(id: string) {
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

  const { data, error } = await supabase
    .from("parts")
    .select("*")
    .eq("id", id)
    .eq("company_id", result.company_id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

// Create part
export async function createPart(formData: {
  part_number: string
  name: string
  description?: string
  category?: string
  manufacturer?: string
  cost?: number
  quantity?: number
  min_quantity?: number
  location?: string
  supplier?: string
  supplier_part_number?: string
  notes?: string
}) {
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

  // Validate required fields
  if (!formData.part_number || !formData.name) {
    return { error: "Part number and name are required", data: null }
  }

  // Check for duplicate part number
  const { data: existing } = await supabase
    .from("parts")
    .select("id")
    .eq("company_id", result.company_id)
    .eq("part_number", formData.part_number)
    .single()

  if (existing) {
    return { error: "Part number already exists", data: null }
  }

  const { data, error } = await supabase
    .from("parts")
    .insert({
      company_id: result.company_id,
      part_number: formData.part_number,
      name: formData.name,
      description: formData.description || null,
      category: formData.category || "other",
      manufacturer: formData.manufacturer || null,
      cost: formData.cost || 0,
      quantity: formData.quantity || 0,
      min_quantity: formData.min_quantity || 0,
      location: formData.location || null,
      supplier: formData.supplier || null,
      supplier_part_number: formData.supplier_part_number || null,
      notes: formData.notes || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/maintenance/parts")
  return { data, error: null }
}

// Update part
export async function updatePart(
  id: string,
  formData: {
    part_number?: string
    name?: string
    description?: string
    category?: string
    manufacturer?: string
    cost?: number
    quantity?: number
    min_quantity?: number
    location?: string
    supplier?: string
    supplier_part_number?: string
    notes?: string
  }
) {
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

  // Check if part exists and belongs to company
  const { data: existing } = await supabase
    .from("parts")
    .select("id")
    .eq("id", id)
    .eq("company_id", result.company_id)
    .single()

  if (!existing) {
    return { error: "Part not found", data: null }
  }

  // Check for duplicate part number if changing
  if (formData.part_number && formData.part_number !== existing.part_number) {
    const { data: duplicate } = await supabase
      .from("parts")
      .select("id")
      .eq("company_id", result.company_id)
      .eq("part_number", formData.part_number)
      .neq("id", id)
      .single()

    if (duplicate) {
      return { error: "Part number already exists", data: null }
    }
  }

  const updateData: any = {
    updated_at: new Date().toISOString(),
  }

  if (formData.part_number !== undefined) updateData.part_number = formData.part_number
  if (formData.name !== undefined) updateData.name = formData.name
  if (formData.description !== undefined) updateData.description = formData.description
  if (formData.category !== undefined) updateData.category = formData.category
  if (formData.manufacturer !== undefined) updateData.manufacturer = formData.manufacturer
  if (formData.cost !== undefined) updateData.cost = formData.cost
  if (formData.quantity !== undefined) updateData.quantity = formData.quantity
  if (formData.min_quantity !== undefined) updateData.min_quantity = formData.min_quantity
  if (formData.location !== undefined) updateData.location = formData.location
  if (formData.supplier !== undefined) updateData.supplier = formData.supplier
  if (formData.supplier_part_number !== undefined) updateData.supplier_part_number = formData.supplier_part_number
  if (formData.notes !== undefined) updateData.notes = formData.notes

  const { data, error } = await supabase
    .from("parts")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", result.company_id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/maintenance/parts")
  return { data, error: null }
}

// Delete part
export async function deletePart(id: string) {
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

  const { error } = await supabase
    .from("parts")
    .delete()
    .eq("id", id)
    .eq("company_id", result.company_id)

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/maintenance/parts")
  return { data: { success: true }, error: null }
}

// Record part usage (link to maintenance)
export async function recordPartUsage(formData: {
  part_id: string
  maintenance_id?: string
  quantity_used: number
  date?: string
  notes?: string
}) {
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

  // Get part to verify it exists and get current quantity
  const { data: part } = await supabase
    .from("parts")
    .select("quantity")
    .eq("id", formData.part_id)
    .eq("company_id", result.company_id)
    .single()

  if (!part) {
    return { error: "Part not found", data: null }
  }

  // Check if enough quantity available
  if (part.quantity < formData.quantity_used) {
    return { error: "Insufficient quantity available", data: null }
  }

  // Create usage record
  const { data: usage, error: usageError } = await supabase
    .from("part_usage")
    .insert({
      company_id: result.company_id,
      part_id: formData.part_id,
      maintenance_id: formData.maintenance_id || null,
      quantity_used: formData.quantity_used,
      date: formData.date || new Date().toISOString().split("T")[0],
      notes: formData.notes || null,
    })
    .select()
    .single()

  if (usageError) {
    return { error: usageError.message, data: null }
  }

  // Update part quantity
  const { error: updateError } = await supabase
    .from("parts")
    .update({
      quantity: part.quantity - formData.quantity_used,
      updated_at: new Date().toISOString(),
    })
    .eq("id", formData.part_id)

  if (updateError) {
    return { error: updateError.message, data: null }
  }

  revalidatePath("/dashboard/maintenance/parts")
  return { data: usage, error: null }
}

// Create part order (reorder)
export async function createPartOrder(formData: {
  part_id: string
  quantity: number
  order_date?: string
  expected_date?: string
  supplier?: string
  supplier_order_number?: string
  cost_per_unit?: number
  notes?: string
}) {
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

  // Get part to get supplier info
  const { data: part } = await supabase
    .from("parts")
    .select("supplier")
    .eq("id", formData.part_id)
    .eq("company_id", result.company_id)
    .single()

  if (!part) {
    return { error: "Part not found", data: null }
  }

  const totalCost = (formData.cost_per_unit || 0) * formData.quantity

  const { data, error } = await supabase
    .from("part_orders")
    .insert({
      company_id: result.company_id,
      part_id: formData.part_id,
      quantity: formData.quantity,
      order_date: formData.order_date || new Date().toISOString().split("T")[0],
      expected_date: formData.expected_date || null,
      status: "pending",
      supplier: formData.supplier || part.supplier || null,
      supplier_order_number: formData.supplier_order_number || null,
      cost_per_unit: formData.cost_per_unit || null,
      total_cost: totalCost,
      notes: formData.notes || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/maintenance/parts")
  return { data, error: null }
}

// Update part order status
export async function updatePartOrderStatus(
  id: string,
  status: "pending" | "ordered" | "received" | "cancelled",
  received_date?: string
) {
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

  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === "received" && received_date) {
    updateData.received_date = received_date

    // Update part quantity when order is received
    const { data: order } = await supabase
      .from("part_orders")
      .select("part_id, quantity")
      .eq("id", id)
      .single()

    if (order) {
      const { data: part } = await supabase
        .from("parts")
        .select("quantity")
        .eq("id", order.part_id)
        .single()

      if (part) {
        await supabase
          .from("parts")
          .update({
            quantity: (part.quantity || 0) + order.quantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.part_id)
      }
    }
  }

  const { data, error } = await supabase
    .from("part_orders")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", result.company_id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/maintenance/parts")
  return { data, error: null }
}

// Get parts needing reorder (low stock)
export async function getPartsNeedingReorder() {
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

  const { data, error } = await supabase
    .from("parts")
    .select("*")
    .eq("company_id", result.company_id)
    .lte("quantity", supabase.raw("min_quantity"))
    .order("quantity", { ascending: true })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}





