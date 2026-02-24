"use server"

import { createClient } from "@/lib/supabase/server"
import { getAuthContext } from "@/lib/auth/server"

type Period = 'weekly' | 'monthly' | 'yearly'

/**
 * Get revenue trend data for different periods
 * Returns only plain JSON-serializable data
 */
export async function getRevenueTrend(period: Period = 'weekly') {
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
      startDate.setFullYear(now.getFullYear() - 5)
      startDate.setMonth(0, 1)
      startDate.setHours(0, 0, 0, 0)
      
      // Generate 6 years
      for (let i = 5; i >= 0; i--) {
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

    // Fetch invoices
    const { data: invoices } = await supabase
      .from("invoices")
      .select("amount, created_at, issue_date")
      .eq("company_id", companyId)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true })

    // Fetch loads as fallback
    const { data: loads } = await supabase
      .from("loads")
      .select("created_at, total_rate, value")
      .eq("company_id", companyId)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true })

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

    // Process loads
    if (loads && loads.length > 0) {
      loads.forEach((load: any) => {
        if (!load.created_at) return
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
            revenueByPeriod[periodKey] = (revenueByPeriod[periodKey] || 0) + (amount * 0.5)
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

