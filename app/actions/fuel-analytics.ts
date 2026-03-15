"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

/**
 * Get fuel analytics for a truck or all trucks
 */
export async function getFuelAnalytics(filters?: {
  truck_id?: string
  start_date?: string
  end_date?: string
}) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // Build query for fuel expenses with pagination/limit to prevent OOM
    let fuelQuery = supabase
      .from("expenses")
      .select("id, amount, date, mileage, truck_id, description, gallons, price_per_gallon")
      .eq("company_id", ctx.companyId)
      .eq("category", "fuel")
      .order("date", { ascending: false })
      .limit(10000) // Cap at 10k rows to prevent memory exhaustion

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
      .eq("company_id", ctx.companyId)

    if (filters?.truck_id) {
      trucksQuery = trucksQuery.eq("id", filters.truck_id)
    }

    const { data: trucks, error: trucksError } = await trucksQuery

    if (trucksError) {
      return { error: trucksError.message, data: null }
    }

    // Calculate analytics
    const expenses = fuelExpenses || []
    const totalFuelCost = expenses.reduce((sum: number, e: { id: string; amount: string | number; date: string; mileage: number | null; truck_id: string | null; description: string | null; gallons: number | string | null; price_per_gallon: number | string | null }) => sum + (parseFloat(String(e.amount)) || 0), 0)
    const totalFuelExpenses = expenses.length

    // Calculate MPG per truck
    const truckAnalytics: Record<string, any> = {}
    
    for (const truck of trucks || []) {
      const truckExpenses = expenses.filter((e: { id: string; amount: string | number; date: string; mileage: number | null; truck_id: string | null; description: string | null; gallons: number | string | null; price_per_gallon: number | string | null }) => e.truck_id === truck.id)
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

        if (gallons > 0 && gallons < 200 && miles > 0) { // Reasonable check: max 200 gallons per fill
          const mpg = miles / gallons
          const costPerMile = miles > 0 ? previousFuelCost / miles : 0

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
        total_fuel_cost: truckExpenses.reduce((sum: number, e: { id: string; amount: string | number; date: string; mileage: number | null; truck_id: string | null; description: string | null; gallons: number | string | null; price_per_gallon: number | string | null }) => sum + (parseFloat(String(e.amount)) || 0), 0),
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
    const filteredTrucks = allTruckAnalytics.filter(t => t.avg_mpg !== null && t.avg_mpg > 0)
    const fleetAvgMPG = filteredTrucks.length > 0
      ? filteredTrucks.reduce((sum, t) => sum + (t.avg_mpg || 0), 0) / filteredTrucks.length
      : 0
    const fleetAvgCostPerMile = fleetTotalMiles > 0 && fleetTotalCost > 0
      ? Math.round((fleetTotalCost / fleetTotalMiles) * 100) / 100
      : null

    // Fuel consumption trends (monthly)
    const monthlyTrends: Record<string, { cost: number; expenses: number; miles: number }> = {}
    
    // Group expenses by month and calculate total cost and count
    expenses.forEach((expense: { id: string; amount: string | number; date: string; mileage: number | null; truck_id: string | null; description: string | null; gallons: number | string | null; price_per_gallon: number | string | null }) => {
      const date = new Date(expense.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!monthlyTrends[monthKey]) {
        monthlyTrends[monthKey] = { cost: 0, expenses: 0, miles: 0 }
      }
      
      monthlyTrends[monthKey].cost += parseFloat(String(expense.amount)) || 0
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
          const avgMPG = mpgEntriesForMonth.length > 0 
            ? mpgEntriesForMonth.reduce((sum: number, mpg: any) => sum + mpg.mpg, 0) / mpgEntriesForMonth.length
            : 0
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

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // Get routes with their fuel expenses
    const { data: routes, error: routesError } = await supabase
      .from("routes")
      .select("id, name, origin, destination, truck_id, driver_id")
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })

    if (routesError) {
      return { error: routesError.message, data: null }
    }

    // Get fuel expenses linked to routes
    // Note: route_id might not exist in expenses table, so we'll check if it exists
    let fuelQuery = supabase
      .from("expenses")
      .select("id, amount, date, truck_id, mileage")
      .eq("company_id", ctx.companyId)
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
      const routeExpenses = (fuelExpenses || []).filter((e: { id: string; amount: string | number; date: string; mileage: number | null; truck_id: string | null; [key: string]: any }) => {
        // Match by truck if route has truck_id
        if (route.truck_id && e.truck_id === route.truck_id) {
          return true
        }
        return false
      })
      
      const totalCost = routeExpenses.reduce((sum: number, e: { id: string; amount: string | number; date: string; mileage: number | null; truck_id: string | null; [key: string]: any }) => sum + (parseFloat(String(e.amount)) || 0), 0)
      
      if (routeExpenses.length > 0) {
        routeFuelCosts[route.id] = {
          route_id: route.id,
          route_number: route.name || `Route ${route.id ? route.id.substring(0, 8) : 'Unknown'}`,
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

/**
 * Get fuel efficiency report with MPG by truck and driver
 */
export async function getFuelEfficiencyReport(filters?: {
  start_date?: string
  end_date?: string
  truck_id?: string
  driver_id?: string
}) {
  const supabase = await createClient()

  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }

  try {
    // Get fuel expenses with truck and driver info
    let fuelQuery = supabase
      .from("expenses")
      .select(`
        id,
        amount,
        date,
        mileage,
        truck_id,
        driver_id,
        gallons,
        price_per_gallon,
        trucks:truck_id(id, truck_number),
        drivers:driver_id(id, name)
      `)
      .eq("company_id", ctx.companyId)
      .eq("category", "fuel")
      .order("date", { ascending: false })

    if (filters?.truck_id) {
      fuelQuery = fuelQuery.eq("truck_id", filters.truck_id)
    }
    if (filters?.driver_id) {
      fuelQuery = fuelQuery.eq("driver_id", filters.driver_id)
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

    const expenses = fuelExpenses || []

    // Calculate by truck
    const truckEfficiency: Record<string, any> = {}
    const driverEfficiency: Record<string, any> = {}

    // Group expenses by truck
    expenses.forEach((expense: any) => {
      if (!expense.truck_id) return

      const truckId = expense.truck_id
      if (!truckEfficiency[truckId]) {
        truckEfficiency[truckId] = {
          truck_id: truckId,
          truck_number: expense.trucks?.truck_number || "Unknown",
          expenses: [],
          total_cost: 0,
          total_gallons: 0,
          total_miles: 0,
        }
      }

      truckEfficiency[truckId].expenses.push(expense)
      truckEfficiency[truckId].total_cost += parseFloat(expense.amount) || 0

      if (expense.gallons) {
        truckEfficiency[truckId].total_gallons += parseFloat(expense.gallons)
      }
    })

    // Group expenses by driver
    expenses.forEach((expense: any) => {
      if (!expense.driver_id) return

      const driverId = expense.driver_id
      if (!driverEfficiency[driverId]) {
        driverEfficiency[driverId] = {
          driver_id: driverId,
          driver_name: expense.drivers?.name || "Unknown",
          expenses: [],
          total_cost: 0,
          total_gallons: 0,
          total_miles: 0,
        }
      }

      driverEfficiency[driverId].expenses.push(expense)
      driverEfficiency[driverId].total_cost += parseFloat(expense.amount) || 0

      if (expense.gallons) {
        driverEfficiency[driverId].total_gallons += parseFloat(expense.gallons)
      }
    })

    // Calculate MPG for each truck (using consecutive fills)
    Object.values(truckEfficiency).forEach((truck: any) => {
      const sortedExpenses = [...truck.expenses].sort((a: any, b: any) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      let totalMiles = 0
      let totalGallons = 0

      for (let i = 1; i < sortedExpenses.length; i++) {
        const prev = sortedExpenses[i - 1]
        const curr = sortedExpenses[i]

        const prevMileage = prev.mileage
        const currMileage = curr.mileage

        if (!prevMileage || !currMileage) continue

        const miles = currMileage - prevMileage
        if (miles <= 0 || miles > 10000) continue

        let gallons = 0
        if (prev.gallons && prev.gallons > 0) {
          gallons = parseFloat(prev.gallons)
        } else if (prev.price_per_gallon && prev.price_per_gallon > 0) {
          gallons = (parseFloat(prev.amount) || 0) / parseFloat(prev.price_per_gallon)
        } else {
          gallons = (parseFloat(prev.amount) || 0) / 3.50 // Fallback
        }

        if (gallons > 0 && gallons < 200 && miles > 0) {
          const mpg = miles / gallons
          if (mpg >= 3 && mpg <= 15) {
            totalMiles += miles
            totalGallons += gallons
          }
        }
      }

      truck.total_miles = totalMiles
      truck.avg_mpg = totalMiles > 0 && totalGallons > 0
        ? Math.round((totalMiles / totalGallons) * 10) / 10
        : null
      truck.avg_cost_per_mile = totalMiles > 0 && truck.total_cost > 0
        ? Math.round((truck.total_cost / totalMiles) * 100) / 100
        : null
    })

    // Calculate MPG for each driver (using consecutive fills)
    Object.values(driverEfficiency).forEach((driver: any) => {
      const sortedExpenses = [...driver.expenses].sort((a: any, b: any) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      let totalMiles = 0
      let totalGallons = 0

      for (let i = 1; i < sortedExpenses.length; i++) {
        const prev = sortedExpenses[i - 1]
        const curr = sortedExpenses[i]

        const prevMileage = prev.mileage
        const currMileage = curr.mileage

        if (!prevMileage || !currMileage) continue

        const miles = currMileage - prevMileage
        if (miles <= 0 || miles > 10000) continue

        let gallons = 0
        if (prev.gallons && prev.gallons > 0) {
          gallons = parseFloat(prev.gallons)
        } else if (prev.price_per_gallon && prev.price_per_gallon > 0) {
          gallons = (parseFloat(prev.amount) || 0) / parseFloat(prev.price_per_gallon)
        } else {
          gallons = (parseFloat(prev.amount) || 0) / 3.50 // Fallback
        }

        if (gallons > 0 && gallons < 200 && miles > 0) {
          const mpg = miles / gallons
          if (mpg >= 3 && mpg <= 15) {
            totalMiles += miles
            totalGallons += gallons
          }
        }
      }

      driver.total_miles = totalMiles
      driver.avg_mpg = totalMiles > 0 && totalGallons > 0
        ? Math.round((totalMiles / totalGallons) * 10) / 10
        : null
      driver.avg_cost_per_mile = totalMiles > 0 && driver.total_cost > 0
        ? Math.round((driver.total_cost / totalMiles) * 100) / 100
        : null
    })

    // Sort and format results
    const truckResults = Object.values(truckEfficiency)
      .filter((t: any) => t.avg_mpg !== null)
      .sort((a: any, b: any) => (b.avg_mpg || 0) - (a.avg_mpg || 0))
      .map((t: any) => ({
        truck_id: t.truck_id,
        truck_number: t.truck_number,
        total_cost: Math.round(t.total_cost * 100) / 100,
        total_gallons: Math.round(t.total_gallons * 100) / 100,
        total_miles: Math.round(t.total_miles),
        avg_mpg: t.avg_mpg,
        avg_cost_per_mile: t.avg_cost_per_mile,
        expense_count: t.expenses.length,
      }))

    const driverResults = Object.values(driverEfficiency)
      .filter((d: any) => d.avg_mpg !== null)
      .sort((a: any, b: any) => (b.avg_mpg || 0) - (a.avg_mpg || 0))
      .map((d: any) => ({
        driver_id: d.driver_id,
        driver_name: d.driver_name,
        total_cost: Math.round(d.total_cost * 100) / 100,
        total_gallons: Math.round(d.total_gallons * 100) / 100,
        total_miles: Math.round(d.total_miles),
        avg_mpg: d.avg_mpg,
        avg_cost_per_mile: d.avg_cost_per_mile,
        expense_count: d.expenses.length,
      }))

    // Calculate fleet summary
    const fleetTotalCost = truckResults.reduce((sum, t) => sum + t.total_cost, 0)
    const fleetTotalMiles = truckResults.reduce((sum, t) => sum + t.total_miles, 0)
    const fleetTotalGallons = truckResults.reduce((sum, t) => sum + t.total_gallons, 0)
    const fleetAvgMPG = fleetTotalGallons > 0 && fleetTotalMiles > 0
      ? Math.round((fleetTotalMiles / fleetTotalGallons) * 10) / 10
      : null
    const fleetAvgCostPerMile = fleetTotalMiles > 0 && fleetTotalCost > 0
      ? Math.round((fleetTotalCost / fleetTotalMiles) * 100) / 100
      : null

    return {
      data: {
        summary: {
          fleet_avg_mpg: fleetAvgMPG,
          fleet_avg_cost_per_mile: fleetAvgCostPerMile,
          fleet_total_cost: Math.round(fleetTotalCost * 100) / 100,
          fleet_total_miles: Math.round(fleetTotalMiles),
          fleet_total_gallons: Math.round(fleetTotalGallons * 100) / 100,
        },
        by_truck: truckResults,
        by_driver: driverResults,
      },
      error: null,
    }
  } catch (error: any) {
    return { error: error.message || "Failed to get fuel efficiency report", data: null }
  }
}

