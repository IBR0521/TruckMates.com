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

const VALID_TABS = [
  "analytics",
  "revenue",
  "profit-loss",
  "driver-payments",
  "detention",
  "fuel",
  "on-time-delivery",
  "year-end",
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
      <TabsList className="mx-4 md:mx-8 mt-4 grid w-fit grid-cols-4">
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="revenue">Revenue</TabsTrigger>
        <TabsTrigger value="profit-loss">P&amp;L</TabsTrigger>
        <TabsTrigger value="driver-payments">Payments</TabsTrigger>
      </TabsList>

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

      {/* Second row of tabs (rest of the reports suite) */}
      <TabsList className="mx-4 md:mx-8 mt-4 grid w-fit grid-cols-4">
        <TabsTrigger value="detention">Detention</TabsTrigger>
        <TabsTrigger value="fuel">Fuel</TabsTrigger>
        <TabsTrigger value="on-time-delivery">On-Time</TabsTrigger>
        <TabsTrigger value="year-end">Year-End Tax</TabsTrigger>
      </TabsList>

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
    </Tabs>
  )
}

