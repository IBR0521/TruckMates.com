"use client"

import { Card } from "@/components/ui/card"
import { Package, FileText, Clock, Eye } from "lucide-react"
import { useState, useEffect } from "react"
import { getCurrentUser } from "@/app/actions/user"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function DispatcherDashboard() {
  const [activeLoads, setActiveLoads] = useState<any[]>([])
  const [aiDocuments, setAiDocuments] = useState<any[]>([])
  const [driverHOS, setDriverHOS] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    try {
      const userResult = await getCurrentUser()
      if (userResult.data?.company_id) {
        const supabase = createClient()

        // Get active and upcoming loads only
        const { data: loads } = await supabase
          .from("loads")
          .select("*")
          .eq("company_id", userResult.data.company_id)
          .in("status", ["scheduled", "in_transit", "picked_up"])
          .order("pickup_date", { ascending: true })
          .limit(10)

        setActiveLoads(loads || [])

        // Get AI processed documents (Rate Cons) for review
        const { data: documents } = await supabase
          .from("documents")
          .select("*")
          .eq("company_id", userResult.data.company_id)
          .eq("processed_by_ai", true)
          .eq("review_status", "pending")
          .order("created_at", { ascending: false })
          .limit(10)

        setAiDocuments(documents || [])

        // Get driver HOS data (remaining drive time)
        const { data: drivers } = await supabase
          .from("drivers")
          .select("id, name, status")
          .eq("company_id", userResult.data.company_id)
          .eq("status", "active")
          .limit(10)

        // Get ELD data for HOS calculation (placeholder - implement when ELD is ready)
        const driverHOSData = (drivers || []).map((driver: any) => ({
          ...driver,
          remainingHours: 11, // Placeholder - calculate from ELD
          status: "available",
        }))

        setDriverHOS(driverHOSData)
      }
    } catch (error) {
      console.error("Error loading dispatcher dashboard:", error)
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
        <h1 className="text-3xl font-bold text-foreground mb-2">Dispatcher Dashboard</h1>
        <p className="text-muted-foreground">Real-time movement and AI document processing</p>
      </div>

      {/* Active Load Board */}
      <Card className="border-border bg-card/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Active Load Board</h2>
          <Link href="/dashboard/loads">
            <Button variant="outline" size="sm">View All Loads</Button>
          </Link>
        </div>
        <div className="space-y-3">
          {activeLoads.length > 0 ? (
            activeLoads.map((load: any) => (
              <div
                key={load.id}
                className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Package className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {load.shipment_number || load.id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {load.origin} → {load.destination}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {load.total_rate ? (
                      <>
                        <Eye className="w-3 h-3 inline mr-1" />
                        Rate: $***
                      </>
                    ) : (
                      "No rate"
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{load.status}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No active loads</p>
          )}
        </div>
      </Card>

      {/* AI Document Inbox */}
      <Card className="border-border bg-card/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">AI Document Inbox</h2>
          <Link href="/dashboard/documents">
            <Button variant="outline" size="sm">View All Documents</Button>
          </Link>
        </div>
        <div className="space-y-3">
          {aiDocuments.length > 0 ? (
            aiDocuments.map((doc: any) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{doc.name || "Document"}</p>
                    <p className="text-xs text-muted-foreground">AI Processed - Needs Review</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Review</Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No documents pending review
            </p>
          )}
        </div>
      </Card>

      {/* Driver HOS Clock */}
      <Card className="border-border bg-card/50 p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Driver HOS Status</h2>
        <div className="space-y-3">
          {driverHOS.length > 0 ? (
            driverHOS.map((driver: any) => (
              <div
                key={driver.id}
                className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{driver.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {driver.remainingHours}h remaining drive time
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    driver.remainingHours > 4
                      ? "bg-green-500/20 text-green-400"
                      : driver.remainingHours > 2
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {driver.status}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No active drivers</p>
          )}
        </div>
      </Card>
    </div>
  )
}

