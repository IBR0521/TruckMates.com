"use client"

import { Card } from "@/components/ui/card"
import { Package, MapPin, Building2, TrendingUp } from "lucide-react"
import { useState, useEffect } from "react"
import { getDashboardStats } from "@/app/actions/dashboard"
import { getCurrentUser } from "@/app/actions/user"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function OperationsManagerDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [marketplaceStats, setMarketplaceStats] = useState<any>(null)
  const [yardStats, setYardStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    try {
      const dashboardResult = await getDashboardStats()
      if (dashboardResult.data) {
        setStats(dashboardResult.data)
      }

      const userResult = await getCurrentUser()
      if (userResult.data?.company_id) {
        const supabase = createClient()

        // Get marketplace stats
        const { data: marketplace } = await supabase
          .from("load_marketplace")
          .select("id, status")
          .eq("company_id", userResult.data.company_id)

        const activePostings = marketplace?.filter((l: any) => l.status === "active").length || 0
        const totalPostings = marketplace?.length || 0

        setMarketplaceStats({
          activePostings,
          totalPostings,
        })

        // Get yard management stats (placeholder - implement when yard management is ready)
        setYardStats({
          occupancy: 0,
          capacity: 0,
        })
      }
    } catch (error) {
      console.error("Error loading operations manager dashboard:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Operations Dashboard</h1>
        <p className="text-muted-foreground">Marketplace, yard management, and fleet coordination</p>
      </div>

      {/* Marketplace Status */}
      <Card className="border-border bg-card/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Marketplace Status</h2>
          <Link href="/dashboard/marketplace">
            <Button variant="outline" size="sm">View Marketplace</Button>
          </Link>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-secondary/30 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Active Load Postings</span>
              <Package className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {marketplaceStats?.activePostings || 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {marketplaceStats?.totalPostings || 0} total postings
            </p>
          </div>
          <div className="p-4 bg-secondary/30 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Incoming Bids</span>
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-foreground">0</p>
            <p className="text-xs text-muted-foreground mt-1">Pending review</p>
          </div>
        </div>
      </Card>

      {/* Yard Management */}
      <Card className="border-border bg-card/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Yard Management</h2>
          <Link href="/dashboard/yard">
            <Button variant="outline" size="sm">Manage Yard</Button>
          </Link>
        </div>
        <div className="p-4 bg-secondary/30 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Current Occupancy</span>
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div className="flex items-center gap-4">
            <p className="text-2xl font-bold text-foreground">
              {yardStats?.occupancy || 0} / {yardStats?.capacity || 0}
            </p>
            <div className="flex-1 bg-secondary/50 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full"
                style={{
                  width: `${yardStats?.capacity > 0 ? (yardStats.occupancy / yardStats.capacity) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Route Map - Global View */}
      <Card className="border-border bg-card/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Fleet GPS Overview</h2>
          <Link href="/dashboard/fleet-map">
            <Button variant="outline" size="sm">View Full Map</Button>
          </Link>
        </div>
        <div className="h-64 bg-secondary/20 rounded-lg border border-border flex items-center justify-center">
          <div className="text-center">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Global fleet GPS view</p>
            <p className="text-sm text-muted-foreground mt-1">
              {stats?.activeRoutes || 0} active routes
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

