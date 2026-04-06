"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { getELDEvents } from "@/app/actions/eld"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ELDDevicesPage from "@/app/dashboard/eld/devices/page"
import ELDHealthPage from "@/app/dashboard/eld/health/page"
import ELDInsightsPage from "@/app/dashboard/eld/insights/page"
import { EldLogsTab } from "@/components/eld/eld-logs-tab"
import ELDViolationsPage from "@/app/dashboard/eld/violations/page"
import { FleetHosDashboard } from "@/components/eld/fleet-hos-dashboard"

export function FleetEldPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [events, setEvents] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const tabParam = (searchParams.get("tab") || "overview").toLowerCase()
  const activeTab = ["overview", "devices", "logs", "violations", "health", "insights"].includes(tabParam)
    ? tabParam
    : "overview"

  async function loadData() {
    try {
      const eventsResult = await getELDEvents({ resolved: false, event_type: "hos_violation" })
      if (eventsResult.data) {
        setEvents(eventsResult.data)
      }
    } catch (error) {
      toast.error("Failed to load ELD data")
    }
  }

  return (
    <div className="relative w-full bg-background">
      {/* Opaque cover to ensure any underlying decorative/background layer can't show through */}
      <div className="absolute inset-0 bg-background -z-10" aria-hidden="true" />

      <Tabs
        value={activeTab}
        onValueChange={(value) => router.push(`/dashboard/eld?tab=${encodeURIComponent(value)}`)}
        className="w-full relative z-10"
      >
        <TabsList className="mx-4 md:mx-8 mt-4 flex h-auto w-full max-w-5xl flex-wrap gap-1 rounded-md bg-muted/40 p-1">
          <TabsTrigger value="overview" className="shrink-0">
            Overview
          </TabsTrigger>
          <TabsTrigger value="devices" className="shrink-0">
            Devices
          </TabsTrigger>
          <TabsTrigger value="logs" className="shrink-0">
            Logs
          </TabsTrigger>
          <TabsTrigger value="violations" className="shrink-0">
            Violations
          </TabsTrigger>
          <TabsTrigger value="health" className="shrink-0">
            Health
          </TabsTrigger>
          <TabsTrigger value="insights" className="shrink-0">
            Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <div className="w-full bg-background">
            <div className="border-b border-border bg-card px-4 py-4 md:px-8">
              <h1 className="text-2xl font-bold text-foreground">ELD Service</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Overview shows driver HOS only. Device hardware lives on the Devices tab; the 24-hour log grid is on
                the Logs tab.
              </p>
            </div>

            <div className="p-4 md:p-8">
              <div className="mx-auto max-w-7xl space-y-6">
                {events && events.length > 0 && (
                  <Card className="border-yellow-500/20 bg-yellow-500/10 p-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">Active HOS violations</h3>
                        <p className="text-sm text-muted-foreground">
                          {events.length} unresolved violation{events.length !== 1 ? "s" : ""} require attention
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/dashboard/eld?tab=violations">View violations</Link>
                      </Button>
                    </div>
                  </Card>
                )}

                <FleetHosDashboard />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="devices">
          <div className="w-full bg-background">
            <ELDDevicesPage />
          </div>
        </TabsContent>
        <TabsContent value="logs">
          <div className="w-full bg-background">
            <EldLogsTab embeddedInEldShell />
          </div>
        </TabsContent>
        <TabsContent value="violations">
          <div className="w-full bg-background">
            <ELDViolationsPage />
          </div>
        </TabsContent>
        <TabsContent value="health">
          <div className="w-full bg-background">
            <ELDHealthPage />
          </div>
        </TabsContent>
        <TabsContent value="insights">
          <div className="w-full bg-background">
            <ELDInsightsPage />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
