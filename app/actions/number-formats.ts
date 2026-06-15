"use server"

import { safeDbError } from "@/lib/utils/error"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
const COMPANY_SETTINGS_SELECT = `
  id, company_id,
  load_number_format, invoice_number_format, dispatch_number_format, bol_number_format,
  load_number_sequence, invoice_number_sequence, dispatch_number_sequence, bol_number_sequence,
  timezone, date_format, time_format, currency, currency_symbol, default_payment_terms,
  invoice_auto_send, default_load_type, default_carrier_type, auto_create_route,
  default_check_call_interval, check_call_reminder_minutes, require_check_call_at_pickup, require_check_call_at_delivery,
  auto_attach_bol_to_load, auto_email_bol_to_customer, document_retention_days, bol_auto_generate,
  odometer_validation_enabled, max_odometer_increase_per_day, odometer_auto_sync_from_eld,
  owner_name, dba_name, ein_number, business_type,
  dot_number,
  load_charge_type, miles_calculation_method, fuel_surcharge_method, fuel_surcharge_flat_amount, fuel_surcharge_per_mile,
  fsc_base_price, fsc_mpg_assumed, per_diem_rate,
  check_call_notify_customer, check_call_notify_broker, check_call_notify_on_trip_start, check_call_notify_at_shipper,
  check_call_notify_pickup_completed, check_call_notify_enroute, check_call_notify_at_consignee, check_call_notify_dropoff_completed,
  factoring_company_name, factoring_submission_email, factoring_include_bol, factoring_include_rate_conf, factoring_include_pod, factoring_email_template, factoring_auto_submit,
  triumphpay_enabled, triumphpay_api_base_url, triumphpay_api_key, triumphpay_api_secret,
  require_bol_before_dispatch, require_documents_before_dispatch, required_documents,
  auto_assign_driver, auto_assign_truck, allow_status_skip, assignment_priority,
  consider_driver_hours, consider_truck_maintenance, max_distance_for_auto_assign,
  default_status, weight_unit, distance_unit, temperature_unit,
  require_confirmation_before_dispatch, dispatch_approval_required,
  auto_dispatch_on_ready, allow_bulk_dispatch,
  notify_on_load_created, notify_on_status_change, notify_on_delivery,
  notify_driver_on_assignment, notify_on_delivery_delay, required_statuses,
  require_check_call_at_milestones, check_call_timeout_minutes, auto_escalate_missed_calls,
  driver_assignment_method, consider_driver_proximity, consider_driver_experience,
  max_assignment_distance, preferred_driver_priority, auto_optimize_routes,
  route_optimization_algorithm, consider_traffic, consider_tolls, allow_route_deviations,
  max_route_deviation_miles, notify_on_dispatch, notify_on_check_call_missed,
  notify_on_driver_late, notify_on_route_deviation, notification_channels,
  track_driver_location, location_update_interval, geofence_enabled, geofence_radius,
  emergency_contact_required, auto_notify_on_emergency, emergency_escalation_minutes,
  auto_invoice_on_delivery,
  tax_enabled, default_tax_rate, tax_inclusive, tax_name,
  late_fee_enabled, late_fee_type, late_fee_value, late_fee_grace_period_days,
  discount_enabled, default_discount_type, early_payment_discount_enabled,
  early_payment_discount_percentage, early_payment_discount_days,
  invoice_email_subject, invoice_email_body, send_copy_to_company, cc_emails, bcc_emails,
  invoice_template, show_company_logo, show_payment_instructions, payment_instructions, footer_text,
  auto_attach_documents, include_bol_in_invoice,
  notify_on_document_expiry, notify_on_permit_expiry, notify_on_roadside_oos, notify_on_dot_reportable_incident,
  compliance_expiry_lead_days, compliance_notification_channels,
  notify_on_invoice_overdue, notify_on_factoring_status, finance_notification_channels,
  created_at, updated_at
`

