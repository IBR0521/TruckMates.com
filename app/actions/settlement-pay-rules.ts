"use server"

import * as Sentry from "@sentry/nextjs"
import { errorMessage, sanitizeError } from "@/lib/error-message"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"
import { revalidatePath } from "next/cache"


function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return sanitizeError(error, { fallback })
}


/**
 * Settlement Pay Rules Engine
 * Manages complex pay structures for drivers
 */

export interface PayRuleBonus {
  type: string // 'hazmat', 'on_time', 'mileage_threshold', 'custom'
  amount: number
  description: string
  threshold?: number // For mileage_threshold type
  condition?: string // For custom conditions
}

export interface PayRuleDeduction {
  type: string // 'fuel', 'advance', 'equipment', 'insurance', 'custom'
  percentage?: number // Percentage of fuel costs, etc.
  amount?: number // Fixed amount
  description: string
}

export interface DriverPayRule {
  id?: string
  driver_id: string
  pay_type: "per_mile" | "percentage" | "flat" | "hybrid"
  base_rate_per_mile?: number
  base_percentage?: number
  base_flat_rate?: number
  bonuses?: PayRuleBonus[]
  deductions?: PayRuleDeduction[]
  minimum_pay_guarantee?: number
  effective_from: string
  effective_to?: string
  is_active?: boolean
  notes?: string
}

export type SettlementLineItemType =
  | "mileage"
  | "hourly"
  | "percentage"
  | "flat"
  | "hybrid"
  | "bonus"
  | "deduction"
  | "per_diem"

export interface SettlementLineItem {
  type: SettlementLineItemType
  description: string
  amount: number
  taxable: boolean
}

/**
 * Create or update a driver pay rule
 */
export async function upsertDriverPayRule(rule: DriverPayRule) {
  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    const supabase = await createClient()
    const ctx = await getCachedAuthContext()
    if (ctx.error || !ctx.companyId) {
      return { error: ctx.error || "Not authenticated", data: null }
    }

    // BUG-012 FIX: Use RPC function for atomic transaction (deactivate old + insert new)
    // This ensures if insert fails, old rule remains active
    const { data, error } = await supabase.rpc('update_driver_pay_rule', {
      p_rule_id: rule.id || null,
      p_company_id: ctx.companyId,
      p_driver_id: rule.driver_id,
      p_pay_type: rule.pay_type,
      p_base_rate_per_mile: rule.base_rate_per_mile || null,
      p_base_percentage: rule.base_percentage || null,
      p_base_flat_rate: rule.base_flat_rate || null,
      p_bonuses: rule.bonuses || [],
      p_deductions: rule.deductions || [],
      p_minimum_pay_guarantee: rule.minimum_pay_guarantee || null,
      p_effective_from: rule.effective_from,
      p_effective_to: rule.effective_to || null,
      p_is_active: rule.is_active !== false,
    })

    // If RPC doesn't exist, fallback to manual transaction (less safe)
    if (error && error.message?.includes('does not exist')) {
      // Fallback: Manual transaction (not atomic, but better than nothing)
      // First deactivate old rule if updating
      if (rule.id) {
        await supabase
          .from("driver_pay_rules")
          .update({ is_active: false })
          .eq("id", rule.id)
      }

      // Deactivate other active rules for this driver
      if (rule.is_active !== false) {
        await supabase
          .from("driver_pay_rules")
          .update({ is_active: false })
          .eq("driver_id", rule.driver_id)
          .eq("is_active", true)
      }

      // Insert new rule
      const { data: insertData, error: insertError } = await supabase
        .from("driver_pay_rules")
        .insert({
          company_id: ctx.companyId,
          driver_id: rule.driver_id,
          pay_type: rule.pay_type,
          base_rate_per_mile: rule.base_rate_per_mile || null,
          base_percentage: rule.base_percentage || null,
          base_flat_rate: rule.base_flat_rate || null,
          bonuses: rule.bonuses || [],
          deductions: rule.deductions || [],
          minimum_pay_guarantee: rule.minimum_pay_guarantee || null,
          effective_from: rule.effective_from,
          effective_to: rule.effective_to || null,
          is_active: rule.is_active !== false,
          notes: rule.notes || null,
        })
        .select()
        .single()

      if (insertError) {
        return { error: insertError.message, data: null }
      }

      revalidatePath("/dashboard/accounting/settlements")
      return { data: insertData, error: null }
    }

    // If RPC succeeded
    if (error) {
      return { error: safeDbError(error), data: null }
    }

    revalidatePath("/dashboard/accounting/settlements")
    return { data, error: null }
  } catch (error: unknown) {
    Sentry.captureException(error)
    const message = error instanceof Error ? errorMessage(error) : "An unexpected error occurred"
    return { error: message, data: null }
  }
}

