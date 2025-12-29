"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getELDMileageData } from "./eld"

export async function getIFTAReports() {
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

  const { data: reports, error } = await supabase
    .from("ifta_reports")
    .select("*")
    .eq("company_id", userData.company_id)
    .order("created_at", { ascending: false })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: reports, error: null }
}

export async function deleteIFTAReport(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from("ifta_reports").delete().eq("id", id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/dashboard/ifta")
  return { error: null }
}

export async function createIFTAReport(formData: {
  quarter: string
  year: number
  truck_ids: string[]
  include_eld: boolean
  period_start?: string
  period_end?: string
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

  // Calculate quarter dates
  const year = formData.year
  const quarter = formData.quarter
  let periodStart = ""
  let periodEnd = ""
  let period = ""

  if (quarter === "Q1") {
    periodStart = `${year}-01-01`
    periodEnd = `${year}-03-31`
    period = `Jan-Mar ${year}`
  } else if (quarter === "Q2") {
    periodStart = `${year}-04-01`
    periodEnd = `${year}-06-30`
    period = `Apr-Jun ${year}`
  } else if (quarter === "Q3") {
    periodStart = `${year}-07-01`
    periodEnd = `${year}-09-30`
    period = `Jul-Sep ${year}`
  } else if (quarter === "Q4") {
    periodStart = `${year}-10-01`
    periodEnd = `${year}-12-31`
    period = `Oct-Dec ${year}`
  }

  // Override with custom dates if provided
  if (formData.period_start) periodStart = formData.period_start
  if (formData.period_end) periodEnd = formData.period_end

  // Calculate total miles - use ELD data if available, otherwise use routes
  let totalMiles = 0

  if (formData.include_eld && formData.truck_ids.length > 0) {
    // Use ELD mileage data if available
    const eldResult = await getELDMileageData({
      truck_ids: formData.truck_ids,
      start_date: periodStart,
      end_date: periodEnd,
    })

    if (eldResult.data && eldResult.data.totalMiles > 0) {
      totalMiles = eldResult.data.totalMiles
    }
  }

  // If no ELD data or ELD data is insufficient, fall back to routes
  if (totalMiles === 0) {
    const { data: routes } = await supabase
      .from("routes")
      .select("distance, truck_id")
      .eq("company_id", userData.company_id)
      .in("truck_id", formData.truck_ids)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd)

    routes?.forEach((route) => {
      const distance = route.distance || "0 mi"
      const miles = parseInt(distance.replace(/[^0-9]/g, "")) || 0
      totalMiles += miles
    })
  }

  // Estimate fuel purchased (simplified calculation)
  const estimatedFuel = Math.round(totalMiles / 6.5) // Assuming 6.5 MPG average

  // Estimate tax owed (simplified - real IFTA calculation is more complex)
  const estimatedTax = totalMiles * 0.0716 // Simplified rate

  // Create state breakdown (simplified - in real app, you'd track actual state miles)
  const stateBreakdown = [
    { state: "California", miles: Math.round(totalMiles * 0.3), fuel: `${Math.round(estimatedFuel * 0.3)} gal`, tax: `$${(estimatedTax * 0.3).toFixed(2)}` },
    { state: "Texas", miles: Math.round(totalMiles * 0.4), fuel: `${Math.round(estimatedFuel * 0.4)} gal`, tax: `$${(estimatedTax * 0.4).toFixed(2)}` },
    { state: "Arizona", miles: Math.round(totalMiles * 0.2), fuel: `${Math.round(estimatedFuel * 0.2)} gal`, tax: `$${(estimatedTax * 0.2).toFixed(2)}` },
    { state: "Nevada", miles: Math.round(totalMiles * 0.1), fuel: `${Math.round(estimatedFuel * 0.1)} gal`, tax: `$${(estimatedTax * 0.1).toFixed(2)}` },
  ]

  const { data, error } = await supabase
    .from("ifta_reports")
    .insert({
      company_id: userData.company_id,
      quarter: formData.quarter,
      year: formData.year,
      period: period,
      total_miles: `${totalMiles.toLocaleString()} mi`,
      fuel_purchased: `${estimatedFuel.toLocaleString()} gal`,
      tax_owed: estimatedTax,
      status: "draft",
      truck_ids: formData.truck_ids,
      include_eld: formData.include_eld,
      state_breakdown: stateBreakdown,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath("/dashboard/ifta")
  return { data, error: null }
}