/**
 * Generate a number based on a format string
 * Format tokens: {YEAR}, {MONTH}, {DAY}, {SEQUENCE}, {COMPANY}
 */
function generateNumber(format: string, sequence: number, companyName?: string): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  
  let number = format
    .replace(/{YEAR}/g, String(year))
    .replace(/{MONTH}/g, month)
    .replace(/{DAY}/g, day)
    .replace(/{SEQUENCE}/g, String(sequence).padStart(4, '0'))
    .replace(/{COMPANY}/g, (companyName || 'COMP').substring(0, 4).toUpperCase())
  
  return number
}

/**
 * Get company settings (create if doesn't exist)
 */
export async function getCompanySettings() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // BUG-064 FIX: Add RBAC check - filter sensitive fields for non-admin roles
  const { data: currentUser, error: currentUserError } = await supabase
    .from("users")
    .select("role")
    .eq("id", ctx.userId)
    .maybeSingle()
  if (currentUserError) {
    return { error: safeDbError(currentUserError, "Failed to fetch user role"), data: null }
  }
  
  const userRole = currentUser?.role || 'driver'
  const isAdmin = userRole === 'super_admin' || userRole === 'operations_manager'

  // Get or create company settings
  let { data: settings, error } = await supabase
    .from("company_settings")
    .select(COMPANY_SETTINGS_SELECT)
    .eq("company_id", ctx.companyId)
    .single()

  // MEDIUM FIX 16: Return error instead of hardcoded defaults to prevent silent misconfiguration
  if (error && (error.code === "42P01" || error.message.includes("does not exist"))) {
    return { error: "company_settings table does not exist. Please run the SQL schema.", data: null }
  }

  if (error && error.code === 'PGRST116') {
    // Settings don't exist, try to create them
    // But if RLS blocks it, return default settings instead
    const { data: newSettings, error: createError } = await supabase
      .from("company_settings")
      .insert({
        company_id: ctx.companyId,
      })
      .select()
      .single()

    if (createError) {
      // MEDIUM FIX 16: Return error instead of hardcoded defaults
      return { error: safeDbError(createError, "Failed to create settings"), data: null }
    }

    settings = newSettings
  } else if (error) {
    // MEDIUM FIX 16: Return error instead of hardcoded defaults
    return { error: safeDbError(error, "Failed to fetch settings"), data: null }
  }

  // BUG-064 FIX: Filter sensitive fields for non-admin roles
  if (!isAdmin && settings) {
    const filteredSettings = { ...settings }
    // Remove sensitive financial/tax information
    delete filteredSettings.ein_number
    delete filteredSettings.owner_name
    delete filteredSettings.dba_name
    delete filteredSettings.triumphpay_api_key
    delete filteredSettings.triumphpay_api_secret
    return { data: filteredSettings, error: null }
  }

  return { data: settings, error: null }
}

/**
 * Update company settings
 */
