"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { revalidatePath } from "next/cache"
import { DATClient } from "@/lib/external-brokers/dat-client"
import { TruckstopClient } from "@/lib/external-brokers/truckstop-client"
import { Loadboard123Client } from "@/lib/external-brokers/loadboard123-client"

/**
 * Get external broker integrations for company
 */
export async function getExternalBrokerIntegrations() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: "Not authenticated" }
  }

  const { company_id, error: companyError } = await getCachedUserCompany(user.id)

  if (companyError || !company_id) {
    return { data: null, error: companyError || "No company found" }
  }

  const { data, error } = await supabase
    .from("external_broker_integrations")
    .select("*")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[getExternalBrokerIntegrations] Error:", error)
    return { data: null, error: error.message }
  }

  return { data: data || [], error: null }
}

/**
 * Create or update external broker integration
 */
export async function upsertExternalBrokerIntegration(formData: {
  provider: "dat" | "truckstop" | "123loadboard" | "uber_freight" | "convoy" | "other"
  dat_enabled?: boolean
  dat_api_key?: string
  dat_api_secret?: string
  dat_username?: string
  dat_password?: string
  dat_subscription_tier?: string
  dat_sync_enabled?: boolean
  truckstop_enabled?: boolean
  truckstop_api_key?: string
  truckstop_api_secret?: string
  truckstop_username?: string
  truckstop_password?: string
  truckstop_subscription_tier?: string
  truckstop_sync_enabled?: boolean
  loadboard123_enabled?: boolean
  loadboard123_api_key?: string
  loadboard123_username?: string
  loadboard123_password?: string
  loadboard123_sync_enabled?: boolean
  other_provider_name?: string
  other_api_key?: string
  other_api_secret?: string
  other_api_url?: string
  other_sync_enabled?: boolean
  auto_sync_enabled?: boolean
  sync_interval_minutes?: number
  sync_filters?: any
  max_loads_per_sync?: number
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: "Not authenticated" }
  }

  const { company_id, error: companyError } = await getCachedUserCompany(user.id)

  if (companyError || !company_id) {
    return { data: null, error: companyError || "No company found" }
  }

  // Check if user is manager
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (userData?.role !== "manager") {
    return { data: null, error: "Only managers can manage external broker integrations" }
  }

  // Prepare update data
  const updateData: any = {
    company_id,
    provider: formData.provider,
    updated_at: new Date().toISOString(),
  }

  // DAT fields
  if (formData.provider === "dat") {
    updateData.dat_enabled = formData.dat_enabled || false
    if (formData.dat_api_key) updateData.dat_api_key = formData.dat_api_key
    if (formData.dat_api_secret) updateData.dat_api_secret = formData.dat_api_secret
    if (formData.dat_username) updateData.dat_username = formData.dat_username
    if (formData.dat_password) updateData.dat_password = formData.dat_password
    if (formData.dat_subscription_tier) updateData.dat_subscription_tier = formData.dat_subscription_tier
    updateData.dat_sync_enabled = formData.dat_sync_enabled || false
  }

  // Truckstop fields
  if (formData.provider === "truckstop") {
    updateData.truckstop_enabled = formData.truckstop_enabled || false
    if (formData.truckstop_api_key) updateData.truckstop_api_key = formData.truckstop_api_key
    if (formData.truckstop_api_secret) updateData.truckstop_api_secret = formData.truckstop_api_secret
    if (formData.truckstop_username) updateData.truckstop_username = formData.truckstop_username
    if (formData.truckstop_password) updateData.truckstop_password = formData.truckstop_password
    if (formData.truckstop_subscription_tier) updateData.truckstop_subscription_tier = formData.truckstop_subscription_tier
    updateData.truckstop_sync_enabled = formData.truckstop_sync_enabled || false
  }

  // 123Loadboard fields
  if (formData.provider === "123loadboard") {
    updateData.loadboard123_enabled = formData.loadboard123_enabled || false
    if (formData.loadboard123_api_key) updateData.loadboard123_api_key = formData.loadboard123_api_key
    if (formData.loadboard123_username) updateData.loadboard123_username = formData.loadboard123_username
    if (formData.loadboard123_password) updateData.loadboard123_password = formData.loadboard123_password
    updateData.loadboard123_sync_enabled = formData.loadboard123_sync_enabled || false
  }

  // Other provider fields
  if (formData.provider === "other") {
    if (formData.other_provider_name) updateData.other_provider_name = formData.other_provider_name
    if (formData.other_api_key) updateData.other_api_key = formData.other_api_key
    if (formData.other_api_secret) updateData.other_api_secret = formData.other_api_secret
    if (formData.other_api_url) updateData.other_api_url = formData.other_api_url
    updateData.other_sync_enabled = formData.other_sync_enabled || false
  }

  // Common sync settings
  updateData.auto_sync_enabled = formData.auto_sync_enabled || false
  if (formData.sync_interval_minutes) updateData.sync_interval_minutes = formData.sync_interval_minutes
  if (formData.sync_filters) updateData.sync_filters = formData.sync_filters
  if (formData.max_loads_per_sync) updateData.max_loads_per_sync = formData.max_loads_per_sync

  const { data, error } = await supabase
    .from("external_broker_integrations")
    .upsert(updateData, {
      onConflict: "company_id,provider",
      ignoreDuplicates: false,
    })
    .select()
    .single()

  if (error) {
    console.error("[upsertExternalBrokerIntegration] Error:", error)
    return { data: null, error: error.message }
  }

  revalidatePath("/dashboard/settings/integration")
  return { data, error: null }
}

