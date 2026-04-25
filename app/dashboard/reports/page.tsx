"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter, useSearchParams } from "next/navigation"

import AnalyticsPage from "./analytics/page"
import RevenuePage from "./revenue/page"
import ProfitLossPage from "./profit-loss/page"
import DriverPaymentsPage from "./driver-payments/page"
import DetentionPage from "./detention/page"
import OnTimeDeliveryPage from "./on-time-delivery/page"
import YearEndTaxReportPage from "./year-end/page"
import FuelEfficiencyReportPage from "./fuel-efficiency/page"
import FuelAnalyticsPage from "../fuel-analytics/page"
import ARAgingPage from "./ar-aging/page"

const VALID_TABS = [
  "analytics",
  "revenue",
  "profit-loss",
  "driver-payments",
  "detention",
  "fuel",
  "on-time-delivery",
  "year-end",
  "ar-aging",
] as const

type ReportsTab = (typeof VALID_TABS)[number]

export default function ReportsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const tabParam = (searchParams.get("tab") || "analytics").toLowerCase()
  const activeTab = (VALID_TABS as readonly string[]).includes(tabParam) ? (tabParam as ReportsTab) : "analytics"

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => router.push(`/dashboard/reports?tab=${encodeURIComponent(value)}`)}
      className="w-full"
    >
      <div className="mx-4 md:mx-8 mt-4 max-w-full overflow-x-auto pb-1 [scrollbar-width:thin]">
        <TabsList className="inline-flex h-auto min-h-9 w-max max-w-none flex-nowrap items-stretch justify-start gap-0.5 rounded-lg p-[3px]">
          <TabsTrigger className="shrink-0 flex-none px-3" value="analytics">
            Analytics
          </TabsTrigger>
          <TabsTrigger className="shrink-0 flex-none px-3" value="revenue">
            Revenue
          </TabsTrigger>
          <TabsTrigger className="shrink-0 flex-none px-3" value="profit-loss">
            P&amp;L
          </TabsTrigger>
          <TabsTrigger className="shrink-0 flex-none px-3" value="driver-payments">
            Payments
          </TabsTrigger>
          <TabsTrigger className="shrink-0 flex-none px-3" value="detention">
            Detention
          </TabsTrigger>
          <TabsTrigger className="shrink-0 flex-none px-3" value="fuel">
            Fuel
          </TabsTrigger>
          <TabsTrigger className="shrink-0 flex-none px-3" value="on-time-delivery">
            On-Time
          </TabsTrigger>
          <TabsTrigger className="shrink-0 flex-none px-3" value="year-end">
            Year-End Tax
          </TabsTrigger>
          <TabsTrigger className="shrink-0 flex-none px-3" value="ar-aging">
            AR Aging
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="analytics">
        <AnalyticsPage />
      </TabsContent>
      <TabsContent value="revenue">
        <RevenuePage />
      </TabsContent>
      <TabsContent value="profit-loss">
        <ProfitLossPage />
      </TabsContent>
      <TabsContent value="driver-payments">
        <DriverPaymentsPage />
      </TabsContent>

      <TabsContent value="detention">
        <DetentionPage />
      </TabsContent>
      <TabsContent value="fuel">
        <div className="space-y-8">
          <FuelEfficiencyReportPage />
          <FuelAnalyticsPage />
        </div>
      </TabsContent>
      <TabsContent value="on-time-delivery">
        <OnTimeDeliveryPage />
      </TabsContent>
      <TabsContent value="year-end">
        <YearEndTaxReportPage />
      </TabsContent>
      <TabsContent value="ar-aging">
        <ARAgingPage />
      </TabsContent>
    </Tabs>
  )
}

