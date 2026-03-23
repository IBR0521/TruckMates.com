"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { getUserRole } from "@/lib/server-permissions"
import type { EmployeeRole } from "@/lib/roles"
import { revalidatePath } from "next/cache"
import { createLoad } from "./loads"
import { sendNotification } from "./notifications"

const MARKETPLACE_MANAGER_ROLES: readonly EmployeeRole[] = ["super_admin", "operations_manager"]

// Explicit column lists to avoid `select("*")` over-fetching.
const LOAD_MARKETPLACE_AUTO_CREATE_SELECT =
  "id, origin, destination, rate, equipment_type, auto_create_enabled"
const MARKETPLACE_SUBSCRIPTIONS_SELECT =
  "id, carrier_company_id, origin_filter, destination_filter, min_rate, max_rate, equipment_types, auto_accept, auto_accept_min_rate, email_notifications, sms_notifications, is_active"
const COMPANIES_SELECT =
  "id, name, address, phone, email, company_type, created_at, updated_at"
const BROKER_STATISTICS_SELECT =
  "average_rating, total_ratings, average_payment_days, payment_rate, total_loads_posted, total_loads_completed, verified"
const CARRIER_STATISTICS_SELECT =
  "average_rating, total_ratings, on_time_delivery_rate, damage_rate, total_loads_accepted, total_loads_completed, verified"

/**
 * Get all available marketplace loads (public)
 */
export async function getMarketplaceLoads(filters?: {
  origin?: string
  destination?: string
  minRate?: number
  maxRate?: number
  equipmentType?: string
  limit?: number
  offset?: number
}) {
  try {
    const supabase = await createClient()

    let query = supabase
      .from("load_marketplace")
      .select(
        `
        id,
        origin,
        destination,
        weight,
        weight_kg,
        contents,
        value,
        rate,
        rate_type,
        pickup_date,
        delivery_date,
        equipment_type,
        status,
        auto_create_enabled,
        created_at,
        broker:broker_id (
          id,
          name
        )
      `,
        { count: "exact" },
      )
      .eq("status", "available")
      .order("created_at", { ascending: false })

    // Apply filters
    if (filters?.origin) {
      query = query.ilike("origin", `%${filters.origin}%`)
    }
    if (filters?.destination) {
      query = query.ilike("destination", `%${filters.destination}%`)
    }
    if (filters?.minRate) {
      query = query.gte("rate", filters.minRate)
    }
    if (filters?.maxRate) {
      query = query.lte("rate", filters.maxRate)
    }
    if (filters?.equipmentType) {
      query = query.eq("equipment_type", filters.equipmentType)
    }

    // Apply pagination
    const limit = Math.min(filters?.limit || 25, 100)
    const offset = filters?.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error("[getMarketplaceLoads] Error:", error)
      return { data: null, error: error.message, count: 0 }
    }

    return { data: data || [], error: null, count: count || 0 }
  } catch (error: any) {
    console.error("[getMarketplaceLoads] Unexpected error:", error)
    return { data: null, error: error?.message || "Failed to load marketplace loads", count: 0 }
  }
}

/**
 * Get a single marketplace load
 */
export async function getMarketplaceLoad(id: string) {
  const supabase = await createClient()

  // Validate UUID format before querying
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!id || !uuidRegex.test(id)) {
    return { data: null, error: "Invalid load ID format" }
  }

  try {
    const { data, error } = await supabase
      .from("load_marketplace")
      .select(`
        *,
        broker:broker_id(id, name, email, phone)
      `)
      .eq("id", id)
      .single()

    if (error) {
      console.error("[getMarketplaceLoad] Error:", error)
      // If no rows returned, it's a not found error
      if (error.code === 'PGRST116') {
        return { data: null, error: "Load not found" }
      }
      return { data: null, error: error.message }
    }

    if (!data) {
      return { data: null, error: "Load not found" }
    }

    return { data, error: null }
  } catch (error: any) {
    console.error("[getMarketplaceLoad] Exception:", error)
    return { data: null, error: error?.message || "Failed to load load details" }
  }
}

