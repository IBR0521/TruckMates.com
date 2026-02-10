"use client"

import { Card } from "@/components/ui/card"
import { AlertTriangle, FileCheck, Wrench, Calendar } from "lucide-react"
import { useState, useEffect } from "react"
import { getCurrentUser } from "@/app/actions/user"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function SafetyComplianceDashboard() {
  const [hosViolations, setHosViolations] = useState<any[]>([])
  const [documentExpiry, setDocumentExpiry] = useState<any[]>([])
  const [maintenanceLog, setMaintenanceLog] = useState<any[]>([])
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

        // Get HOS violations from ELD (placeholder - implement when ELD is ready)
        const { data: violations } = await supabase
          .from("eld_events")
          .select("*")
          .eq("company_id", userResult.data.company_id)
          .eq("violation", true)
          .order("created_at", { ascending: false })
          .limit(10)

        setHosViolations(violations || [])

        // Get document expiry alerts (CDLs, Insurance, IFTA)
        const now = new Date()
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

        // Driver CDLs
        const { data: drivers } = await supabase
          .from("drivers")
          .select("id, name, license_expiry")
          .eq("company_id", userResult.data.company_id)
          .not("license_expiry", "is", null)
          .lte("license_expiry", thirtyDaysFromNow.toISOString().split("T")[0])

        // Vehicle insurance
        const { data: vehicles } = await supabase
          .from("trucks")
          .select("id, truck_number, insurance_expiry_date")
          .eq("company_id", userResult.data.company_id)
          .not("insurance_expiry_date", "is", null)
          .lte("insurance_expiry_date", thirtyDaysFromNow.toISOString().split("T")[0])

        const expiryAlerts = [
          ...(drivers || []).map((d: any) => ({
            type: "CDL",
            name: d.name,
            expiry: d.license_expiry,
            id: d.id,
          })),
          ...(vehicles || []).map((v: any) => ({
            type: "Insurance",
            name: v.truck_number,
            expiry: v.insurance_expiry_date,
            id: v.id,
          })),
        ].sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime())

        setDocumentExpiry(expiryAlerts.slice(0, 10))

        // Get upcoming maintenance
        const { data: maintenance } = await supabase
          .from("maintenance")
          .select("*")
          .eq("company_id", userResult.data.company_id)
          .in("status", ["scheduled", "overdue"])
          .order("scheduled_date", { ascending: true })
          .limit(10)

        setMaintenanceLog(maintenance || [])
      }
    } catch (error) {
      console.error("Error loading safety compliance dashboard:", error)
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
        <h1 className="text-3xl font-bold text-foreground mb-2">Safety & Compliance</h1>
        <p className="text-muted-foreground">ELD service, inspections, and regulatory compliance</p>
      </div>

      {/* HOS Violation Alerts */}
      <Card className="border-border bg-card/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">HOS Violation Alerts</h2>
          <Link href="/dashboard/eld">
            <Button variant="outline" size="sm">View ELD Logs</Button>
          </Link>
        </div>
        <div className="space-y-3">
          {hosViolations.length > 0 ? (
            hosViolations.map((violation: any) => (
              <div
                key={violation.id}
                className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Driver: {violation.driver_id || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {violation.event_type || "HOS Violation"}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-red-400 font-medium">Violation</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No violations detected</p>
          )}
        </div>
      </Card>

      {/* Document Expiry */}
      <Card className="border-border bg-card/50 p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Document Expiry Alerts</h2>
        <div className="space-y-3">
          {documentExpiry.length > 0 ? (
            documentExpiry.map((doc: any, index: number) => {
              const daysUntilExpiry = Math.ceil(
                (new Date(doc.expiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              )
              return (
                <div
                  key={`${doc.type}-${doc.id}-${index}`}
                  className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <FileCheck className="w-4 h-4 text-yellow-400" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {doc.type}: {doc.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Expires: {new Date(doc.expiry).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-yellow-400 font-medium">
                    {daysUntilExpiry} days
                  </span>
                </div>
              )
            })
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No documents expiring soon
            </p>
          )}
        </div>
      </Card>

      {/* Maintenance Log */}
      <Card className="border-border bg-card/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Maintenance Log</h2>
          <Link href="/dashboard/maintenance">
            <Button variant="outline" size="sm">View All Maintenance</Button>
          </Link>
        </div>
        <div className="space-y-3">
          {maintenanceLog.length > 0 ? (
            maintenanceLog.map((maint: any) => (
              <div
                key={maint.id}
                className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Wrench className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{maint.service_type}</p>
                    <p className="text-xs text-muted-foreground">
                      Scheduled:{" "}
                      {maint.scheduled_date
                        ? new Date(maint.scheduled_date).toLocaleDateString()
                        : "TBD"}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    maint.status === "overdue"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-yellow-500/20 text-yellow-400"
                  }`}
                >
                  {maint.status}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No upcoming maintenance
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}

