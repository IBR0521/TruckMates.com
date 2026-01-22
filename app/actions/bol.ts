"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Get all BOLs
export async function getBOLs(filters?: {
  load_id?: string
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

  let query = supabase
    .from("bols")
    .select("*")
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false })

  if (filters?.load_id) {
    query = query.eq("load_id", filters.load_id)
  }

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  const { data, error } = await query

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

// Get single BOL
export async function getBOL(id: string) {
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
    .from("bols")
    .select("*")
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

// Create BOL
export async function createBOL(formData: {
  load_id: string
  template_id?: string
  shipper_name: string
  shipper_address?: string
  shipper_city?: string
  shipper_state?: string
  shipper_zip?: string
  shipper_phone?: string
  shipper_email?: string
  consignee_name: string
  consignee_address?: string
  consignee_city?: string
  consignee_state?: string
  consignee_zip?: string
  consignee_phone?: string
  consignee_email?: string
  carrier_name?: string
  carrier_mc_number?: string
  carrier_dot_number?: string
  pickup_date?: string
  delivery_date?: string
  freight_charges?: number
  payment_terms?: string
  special_instructions?: string
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

  // Generate BOL number
  const bolNumber = `BOL-${Date.now().toString(36).toUpperCase()}`

  const { data, error } = await supabase
    .from("bols")
    .insert({
      company_id: userData.company_id,
      load_id: formData.load_id,
      bol_number: bolNumber,
      template_id: formData.template_id || null,
      shipper_name: formData.shipper_name,
      shipper_address: formData.shipper_address || null,
      shipper_city: formData.shipper_city || null,
      shipper_state: formData.shipper_state || null,
      shipper_zip: formData.shipper_zip || null,
      shipper_phone: formData.shipper_phone || null,
      shipper_email: formData.shipper_email || null,
      consignee_name: formData.consignee_name,
      consignee_address: formData.consignee_address || null,
      consignee_city: formData.consignee_city || null,
      consignee_state: formData.consignee_state || null,
      consignee_zip: formData.consignee_zip || null,
      consignee_phone: formData.consignee_phone || null,
      consignee_email: formData.consignee_email || null,
      carrier_name: formData.carrier_name || null,
      carrier_mc_number: formData.carrier_mc_number || null,
      carrier_dot_number: formData.carrier_dot_number || null,
      pickup_date: formData.pickup_date || null,
      delivery_date: formData.delivery_date || null,
      freight_charges: formData.freight_charges || null,
      payment_terms: formData.payment_terms || null,
      special_instructions: formData.special_instructions || null,
      status: "draft",
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/bols")
  return { data, error: null }
}

// Update BOL signature
export async function updateBOLSignature(
  bolId: string,
  signatureType: "shipper" | "driver" | "consignee",
  signatureData: {
    signature_url: string
    signed_by: string
    signed_at: string
    ip_address?: string
  }
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

  const signatureField = `${signatureType}_signature`

  // Get current BOL to check status and signatures
  const { data: currentBOL } = await supabase
    .from("bols")
    .select(`${signatureField}, status, shipper_signature, driver_signature, consignee_signature`)
    .eq("id", bolId)
    .eq("company_id", userData.company_id)
    .single()

  if (!currentBOL) {
    return { error: "BOL not found", data: null }
  }

  const updateData: any = {
    [signatureField]: signatureData,
  }

  // Check if we should update status to 'signed'
  // At minimum, driver signature should be required
  const hasDriverSignature = signatureType === "driver" || currentBOL.driver_signature

  if (hasDriverSignature && currentBOL.status === "draft") {
    updateData.status = "signed"
  }

  const { data, error } = await supabase
    .from("bols")
    .update(updateData)
    .eq("id", bolId)
    .eq("company_id", userData.company_id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/bols")
  revalidatePath(`/dashboard/bols/${bolId}`)
  return { data, error: null }
}

// Update BOL Proof of Delivery
export async function updateBOLPOD(
  bolId: string,
  podData: {
    pod_photos?: string[]
    pod_notes?: string
    pod_received_by?: string
    pod_received_date?: string
    pod_delivery_condition?: string
  }
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

  const updateData: any = {}
  if (podData.pod_photos !== undefined) updateData.pod_photos = podData.pod_photos
  if (podData.pod_notes !== undefined) updateData.pod_notes = podData.pod_notes
  if (podData.pod_received_by !== undefined) updateData.pod_received_by = podData.pod_received_by
  if (podData.pod_received_date !== undefined) updateData.pod_received_date = podData.pod_received_date
  if (podData.pod_delivery_condition !== undefined) updateData.pod_delivery_condition = podData.pod_delivery_condition

  // Update status to 'delivered' if POD is provided
  if (podData.pod_received_date || podData.pod_received_by) {
    updateData.status = "delivered"
  }

  const { data, error } = await supabase
    .from("bols")
    .update(updateData)
    .eq("id", bolId)
    .eq("company_id", userData.company_id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/bols")
  revalidatePath(`/dashboard/bols/${bolId}`)
  return { data, error: null }
}

// Get BOL templates
export async function getBOLTemplates() {
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
    .from("bol_templates")
    .select("*")
    .eq("company_id", userData.company_id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

// Create BOL template
export async function createBOLTemplate(formData: {
  name: string
  description?: string
  is_default?: boolean
  template_html?: string
  template_fields?: any
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

  // If this is set as default, unset other defaults
  if (formData.is_default) {
    await supabase
      .from("bol_templates")
      .update({ is_default: false })
      .eq("company_id", userData.company_id)
  }

  const { data, error } = await supabase
    .from("bol_templates")
    .insert({
      company_id: userData.company_id,
      name: formData.name,
      description: formData.description || null,
      is_default: formData.is_default || false,
      template_html: formData.template_html || null,
      template_fields: formData.template_fields || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/bols/templates")
  return { data, error: null }
}