export async function updateCompanySettings(settings: {
  load_number_format?: string
  invoice_number_format?: string
  dispatch_number_format?: string
  bol_number_format?: string
  timezone?: string
  date_format?: string
  time_format?: string
  currency?: string
  currency_symbol?: string
  default_payment_terms?: string
  invoice_auto_send?: boolean
  default_load_type?: string
  default_carrier_type?: string
  auto_create_route?: boolean
  default_check_call_interval?: number
  check_call_reminder_minutes?: number
  require_check_call_at_pickup?: boolean
  require_check_call_at_delivery?: boolean
  auto_attach_bol_to_load?: boolean
  auto_email_bol_to_customer?: boolean
  document_retention_days?: number
  bol_auto_generate?: boolean
  odometer_validation_enabled?: boolean
  max_odometer_increase_per_day?: number
  odometer_auto_sync_from_eld?: boolean
  // Business Information
  owner_name?: string
  dba_name?: string
  ein_number?: string
  business_type?: string
  dot_number?: string
  // Load Settings
  load_charge_type?: string
  miles_calculation_method?: string
  fuel_surcharge_method?: string
  fuel_surcharge_flat_amount?: number
  fuel_surcharge_per_mile?: number
  fsc_base_price?: number
  fsc_mpg_assumed?: number
  per_diem_rate?: number
  // Dispatch Settings
  check_call_notify_customer?: boolean
  check_call_notify_broker?: boolean
  check_call_notify_on_trip_start?: boolean
  check_call_notify_at_shipper?: boolean
  check_call_notify_pickup_completed?: boolean
  check_call_notify_enroute?: boolean
  check_call_notify_at_consignee?: boolean
  check_call_notify_dropoff_completed?: boolean
  /** Factoring partner (invoice submission) */
  factoring_company_name?: string | null
  factoring_submission_email?: string | null
  factoring_include_bol?: boolean
  factoring_include_rate_conf?: boolean
  factoring_include_pod?: boolean
  factoring_email_template?: string | null
  factoring_auto_submit?: boolean
  triumphpay_enabled?: boolean
  triumphpay_api_base_url?: string | null
  triumphpay_api_key?: string | null
  triumphpay_api_secret?: string | null
  require_bol_before_dispatch?: boolean
  require_documents_before_dispatch?: boolean
  required_documents?: string[]
  auto_assign_driver?: boolean
  auto_assign_truck?: boolean
  allow_status_skip?: boolean
  assignment_priority?: string
  consider_driver_hours?: boolean
  consider_truck_maintenance?: boolean
  max_distance_for_auto_assign?: number
  default_status?: string
  weight_unit?: string
  distance_unit?: string
  temperature_unit?: string
  require_confirmation_before_dispatch?: boolean
  dispatch_approval_required?: boolean
  auto_dispatch_on_ready?: boolean
  allow_bulk_dispatch?: boolean
  notify_on_load_created?: boolean
  notify_on_status_change?: boolean
  notify_on_delivery?: boolean
  notify_driver_on_assignment?: boolean
  notify_on_delivery_delay?: boolean
  required_statuses?: string[]
  require_check_call_at_milestones?: boolean
  check_call_timeout_minutes?: number
  auto_escalate_missed_calls?: boolean
  driver_assignment_method?: string
  consider_driver_proximity?: boolean
  consider_driver_experience?: boolean
  max_assignment_distance?: number
  preferred_driver_priority?: boolean
  auto_optimize_routes?: boolean
  route_optimization_algorithm?: string
  consider_traffic?: boolean
  consider_tolls?: boolean
  allow_route_deviations?: boolean
  max_route_deviation_miles?: number
  notify_on_dispatch?: boolean
  notify_on_check_call_missed?: boolean
  notify_on_driver_late?: boolean
  notify_on_route_deviation?: boolean
  notification_channels?: string[]
  track_driver_location?: boolean
  location_update_interval?: number
  geofence_enabled?: boolean
  geofence_radius?: number
  emergency_contact_required?: boolean
  auto_notify_on_emergency?: boolean
  emergency_escalation_minutes?: number
  auto_invoice_on_delivery?: boolean
  tax_enabled?: boolean
  default_tax_rate?: number
  tax_inclusive?: boolean
  tax_name?: string
  late_fee_enabled?: boolean
  late_fee_type?: string
  late_fee_value?: number
  late_fee_grace_period_days?: number
  discount_enabled?: boolean
  default_discount_type?: string
  early_payment_discount_enabled?: boolean
  early_payment_discount_percentage?: number
  early_payment_discount_days?: number
  invoice_email_subject?: string
  invoice_email_body?: string
  send_copy_to_company?: boolean
  cc_emails?: string
  bcc_emails?: string
  invoice_template?: string
  show_company_logo?: boolean
  show_payment_instructions?: boolean
  payment_instructions?: string
  footer_text?: string
  auto_attach_documents?: boolean
  include_bol_in_invoice?: boolean
  notify_on_document_expiry?: boolean
  notify_on_permit_expiry?: boolean
  notify_on_roadside_oos?: boolean
  notify_on_dot_reportable_incident?: boolean
  compliance_expiry_lead_days?: number[]
  compliance_notification_channels?: string[]
  notify_on_invoice_overdue?: boolean
  notify_on_factoring_status?: boolean
  finance_notification_channels?: string[]
  // HIGH FIX 3: Removed broad index signatures to prevent arbitrary column injection
}) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { getUserRole } = await import("@/lib/server-permissions")
  const role = await getUserRole()
  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can update company settings", data: null }
  }

  // HIGH FIX 3: Build explicit updateData object to prevent broad index-signature injection
  const updateData: Record<string, unknown> = {}
  const allowedFields = [
    'load_number_format', 'invoice_number_format', 'dispatch_number_format', 'bol_number_format',
    'timezone', 'date_format', 'time_format', 'currency', 'currency_symbol', 'default_payment_terms',
    'invoice_auto_send', 'default_load_type', 'default_carrier_type', 'auto_create_route',
    'default_check_call_interval', 'check_call_reminder_minutes', 'require_check_call_at_pickup',
    'require_check_call_at_delivery', 'auto_attach_bol_to_load', 'auto_email_bol_to_customer',
    'document_retention_days', 'bol_auto_generate', 'odometer_validation_enabled',
    'max_odometer_increase_per_day', 'odometer_auto_sync_from_eld', 'owner_name', 'dba_name',
    'ein_number', 'business_type', 'dot_number', 'load_charge_type', 'miles_calculation_method',
    'fuel_surcharge_method', 'fuel_surcharge_flat_amount', 'fuel_surcharge_per_mile', 'fsc_base_price', 'fsc_mpg_assumed', 'per_diem_rate',
    'check_call_notify_customer', 'check_call_notify_broker', 'check_call_notify_on_trip_start',
    'check_call_notify_at_shipper', 'check_call_notify_pickup_completed', 'check_call_notify_enroute',
    'check_call_notify_at_consignee', 'check_call_notify_dropoff_completed',
    'factoring_company_name', 'factoring_submission_email', 'factoring_include_bol', 'factoring_include_rate_conf',
    'factoring_include_pod', 'factoring_email_template', 'factoring_auto_submit',
    'triumphpay_enabled', 'triumphpay_api_base_url', 'triumphpay_api_key', 'triumphpay_api_secret',
    'require_bol_before_dispatch', 'require_documents_before_dispatch', 'required_documents',
    'auto_assign_driver', 'auto_assign_truck', 'allow_status_skip', 'assignment_priority',
    'consider_driver_hours', 'consider_truck_maintenance', 'max_distance_for_auto_assign',
    'default_status', 'weight_unit', 'distance_unit', 'temperature_unit',
    'require_confirmation_before_dispatch', 'dispatch_approval_required',
    'auto_dispatch_on_ready', 'allow_bulk_dispatch',
    'notify_on_load_created', 'notify_on_status_change', 'notify_on_delivery',
    'notify_driver_on_assignment', 'notify_on_delivery_delay', 'required_statuses',
    'require_check_call_at_milestones', 'check_call_timeout_minutes', 'auto_escalate_missed_calls',
    'driver_assignment_method', 'consider_driver_proximity', 'consider_driver_experience',
    'max_assignment_distance', 'preferred_driver_priority', 'auto_optimize_routes',
    'route_optimization_algorithm', 'consider_traffic', 'consider_tolls', 'allow_route_deviations',
    'max_route_deviation_miles', 'notify_on_dispatch', 'notify_on_check_call_missed',
    'notify_on_driver_late', 'notify_on_route_deviation', 'notification_channels',
    'track_driver_location', 'location_update_interval', 'geofence_enabled', 'geofence_radius',
    'emergency_contact_required', 'auto_notify_on_emergency', 'emergency_escalation_minutes',
    'auto_invoice_on_delivery',
    'tax_enabled', 'default_tax_rate', 'tax_inclusive', 'tax_name',
    'late_fee_enabled', 'late_fee_type', 'late_fee_value', 'late_fee_grace_period_days',
    'discount_enabled', 'default_discount_type', 'early_payment_discount_enabled',
    'early_payment_discount_percentage', 'early_payment_discount_days',
    'invoice_email_subject', 'invoice_email_body', 'send_copy_to_company', 'cc_emails', 'bcc_emails',
    'invoice_template', 'show_company_logo', 'show_payment_instructions', 'payment_instructions', 'footer_text',
    'auto_attach_documents', 'include_bol_in_invoice',
    'notify_on_document_expiry', 'notify_on_permit_expiry', 'notify_on_roadside_oos', 'notify_on_dot_reportable_incident',
    'compliance_expiry_lead_days', 'compliance_notification_channels',
    'notify_on_invoice_overdue', 'notify_on_factoring_status', 'finance_notification_channels',
  ]
  
  for (const field of allowedFields) {
    const settingsRecord = settings as Record<string, unknown>
    if (settingsRecord[field] !== undefined) {
      updateData[field] = settingsRecord[field]
    }
  }

  const { data, error } = await supabase
    .from("company_settings")
    .update(updateData)
    .eq("company_id", ctx.companyId)
    .select()
    .single()

  if (error) {
    return { error: safeDbError(error), data: null }
  }

  return { data, error: null }
}

