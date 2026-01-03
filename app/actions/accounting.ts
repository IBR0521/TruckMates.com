"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { validatePricingData, validateNonNegativeNumber, sanitizeString, validateDate } from "@/lib/validation"

export async function getInvoices(filters?: {
  load_id?: string
  status?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  // Use optimized helper with caching
  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id
  const companyError = result.error

  if (companyError || !company_id) {
    return { error: companyError || "No company found", data: null }
  }

  // Build query with selective columns and pagination
  let query = supabase
    .from("invoices")
    .select("id, invoice_number, customer_name, amount, status, issue_date, due_date, load_id, created_at", { count: "exact" })
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })

  // Apply filters
  if (filters?.load_id) {
    query = query.eq("load_id", filters.load_id)
  }
  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  // Apply pagination (default limit 100)
  const limit = filters?.limit || 100
  const offset = filters?.offset || 0
  query = query.range(offset, offset + limit - 1)

  const { data: invoices, error, count } = await query

  if (error) {
    return { error: error.message, data: null, count: 0 }
  }

  return { data: invoices || [], error: null, count: count || 0 }
}

// Get single invoice
export async function getInvoice(id: string) {
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

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(`
      *,
      loads:load_id (
        id,
        shipment_number,
        origin,
        destination,
        company_name
      )
    `)
    .eq("id", id)
    .eq("company_id", userData.company_id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: invoice, error: null }
}

export async function getExpenses() {
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

  const { data: expenses, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: expenses, error: null }
}

export async function getSettlements() {
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

  const { data: settlements, error } = await supabase
    .from("settlements")
    .select(`
      *,
      drivers:driver_id (
        id,
        name
      )
    `)
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: settlements, error: null }
}

export async function deleteInvoice(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("invoices").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/dashboard/accounting/invoices")
  return { error: null }
}

export async function deleteExpense(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("expenses").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/dashboard/accounting/expenses")
  return { error: null }
}

export async function deleteSettlement(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("settlements").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/dashboard/accounting/settlements")
  return { error: null }
}

