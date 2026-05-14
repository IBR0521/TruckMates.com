import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getCachedAuthContext } from "@/lib/auth/server"
import { checkFeatureAccess } from "@/lib/plan-enforcement"
import { getLoad } from "@/app/actions/loads"
import { createClient } from "@/lib/supabase/server"
import { TripReplayClient } from "@/components/trips/trip-replay-client"

type LoadRow = {
  company_id: string
  shipment_number?: string | null
  origin?: string | null
  destination?: string | null
  load_date?: string | null
  actual_delivery?: string | null
  driver_id?: string | null
  truck_id?: string | null
}

export default async function LoadTripReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    redirect("/login")
  }
  const gate = await checkFeatureAccess({ companyId: ctx.companyId, feature: "trip_replay" })
  if (!gate.allowed) {
    redirect(`/dashboard/loads/${id}`)
  }

  const lr = await getLoad(id)
  if (lr.error || !lr.data) notFound()
  const load = lr.data as LoadRow
  if (load.company_id !== ctx.companyId) notFound()

  const supabase = await createClient()
  let driverLabel: string | null = null
  let truckLabel: string | null = null
  const driverId = load.driver_id ? String(load.driver_id) : null
  const truckId = load.truck_id ? String(load.truck_id) : null
  if (driverId) {
    const { data: d } = await supabase
      .from("drivers")
      .select("name")
      .eq("id", driverId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()
    driverLabel = typeof d?.name === "string" ? d.name : null
  }
  if (truckId) {
    const { data: t } = await supabase
      .from("trucks")
      .select("truck_number")
      .eq("id", truckId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()
    truckLabel = typeof t?.truck_number === "string" ? t.truck_number : null
  }

  const banner = {
    shipment_number: load.shipment_number ?? "",
    origin: load.origin ?? "",
    destination: load.destination ?? "",
    load_date: load.load_date ?? null,
    actual_delivery: load.actual_delivery ?? null,
    driverLabel,
    truckLabel,
  }

  return (
    <div>
      <div className="px-4 pt-3 text-xs text-muted-foreground">
        <Link href={`/dashboard/loads/${id}`} className="text-primary hover:underline">
          ← Load detail
        </Link>
      </div>
      <TripReplayClient loadId={id} banner={banner} />
    </div>
  )
}