/**
 * Post a load to marketplace (broker only)
 */
export async function postLoadToMarketplace(formData: {
  origin: string
  destination: string
  rate: number
  weight?: string
  weight_kg?: number
  contents?: string
  value?: number
  pickup_date?: string
  delivery_date?: string
  equipment_type?: string
  shipper_name?: string
  shipper_address?: string
  shipper_city?: string
  shipper_state?: string
  shipper_zip?: string
  shipper_contact_name?: string
  shipper_contact_phone?: string
  shipper_contact_email?: string
  consignee_name?: string
  consignee_address?: string
  consignee_city?: string
  consignee_state?: string
  consignee_zip?: string
  consignee_contact_name?: string
  consignee_contact_phone?: string
  consignee_contact_email?: string
  notes?: string
  [key: string]: any
}) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const role = await getUserRole()
  if (!role || !MARKETPLACE_MANAGER_ROLES.includes(role)) {
    return { data: null, error: "Only managers can post loads to marketplace" }
  }

  const { data: companyData } = await supabase
    .from("companies")
    .select("company_type")
    .eq("id", ctx.companyId)
    .single()

  // Check if company can post loads (broker or both)
  if (companyData?.company_type !== "broker" && companyData?.company_type !== "both") {
    return { data: null, error: "Only broker companies can post loads to marketplace. Please update your company type in settings." }
  }

  const { data, error } = await supabase
    .from("load_marketplace")
    .insert({
      broker_id: ctx.companyId,
      origin: formData.origin,
      destination: formData.destination,
      rate: formData.rate,
      weight: formData.weight,
      weight_kg: formData.weight_kg,
      contents: formData.contents,
      value: formData.value,
      pickup_date: formData.pickup_date || null,
      delivery_date: formData.delivery_date || null,
      equipment_type: formData.equipment_type,
      shipper_name: formData.shipper_name,
      shipper_address: formData.shipper_address,
      shipper_city: formData.shipper_city,
      shipper_state: formData.shipper_state,
      shipper_zip: formData.shipper_zip,
      shipper_contact_name: formData.shipper_contact_name,
      shipper_contact_phone: formData.shipper_contact_phone,
      shipper_contact_email: formData.shipper_contact_email,
      consignee_name: formData.consignee_name,
      consignee_address: formData.consignee_address,
      consignee_city: formData.consignee_city,
      consignee_state: formData.consignee_state,
      consignee_zip: formData.consignee_zip,
      consignee_contact_name: formData.consignee_contact_name,
      consignee_contact_phone: formData.consignee_contact_phone,
      consignee_contact_email: formData.consignee_contact_email,
      notes: formData.notes,
      status: "available",
      auto_create_enabled: true,
    })
    .select()
    .single()

  if (error) {
    console.error("[postLoadToMarketplace] Error:", error)
    return { data: null, error: error.message }
  }

  // Auto-create loads for matching carriers
  await autoCreateLoadsForMatchingCarriers(data.id)

  revalidatePath("/marketplace")
  revalidatePath("/dashboard/marketplace")

  return { data, error: null }
}

/**
 * Accept a marketplace load (carrier)
 * This creates a load in TruckMates and updates marketplace status
 */