/**
 * Generate next load number
 */
export async function generateLoadNumber(): Promise<{ data: string | null; error: string | null }> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  // Get company settings
  const settingsResult = await getCompanySettings()
  if (settingsResult.error || !settingsResult.data) {
    return { error: settingsResult.error || "Failed to get settings", data: null }
  }

  const settings = settingsResult.data
  const format = settings.load_number_format || 'LOAD-{YEAR}-{SEQUENCE}'

  // BUG-043 FIX: Use atomic RPC function for sequence increment - fail loudly if RPC doesn't exist
  // Removed non-atomic fallback to prevent race conditions and duplicate numbers
  const { data: rpcResult, error: rpcError } = await supabase.rpc('increment_load_number_sequence', {
    p_company_id: ctx.companyId
  })
  
  if (rpcError) {
    // BUG-043 FIX: Fail loudly instead of using race-prone fallback
    if (rpcError.message?.includes('function') || rpcError.message?.includes('does not exist')) {
      return { 
        error: 'Atomic sequence increment function not found. Please run fix_atomic_sequence_increment.sql migration.', 
        data: null 
      }
    }
    return { error: safeDbError(rpcError, "Failed to increment sequence"), data: null }
  }
  
  if (rpcResult === null || rpcResult === undefined) {
    return { error: 'Sequence increment returned null. Please check database configuration.', data: null }
  }
  
  const sequence = typeof rpcResult === 'number' ? rpcResult : parseInt(String(rpcResult), 10)

  // Get company name for {COMPANY} token
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("name")
    .eq("id", ctx.companyId)
    .maybeSingle()
  if (companyError) {
    return { error: safeDbError(companyError, "Failed to fetch company name"), data: null }
  }

  // Generate number using the incremented sequence
  const number = generateNumber(format, sequence, company?.name)

  return { data: number, error: null }
}