/**
 * Test external broker connection
 */
export async function testExternalBrokerConnection(integrationId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  const { company_id } = await getCachedUserCompany(user.id)

  const { data: integration } = await supabase
    .from("external_broker_integrations")
    .select("*")
    .eq("id", integrationId)
    .eq("company_id", company_id)
    .single()

  if (!integration) {
    return { success: false, error: "Integration not found" }
  }

  try {
    let client: DATClient | TruckstopClient | Loadboard123Client | null = null

    // Initialize appropriate client based on provider
    if (integration.provider === "dat" && integration.dat_enabled) {
      if (!integration.dat_api_key || !integration.dat_api_secret) {
        return { success: false, error: "DAT API credentials are missing" }
      }
      client = new DATClient({
        api_key: integration.dat_api_key,
        api_secret: integration.dat_api_secret,
        username: integration.dat_username || undefined,
        password: integration.dat_password || undefined,
        subscription_tier: integration.dat_subscription_tier || undefined,
      })
    } else if (integration.provider === "truckstop" && integration.truckstop_enabled) {
      if (!integration.truckstop_api_key || !integration.truckstop_api_secret) {
        return { success: false, error: "Truckstop API credentials are missing" }
      }
      client = new TruckstopClient({
        api_key: integration.truckstop_api_key,
        api_secret: integration.truckstop_api_secret,
        username: integration.truckstop_username || undefined,
        password: integration.truckstop_password || undefined,
        subscription_tier: integration.truckstop_subscription_tier || undefined,
      })
    } else if (integration.provider === "123loadboard" && integration.loadboard123_enabled) {
      if (!integration.loadboard123_api_key || !integration.loadboard123_username || !integration.loadboard123_password) {
        return { success: false, error: "123Loadboard API credentials are missing" }
      }
      client = new Loadboard123Client({
        api_key: integration.loadboard123_api_key,
        username: integration.loadboard123_username,
        password: integration.loadboard123_password,
      })
    } else {
      return { success: false, error: `Provider ${integration.provider} is not enabled or not supported` }
    }

    if (!client) {
      return { success: false, error: "Failed to initialize API client" }
    }

    // Test connection
    const testResult = await client.testConnection()
    
    if (testResult.success) {
      // Update last sync status
      await supabase
        .from("external_broker_integrations")
        .update({
          last_sync_status: "success",
          last_sync_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", integrationId)
    } else {
      // Update error status
      await supabase
        .from("external_broker_integrations")
        .update({
          last_sync_status: "error",
          last_sync_error: testResult.error || "Connection test failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", integrationId)
    }

    return testResult
  } catch (error: any) {
    console.error("[testExternalBrokerConnection] Error:", error)
    
    // Update error status
    await supabase
      .from("external_broker_integrations")
      .update({
        last_sync_status: "error",
        last_sync_error: error.message || "Connection test error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", integrationId)
    
    return { success: false, error: error.message || "Connection test failed" }
  }
}

/**
 * Sync loads from external broker
 */
export async function syncExternalBrokerLoads(integrationId: string, syncType: "manual" | "automatic" = "manual") {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: "Not authenticated" }
  }

  const { company_id } = await getCachedUserCompany(user.id)

  const { data: integration } = await supabase
    .from("external_broker_integrations")
    .select("*")
    .eq("id", integrationId)
    .eq("company_id", company_id)
    .single()

  if (!integration) {
    return { data: null, error: "Integration not found" }
  }

  const startTime = Date.now()

  // Create sync history record
  const { data: syncHistory } = await supabase
    .from("external_load_sync_history")
    .insert({
      integration_id: integrationId,
      company_id,
      sync_type: syncType,
      status: "success", // Will be updated based on actual sync result
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  try {
    let client: DATClient | TruckstopClient | Loadboard123Client | null = null

    // Initialize appropriate client
    if (integration.provider === "dat" && integration.dat_enabled) {
      if (!integration.dat_api_key || !integration.dat_api_secret) {
        throw new Error("DAT API credentials are missing")
      }
      client = new DATClient({
        api_key: integration.dat_api_key,
        api_secret: integration.dat_api_secret,
        username: integration.dat_username || undefined,
        password: integration.dat_password || undefined,
        subscription_tier: integration.dat_subscription_tier || undefined,
      })
    } else if (integration.provider === "truckstop" && integration.truckstop_enabled) {
      if (!integration.truckstop_api_key || !integration.truckstop_api_secret) {
        throw new Error("Truckstop API credentials are missing")
      }
      client = new TruckstopClient({
        api_key: integration.truckstop_api_key,
        api_secret: integration.truckstop_api_secret,
        username: integration.truckstop_username || undefined,
        password: integration.truckstop_password || undefined,
        subscription_tier: integration.truckstop_subscription_tier || undefined,
      })
    } else if (integration.provider === "123loadboard" && integration.loadboard123_enabled) {
      if (!integration.loadboard123_api_key || !integration.loadboard123_username || !integration.loadboard123_password) {
        throw new Error("123Loadboard API credentials are missing")
      }
      client = new Loadboard123Client({
        api_key: integration.loadboard123_api_key,
        username: integration.loadboard123_username,
        password: integration.loadboard123_password,
      })
    } else {
      throw new Error(`Provider ${integration.provider} is not enabled or not supported`)
    }

    if (!client) {
      throw new Error("Failed to initialize API client")
    }

    // Get sync filters from integration settings
    const syncFilters = integration.sync_filters || {}
    const maxLoads = integration.max_loads_per_sync || 100

    // Search for loads
    let searchResult: { data: any[] | null; error: string | null } = { data: null, error: null }

    if (client instanceof DATClient) {
      searchResult = await client.searchLoads({
        origin: syncFilters.origin,
        destination: syncFilters.destination,
        equipment_type: syncFilters.equipment_type,
        min_rate: syncFilters.min_rate,
        max_rate: syncFilters.max_rate,
        limit: maxLoads,
      })
    } else if (client instanceof TruckstopClient) {
      searchResult = await client.searchLoads({
        origin: syncFilters.origin,
        destination: syncFilters.destination,
        equipment_type: syncFilters.equipment_type,
        min_rate: syncFilters.min_rate,
        max_rate: syncFilters.max_rate,
        limit: maxLoads,
      })
    } else if (client instanceof Loadboard123Client) {
      searchResult = await client.searchLoads({
        origin: syncFilters.origin,
        destination: syncFilters.destination,
        equipment_type: syncFilters.equipment_type,
        min_rate: syncFilters.min_rate,
        max_rate: syncFilters.max_rate,
        limit: maxLoads,
      })
    }

    if (searchResult.error || !searchResult.data) {
      throw new Error(searchResult.error || "Failed to fetch loads from external API")
    }

    const externalLoads = searchResult.data
    const loadsFound = externalLoads.length

    // Transform and store loads
    let loadsSynced = 0
    let loadsUpdated = 0
    let loadsSkipped = 0
    let errorsCount = 0
    const errors: string[] = []

    for (const externalLoad of externalLoads) {
      try {
        let transformedLoad: any

        if (client instanceof DATClient) {
          transformedLoad = client.transformLoad(externalLoad, integrationId, company_id)
        } else if (client instanceof TruckstopClient) {
          transformedLoad = client.transformLoad(externalLoad, integrationId, company_id)
        } else if (client instanceof Loadboard123Client) {
          transformedLoad = client.transformLoad(externalLoad, integrationId, company_id)
        } else {
          continue
        }

        // Check if load already exists
        const { data: existingLoad } = await supabase
          .from("external_loads")
          .select("id")
          .eq("integration_id", integrationId)
          .eq("external_load_id", transformedLoad.external_load_id)
          .single()

        if (existingLoad) {
          // Update existing load
          const { error: updateError } = await supabase
            .from("external_loads")
            .update({
              ...transformedLoad,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingLoad.id)

          if (updateError) {
            errorsCount++
            errors.push(`Failed to update load ${transformedLoad.external_load_id}: ${updateError.message}`)
          } else {
            loadsUpdated++
          }
        } else {
          // Insert new load
          const { error: insertError } = await supabase
            .from("external_loads")
            .insert(transformedLoad)

          if (insertError) {
            // Check if it's a duplicate key error (race condition)
            if (insertError.code === "23505") {
              loadsSkipped++
            } else {
              errorsCount++
              errors.push(`Failed to insert load ${transformedLoad.external_load_id}: ${insertError.message}`)
            }
          } else {
            loadsSynced++
          }
        }
      } catch (error: any) {
        errorsCount++
        errors.push(`Error processing load: ${error.message}`)
      }
    }

    const endTime = Date.now()
    const durationSeconds = Math.round((endTime - startTime) / 1000)

    // Update sync history
    const syncStatus = errorsCount > 0 && loadsSynced === 0 ? "error" : errorsCount > 0 ? "partial" : "success"

    await supabase
      .from("external_load_sync_history")
      .update({
        status: syncStatus,
        loads_found: loadsFound,
        loads_synced: loadsSynced,
        loads_updated: loadsUpdated,
        loads_skipped: loadsSkipped,
        errors_count: errorsCount,
        error_message: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
        error_details: errors.length > 0 ? { errors: errors.slice(0, 10) } : null,
        completed_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq("id", syncHistory?.id)

    // Update integration last sync time
    const lastSyncField = integration.provider === "dat" ? "dat_last_sync_at" :
                         integration.provider === "truckstop" ? "truckstop_last_sync_at" :
                         integration.provider === "123loadboard" ? "loadboard123_last_sync_at" : null

    if (lastSyncField) {
      await supabase
        .from("external_broker_integrations")
        .update({
          [lastSyncField]: new Date().toISOString(),
          last_sync_status: syncStatus,
          last_sync_error: errors.length > 0 ? errors[0] : null,
          total_loads_synced: (integration.total_loads_synced || 0) + loadsSynced,
          updated_at: new Date().toISOString(),
        })
        .eq("id", integrationId)
    }

    revalidatePath("/dashboard/loads/external")

    return {
      data: {
        syncHistoryId: syncHistory?.id,
        loadsFound,
        loadsSynced,
        loadsUpdated,
        loadsSkipped,
        errorsCount,
        durationSeconds,
        message: `Synced ${loadsSynced} new loads, updated ${loadsUpdated} existing loads${errorsCount > 0 ? `, ${errorsCount} errors` : ""}`,
      },
      error: null,
    }
  } catch (error: any) {
    console.error("[syncExternalBrokerLoads] Error:", error)

    const endTime = Date.now()
    const durationSeconds = Math.round((endTime - startTime) / 1000)

    // Update sync history with error
    await supabase
      .from("external_load_sync_history")
      .update({
        status: "error",
        errors_count: 1,
        error_message: error.message || "Sync failed",
        error_details: { error: error.message, stack: error.stack },
        completed_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq("id", syncHistory?.id)

    // Update integration error status
    await supabase
      .from("external_broker_integrations")
      .update({
        last_sync_status: "error",
        last_sync_error: error.message || "Sync failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", integrationId)

    return {
      data: null,
      error: error.message || "Failed to sync loads from external broker",
    }
  }
}

/**
 * Get external loads
 */
export async function getExternalLoads(filters?: {
  integration_id?: string
  status?: string
  origin?: string
  destination?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: "Not authenticated" }
  }

  const { company_id } = await getCachedUserCompany(user.id)

  let query = supabase
    .from("external_loads")
    .select("*", { count: "exact" })
    .eq("company_id", company_id)
    .order("synced_at", { ascending: false })

  if (filters?.integration_id) {
    query = query.eq("integration_id", filters.integration_id)
  }

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  if (filters?.origin) {
    query = query.ilike("origin", `%${filters.origin}%`)
  }

  if (filters?.destination) {
    query = query.ilike("destination", `%${filters.destination}%`)
  }

  const limit = Math.min(filters?.limit || 25, 100)
  const offset = filters?.offset || 0
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error("[getExternalLoads] Error:", error)
    return { data: null, error: error.message, count: 0 }
  }

  return { data: data || [], error: null, count: count || 0 }
}

/**
 * Import external load to internal loads
 */
export async function importExternalLoad(externalLoadId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: "Not authenticated" }
  }

  const { company_id } = await getCachedUserCompany(user.id)

  // Get external load
  const { data: externalLoad } = await supabase
    .from("external_loads")
    .select("*")
    .eq("id", externalLoadId)
    .eq("company_id", company_id)
    .single()

  if (!externalLoad) {
    return { data: null, error: "External load not found" }
  }

  // Import to internal loads using createLoad action
  const { createLoad } = await import("./loads")

  const loadData = {
    shipment_number: `EXT-${externalLoad.external_load_id}`,
    origin: externalLoad.origin,
    destination: externalLoad.destination,
    weight_kg: externalLoad.weight_kg,
    contents: externalLoad.load_description || "",
    rate: externalLoad.rate,
    load_date: externalLoad.pickup_date || undefined,
    estimated_delivery: externalLoad.delivery_date || undefined,
    source: externalLoad.external_board,
    marketplace_load_id: externalLoad.external_load_id,
  }

  const result = await createLoad(loadData)

  if (result.error) {
    return { data: null, error: result.error }
  }

  // Update external load status
  await supabase
    .from("external_loads")
    .update({
      status: "imported",
      imported_load_id: result.data?.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", externalLoadId)

  revalidatePath("/dashboard/loads")
  return { data: result.data, error: null }
}