export async function acceptMarketplaceLoad(marketplaceLoadId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const role = await getUserRole()
  if (!role || !MARKETPLACE_MANAGER_ROLES.includes(role)) {
    return { data: null, error: "Only managers can accept loads from marketplace" }
  }

  const { data: companyData } = await supabase
    .from("companies")
    .select("company_type")
    .eq("id", ctx.companyId)
    .single()

  // Check if company can accept loads (carrier or both)
  if (companyData?.company_type !== "carrier" && companyData?.company_type !== "both") {
    return { data: null, error: "Only carrier companies can accept loads from marketplace. Please update your company type in settings." }
  }

  // BUG-058 FIX: Use atomic conditional update to prevent TOCTOU race condition
  // Update status atomically - only proceed if exactly 1 row was modified
  const { data: updatedLoad, error: updateError } = await supabase
    .from("load_marketplace")
    .update({ 
      status: "accepted",
      matched_carrier_id: ctx.companyId,
      matched_at: new Date().toISOString()
    })
    .eq("id", marketplaceLoadId)
    .eq("status", "available") // Atomic condition: only update if still available
    .select()
    .single()

  if (updateError || !updatedLoad) {
    return { data: null, error: "Load not found or already accepted by another carrier" }
  }

  // Use the updated load data
  const marketplaceLoad = updatedLoad

  // Convert marketplace load to TruckMates load format
  const loadData = {
    shipment_number: `MP-${marketplaceLoad.id.substring(0, 8)}`,
    origin: marketplaceLoad.origin,
    destination: marketplaceLoad.destination,
    weight: marketplaceLoad.weight,
    weight_kg: marketplaceLoad.weight_kg,
    contents: marketplaceLoad.contents,
    value: marketplaceLoad.value,
    rate: marketplaceLoad.rate,
    load_date: marketplaceLoad.pickup_date || null,
    estimated_delivery: marketplaceLoad.delivery_date || null,
    status: "pending",
    source: "marketplace",
    shipper_name: marketplaceLoad.shipper_name,
    shipper_address: marketplaceLoad.shipper_address,
    shipper_city: marketplaceLoad.shipper_city,
    shipper_state: marketplaceLoad.shipper_state,
    shipper_zip: marketplaceLoad.shipper_zip,
    shipper_contact_name: marketplaceLoad.shipper_contact_name,
    shipper_contact_phone: marketplaceLoad.shipper_contact_phone,
    shipper_contact_email: marketplaceLoad.shipper_contact_email,
    consignee_name: marketplaceLoad.consignee_name,
    consignee_address: marketplaceLoad.consignee_address,
    consignee_city: marketplaceLoad.consignee_city,
    consignee_state: marketplaceLoad.consignee_state,
    consignee_zip: marketplaceLoad.consignee_zip,
    consignee_contact_name: marketplaceLoad.consignee_contact_name,
    consignee_contact_phone: marketplaceLoad.consignee_contact_phone,
    consignee_contact_email: marketplaceLoad.consignee_contact_email,
    pickup_instructions: marketplaceLoad.pickup_instructions,
    delivery_instructions: marketplaceLoad.delivery_instructions,
    notes: marketplaceLoad.notes,
  }

  // Create load in TruckMates
  const { data: createdLoad, error: createError } = await createLoad(loadData)

  if (createError || !createdLoad) {
    return { data: null, error: createError || "Failed to create load" }
  }

  // BUG-058 FIX: Update created_load_id (status already updated atomically above)
  const { error: updateLoadIdError } = await supabase
    .from("load_marketplace")
    .update({
      created_load_id: createdLoad.id,
    })
    .eq("id", marketplaceLoadId)

  if (updateLoadIdError) {
    console.error("[acceptMarketplaceLoad] Failed to update created_load_id:", updateLoadIdError)
    // Load was created and status updated, but load_id update failed - log but continue
  }

  // Notify broker (use marketplaceLoad which was set from updatedLoad above)
  try {
    const { data: brokerUsers } = await supabase
      .from("users")
      .select("id")
      .eq("company_id", marketplaceLoad.broker_id)

    if (brokerUsers) {
      for (const brokerUser of brokerUsers) {
        await sendNotification(brokerUser.id, "marketplace_load_accepted", {
          marketplaceLoadId: marketplaceLoad.id,
          carrierCompanyId: ctx.companyId,
          loadId: createdLoad.id,
        }).catch((err) => {
          console.warn("[acceptMarketplaceLoad] Notification failed:", err)
        })
      }
    }
  } catch (error) {
    console.warn("[acceptMarketplaceLoad] Notification error:", error)
  }

  revalidatePath("/marketplace")
  revalidatePath("/dashboard/marketplace")
  revalidatePath("/dashboard/loads")

  return { data: { marketplaceLoad, createdLoad }, error: null }
}

/**
 * Auto-create loads for carriers who have matching subscriptions
 */