// Create invoice
export async function createInvoice(formData: {
  customer_name: string
  load_id?: string
  amount: number
  issue_date: string
  due_date: string
  payment_terms?: string
  description?: string
  items?: any[]
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

  // Professional validation
  if (!validateRequiredString(formData.customer_name, 2, 200)) {
    return { error: "Customer name is required and must be between 2 and 200 characters", data: null }
  }

  if (!validateNonNegativeNumber(formData.amount)) {
    return { error: "Amount must be a non-negative number", data: null }
  }

  if (formData.amount <= 0) {
    return { error: "Invoice amount must be greater than 0", data: null }
  }

  if (!validateDate(formData.issue_date)) {
    return { error: "Invalid issue date format (use YYYY-MM-DD)", data: null }
  }

  if (!validateDate(formData.due_date)) {
    return { error: "Invalid due date format (use YYYY-MM-DD)", data: null }
  }

  const issueDate = new Date(formData.issue_date)
  const dueDate = new Date(formData.due_date)
  if (dueDate < issueDate) {
    return { error: "Due date must be after or equal to issue date", data: null }
  }

  // Validate load if provided
  if (formData.load_id) {
    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select("id, company_id")
      .eq("id", formData.load_id)
      .eq("company_id", userData.company_id)
      .single()

    if (loadError || !load) {
      return { error: "Invalid load selected", data: null }
    }
  }

  // Generate invoice number using format system
  const { generateInvoiceNumber } = await import("./number-formats")
  const numberResult = await generateInvoiceNumber()
  if (numberResult.error || !numberResult.data) {
    return { error: numberResult.error || "Failed to generate invoice number", data: null }
  }
  const invoiceNumber = numberResult.data

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      company_id: userData.company_id,
      invoice_number: invoiceNumber,
      customer_name: sanitizeString(formData.customer_name, 200),
      load_id: formData.load_id || null,
      amount: typeof formData.amount === 'string' ? parseFloat(formData.amount) : formData.amount,
      status: "pending",
      issue_date: formData.issue_date,
      due_date: formData.due_date,
      payment_terms: formData.payment_terms ? sanitizeString(formData.payment_terms, 50) : "Net 30",
      description: formData.description ? sanitizeString(formData.description, 2000) : null,
      items: formData.items || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/accounting/invoices")
  return { data, error: null }
}

// Get load data for invoice auto-fill
export async function getLoadForInvoice(loadId: string) {
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

  const { data: load, error } = await supabase
    .from("loads")
    .select("id, shipment_number, value, company_name, origin, destination, contents")
    .eq("id", loadId)
    .eq("company_id", userData.company_id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: load, error: null }
}

// Create expense
export async function createExpense(formData: {
  category: string
  description: string
  amount: number
  date: string
  vendor?: string
  driver_id?: string
  truck_id?: string
  mileage?: number
  payment_method?: string
  receipt_url?: string
  has_receipt?: boolean
  fuel_level_after?: number
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

  // Professional validation
  if (!validateRequiredString(formData.category, 1, 100)) {
    return { error: "Category is required and must be between 1 and 100 characters", data: null }
  }

  if (!validateRequiredString(formData.description, 3, 500)) {
    return { error: "Description is required and must be between 3 and 500 characters", data: null }
  }

  if (!validateNonNegativeNumber(formData.amount)) {
    return { error: "Amount must be a non-negative number", data: null }
  }

  if (formData.amount <= 0) {
    return { error: "Expense amount must be greater than 0", data: null }
  }

  if (!validateDate(formData.date)) {
    return { error: "Invalid date format (use YYYY-MM-DD)", data: null }
  }

  if (formData.mileage !== undefined && formData.mileage !== null) {
    if (!validateNonNegativeNumber(formData.mileage)) {
      return { error: "Mileage must be a non-negative number", data: null }
    }
  }

  if (formData.fuel_level_after !== undefined && formData.fuel_level_after !== null) {
    const fuel = typeof formData.fuel_level_after === 'string' ? parseFloat(formData.fuel_level_after) : formData.fuel_level_after
    if (isNaN(fuel) || fuel < 0 || fuel > 100) {
      return { error: "Fuel level must be between 0 and 100", data: null }
    }
  }

  // Validate driver if provided
  if (formData.driver_id) {
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id, company_id")
      .eq("id", formData.driver_id)
      .eq("company_id", userData.company_id)
      .single()

    if (driverError || !driver) {
      return { error: "Invalid driver selected", data: null }
    }
  }

  // Validate truck if provided
  if (formData.truck_id) {
    const { data: truck, error: truckError } = await supabase
      .from("trucks")
      .select("id, company_id")
      .eq("id", formData.truck_id)
      .eq("company_id", userData.company_id)
      .single()

    if (truckError || !truck) {
      return { error: "Invalid truck selected", data: null }
    }
  }

  // Validate vendor if provided
  if (formData.vendor) {
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id, company_id")
      .eq("id", formData.vendor)
      .eq("company_id", userData.company_id)
      .single()

    if (vendorError || !vendor) {
      return { error: "Invalid vendor selected", data: null }
    }
  }

  // Try to auto-link to route/load based on date, driver, and truck
  let linkedRouteId = null
  let linkedLoadId = null

  if (formData.driver_id || formData.truck_id) {
    // Find matching route for the same date, driver, and truck
    let routeQuery = supabase
      .from("routes")
      .select("id")
      .eq("company_id", userData.company_id)
      .gte("created_at", `${formData.date}T00:00:00`)
      .lte("created_at", `${formData.date}T23:59:59`)

    if (formData.driver_id) {
      routeQuery = routeQuery.eq("driver_id", formData.driver_id)
    }
    if (formData.truck_id) {
      routeQuery = routeQuery.eq("truck_id", formData.truck_id)
    }

    const { data: matchingRoute } = await routeQuery.limit(1).single()

    if (matchingRoute) {
      linkedRouteId = matchingRoute.id
    }

    // Find matching load for the same date, driver, and truck
    let loadQuery = supabase
      .from("loads")
      .select("id")
      .eq("company_id", userData.company_id)
      .eq("load_date", formData.date)

    if (formData.driver_id) {
      loadQuery = loadQuery.eq("driver_id", formData.driver_id)
    }
    if (formData.truck_id) {
      loadQuery = loadQuery.eq("truck_id", formData.truck_id)
    }

    const { data: matchingLoad } = await loadQuery.limit(1).single()

    if (matchingLoad) {
      linkedLoadId = matchingLoad.id
    }
  }

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      company_id: userData.company_id,
      category: sanitizeString(formData.category, 100).toLowerCase(),
      description: sanitizeString(formData.description, 500),
      amount: typeof formData.amount === 'string' ? parseFloat(formData.amount) : formData.amount,
      date: formData.date,
      vendor: formData.vendor || null,
      driver_id: formData.driver_id || null,
      truck_id: formData.truck_id || null,
      mileage: formData.mileage ? (typeof formData.mileage === 'string' ? parseFloat(formData.mileage) : formData.mileage) : null,
      payment_method: formData.payment_method ? sanitizeString(formData.payment_method, 50) : null,
      receipt_url: formData.receipt_url ? sanitizeString(formData.receipt_url, 500) : null,
      has_receipt: formData.has_receipt || false,
      fuel_level_after: formData.fuel_level_after ? (typeof formData.fuel_level_after === 'string' ? parseFloat(formData.fuel_level_after) : formData.fuel_level_after) : null,
      route_id: linkedRouteId,
      load_id: linkedLoadId,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  // Auto-update fuel level if this is a fuel expense with truck_id and fuel_level_after
  if (formData.category.toLowerCase() === "fuel" && formData.truck_id && formData.fuel_level_after !== undefined) {
    try {
      const { updateTruck } = await import("./trucks")
      await updateTruck(formData.truck_id, {
        fuel_level: formData.fuel_level_after,
      })
      
      // Revalidate truck paths so fuel level updates in UI
      revalidatePath("/dashboard/trucks")
      revalidatePath(`/dashboard/trucks/${formData.truck_id}`)
    } catch (error) {
      // Don't fail expense creation if fuel level update fails
      console.error("[AUTO-FUEL] Failed to update fuel level:", error)
    }
  }

  revalidatePath("/dashboard/accounting/expenses")
  return { data, error: null }
}

// Get driver's loads for a specific period (for settlement calculation)
export async function getDriverLoadsForPeriod(driverId: string, periodStart: string, periodEnd: string) {
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

  // Get loads for driver in the period
  // Filter by load_date if available, otherwise use created_at as fallback
  // Get loads with load_date in period
  const { data: loadsWithDate, error: errorWithDate } = await supabase
    .from("loads")
    .select("id, shipment_number, value, status, actual_delivery, load_date, created_at")
    .eq("company_id", userData.company_id)
    .eq("driver_id", driverId)
    .not("load_date", "is", null)
    .gte("load_date", periodStart)
    .lte("load_date", periodEnd)
    .order("load_date", { ascending: true })

  // Get loads without load_date, filtered by created_at
  const { data: loadsWithoutDate, error: errorWithoutDate } = await supabase
    .from("loads")
    .select("id, shipment_number, value, status, actual_delivery, load_date, created_at")
    .eq("company_id", userData.company_id)
    .eq("driver_id", driverId)
    .is("load_date", null)
    .gte("created_at", `${periodStart}T00:00:00`)
    .lte("created_at", `${periodEnd}T23:59:59`)
    .order("created_at", { ascending: true })

  if (errorWithDate || errorWithoutDate) {
    return { error: errorWithDate?.message || errorWithoutDate?.message || "Failed to fetch loads", data: null }
  }

  const allLoads = [...(loadsWithDate || []), ...(loadsWithoutDate || [])]

  return { data: allLoads, error: null }
}

// Get driver's fuel expenses for a specific period (for settlement calculation)
export async function getDriverFuelExpensesForPeriod(driverId: string, periodStart: string, periodEnd: string) {
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

  // Get fuel expenses for driver in the period
  const { data: expenses, error } = await supabase
    .from("expenses")
    .select("id, amount, date, description")
    .eq("company_id", userData.company_id)
    .eq("driver_id", driverId)
    .eq("category", "fuel")
    .gte("date", periodStart)
    .lte("date", periodEnd)
    .order("date", { ascending: true })

  if (error) {
    return { error: error.message, data: null }
  }

  const totalFuelExpense = expenses?.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0) || 0

  return { data: expenses || [], totalFuelExpense, error: null }
}

// Create settlement with automatic calculations
export async function createSettlement(formData: {
  driver_id: string
  period_start: string
  period_end: string
  gross_pay?: number
  fuel_deduction?: number
  advance_deduction?: number
  other_deductions?: number
  payment_method?: string
  notes?: string
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

  // Get driver's loads for the period
  const loadsResult = await getDriverLoadsForPeriod(
    formData.driver_id,
    formData.period_start,
    formData.period_end
  )

  if (loadsResult.error) {
    return { error: loadsResult.error, data: null }
  }

  const loads = loadsResult.data || []

  // Get driver's pay rate
  const { data: driver } = await supabase
    .from("drivers")
    .select("pay_rate")
    .eq("id", formData.driver_id)
    .single()

  // Calculate gross pay if not provided
  let grossPay = formData.gross_pay || 0
  if (!formData.gross_pay && loads.length > 0) {
    if (driver?.pay_rate) {
      // If pay rate exists, calculate from loads
      // Pay rate can be:
      // - Percentage (0-1): multiply by load value
      // - Per load amount: multiply by number of loads
      // - Per mile: would need route distance (future enhancement)
      // For now, treating as percentage if < 1, otherwise as per-load amount
      const payRate = Number(driver.pay_rate) || 0
      if (payRate <= 1) {
        // Percentage: multiply each load value by pay rate
        grossPay = loads.reduce((sum, load) => {
          const loadValue = Number(load.value) || 0
          return sum + (loadValue * payRate)
        }, 0)
      } else {
        // Per-load amount: multiply by number of loads
        grossPay = loads.length * payRate
      }
    } else {
      // If no pay rate, sum load values as gross pay estimate
      // (This is just an estimate - user should set pay rate for accurate calculations)
      grossPay = loads.reduce((sum, load) => sum + (Number(load.value) || 0), 0)
    }
  }

  // Get fuel expenses for the period
  const fuelResult = await getDriverFuelExpensesForPeriod(
    formData.driver_id,
    formData.period_start,
    formData.period_end
  )

  // Get ELD mileage data for the period (if driver has ELD device)
  let eldMiles = 0
  try {
    const { getELDLogs } = await import("./eld")
    const eldLogsResult = await getELDLogs({
      driver_id: formData.driver_id,
      start_date: formData.period_start,
      end_date: formData.period_end,
    })
    
    if (eldLogsResult.data) {
      // Sum miles from ELD logs
      eldMiles = eldLogsResult.data
        .filter((log: any) => log.log_type === "driving" && log.miles_driven)
        .reduce((sum: number, log: any) => sum + (Number(log.miles_driven) || 0), 0)
    }
  } catch (error) {
    // ELD data not available, continue without it
    console.log("ELD data not available for settlement calculation")
  }

  const fuelDeduction = formData.fuel_deduction !== undefined 
    ? formData.fuel_deduction 
    : (fuelResult.totalFuelExpense || 0)

  const advanceDeduction = formData.advance_deduction || 0
  const otherDeductions = formData.other_deductions || 0
  const totalDeductions = fuelDeduction + advanceDeduction + otherDeductions
  const netPay = grossPay - totalDeductions

  // Prepare loads data for JSONB
  const loadsData = loads.map((load) => ({
    id: load.id,
    shipment_number: load.shipment_number,
    value: load.value || 0,
    date: load.load_date || load.actual_delivery,
  }))

  // Create settlement
  const { data, error } = await supabase
    .from("settlements")
    .insert({
      company_id: userData.company_id,
      driver_id: formData.driver_id,
      period_start: formData.period_start,
      period_end: formData.period_end,
      gross_pay: grossPay,
      fuel_deduction: fuelDeduction,
      advance_deduction: advanceDeduction,
      other_deductions: otherDeductions,
      total_deductions: totalDeductions,
      net_pay: netPay,
      status: "pending",
      payment_method: formData.payment_method || null,
      loads: loadsData,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/accounting/settlements")
  return { data, error: null }
}