/**
 * Generate next invoice number
 */
export async function generateInvoiceNumber(): Promise<{ data: string | null; error: string | null }> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const settingsResult = await getCompanySettings()
  if (settingsResult.error || !settingsResult.data) {
    return { error: settingsResult.error || "Failed to get settings", data: null }
  }

  const settings = settingsResult.data
  const format = settings.invoice_number_format || 'INV-{YEAR}-{MONTH}-{SEQUENCE}'

  // BUG-043 FIX: Use atomic RPC function for sequence increment - fail loudly if RPC doesn't exist
  const { data: rpcResult, error: rpcError } = await supabase.rpc('increment_invoice_number_sequence', {
    p_company_id: ctx.companyId
  })
  
  if (rpcError) {
    if (rpcError.message?.includes('function') || rpcError.message?.includes('does not exist')) {
      return { 
        error: 'Atomic sequence increment function not found. Please run fix_atomic_sequence_increment.sql migration.', 
        data: null 
      }
    }
    return { error: safeDbError(rpcError, "Failed to increment sequence"), data: null }
  }
  
  if (rpcResult === null || rpcResult === undefined) {
    return { error: 'Sequence increment returned null. Please check database configuration.', data: null }
  }
  
  const sequence = typeof rpcResult === 'number' ? rpcResult : parseInt(String(rpcResult), 10)

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("name")
    .eq("id", ctx.companyId)
    .maybeSingle()

  if (companyError) {
    return { error: safeDbError(companyError, "Failed to fetch company name"), data: null }
  }

  const number = generateNumber(format, sequence, company?.name)

  return { data: number, error: null }
}