async function autoCreateLoadsForMatchingCarriers(marketplaceLoadId: string) {
  const supabase = await createClient()

  // Get marketplace load
  const { data: marketplaceLoad } = await supabase
    .from("load_marketplace")
    .select(LOAD_MARKETPLACE_AUTO_CREATE_SELECT)
    .eq("id", marketplaceLoadId)
    .single()

  if (!marketplaceLoad || !marketplaceLoad.auto_create_enabled) {
    return
  }

  // Get all active subscriptions
  const { data: subscriptions } = await supabase
    .from("marketplace_subscriptions")
    .select(MARKETPLACE_SUBSCRIPTIONS_SELECT)
    .eq("is_active", true)

  if (!subscriptions || subscriptions.length === 0) {
    return
  }

  // Find matching carriers
  const matchingCarriers = subscriptions.filter((sub: { origin_filter: string[] | null; destination_filter: string[] | null; min_rate: number | null; max_rate: number | null; [key: string]: any }) => {
    // Check origin filter
    if (sub.origin_filter && sub.origin_filter.length > 0) {
      const originMatch = sub.origin_filter.some((filter: string) =>
        marketplaceLoad.origin.toLowerCase().includes(filter.toLowerCase())
      )
      if (!originMatch) return false
    }

    // Check destination filter
    if (sub.destination_filter && sub.destination_filter.length > 0) {
      const destMatch = sub.destination_filter.some((filter: string) =>
        marketplaceLoad.destination.toLowerCase().includes(filter.toLowerCase())
      )
      if (!destMatch) return false
    }

    // Check rate filter
    if (sub.min_rate && marketplaceLoad.rate < sub.min_rate) return false
    if (sub.max_rate && marketplaceLoad.rate > sub.max_rate) return false

    // Check equipment type
    if (
      sub.equipment_types &&
      sub.equipment_types.length > 0 &&
      marketplaceLoad.equipment_type &&
      !sub.equipment_types.includes(marketplaceLoad.equipment_type)
    ) {
      return false
    }

    return true
  })

  // Auto-create loads for matching carriers
  for (const subscription of matchingCarriers) {
    try {
      // If auto-accept is enabled and rate meets criteria
      if (
        subscription.auto_accept &&
        (!subscription.auto_accept_min_rate ||
          marketplaceLoad.rate >= subscription.auto_accept_min_rate)
      ) {
        // Auto-accept the load
        await acceptMarketplaceLoad(marketplaceLoadId)
      } else {
        // Just create the load (carrier needs to manually accept)
        // This would require creating a "pending" load that the carrier can review
        // For now, we'll just notify them
        const { data: carrierUsers } = await supabase
          .from("users")
          .select("id")
          .eq("company_id", subscription.carrier_company_id)

        if (carrierUsers && subscription.email_notifications) {
          for (const user of carrierUsers) {
            await sendNotification(user.id, "marketplace_new_matching_load", {
              marketplaceLoadId: marketplaceLoad.id,
              origin: marketplaceLoad.origin,
              destination: marketplaceLoad.destination,
              rate: marketplaceLoad.rate,
            }).catch((err) => {
              console.warn("[autoCreateLoadsForMatchingCarriers] Notification failed:", err)
            })
          }
        }
      }
    } catch (error) {
      console.error(
        `[autoCreateLoadsForMatchingCarriers] Error for carrier ${subscription.carrier_company_id}:`,
        error
      )
    }
  }
}

/**
 * Get broker's posted loads
 */
export async function getBrokerMarketplaceLoads() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const { data, error } = await supabase
    .from("load_marketplace")
    .select(`
      *,
      created_load:created_load_id(id, shipment_number, status)
    `)
    .eq("broker_id", ctx.companyId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[getBrokerMarketplaceLoads] Error:", error)
    return { data: null, error: error.message }
  }

  return { data: data || [], error: null }
}

/**
 * Get or create marketplace subscription for carrier
 */
