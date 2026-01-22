"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"

/**
 * Get fuel analytics for a truck or all trucks
 */
export async function getFuelAnalytics(filters?: {
  truck_id?: string
  start_date?: string
  end_date?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id
  const companyError = result.error

  if (companyError || !company_id) {
    return { error: companyError || "No company found", data: null }
  }

  try {
    // Build query for fuel expenses
    let fuelQuery = supabase
      .from("expenses")
      .select("id, amount, date, mileage, truck_id, description, gallons, price_per_gallon")
      .eq("company_id", company_id)
      .eq("category", "fuel")
      .order("date", { ascending: false })

    // Apply filters
    if (filters?.truck_id) {
      fuelQuery = fuelQuery.eq("truck_id", filters.truck_id)
    }
    if (filters?.start_date) {
      fuelQuery = fuelQuery.gte("date", filters.start_date)
    }
    if (filters?.end_date) {
      fuelQuery = fuelQuery.lte("date", filters.end_date)
    }

    const { data: fuelExpenses, error: fuelError } = await fuelQuery

    if (fuelError) {
      return { error: fuelError.message, data: null }
    }

    // Get trucks for reference
    let trucksQuery = supabase
      .from("trucks")
      .select("id, truck_number, fuel_level, mileage")
      .eq("company_id", company_id)

    if (filters?.truck_id) {
      trucksQuery = trucksQuery.eq("id", filters.truck_id)
    }

    const { data: trucks, error: trucksError } = await trucksQuery

    if (trucksError) {
      return { error: trucksError.message, data: null }
    }

    // Calculate analytics
    const expenses = fuelExpenses || []
    const totalFuelCost = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
    const totalFuelExpenses = expenses.length

    // Calculate MPG per truck
    const truckAnalytics: Record<string, any> = {}
    
    for (const truck of trucks || []) {
      const truckExpenses = expenses.filter(e => e.truck_id === truck.id)
      if (truckExpenses.length === 0) continue

      // Sort expenses by date (oldest first)
      const sortedExpenses = [...truckExpenses].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      let totalMiles = 0
      let totalGallons = 0
      let totalCost = 0
      const mpgData: Array<{ date: string; mpg: number; cost_per_mile: number }> = []

      // Calculate MPG between consecutive fuel fills
      // We need at least 2 expenses to calculate MPG
      for (let i = 1; i < sortedExpenses.length; i++) {
        const previous = sortedExpenses[i - 1]
        const current = sortedExpenses[i]

        // Get mileage from expenses (odometer reading at time of fill)
        const previousMileage = previous.mileage
        const currentMileage = current.mileage

        // If mileage is not available, try to use truck's current mileage as fallback
        if (!previousMileage || !currentMileage) {
          // Skip this calculation if we don't have mileage data
          continue
        }

        const miles = currentMileage - previousMileage

        // Only calculate if miles are positive and reasonable (between 0 and 10000 miles)
        if (miles <= 0 || miles > 10000) {
          continue
        }

        // Get gallons from actual data (if available) or calculate from cost and price
        const previousFuelCost = parseFloat(previous.amount) || 0
        let gallons = 0
        
        // Use real gallons if available
        if (previous.gallons && previous.gallons > 0) {
          gallons = parseFloat(previous.gallons)
        } 
        // Otherwise, calculate from price_per_gallon if available
        else if (previous.price_per_gallon && previous.price_per_gallon > 0) {
          gallons = previousFuelCost / parseFloat(previous.price_per_gallon)
        }
        // Fallback: use estimated price (only if no real data available)
        else if (previousFuelCost > 0) {
          const estimatedPricePerGallon = 3.50 // Fallback estimate
          gallons = previousFuelCost / estimatedPricePerGallon
        }

        if (gallons > 0 && gallons < 200) { // Reasonable check: max 200 gallons per fill
          const mpg = miles / gallons
          const costPerMile = previousFuelCost / miles

          // Only include reasonable MPG values (between 3 and 15 MPG for trucks)
          if (mpg >= 3 && mpg <= 15) {
            totalMiles += miles
            totalGallons += gallons
            totalCost += previousFuelCost

            mpgData.push({
              date: current.date,
              mpg: Math.round(mpg * 10) / 10,
              cost_per_mile: Math.round(costPerMile * 100) / 100,
            })
          }
        }
      }

      // Calculate overall MPG
      const avgMPG = totalMiles > 0 && totalGallons > 0 
        ? Math.round((totalMiles / totalGallons) * 10) / 10 
        : null

      const avgCostPerMile = totalMiles > 0 && totalCost > 0
        ? Math.round((totalCost / totalMiles) * 100) / 100
        : null

      truckAnalytics[truck.id] = {
        truck_id: truck.id,
        truck_number: truck.truck_number,
        total_fuel_cost: truckExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0),
        total_fuel_expenses: truckExpenses.length,
        total_miles: totalMiles,
        avg_mpg: avgMPG,
        avg_cost_per_mile: avgCostPerMile,
        mpg_data: mpgData,
        fuel_expenses: truckExpenses,
      }
    }

    // Overall fleet analytics
    const allTruckAnalytics = Object.values(truckAnalytics)
    const fleetTotalMiles = allTruckAnalytics.reduce((sum, t) => sum + (t.total_miles || 0), 0)
    const fleetTotalCost = allTruckAnalytics.reduce((sum, t) => sum + (t.total_fuel_cost || 0), 0)
    const fleetAvgMPG = allTruckAnalytics
      .filter(t => t.avg_mpg !== null)
      .reduce((sum, t, _, arr) => sum + (t.avg_mpg || 0) / arr.length, 0)
    const fleetAvgCostPerMile = fleetTotalMiles > 0 && fleetTotalCost > 0
      ? Math.round((fleetTotalCost / fleetTotalMiles) * 100) / 100
      : null

    // Fuel consumption trends (monthly)
    const monthlyTrends: Record<string, { cost: number; expenses: number; miles: number }> = {}
    
    // Group expenses by month and calculate total cost and count
    expenses.forEach(expense => {
      const date = new Date(expense.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!monthlyTrends[monthKey]) {
        monthlyTrends[monthKey] = { cost: 0, expenses: 0, miles: 0 }
      }
      
      monthlyTrends[monthKey].cost += parseFloat(expense.amount) || 0
      monthlyTrends[monthKey].expenses += 1
    })

    // Calculate miles per month from truck analytics
    // Use the total_miles from each truck's analytics, grouped by month
    Object.values(truckAnalytics).forEach((truck: any) => {
      // Group fuel expenses by month to estimate miles per month
      const monthlyTruckMiles: Record<string, number> = {}
      
      truck.fuel_expenses?.forEach((expense: any, index: number) => {
        const date = new Date(expense.date)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        
        // Estimate miles for this month based on MPG data
        const mpgEntriesForMonth = truck.mpg_data?.filter((mpg: any) => {
          const mpgDate = new Date(mpg.date)
          const mpgMonthKey = `${mpgDate.getFullYear()}-${String(mpgDate.getMonth() + 1).padStart(2, '0')}`
          return mpgMonthKey === monthKey
        }) || []
        
        // If we have MPG data, estimate miles (gallons * MPG)
        // Otherwise use a rough estimate
        if (mpgEntriesForMonth.length > 0) {
          // Estimate: average MPG * estimated gallons per fill
          const avgMPG = mpgEntriesForMonth.reduce((sum: number, mpg: any) => sum + mpg.mpg, 0) / mpgEntriesForMonth.length
          const estimatedGallons = parseFloat(expense.amount) / 3.50 // Rough estimate
          monthlyTruckMiles[monthKey] = (monthlyTruckMiles[monthKey] || 0) + (avgMPG * estimatedGallons)
        } else {
          // Fallback: estimate 500 miles per fuel fill
          monthlyTruckMiles[monthKey] = (monthlyTruckMiles[monthKey] || 0) + 500
        }
      })
      
      // Add truck miles to monthly trends
      Object.entries(monthlyTruckMiles).forEach(([monthKey, miles]) => {
        if (monthlyTrends[monthKey]) {
          monthlyTrends[monthKey].miles += Math.round(miles)
        }
      })
    })

    const trends = Object.entries(monthlyTrends)
      .map(([month, data]) => ({
        month,
        cost: Math.round(data.cost * 100) / 100,
        expenses: data.expenses,
        miles: data.miles || 0, // Use 0 if no miles calculated
        avg_cost_per_mile: data.miles > 0 ? Math.round((data.cost / data.miles) * 100) / 100 : null,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))

    return {
      data: {
        summary: {
          total_fuel_cost: Math.round(totalFuelCost * 100) / 100,
          total_fuel_expenses: totalFuelExpenses,
          fleet_avg_mpg: fleetAvgMPG > 0 ? Math.round(fleetAvgMPG * 10) / 10 : null,
          fleet_avg_cost_per_mile: fleetAvgCostPerMile,
          fleet_total_miles: fleetTotalMiles,
        },
        truck_analytics: truckAnalytics,
        trends: trends,
      },
      error: null,
    }
  } catch (error: any) {
    return { error: error.message || "Failed to get fuel analytics", data: null }
  }
}

/**
 * Get fuel cost per route
 */
export async function getFuelCostPerRoute(filters?: {
  start_date?: string
  end_date?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  try {
    // Get routes with their fuel expenses
    const { data: routes, error: routesError } = await supabase
      .from("routes")
      .select("id, name, origin, destination, truck_id, driver_id")
      .eq("company_id", company_id)
      .order("created_at", { ascending: false })

    if (routesError) {
      return { error: routesError.message, data: null }
    }

    // Get fuel expenses linked to routes
    // Note: route_id might not exist in expenses table, so we'll check if it exists
    let fuelQuery = supabase
      .from("expenses")
      .select("id, amount, date, truck_id, mileage")
      .eq("company_id", company_id)
      .eq("category", "fuel")

    if (filters?.start_date) {
      fuelQuery = fuelQuery.gte("date", filters.start_date)
    }
    if (filters?.end_date) {
      fuelQuery = fuelQuery.lte("date", filters.end_date)
    }

    const { data: fuelExpenses, error: fuelError } = await fuelQuery

    if (fuelError) {
      return { error: fuelError.message, data: null }
    }

    // Calculate fuel cost per route
    // Since route_id might not be in expenses, we'll match by truck_id and date proximity
    const routeFuelCosts: Record<string, any> = {}

    for (const route of routes || []) {
      // Try to match expenses to routes by truck_id and date
      // This is approximate - ideally expenses would have route_id
      const routeExpenses = (fuelExpenses || []).filter(e => {
        // Match by truck if route has truck_id
        if (route.truck_id && e.truck_id === route.truck_id) {
          return true
        }
        return false
      })
      
      const totalCost = routeExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
      
      if (routeExpenses.length > 0) {
        routeFuelCosts[route.id] = {
          route_id: route.id,
          route_number: route.name || `Route ${route.id.substring(0, 8)}`,
          origin: route.origin || "N/A",
          destination: route.destination || "N/A",
          total_fuel_cost: Math.round(totalCost * 100) / 100,
          fuel_expenses_count: routeExpenses.length,
        }
      }
    }

    return {
      data: {
        route_fuel_costs: Object.values(routeFuelCosts),
      },
      error: null,
    }
  } catch (error: any) {
    return { error: error.message || "Failed to get fuel cost per route", data: null }
  }
}

