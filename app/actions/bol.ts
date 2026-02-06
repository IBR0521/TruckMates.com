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

/**
 * Auto-populate BOL data from Load
 */
export async function getBOLDataFromLoad(loadId: string): Promise<{
  data: {
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
    pickup_date?: string
    delivery_date?: string
    freight_charges?: number
    special_instructions?: string
  } | null
  error: string | null
}> {
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

  try {
    // Get load with address book entries
    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select(`
        *,
        shipper_address_book:shipper_address_book_id (
          id,
          name,
          company_name,
          contact_name,
          email,
          phone,
          address_line1,
          address_line2,
          city,
          state,
          zip_code
        ),
        consignee_address_book:consignee_address_book_id (
          id,
          name,
          company_name,
          contact_name,
          email,
          phone,
          address_line1,
          address_line2,
          city,
          state,
          zip_code
        )
      `)
      .eq("id", loadId)
      .eq("company_id", userData.company_id)
      .single()

    if (loadError || !load) {
      return { error: loadError?.message || "Load not found", data: null }
    }

    // Priority: Address Book > Load fields > Empty
    const shipperAddressBook = (load as any).shipper_address_book
    const consigneeAddressBook = (load as any).consignee_address_book

    // Build shipper data
    const shipperData = {
      shipper_name: shipperAddressBook?.company_name || shipperAddressBook?.name || load.shipper_name || "",
      shipper_address: shipperAddressBook?.address_line1 || load.shipper_address || undefined,
      shipper_city: shipperAddressBook?.city || load.shipper_city || undefined,
      shipper_state: shipperAddressBook?.state || load.shipper_state || undefined,
      shipper_zip: shipperAddressBook?.zip_code || load.shipper_zip || undefined,
      shipper_phone: shipperAddressBook?.phone || load.shipper_contact_phone || undefined,
      shipper_email: shipperAddressBook?.email || load.shipper_contact_email || undefined,
    }

    // Build consignee data
    const consigneeData = {
      consignee_name: consigneeAddressBook?.company_name || consigneeAddressBook?.name || load.consignee_name || "",
      consignee_address: consigneeAddressBook?.address_line1 || load.consignee_address || undefined,
      consignee_city: consigneeAddressBook?.city || load.consignee_city || undefined,
      consignee_state: consigneeAddressBook?.state || load.consignee_state || undefined,
      consignee_zip: consigneeAddressBook?.zip_code || load.consignee_zip || undefined,
      consignee_phone: consigneeAddressBook?.phone || load.consignee_contact_phone || undefined,
      consignee_email: consigneeAddressBook?.email || load.consignee_contact_email || undefined,
    }

    // Get company info for carrier
    const { data: company } = await supabase
      .from("companies")
      .select("name, mc_number, dot_number")
      .eq("id", userData.company_id)
      .single()

    return {
      data: {
        ...shipperData,
        ...consigneeData,
        pickup_date: load.load_date || undefined,
        delivery_date: load.estimated_delivery || undefined,
        freight_charges: load.rate || load.value || load.total_rate || undefined,
        special_instructions: load.special_instructions || load.pickup_instructions || load.delivery_instructions || undefined,
      },
      error: null,
    }
  } catch (error: any) {
    return { error: error.message || "Failed to get BOL data from load", data: null }
  }
}

// Create BOL (enhanced with auto-population)
export async function createBOL(formData: {
  load_id: string
  template_id?: string
  shipper_name?: string
  shipper_address?: string
  shipper_city?: string
  shipper_state?: string
  shipper_zip?: string
  shipper_phone?: string
  shipper_email?: string
  consignee_name?: string
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
  auto_populate?: boolean // If true, auto-populate from load data
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

  // Auto-populate from load if requested or if fields are missing
  let bolData = { ...formData }
  if (formData.auto_populate || !formData.shipper_name || !formData.consignee_name) {
    const loadData = await getBOLDataFromLoad(formData.load_id)
    if (loadData.data) {
      // Merge: formData takes precedence, but fill in missing fields from load
      bolData = {
        ...loadData.data,
        ...formData, // Form data overrides auto-populated data
        load_id: formData.load_id, // Preserve load_id
        template_id: formData.template_id,
        payment_terms: formData.payment_terms,
      }
    }
  }

  // Get company info for carrier if not provided
  if (!bolData.carrier_name || !bolData.carrier_mc_number) {
    const { data: company } = await supabase
      .from("companies")
      .select("name, mc_number, dot_number")
      .eq("id", userData.company_id)
      .single()

    if (company) {
      bolData.carrier_name = bolData.carrier_name || company.name || undefined
      bolData.carrier_mc_number = bolData.carrier_mc_number || company.mc_number || undefined
      bolData.carrier_dot_number = bolData.carrier_dot_number || company.dot_number || undefined
    }
  }

  // Generate BOL number
  const bolNumber = `BOL-${Date.now().toString(36).toUpperCase()}`

  const { data, error } = await supabase
    .from("bols")
    .insert({
      company_id: userData.company_id,
      load_id: bolData.load_id,
      bol_number: bolNumber,
      template_id: bolData.template_id || null,
      shipper_name: bolData.shipper_name || "",
      shipper_address: bolData.shipper_address || null,
      shipper_city: bolData.shipper_city || null,
      shipper_state: bolData.shipper_state || null,
      shipper_zip: bolData.shipper_zip || null,
      shipper_phone: bolData.shipper_phone || null,
      shipper_email: bolData.shipper_email || null,
      consignee_name: bolData.consignee_name || "",
      consignee_address: bolData.consignee_address || null,
      consignee_city: bolData.consignee_city || null,
      consignee_state: bolData.consignee_state || null,
      consignee_zip: bolData.consignee_zip || null,
      consignee_phone: bolData.consignee_phone || null,
      consignee_email: bolData.consignee_email || null,
      carrier_name: bolData.carrier_name || null,
      carrier_mc_number: bolData.carrier_mc_number || null,
      carrier_dot_number: bolData.carrier_dot_number || null,
      pickup_date: bolData.pickup_date || null,
      delivery_date: bolData.delivery_date || null,
      freight_charges: bolData.freight_charges || null,
      payment_terms: bolData.payment_terms || null,
      special_instructions: bolData.special_instructions || null,
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
    .select("status, shipper_signature, driver_signature, consignee_signature")
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
  const hasDriverSignature = signatureType === "driver" || (currentBOL as any).driver_signature

  if (hasDriverSignature && (currentBOL as any).status === "draft") {
    updateData.status = "signed"
  }

  // If consignee signature is being added (POD captured), update status to delivered
  if (signatureType === "consignee" && updateData.consignee_signature) {
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

  // Auto-store PDF if BOL is completed (has consignee signature)
  if (data && data.consignee_signature && signatureType === "consignee") {
    try {
      const { autoStoreBOLPDFOnCompletion } = await import("./bol-enhanced")
      await autoStoreBOLPDFOnCompletion(bolId).catch((err) => {
        console.error("Failed to auto-store BOL PDF:", err)
        // Don't fail if PDF storage fails
      })
    } catch (error) {
      console.error("Error importing bol-enhanced:", error)
    }
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

  // Auto-store PDF if BOL is completed (has consignee signature)
  if (data && (data as any).consignee_signature) {
    try {
      const { autoStoreBOLPDFOnCompletion } = await import("./bol-enhanced")
      await autoStoreBOLPDFOnCompletion(bolId).catch((err) => {
        console.error("Failed to auto-store BOL PDF:", err)
        // Don't fail if PDF storage fails
      })
    } catch (error) {
      console.error("Error importing bol-enhanced:", error)
    }
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