export async function getMarketplaceSubscription() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const { data, error } = await supabase
    .from("marketplace_subscriptions")
    .select(MARKETPLACE_SUBSCRIPTIONS_SELECT)
    .eq("carrier_company_id", ctx.companyId)
    .single()

  if (error) {
    // Subscription doesn't exist, create one
    const { data: newSubscription, error: createError } = await supabase
      .from("marketplace_subscriptions")
      .insert({
        carrier_company_id: ctx.companyId,
        is_active: true,
      })
      .select()
      .single()

    if (createError) {
      console.error("[getMarketplaceSubscription] Create error:", createError)
      return { data: null, error: createError.message }
    }

    return { data: newSubscription, error: null }
  }

  return { data, error: null }
}

/**
 * Update marketplace subscription
 */
export async function updateMarketplaceSubscription(formData: {
  origin_filter?: string[]
  destination_filter?: string[]
  min_rate?: number
  max_rate?: number
  equipment_types?: string[]
  auto_accept?: boolean
  auto_accept_min_rate?: number
  email_notifications?: boolean
  sms_notifications?: boolean
  is_active?: boolean
}) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const { data, error } = await supabase
    .from("marketplace_subscriptions")
    .update(formData)
    .eq("carrier_company_id", ctx.companyId)
    .select()
    .single()

  if (error) {
    console.error("[updateMarketplaceSubscription] Error:", error)
    return { data: null, error: error.message }
  }

  revalidatePath("/dashboard/marketplace/settings")
  return { data, error: null }
}

/**
 * Get broker profile with statistics
 */
export async function getBrokerProfile(brokerCompanyId: string) {
  const supabase = await createClient()

  // Get company info
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select(COMPANIES_SELECT)
    .eq("id", brokerCompanyId)
    .single()

  if (companyError || !company) {
    return { data: null, error: "Broker not found" }
  }

  // Get broker statistics
  const { data: stats, error: statsError } = await supabase
    .from("broker_statistics")
    .select(BROKER_STATISTICS_SELECT)
    .eq("broker_company_id", brokerCompanyId)
    .single()

  // Get recent loads
  const { data: recentLoads } = await supabase
    .from("load_marketplace")
    .select("id, origin, destination, rate, equipment_type, pickup_date, status")
    .eq("broker_id", brokerCompanyId)
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(10)

  return {
    data: {
      company,
      statistics: stats || {
        average_rating: 0,
        total_ratings: 0,
        average_payment_days: 0,
        payment_rate: 100,
        total_loads_posted: 0,
        total_loads_completed: 0,
        verified: false,
      },
      recentLoads: recentLoads || [],
    },
    error: null,
  }
}

/**
 * Get carrier profile with statistics
 */
export async function getCarrierProfile(carrierCompanyId: string) {
  const supabase = await createClient()

  // Get company info
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select(COMPANIES_SELECT)
    .eq("id", carrierCompanyId)
    .single()

  if (companyError || !company) {
    return { data: null, error: "Carrier not found" }
  }

  // Get carrier statistics
  const { data: stats, error: statsError } = await supabase
    .from("carrier_statistics")
    .select(CARRIER_STATISTICS_SELECT)
    .eq("carrier_company_id", carrierCompanyId)
    .single()

  return {
    data: {
      company,
      statistics: stats || {
        average_rating: 0,
        total_ratings: 0,
        on_time_delivery_rate: 0,
        damage_rate: 0,
        total_loads_accepted: 0,
        total_loads_completed: 0,
        verified: false,
      },
    },
    error: null,
  }
}

/**
 * Rate a broker (after load completion)
 */
