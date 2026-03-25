"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ArrowLeft, Calculator } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TripPlanningEstimatorPanel } from "@/components/trip-planning-estimator-panel"
import { useEffect } from "react"

export default function IFTATripPlanningPage() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (pathname === "/dashboard/ifta/trip-planning") {
      router.replace("/dashboard/ifta?tab=trip-planning")
    }
  }, [pathname, router])

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <Link href="/dashboard/ifta">
          <Button variant="ghost" size="sm" className="mb-3">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to IFTA
          </Button>
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <Calculator className="w-7 h-7 text-primary" />
          Trip planning
        </h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
          Same engine as on a load: truck routing, miles by state, fuel &amp; toll estimates. Results are{" "}
          <strong className="text-foreground">not saved</strong> here — open a shipment and use{" "}
          <strong className="text-foreground">Calculate &amp; save</strong> on the load to store the estimate.
        </p>
      </div>

      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <TripPlanningEstimatorPanel idPrefix="ifta-standalone-tpe" />
      </div>
    </div>
  )
}
