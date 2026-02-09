"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { revalidatePath } from "next/cache"

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

/**
 * Create or update a driver pay rule
 */
export async function upsertDriverPayRule(rule: DriverPayRule) {
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

  try {
    // If updating existing rule, deactivate it first
    if (rule.id) {
      await supabase
        .from("driver_pay_rules")
        .update({ is_active: false })
        .eq("id", rule.id)
    }

    // If activating a new rule, deactivate other active rules for this driver
    if (rule.is_active !== false) {
      await supabase
        .from("driver_pay_rules")
        .update({ is_active: false })
        .eq("driver_id", rule.driver_id)
        .eq("is_active", true)
    }

    // Insert new rule
    const { data, error } = await supabase
      .from("driver_pay_rules")
      .insert({
        company_id: result.company_id,
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

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/accounting/settlements")
    return { data, error: null }
  } catch (error: any) {
    return { error: error?.message || "Failed to save pay rule", data: null }
  }
}

/**
 * Get active pay rule for a driver
 */
export async function getActivePayRule(driverId: string, date?: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    const queryDate = date || new Date().toISOString().split("T")[0]

    const { data, error } = await supabase.rpc("get_active_pay_rule", {
      p_driver_id: driverId,
      p_date: queryDate,
    })

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: data && data.length > 0 ? data[0] : null, error: null }
  } catch (error: any) {
    return { error: error?.message || "Failed to get pay rule", data: null }
  }
}

/**
 * Get all pay rules for a driver
 */
export async function getDriverPayRules(driverId: string) {
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

  try {
    const { data, error } = await supabase
      .from("driver_pay_rules")
      .select("*")
      .eq("company_id", result.company_id)
      .eq("driver_id", driverId)
      .order("effective_from", { ascending: false })

    if (error) {
      return { error: error.message, data: null }
    }

    return { data: data || [], error: null }
  } catch (error: any) {
    return { error: error?.message || "Failed to get pay rules", data: null }
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
  }

  // Calculate base pay
  if (payRule.pay_type === "per_mile" && payRule.base_rate_per_mile) {
    const miles = params.totalMiles || params.loads.reduce((sum, load) => sum + (load.miles || 0), 0)
    grossPay = miles * Number(payRule.base_rate_per_mile)
    calculationDetails.base_pay = grossPay
    calculationDetails.miles_used = miles
    calculationDetails.rate_per_mile = payRule.base_rate_per_mile
  } else if (payRule.pay_type === "percentage" && payRule.base_percentage) {
    const totalLoadValue = params.loads.reduce((sum, load) => sum + (load.value || 0), 0)
    grossPay = totalLoadValue * (Number(payRule.base_percentage) / 100)
    calculationDetails.base_pay = grossPay
    calculationDetails.total_load_value = totalLoadValue
    calculationDetails.percentage = payRule.base_percentage
  } else if (payRule.pay_type === "flat" && payRule.base_flat_rate) {
    grossPay = params.loads.length * Number(payRule.base_flat_rate)
    calculationDetails.base_pay = grossPay
    calculationDetails.loads_count = params.loads.length
    calculationDetails.flat_rate = payRule.base_flat_rate
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  try {
    const { error } = await supabase.from("driver_pay_rules").delete().eq("id", ruleId)

    if (error) {
      return { error: error.message, data: null }
    }

    revalidatePath("/dashboard/accounting/settlements")
    return { data: { success: true }, error: null }
  } catch (error: any) {
    return { error: error?.message || "Failed to delete pay rule", data: null }
  }
}



