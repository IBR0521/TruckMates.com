"use client"

import { Card } from "@/components/ui/card"
import { Package, Camera, FileText, MapPin } from "lucide-react"
import { useState, useEffect } from "react"
import { getCurrentUser } from "@/app/actions/user"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function DriverDashboard() {
  const [nextLoad, setNextLoad] = useState<any | null>(null)
  const [eldHistory, setEldHistory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    try {
      const userResult = await getCurrentUser()
      if (userResult.data?.id) {
        const supabase = createClient()

        // Get driver's assigned loads (only their specific assignment)
        const { data: loads } = await supabase
          .from("loads")
          .select("*")
          .eq("driver_id", userResult.data.id)
          .in("status", ["scheduled", "in_transit", "picked_up"])
          .order("pickup_date", { ascending: true })
          .limit(1)
          .single()

        setNextLoad(loads)

        // Get driver's 8-day ELD history
        const eightDaysAgo = new Date()
        eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)

        const { data: eld } = await supabase
          .from("eld_logs")
          .select("*")
          .eq("driver_id", userResult.data.id)
          .gte("date", eightDaysAgo.toISOString().split("T")[0])
          .order("date", { ascending: false })
          .limit(8)

        setEldHistory(eld || [])
      }
    } catch (error) {
      console.error("Error loading driver dashboard:", error)
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
        <h1 className="text-3xl font-bold text-foreground mb-2">My Dashboard</h1>
        <p className="text-muted-foreground">Your assigned loads and tasks</p>
      </div>

      {/* My Next Load */}
      <Card className="border-border bg-card/50 p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">My Next Load</h2>
        {nextLoad ? (
          <div className="space-y-4">
            <div className="p-4 bg-secondary/30 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <Package className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {nextLoad.shipment_number || nextLoad.id}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{nextLoad.status}</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pickup</p>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">{nextLoad.origin}</p>
                  </div>
                  {nextLoad.pickup_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(nextLoad.pickup_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Delivery</p>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-400" />
                    <p className="text-sm font-medium text-foreground">{nextLoad.destination}</p>
                  </div>
                  {nextLoad.estimated_delivery && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(nextLoad.estimated_delivery).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <Link href={`/dashboard/loads/${nextLoad.id}`}>
              <Button className="w-full">View Load Details</Button>
            </Link>
          </div>
        ) : (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">No assigned loads</p>
          </div>
        )}
      </Card>

      {/* Document Scanner */}
      <Card className="border-border bg-card/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Document Scanner</h2>
          <Link href="/dashboard/documents/upload">
            <Button variant="outline" size="sm">
              <Camera className="w-4 h-4 mr-2" />
              Upload POD
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Quick access to upload Proof of Delivery (POD) documents for AI processing.
        </p>
      </Card>

      {/* Personal ELD Log */}
      <Card className="border-border bg-card/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">My ELD History (8 Days)</h2>
          <Link href="/dashboard/eld">
            <Button variant="outline" size="sm">View Full Log</Button>
          </Link>
        </div>
        <div className="space-y-3">
          {eldHistory.length > 0 ? (
            eldHistory.map((log: any) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {log.date ? new Date(log.date).toLocaleDateString() : "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Drive: {log.drive_hours || 0}h | On-Duty: {log.on_duty_hours || 0}h
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {log.status || "Available"}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No ELD history</p>
          )}
        </div>
      </Card>
    </div>
  )
}

