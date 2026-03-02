"use server"

import { createClient } from "@/lib/supabase/server"
import { getAuthContext } from "@/lib/auth/server"
import { checkViewPermission } from "@/lib/server-permissions"

type Period = 'weekly' | 'monthly' | 'yearly'

/**
 * Get revenue trend data for different periods
 * Returns only plain JSON-serializable data
 */
export async function getRevenueTrend(period: Period = 'weekly') {
  // FIXED: Add RBAC check
  const permissionCheck = await checkViewPermission("reports")
  if (!permissionCheck.allowed) {
    return { data: [], error: permissionCheck.error || "You don't have permission to view reports" }
  }

  try {
    const { companyId, error: authError } = await getAuthContext()
    
    if (authError || !companyId) {
      return { data: [], error: authError || "Not authenticated" }
    }

    const supabase = await createClient()
    const now = new Date()
    let startDate = new Date()
    let dataPoints: Array<{ date: string; amount: number }> = []

    // Calculate date range based on period
    if (period === 'weekly') {
      startDate.setDate(now.getDate() - 7)
      startDate.setHours(0, 0, 0, 0)
      
      // Generate 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        date.setHours(0, 0, 0, 0)
        dataPoints.push({
          date: date.toISOString().split('T')[0],
          amount: 0
        })
      }
    } else if (period === 'monthly') {
      startDate.setMonth(now.getMonth() - 6)
      startDate.setDate(1)
      startDate.setHours(0, 0, 0, 0)
      
      // Generate 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now)
        date.setMonth(date.getMonth() - i)
        date.setDate(1)
        date.setHours(0, 0, 0, 0)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        dataPoints.push({
          date: monthKey,
          amount: 0
        })
      }
    } else if (period === 'yearly') {
      // FIXED: Generate 5 years (not 6) to match query window
      startDate.setFullYear(now.getFullYear() - 5)
      startDate.setMonth(0, 1)
      startDate.setHours(0, 0, 0, 0)
      
      // FIXED: Generate 5 data points (currentYear - 4 through currentYear), not 6
      for (let i = 4; i >= 0; i--) {
        const date = new Date(now)
        date.setFullYear(date.getFullYear() - i)
        date.setMonth(0, 1)
        date.setHours(0, 0, 0, 0)
        const yearKey = String(date.getFullYear())
        dataPoints.push({
          date: yearKey,
          amount: 0
        })
      }
    }

    // FIXED: For yearly mode, use end of current year, not current date, for consistent full-year comparison
    let endDate = now
    if (period === 'yearly') {
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999) // End of current year
    }
    
    // Fetch invoices
    const { data: invoices, error: invoicesError } = await supabase
      .from("invoices")
      .select("amount, created_at, issue_date, load_id")
      .eq("company_id", companyId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: true })

    if (invoicesError) {
      console.error("[getRevenueTrend] Error fetching invoices:", invoicesError)
    }

    // FIXED: Track which loads have invoices to prevent double-counting
    const loadIdsWithInvoices = new Set<string>()
    invoices?.forEach((inv: any) => {
      if (inv.load_id) {
        loadIdsWithInvoices.add(inv.load_id)
      }
    })
    
    // MEDIUM FIX: Add limit to prevent unbounded queries even with date range
    // Fetch loads as fallback (only for loads without invoices)
    const { data: loads, error: loadsError } = await supabase
      .from("loads")
      .select("id, created_at, total_rate, value")
      .eq("company_id", companyId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: true })
      .limit(10000) // Reasonable limit for trend analysis

    if (loadsError) {
      console.error("[getRevenueTrend] Error fetching loads:", loadsError)
    }

    // Group revenue by period
    const revenueByPeriod: Record<string, number> = {}

    // Process invoices
    if (invoices && invoices.length > 0) {
      invoices.forEach((inv: any) => {
        let date: Date | null = null
        if (inv.created_at) {
          date = new Date(inv.created_at)
        } else if (inv.issue_date) {
          date = new Date(inv.issue_date)
        }
        
        if (!date || isNaN(date.getTime())) return

        let periodKey = ''
        if (period === 'weekly') {
          periodKey = date.toISOString().split('T')[0]
        } else if (period === 'monthly') {
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        } else if (period === 'yearly') {
          periodKey = String(date.getFullYear())
        }

        if (periodKey) {
          const amount = Number(inv.amount) || 0
          if (amount > 0) {
            revenueByPeriod[periodKey] = (revenueByPeriod[periodKey] || 0) + amount
          }
        }
      })
    }

    // FIXED: Process loads - only add if no invoice exists for that load (no 0.5 factor)
    if (loads && loads.length > 0) {
      loads.forEach((load: any) => {
        if (!load.created_at) return
        // Skip if this load already has an invoice
        if (load.id && loadIdsWithInvoices.has(load.id)) {
          return
        }
        
        const date = new Date(load.created_at)
        if (isNaN(date.getTime())) return

        let periodKey = ''
        if (period === 'weekly') {
          periodKey = date.toISOString().split('T')[0]
        } else if (period === 'monthly') {
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        } else if (period === 'yearly') {
          periodKey = String(date.getFullYear())
        }

        if (periodKey) {
          const amount = Number(load.total_rate) || Number(load.value) || 0
          if (amount > 0) {
            // FIXED: Add full amount, not 0.5 - we've already filtered out loads with invoices
            revenueByPeriod[periodKey] = (revenueByPeriod[periodKey] || 0) + amount
          }
        }
      })
    }

    // Map revenue to data points
    const result = dataPoints.map(point => ({
      date: point.date,
      amount: Number(revenueByPeriod[point.date] || 0)
    }))

    return { data: result, error: null }
  } catch (error: any) {
    return { 
      data: [], 
      error: String(error?.message || error || "Failed to fetch revenue trend") 
    }
  }
}

