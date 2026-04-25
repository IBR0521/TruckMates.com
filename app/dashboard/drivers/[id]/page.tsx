"use client"

import { Button } from "@/components/ui/button"
import {
  Phone,
  Truck,
  User,
  FileText,
  GraduationCap,
  MessageSquare,
  MoreHorizontal,
  Route,
  ClipboardList,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { getDriver } from "@/app/actions/drivers"
import { getTruck } from "@/app/actions/trucks"
import { getDriverRoadsideInspectionStats } from "@/app/actions/roadside-inspections"
import { toast } from "sonner"
import { 
  DetailPageLayout, 
  DetailSection, 
  StatusBadge 
} from "@/components/dashboard/detail-page-layout"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const aliveRef = useRef(true)
  const [driver, setDriver] = useState<any>(null)
  const [truck, setTruck] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [inspectionStats, setInspectionStats] = useState<{
    total_inspections: number
    oos_rate: number
    violation_count: number
  } | null>(null)

  useEffect(() => {
    return () => {
      aliveRef.current = false
    }
  }, [])

  useEffect(() => {
    if (id === "add") {
      router.replace("/dashboard/drivers/add")
      return
    }
    loadDriver()
  }, [id, router])

  async function loadDriver() {
    setIsLoading(true)
    try {
      const result = await getDriver(id)
      if (result.error) {
        toast.error(result.error)
        if (aliveRef.current) router.push("/dashboard/drivers")
        return
      }
      setDriver(result.data)

      // Load truck if assigned
      if (result.data?.truck_id) {
        const truckResult = await getTruck(result.data.truck_id)
        if (truckResult.data) {
          setTruck(truckResult.data)
        }
      }

      const statsResult = await getDriverRoadsideInspectionStats(id)
      if (statsResult.data) {
        setInspectionStats(statsResult.data)
      }
    } catch (error: unknown) {
      toast.error("Failed to load driver details")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <DetailPageLayout
        title="Loading..."
        backUrl="/dashboard/drivers"
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading driver details...</p>
        </div>
      </DetailPageLayout>
    )
  }

  if (!driver) {
    return (
      <DetailPageLayout
        title="Driver Not Found"
        backUrl="/dashboard/drivers"
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">Driver not found.</p>
        </div>
      </DetailPageLayout>
    )
  }

  const getStatusVariant = (status: string): "success" | "default" | "info" | "warning" => {
    switch (status?.toLowerCase()) {
      case "active":
      case "on_route":
        return "success"
      case "available":
        return "info"
      case "on_break":
        return "warning"
      default:
        return "default"
    }
  }

  const getHosVariant = (hosStatus: string): "success" | "warning" | "danger" | "info" | "default" => {
    const normalized = hosStatus.toLowerCase().replace(/\s+/g, "_")
    if (normalized.includes("driv")) return "warning"
    if (normalized.includes("on_duty")) return "info"
    if (normalized.includes("off_duty")) return "default"
    if (normalized.includes("sleeper")) return "success"
    if (normalized.includes("violation")) return "danger"
    return "default"
  }

  const rawHosStatus =
    driver.hos_status ||
    driver.current_hos_status ||
    driver.eld_status ||
    "Unknown"
  const displayHosStatus = String(rawHosStatus).replace(/_/g, " ")

  const driverInitials = (driver.name || "Driver")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join("")

  const assignedTruckLabel = truck
    ? `${truck.truck_number || "Truck"}${truck.make && truck.model ? ` · ${truck.make} ${truck.model}` : ""}`
    : "No truck assigned"
  const assignedRouteLabel = driver.route_name || driver.current_route_name || "No active route"

  const contractType = driver.employee_type === "contractor" ? "1099 Contractor" : "W-2 Employee"

  const getLicenseHealth = (value: string | null | undefined) => {
    if (!value) {
      return { tone: "text-muted-foreground", badge: "bg-muted text-muted-foreground", label: "Missing", days: null as number | null }
    }
    const expiryDate = new Date(value)
    if (Number.isNaN(expiryDate.getTime())) {
      return { tone: "text-muted-foreground", badge: "bg-muted text-muted-foreground", label: "Invalid date", days: null as number | null }
    }
    const now = new Date()
    const days = Math.ceil((expiryDate.getTime() - now.getTime()) / 86400000)
    if (days < 0) {
      return { tone: "text-red-400", badge: "bg-red-500/15 text-red-300 border border-red-500/30", label: "Expired", days }
    }
    if (days <= 30) {
      return { tone: "text-red-300", badge: "bg-red-500/10 text-red-300 border border-red-500/25", label: `Expires in ${days}d`, days }
    }
    if (days <= 60) {
      return { tone: "text-amber-300", badge: "bg-amber-500/10 text-amber-300 border border-amber-500/25", label: `Expires in ${days}d`, days }
    }
    return { tone: "text-emerald-300", badge: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/25", label: "Valid", days }
  }

  const licenseHealth = getLicenseHealth(driver.license_expiry)
  const medicalCertDate =
    driver.medical_certificate_expiry ||
    driver.dot_medical_expiry ||
    driver.custom_fields?.medical_certificate_expiry ||
    driver.medical_expiry ||
    null
  const medicalHealth = getLicenseHealth(medicalCertDate)

  const complianceChecks = [
    Boolean(driver.license_number && licenseHealth.days !== null && licenseHealth.days > 0),
    Boolean(medicalHealth.days !== null && medicalHealth.days > 0),
    Boolean(rawHosStatus && !String(rawHosStatus).toLowerCase().includes("violation")),
    Boolean(driver.emergency_contact_name && driver.emergency_contact_phone),
  ]
  const complianceScore = Math.round((complianceChecks.filter(Boolean).length / complianceChecks.length) * 100)
  const complianceTone =
    complianceScore >= 80 ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
    : complianceScore >= 50 ? "bg-amber-500/10 text-amber-300 border-amber-500/25"
    : "bg-red-500/10 text-red-300 border-red-500/25"

  const denseField = (label: string, value: React.ReactNode, className?: string) => (
    <div className={className}>
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-foreground">{value || "—"}</div>
    </div>
  )

  return (
    <DetailPageLayout
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
            {driverInitials || "DR"}
          </div>
          <div className="min-w-0">
            <div className="truncate">{driver.name || "Driver Details"}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge
                status={driver.status?.replace("_", " ") || "Unknown"}
                variant={getStatusVariant(driver.status)}
              />
              <StatusBadge
                status={`HOS: ${displayHosStatus}`}
                variant={getHosVariant(displayHosStatus)}
              />
            </div>
          </div>
        </div>
      }
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2 text-xs md:text-sm">
          <span>{driver.email || "No email"}</span>
          <span className="text-muted-foreground/70">•</span>
          <span>{assignedTruckLabel}</span>
        </span>
      }
      backUrl="/dashboard/drivers"
      editUrl={`/dashboard/drivers/${id}/edit`}
      actions={
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 border-border/70 bg-transparent">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/dashboard/routes">
                  <Route className="mr-2 h-4 w-4" />
                  Assign to Route
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (driver.phone) window.location.href = `sms:${driver.phone}`
                  else toast.info("Driver phone number is missing.")
                }}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Message Driver
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/eld">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  View HOS Logs
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/drivers/${id}/onboarding`}>
                  <GraduationCap className="mr-2 h-4 w-4" />
                  View Onboarding
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <div className="space-y-4">
        <DetailSection title="Profile Information" icon={<User className="w-5 h-5" />} className="border-border/70 bg-card/80">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {denseField("Full Name", driver.name || "—")}
            {denseField("Driver ID", driver.driver_id || "—")}
            {denseField("Contract Type", contractType)}
            {denseField(
              "Email",
              driver.email ? <a href={`mailto:${driver.email}`} className="text-primary hover:underline">{driver.email}</a> : "—",
            )}
            {denseField(
              "Phone",
              driver.phone ? <a href={`tel:${driver.phone}`} className="text-primary hover:underline">{driver.phone}</a> : "—",
            )}
            {denseField("Home Terminal", driver.home_terminal || driver.base_location || [driver.city, driver.state].filter(Boolean).join(", ") || "Not set")}
            {denseField("Hire Date", driver.hire_date ? new Date(driver.hire_date).toLocaleDateString() : "Not set")}
            {denseField("Experience", driver.years_experience ? `${driver.years_experience} years` : "Not set")}
            {denseField("Language", driver.language_preference || driver.preferred_language || "Not set")}
            {denseField("Emergency Contact", driver.emergency_contact_name || "Not set")}
            {denseField(
              "Emergency Phone",
              driver.emergency_contact_phone ? (
                <a href={`tel:${driver.emergency_contact_phone}`} className="text-primary hover:underline">
                  {driver.emergency_contact_phone}
                </a>
              ) : "Not set",
            )}
            {denseField("Relationship", driver.emergency_contact_relationship || "Not set")}
            {driver.address && denseField(
              "Address",
              [driver.address, driver.city, driver.state, driver.zip].filter(Boolean).join(", "),
              "md:col-span-2 lg:col-span-3",
            )}
          </div>
        </DetailSection>

        <DetailSection title="License Information" icon={<FileText className="w-5 h-5" />} className="border-border/70 bg-card/80">
          <div className="mb-3 rounded-md border border-border/60 bg-muted/10 px-3 py-1.5 text-xs text-muted-foreground">
            Compliance Score: <span className="font-semibold text-foreground">{complianceScore}%</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {denseField("License Number", driver.license_number ? <span className="font-mono">{driver.license_number}</span> : "—")}
            {denseField("State of Issuance", driver.license_state || "—")}
            {denseField("CDL Class", driver.license_type ? driver.license_type.replace("_", " ").toUpperCase().replace("CLASS", "Class") : "—")}
            {denseField(
              "License Expiration",
              <div className="inline-flex items-center gap-2">
                <span className={licenseHealth.tone}>
                  {driver.license_expiry ? new Date(driver.license_expiry).toLocaleDateString() : "Not set"}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${licenseHealth.badge}`}>{licenseHealth.label}</span>
              </div>,
            )}
            {denseField(
              "Medical Certificate",
              <div className="inline-flex items-center gap-2">
                <span className={medicalHealth.tone}>
                  {medicalCertDate ? new Date(medicalCertDate).toLocaleDateString() : "Not set"}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${medicalHealth.badge}`}>{medicalHealth.label}</span>
              </div>,
            )}
            {denseField(
              "Endorsements",
              driver.license_endorsements ? (
                <div className="flex flex-wrap gap-2">
                  {driver.license_endorsements.split(",").map((endorsement: string, idx: number) => (
                    <span key={idx} className="rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-xs text-foreground">
                      {endorsement.trim()}
                    </span>
                  ))}
                </div>
              ) : "None listed",
            )}
          </div>
        </DetailSection>

        {(truck || driver.pay_rate || driver.notes) && (
          <DetailSection title="Assignment & Employment" icon={<Truck className="w-5 h-5" />} className="border-border/70 bg-card/80">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {denseField(
                "Assigned Truck",
                truck?.id ? <Link href={`/dashboard/trucks/${truck.id}`} className="text-primary hover:underline">{assignedTruckLabel}</Link> : assignedTruckLabel,
              )}
              {denseField("Assigned Route", assignedRouteLabel)}
              {denseField(
                "Pay Rate",
                driver.pay_rate
                  ? driver.pay_rate_type === "percentage"
                    ? `${driver.pay_rate}%`
                    : `$${parseFloat(driver.pay_rate || 0).toFixed(2)}/${driver.pay_rate_type === "hourly" ? "hr" : "mile"}`
                  : "Not set",
              )}
              {driver.notes && denseField("Notes", <span className="whitespace-pre-wrap">{driver.notes}</span>, "md:col-span-2 lg:col-span-3")}
            </div>
          </DetailSection>
        )}

        <DetailSection title="CSA Inspection Awareness" icon={<ClipboardList className="w-5 h-5" />} className="border-border/70 bg-card/80">
          <div className="grid gap-3 md:grid-cols-3">
            {denseField("Total Inspections", inspectionStats?.total_inspections ?? 0)}
            {denseField("OOS Rate", `${(inspectionStats?.oos_rate ?? 0).toFixed(1)}%`)}
            {denseField("Total Violations", inspectionStats?.violation_count ?? 0)}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Roadside inspection trends feed CSA score awareness. Track details in Compliance → Roadside.
          </p>
        </DetailSection>
      </div>
    </DetailPageLayout>
  )
}