/**
 * Get active pay rule for a driver
 */
export async function getActivePayRule(driverId: string, date?: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    const queryDate = date || new Date().toISOString().split("T")[0]

    const { data, error } = await supabase.rpc("get_active_pay_rule", {
      p_driver_id: driverId,
      p_date: queryDate,
    })

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    return { data: data && data.length > 0 ? data[0] : null, error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to get pay rule"), data: null }
  }
}

/**
 * Get all pay rules for a driver
 */
export async function getDriverPayRules(driverId: string) {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // V3-007 FIX: Replace select(*) with explicit columns
    const { data, error } = await supabase
      .from("driver_pay_rules")
      .select("id, company_id, driver_id, pay_type, base_rate_per_mile, base_percentage, base_flat_rate, bonuses, deductions, minimum_pay_guarantee, effective_from, effective_to, is_active, notes, created_at, updated_at")
      .eq("company_id", ctx.companyId)
      .eq("driver_id", driverId)
      .order("effective_from", { ascending: false })
      .limit(100) // V3-007 FIX: Add LIMIT to prevent unbounded queries

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    return { data: data || [], error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to get pay rules"), data: null }
  }
}

/**
 * Calculate gross pay using pay rule
 */
export async function calculateGrossPayFromRule(params: {
  driverId: string
  loads: Array<{
    id: string
    value: number
    miles?: number
    load_type?: string
    on_time_delivery?: boolean
    [key: string]: any
  }>
  totalMiles?: number
  periodStart: string
  periodEnd: string
  perDiemEligibleNights?: number
  perDiemRate?: number
}) {
  const supabase = await createClient()

  // Get active pay rule
  const payRuleResult = await getActivePayRule(params.driverId, params.periodStart)

  if (payRuleResult.error || !payRuleResult.data) {
    return {
      error: payRuleResult.error || "No active pay rule found",
      data: null,
    }
  }

  const payRule = payRuleResult.data
  let grossPay = 0
  const calculationDetails: any = {
    base_pay: 0,
    bonuses: [],
    bonus_total: 0,
    deductions: [],
    deduction_total: 0,
    minimum_guarantee_applied: false,
    line_items: [] as SettlementLineItem[],
    non_taxable_pay: 0,
  }

  // Calculate base pay
  if (payRule.pay_type === "per_mile" && payRule.base_rate_per_mile) {
    const miles = params.totalMiles || params.loads.reduce((sum, load) => sum + (load.miles || 0), 0)
    grossPay = miles * Number(payRule.base_rate_per_mile)
    calculationDetails.base_pay = grossPay
    calculationDetails.miles_used = miles
    calculationDetails.rate_per_mile = payRule.base_rate_per_mile
    calculationDetails.line_items.push({
      type: "mileage",
      description: "Mileage pay",
      amount: grossPay,
      taxable: true,
    })
  } else if (payRule.pay_type === "percentage" && payRule.base_percentage) {
    const totalLoadValue = params.loads.reduce((sum, load) => sum + (load.value || 0), 0)
    grossPay = totalLoadValue * (Number(payRule.base_percentage) / 100)
    calculationDetails.base_pay = grossPay
    calculationDetails.total_load_value = totalLoadValue
    calculationDetails.percentage = payRule.base_percentage
    calculationDetails.line_items.push({
      type: "percentage",
      description: "Percentage pay",
      amount: grossPay,
      taxable: true,
    })
  } else if (payRule.pay_type === "flat" && payRule.base_flat_rate) {
    grossPay = params.loads.length * Number(payRule.base_flat_rate)
    calculationDetails.base_pay = grossPay
    calculationDetails.loads_count = params.loads.length
    calculationDetails.flat_rate = payRule.base_flat_rate
    calculationDetails.line_items.push({
      type: "flat",
      description: "Flat per-load pay",
      amount: grossPay,
      taxable: true,
    })
  } else if (payRule.pay_type === "hybrid") {
    // Hybrid: combine per_mile and percentage
    if (payRule.base_rate_per_mile) {
      const miles = params.totalMiles || params.loads.reduce((sum, load) => sum + (load.miles || 0), 0)
      grossPay += miles * Number(payRule.base_rate_per_mile)
      calculationDetails.mileage_pay = miles * Number(payRule.base_rate_per_mile)
    }
    if (payRule.base_percentage) {
      const totalLoadValue = params.loads.reduce((sum, load) => sum + (load.value || 0), 0)
      const percentagePay = totalLoadValue * (Number(payRule.base_percentage) / 100)
      grossPay += percentagePay
      calculationDetails.percentage_pay = percentagePay
    }
    calculationDetails.base_pay = grossPay
    calculationDetails.line_items.push({
      type: "hybrid",
      description: "Hybrid base pay",
      amount: grossPay,
      taxable: true,
    })
  }

  // Apply bonuses
  if (payRule.bonuses && Array.isArray(payRule.bonuses)) {
    for (const bonus of payRule.bonuses) {
      let bonusAmount = 0
      let applies = false

      if (bonus.type === "hazmat") {
        // Check if any load is hazmat
        const hazmatLoads = params.loads.filter((load) => load.load_type === "hazmat")
        if (hazmatLoads.length > 0) {
          bonusAmount = hazmatLoads.length * Number(bonus.amount)
          applies = true
        }
      } else if (bonus.type === "on_time") {
        // Check for on-time deliveries
        const onTimeLoads = params.loads.filter((load) => load.on_time_delivery === true)
        if (onTimeLoads.length > 0) {
          bonusAmount = onTimeLoads.length * Number(bonus.amount)
          applies = true
        }
      } else if (bonus.type === "mileage_threshold" && bonus.threshold) {
        // Check if total miles exceeds threshold
        const totalMiles = params.totalMiles || params.loads.reduce((sum, load) => sum + (load.miles || 0), 0)
        if (totalMiles >= Number(bonus.threshold)) {
          bonusAmount = Number(bonus.amount)
          applies = true
        }
      } else if (bonus.type === "custom") {
        // Custom bonus (always applies if specified)
        bonusAmount = Number(bonus.amount)
        applies = true
      }

      if (applies && bonusAmount > 0) {
        grossPay += bonusAmount
        calculationDetails.bonuses.push({
          type: bonus.type,
          description: bonus.description,
          amount: bonusAmount,
        })
        calculationDetails.line_items.push({
          type: "bonus",
          description: bonus.description || bonus.type,
          amount: bonusAmount,
          taxable: true,
        })
        calculationDetails.bonus_total += bonusAmount
      }
    }
  }

  // Apply minimum pay guarantee
  if (payRule.minimum_pay_guarantee && grossPay < Number(payRule.minimum_pay_guarantee)) {
    grossPay = Number(payRule.minimum_pay_guarantee)
    calculationDetails.minimum_guarantee_applied = true
    calculationDetails.minimum_guarantee_amount = payRule.minimum_pay_guarantee
  }

  const perDiemEligibleNights = Math.max(0, Math.floor(Number(params.perDiemEligibleNights || 0)))
  const perDiemRate = Math.max(0, Number(params.perDiemRate || 0))
  const perDiemAmount = perDiemEligibleNights * perDiemRate
  if (perDiemAmount > 0) {
    calculationDetails.per_diem_eligible_nights = perDiemEligibleNights
    calculationDetails.per_diem_rate = perDiemRate
    calculationDetails.per_diem_amount = perDiemAmount
    calculationDetails.non_taxable_pay = perDiemAmount
    calculationDetails.line_items.push({
      type: "per_diem",
      description: `Per-diem (${perDiemEligibleNights} nights x $${perDiemRate.toFixed(2)})`,
      amount: perDiemAmount,
      taxable: false,
    })
  }

  return {
    data: {
      gross_pay: grossPay,
      calculation_details: calculationDetails,
      pay_rule: payRule,
    },
    error: null,
  }
}

/**
 * Delete a pay rule
 */
export async function deletePayRule(ruleId: string) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  const { getUserRole } = await import("@/lib/server-permissions")
  const role = await getUserRole()
  const MANAGER_ROLES = ["super_admin", "operations_manager"]
  if (!role || !MANAGER_ROLES.includes(role)) {
    return { error: "Only managers can delete pay rules", data: null }
  }

  try {
    const { error } = await supabase
      .from("driver_pay_rules")
      .delete()
      .eq("id", ruleId)
      .eq("company_id", ctx.companyId)

    if (error) {
      return { error: safeDbError(error), data: null }
    }

    revalidatePath("/dashboard/accounting/settlements")
    return { data: { success: true }, error: null }
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to delete pay rule"), data: null }
  }
}



