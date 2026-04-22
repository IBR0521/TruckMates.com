"use client"

import { Button } from "@/components/ui/button"
import {
  Fuel,
  Wrench,
  User,
  Truck,
  FileText,
  MapPin,
  Navigation,
  ClipboardList,
  Route,
  ShieldCheck,
  Package,
  MoreHorizontal,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { getTruck } from "@/app/actions/trucks"
import { getDriver } from "@/app/actions/drivers"
import { toast } from "sonner"
import { 
  DetailPageLayout, 
  DetailSection, 
} from "@/components/dashboard/detail-page-layout"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const aliveRef = useRef(true)
  const [truck, setTruck] = useState<any>(null)
  const [driver, setDriver] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    return () => {
      aliveRef.current = false
    }
  }, [])

  useEffect(() => {
    if (id === "add") {
      router.replace("/dashboard/trucks/add")
      return
    }
    loadTruck()
  }, [id, router])

  async function loadTruck() {
    setIsLoading(true)
    try {
      const result = await getTruck(id)
      if (result.error) {
        toast.error(result.error)
        if (aliveRef.current) router.push("/dashboard/trucks")
        return
      }
      setTruck(result.data)

      // Load driver if assigned
      if (result.data?.current_driver_id) {
        const driverResult = await getDriver(result.data.current_driver_id)
        if (driverResult.data) {
          setDriver(driverResult.data)
        }
      }
    } catch (error: unknown) {
      toast.error("Failed to load truck details")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <DetailPageLayout
        title="Loading..."
        backUrl="/dashboard/trucks"
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading vehicle details...</p>
        </div>
      </DetailPageLayout>
    )
  }

  if (!truck) {
    return (
      <DetailPageLayout
        title="Vehicle Not Found"
        backUrl="/dashboard/trucks"
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">Vehicle not found.</p>
        </div>
      </DetailPageLayout>
    )
  }

  const getStatusChipClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case "available":
        return "bg-emerald-500 text-white"
      case "in_use":
        return "bg-blue-600 text-white"
      case "maintenance":
        return "bg-amber-500 text-black"
      case "out_of_service":
        return "bg-zinc-600 text-white"
      default:
        return "bg-zinc-500 text-white"
    }
  }

  const getDeadlineHealth = (value: string | null | undefined) => {
    if (!value) return { label: "Not set", className: "text-muted-foreground", pill: "border-border/60 bg-muted/20 text-muted-foreground", days: null as number | null }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return { label: "Invalid", className: "text-muted-foreground", pill: "border-border/60 bg-muted/20 text-muted-foreground", days: null as number | null }
    const now = new Date()
    const days = Math.ceil((date.getTime() - now.getTime()) / 86400000)
    if (days < 0) return { label: "Expired", className: "text-red-300", pill: "border-red-500/30 bg-red-500/10 text-red-300", days }
    if (days <= 30) return { label: `${days}d left`, className: "text-red-300", pill: "border-red-500/30 bg-red-500/10 text-red-300", days }
    if (days <= 60) return { label: `${days}d left`, className: "text-amber-300", pill: "border-amber-500/30 bg-amber-500/10 text-amber-300", days }
    return { label: "Valid", className: "text-emerald-300", pill: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", days }
  }

  const licenseHealth = getDeadlineHealth(truck.license_expiry || truck.license_expiry_date)
  const inspectionHealth = getDeadlineHealth(truck.inspection_expiry || truck.inspection_date)
  const insuranceHealth = getDeadlineHealth(truck.insurance_expiry)
  const iftaHealth = getDeadlineHealth(truck.ifta_decal_expiry)
  const lastSeenTime = truck.last_gps_at || truck.last_seen_at || truck.updated_at
  const lastSeenLabel = lastSeenTime ? new Date(lastSeenTime).toLocaleString() : "Unknown"

  const maintenanceHealthScore = [
    licenseHealth.days === null ? 0 : licenseHealth.days > 0 ? 1 : 0,
    inspectionHealth.days === null ? 0 : inspectionHealth.days > 0 ? 1 : 0,
    insuranceHealth.days === null ? 0 : insuranceHealth.days > 0 ? 1 : 0,
  ]
  const maintenanceHealth = Math.round((maintenanceHealthScore.reduce((a, b) => a + b, 0) / maintenanceHealthScore.length) * 100)
  const maintenanceTone =
    maintenanceHealth >= 80 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : maintenanceHealth >= 50 ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
    : "border-red-500/30 bg-red-500/10 text-red-300"

  const vehicleTypeLabel = truck.vehicle_type || truck.body_type || truck.load_type || "Truck"

  return (
    <DetailPageLayout
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
            {vehicleTypeLabel.toLowerCase().includes("box") ? <Package className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <div className="truncate">{truck.truck_number || "Vehicle Details"}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusChipClass(truck.status)}`}>
                {truck.status?.replace("_", " ") || "Unknown"}
              </span>
              {driver?.id ? (
                <Link href={`/dashboard/drivers/${driver.id}`} className="text-xs text-primary hover:underline">
                  Assigned to: {driver.name || "Driver"}
                </Link>
              ) : (
                <span className="text-xs text-muted-foreground">Unassigned driver</span>
              )}
            </div>
          </div>
        </div>
      }
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2 text-xs md:text-sm">
          <span>{truck.make && truck.model ? `${truck.make} ${truck.model}` : "Vehicle profile"}</span>
          <span className="text-muted-foreground/70">•</span>
          <span>{truck.current_location || truck.last_known_address || "Location unavailable"}</span>
          <span className="text-muted-foreground/70">•</span>
          <span>Last seen: {lastSeenLabel}</span>
        </span>
      }
      backUrl="/dashboard/trucks"
      editUrl={`/dashboard/trucks/${id}/edit`}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 border-border/70 bg-transparent">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/dashboard/fleet-map">
                <Navigation className="mr-2 h-4 w-4" />
                View on Fleet Map
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/maintenance/add">
                <Wrench className="mr-2 h-4 w-4" />
                Log Maintenance
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/dvir">
                <ClipboardList className="mr-2 h-4 w-4" />
                View DVIR Reports
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/drivers">
                <User className="mr-2 h-4 w-4" />
                Assign Driver
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <div className="space-y-6">
          <DetailSection title="Basic Information" icon={<Truck className="w-5 h-5" />} className="border-border/70 bg-card/80">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Truck Number</p>
                <p className="mt-1 text-base text-foreground">{truck.truck_number || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Make / Model</p>
                <p className="mt-1 text-base text-foreground">{truck.make || "—"} {truck.model || ""}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">VIN</p>
                <p className="mt-1 font-mono text-sm text-foreground">{truck.vin || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">License Plate</p>
                <p className="mt-1 text-base text-foreground">{truck.license_plate || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Registration State</p>
                <p className="mt-1 text-base text-foreground">{truck.registration_state || truck.license_state || "Not set"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">GVW</p>
                <p className="mt-1 text-base text-foreground">
                  {truck.gross_vehicle_weight ? `${truck.gross_vehicle_weight.toLocaleString()} lbs` : "Not set"}
                </p>
              </div>
            </div>
          </DetailSection>

          <DetailSection title="Assignment" icon={<User className="w-5 h-5" />} className="border-border/70 bg-card/80">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-border/60 bg-muted/10 p-3">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Current Driver</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {driver?.id ? (
                    <Link href={`/dashboard/drivers/${driver.id}`} className="text-primary hover:underline">
                      {driver.name || "Assigned Driver"}
                    </Link>
                  ) : "Unassigned"}
                </p>
                {driver?.phone && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <a href={`tel:${driver.phone}`} className="hover:underline">{driver.phone}</a>
                  </p>
                )}
              </div>
              <div className="rounded-md border border-border/60 bg-muted/10 p-3">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Current Route / Load</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {truck.current_route_name || truck.current_load_number || "No active assignment"}
                </p>
                {!driver?.id && (
                  <Link href="/dashboard/drivers" className="mt-2 inline-block">
                    <Button size="sm" variant="outline" className="h-8 border-border/70 bg-transparent">
                      Assign Driver
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </DetailSection>

          <DetailSection title="Fuel & Mileage" icon={<Fuel className="w-5 h-5" />} className="border-border/70 bg-card/80">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Fuel Level</p>
                <div className="mt-2 space-y-2">
                  <span className="text-2xl font-bold text-foreground">{truck.fuel_level ?? "—"}%</span>
                  <div className="h-2 w-full rounded-full bg-secondary">
                    <div
                      className={`h-2 rounded-full ${
                        (truck.fuel_level ?? 0) > 50 ? "bg-green-500" :
                        (truck.fuel_level ?? 0) > 25 ? "bg-yellow-500" : "bg-red-500"
                      }`}
                      style={{ width: `${truck.fuel_level ?? 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last filled: {truck.last_fueled_at ? new Date(truck.last_fueled_at).toLocaleString() : "Not recorded"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Mileage</p>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {truck.mileage ? `${parseInt(truck.mileage).toLocaleString()} miles` : "Not set"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Last service at: {truck.last_service_mileage ? `${Number(truck.last_service_mileage).toLocaleString()} mi` : "Not recorded"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Next oil change in: {truck.next_oil_change_miles ? `${Number(truck.next_oil_change_miles).toLocaleString()} mi` : "Not configured"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Avg MPG: {truck.average_mpg ?? truck.mpg_average ?? "Not available"}
                </p>
              </div>
            </div>
          </DetailSection>

          <DetailSection
            title="Maintenance Status"
            icon={<Wrench className="w-5 h-5" />}
            className="border-border/70 bg-card/80"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Last Service</p>
                <p className="mt-1 text-sm text-foreground">
                  {truck.last_maintenance_date ? new Date(truck.last_maintenance_date).toLocaleDateString() : "Not recorded"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Next Service</p>
                <p className="mt-1 text-sm text-foreground">
                  {truck.next_service_date ? new Date(truck.next_service_date).toLocaleDateString() : "Not scheduled"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Open Work Orders</p>
                <p className="mt-1 text-sm text-foreground">{truck.open_work_orders ?? "0"}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/dashboard/maintenance">
                <Button variant="outline" size="sm" className="h-8 border-border/70 bg-transparent">View Maintenance History</Button>
              </Link>
              <Link href="/dashboard/maintenance/add">
                <Button size="sm" className="h-8">Create Work Order</Button>
              </Link>
            </div>
          </DetailSection>

          <DetailSection title="Registration & Compliance" icon={<ShieldCheck className="w-5 h-5" />} className="border-border/70 bg-card/80">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Registration</p>
                <p className={`mt-1 text-sm ${licenseHealth.className}`}>
                  {(truck.license_expiry || truck.license_expiry_date) ? new Date(truck.license_expiry || truck.license_expiry_date).toLocaleDateString() : "Not set"}
                </p>
                <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] ${licenseHealth.pill}`}>{licenseHealth.label}</span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Annual Inspection</p>
                <p className={`mt-1 text-sm ${inspectionHealth.className}`}>
                  {(truck.inspection_expiry || truck.inspection_date) ? new Date(truck.inspection_expiry || truck.inspection_date).toLocaleDateString() : "Not set"}
                </p>
                <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] ${inspectionHealth.pill}`}>{inspectionHealth.label}</span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Insurance</p>
                <p className={`mt-1 text-sm ${insuranceHealth.className}`}>
                  {truck.insurance_expiry ? new Date(truck.insurance_expiry).toLocaleDateString() : "Not set"}
                </p>
                <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] ${insuranceHealth.pill}`}>{insuranceHealth.label}</span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">IFTA Decal</p>
                <p className={`mt-1 text-sm ${iftaHealth.className}`}>
                  {truck.ifta_decal_expiry ? new Date(truck.ifta_decal_expiry).toLocaleDateString() : "Not set"}
                </p>
                <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] ${iftaHealth.pill}`}>{iftaHealth.label}</span>
              </div>
            </div>
          </DetailSection>

          {truck.notes && (
            <DetailSection title="Notes" icon={<FileText className="w-5 h-5" />} className="border-border/70 bg-card/80">
              <p className="whitespace-pre-wrap text-sm text-foreground">{truck.notes}</p>
            </DetailSection>
          )}
      </div>
    </DetailPageLayout>
  )
}