export async function rateBroker(formData: {
  broker_company_id: string
  load_id?: string
  marketplace_load_id?: string
  rating: number
  payment_speed_rating?: number
  communication_rating?: number
  load_quality_rating?: number
  review_text?: string
  payment_days?: number
  payment_received?: boolean
}) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  // BUG-066 FIX: Require at least one of load_id or marketplace_load_id to be present
  if (!formData.load_id && !formData.marketplace_load_id) {
    return { data: null, error: "Either load_id or marketplace_load_id is required to rate a broker" }
  }

  // BUG-066 FIX: Verify the load actually connects both companies
  if (formData.load_id) {
    const { data: load } = await supabase
      .from("loads")
      .select("customer_id, company_id")
      .eq("id", formData.load_id)
      .single()
    
    if (!load || (load.customer_id !== formData.broker_company_id && load.company_id !== ctx.companyId)) {
      return { data: null, error: "Load does not connect your company with the rated broker" }
    }
  } else if (formData.marketplace_load_id) {
    const { data: marketplaceLoad } = await supabase
      .from("load_marketplace")
      .select("broker_id, matched_carrier_id")
      .eq("id", formData.marketplace_load_id)
      .single()
    
    if (!marketplaceLoad || 
        (marketplaceLoad.broker_id !== formData.broker_company_id || marketplaceLoad.matched_carrier_id !== ctx.companyId)) {
      return { data: null, error: "Marketplace load does not connect your company with the rated broker" }
    }
  }

  const { data, error } = await supabase
    .from("broker_ratings")
    .insert({
      broker_company_id: formData.broker_company_id,
      carrier_company_id: ctx.companyId,
      load_id: formData.load_id || null,
      marketplace_load_id: formData.marketplace_load_id || null,
      rating: formData.rating,
      payment_speed_rating: formData.payment_speed_rating,
      communication_rating: formData.communication_rating,
      load_quality_rating: formData.load_quality_rating,
      review_text: formData.review_text,
      payment_days: formData.payment_days,
      payment_received: formData.payment_received ?? true,
    })
    .select()
    .single()

  if (error) {
    console.error("[rateBroker] Error:", error)
    return { data: null, error: error.message }
  }

  revalidatePath("/dashboard/marketplace")
  return { data, error: null }
}

/**
 * Rate a carrier (after load completion)
 */
export async function rateCarrier(formData: {
  carrier_company_id: string
  load_id?: string
  marketplace_load_id?: string
  rating: number
  on_time_rating?: number
  communication_rating?: number
  professionalism_rating?: number
  review_text?: string
  on_time_delivery?: boolean
  damage_reported?: boolean
}) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  const role = await getUserRole()
  if (!role || !MARKETPLACE_MANAGER_ROLES.includes(role)) {
    return { data: null, error: "Only managers can rate carriers" }
  }

  // BUG-066 FIX: Require at least one of load_id or marketplace_load_id to be present
  if (!formData.load_id && !formData.marketplace_load_id) {
    return { data: null, error: "Either load_id or marketplace_load_id is required to rate a carrier" }
  }

  // BUG-066 FIX: Verify the load actually connects both companies
  if (formData.load_id) {
    const { data: load } = await supabase
      .from("loads")
      .select("customer_id, company_id")
      .eq("id", formData.load_id)
      .single()
    
    if (!load || (load.customer_id !== ctx.companyId && load.company_id !== formData.carrier_company_id)) {
      return { data: null, error: "Load does not connect your company with the rated carrier" }
    }
  } else if (formData.marketplace_load_id) {
    const { data: marketplaceLoad } = await supabase
      .from("load_marketplace")
      .select("broker_id, matched_carrier_id")
      .eq("id", formData.marketplace_load_id)
      .single()
    
    if (!marketplaceLoad || 
        (marketplaceLoad.broker_id !== ctx.companyId || marketplaceLoad.matched_carrier_id !== formData.carrier_company_id)) {
      return { data: null, error: "Marketplace load does not connect your company with the rated carrier" }
    }
  }

  const { data, error } = await supabase
    .from("carrier_ratings")
    .insert({
      carrier_company_id: formData.carrier_company_id,
      broker_company_id: ctx.companyId,
      load_id: formData.load_id || null,
      marketplace_load_id: formData.marketplace_load_id || null,
      rating: formData.rating,
      on_time_rating: formData.on_time_rating,
      communication_rating: formData.communication_rating,
      professionalism_rating: formData.professionalism_rating,
      review_text: formData.review_text,
      on_time_delivery: formData.on_time_delivery ?? true,
      damage_reported: formData.damage_reported ?? false,
    })
    .select()
    .single()

  if (error) {
    console.error("[rateCarrier] Error:", error)
    return { data: null, error: error.message }
  }

  revalidatePath("/dashboard/marketplace")
  return { data, error: null }
}

