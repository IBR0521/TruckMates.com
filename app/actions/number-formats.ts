"use server"

import { createClient } from "@/lib/supabase/server"

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

  // Get or create company settings
  let { data: settings, error } = await supabase
    .from("company_settings")
    .select("*")
    .eq("company_id", userData.company_id)
    .single()

  // Check if table doesn't exist (schema not run yet)
  if (error && (error.code === "42P01" || error.message.includes("does not exist"))) {
    console.warn("[getCompanySettings] company_settings table does not exist. Please run the SQL schema.")
    // Return default settings instead of error
    return {
      data: {
        load_number_format: "LOAD-{YEAR}-{SEQUENCE}",
        load_number_sequence: 1,
        invoice_number_format: "INV-{YEAR}-{MONTH}-{SEQUENCE}",
        invoice_number_sequence: 1,
        dispatch_number_format: "DISP-{YEAR}-{SEQUENCE}",
        dispatch_number_sequence: 1,
        bol_number_format: "BOL-{YEAR}-{SEQUENCE}",
        bol_number_sequence: 1,
        timezone: "America/New_York",
        date_format: "MM/DD/YYYY",
        time_format: "12h",
        currency: "USD",
        currency_symbol: "$",
        default_payment_terms: "Net 30",
        invoice_auto_send: false,
        default_load_type: "ftl",
        default_carrier_type: "dry-van",
        auto_create_route: true,
        default_check_call_interval: 4,
        check_call_reminder_minutes: 15,
        require_check_call_at_pickup: true,
        require_check_call_at_delivery: true,
        auto_attach_bol_to_load: false,
        auto_email_bol_to_customer: false,
        document_retention_days: 365,
        bol_auto_generate: false,
        odometer_validation_enabled: true,
        max_odometer_increase_per_day: 1000,
        odometer_auto_sync_from_eld: true,
      },
      error: null,
    }
  }

  if (error && error.code === 'PGRST116') {
    // Settings don't exist, create them
    const { data: newSettings, error: createError } = await supabase
      .from("company_settings")
      .insert({
        company_id: userData.company_id,
      })
      .select()
      .single()

    if (createError) {
      return { error: createError.message, data: null }
    }

    settings = newSettings
  } else if (error) {
    return { error: error.message, data: null }
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
    .select("company_id, role")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  if (userData.role !== 'manager') {
    return { error: "Only managers can update company settings", data: null }
  }

  const { data, error } = await supabase
    .from("company_settings")
    .update(settings)
    .eq("company_id", userData.company_id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

/**
 * Generate next load number
 */
export async function generateLoadNumber(): Promise<{ data: string | null; error: string | null }> {
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

  // Get company settings
  const settingsResult = await getCompanySettings()
  if (settingsResult.error || !settingsResult.data) {
    return { error: settingsResult.error || "Failed to get settings", data: null }
  }

  const settings = settingsResult.data
  const format = settings.load_number_format || 'LOAD-{YEAR}-{SEQUENCE}'
  let sequence = settings.load_number_sequence || 1

  // Get company name for {COMPANY} token
  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", userData.company_id)
    .single()

  // Generate number
  const number = generateNumber(format, sequence, company?.name)

  // Increment sequence
  await supabase
    .from("company_settings")
    .update({ load_number_sequence: sequence + 1 })
    .eq("company_id", userData.company_id)

  return { data: number, error: null }
}

/**
 * Generate next invoice number
 */
export async function generateInvoiceNumber(): Promise<{ data: string | null; error: string | null }> {
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

  const settingsResult = await getCompanySettings()
  if (settingsResult.error || !settingsResult.data) {
    return { error: settingsResult.error || "Failed to get settings", data: null }
  }

  const settings = settingsResult.data
  const format = settings.invoice_number_format || 'INV-{YEAR}-{MONTH}-{SEQUENCE}'
  let sequence = settings.invoice_number_sequence || 1

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", userData.company_id)
    .single()

  const number = generateNumber(format, sequence, company?.name)

  await supabase
    .from("company_settings")
    .update({ invoice_number_sequence: sequence + 1 })
    .eq("company_id", userData.company_id)

  return { data: number, error: null }
}

/**
 * Generate next dispatch number
 */
export async function generateDispatchNumber(): Promise<{ data: string | null; error: string | null }> {
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

  const settingsResult = await getCompanySettings()
  if (settingsResult.error || !settingsResult.data) {
    return { error: settingsResult.error || "Failed to get settings", data: null }
  }

  const settings = settingsResult.data
  const format = settings.dispatch_number_format || 'DISP-{YEAR}-{SEQUENCE}'
  let sequence = settings.dispatch_number_sequence || 1

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", userData.company_id)
    .single()

  const number = generateNumber(format, sequence, company?.name)

  await supabase
    .from("company_settings")
    .update({ dispatch_number_sequence: sequence + 1 })
    .eq("company_id", userData.company_id)

  return { data: number, error: null }
}

/**
 * Generate next BOL number
 */
export async function generateBOLNumber(): Promise<{ data: string | null; error: string | null }> {
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

  const settingsResult = await getCompanySettings()
  if (settingsResult.error || !settingsResult.data) {
    return { error: settingsResult.error || "Failed to get settings", data: null }
  }

  const settings = settingsResult.data
  const format = settings.bol_number_format || 'BOL-{YEAR}-{SEQUENCE}'
  let sequence = settings.bol_number_sequence || 1

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", userData.company_id)
    .single()

  const number = generateNumber(format, sequence, company?.name)

  await supabase
    .from("company_settings")
    .update({ bol_number_sequence: sequence + 1 })
    .eq("company_id", userData.company_id)

  return { data: number, error: null }
}