/**
 * Generate next dispatch number
 */
export async function generateDispatchNumber(): Promise<{ data: string | null; error: string | null }> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const settingsResult = await getCompanySettings()
  if (settingsResult.error || !settingsResult.data) {
    return { error: settingsResult.error || "Failed to get settings", data: null }
  }

  const settings = settingsResult.data
  const format = settings.dispatch_number_format || 'DISP-{YEAR}-{SEQUENCE}'

  // BUG-043 FIX: Use atomic RPC function for sequence increment - fail loudly if RPC doesn't exist
  const { data: rpcResult, error: rpcError } = await supabase.rpc('increment_dispatch_number_sequence', {
    p_company_id: ctx.companyId
  })
  
  if (rpcError) {
    if (rpcError.message?.includes('function') || rpcError.message?.includes('does not exist')) {
      return { 
        error: 'Atomic sequence increment function not found. Please run fix_atomic_sequence_increment.sql migration.', 
        data: null 
      }
    }
    return { error: safeDbError(rpcError, "Failed to increment sequence"), data: null }
  }
  
  if (rpcResult === null || rpcResult === undefined) {
    return { error: 'Sequence increment returned null. Please check database configuration.', data: null }
  }
  
  const sequence = typeof rpcResult === 'number' ? rpcResult : parseInt(String(rpcResult), 10)

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("name")
    .eq("id", ctx.companyId)
    .maybeSingle()

  if (companyError) {
    return { error: safeDbError(companyError, "Failed to fetch company name"), data: null }
  }

  const number = generateNumber(format, sequence, company?.name)

  return { data: number, error: null }
}

/**
 * Generate next BOL number
 */
export async function generateBOLNumber(): Promise<{ data: string | null; error: string | null }> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const settingsResult = await getCompanySettings()
  if (settingsResult.error || !settingsResult.data) {
    return { error: settingsResult.error || "Failed to get settings", data: null }
  }

  const settings = settingsResult.data
  const format = settings.bol_number_format || 'BOL-{YEAR}-{SEQUENCE}'

  // BUG-043 FIX: Use atomic RPC function for sequence increment - fail loudly if RPC doesn't exist
  const { data: rpcResult, error: rpcError } = await supabase.rpc('increment_bol_number_sequence', {
    p_company_id: ctx.companyId
  })
  
  if (rpcError) {
    if (rpcError.message?.includes('function') || rpcError.message?.includes('does not exist')) {
      return { 
        error: 'Atomic sequence increment function not found. Please run fix_atomic_sequence_increment.sql migration.', 
        data: null 
      }
    }
    return { error: safeDbError(rpcError, "Failed to increment sequence"), data: null }
  }
  
  if (rpcResult === null || rpcResult === undefined) {
    return { error: 'Sequence increment returned null. Please check database configuration.', data: null }
  }
  
  const sequence = typeof rpcResult === 'number' ? rpcResult : parseInt(String(rpcResult), 10)

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("name")
    .eq("id", ctx.companyId)
    .maybeSingle()

  if (companyError) {
    return { error: safeDbError(companyError, "Failed to fetch company name"), data: null }
  }

  const number = generateNumber(format, sequence, company?.name)

  return { data: number, error: null }
}


