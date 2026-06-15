"use client"

import { Button } from "@/components/ui/button"
import { errorMessage } from "@/lib/error-message"
import { Card } from "@/components/ui/card"
import {
  MapPin,
  Package,
  Truck,
  Calendar,
  Route,
  Calculator,
  FileSpreadsheet,
  Building2,
  FileText,
  DollarSign,
  Share2,
  ArrowRight,
  Edit2,
  FilePenLine,
  CircleAlert,
  BookOpen,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { GoogleMapsRoute } from "@/components/google-maps-route"
import { getLoad, updateLoad } from "@/app/actions/loads"
import { getCompanySettings } from "@/app/actions/number-formats"
import { formatLoadWeight, type WeightUnit } from "@/lib/format-weight"
import { quickAssignLoad } from "@/app/actions/dispatches"
import { ensureDispatchConfirmed } from "@/lib/dispatch-confirm-client"
import { getRoutes } from "@/app/actions/routes"
import { getTrucks } from "@/app/actions/trucks"
import { getLoadDeliveryPoints, getLoadSummary } from "@/app/actions/load-delivery-points"
import { createInvoice, getInvoices } from "@/app/actions/accounting"
import { autoGenerateInvoiceOnPOD } from "@/app/actions/auto-invoice"
import { getDocuments, getDocumentUrl } from "@/app/actions/documents"
import { generateRateConfirmation } from "@/app/actions/rate-confirmation"
import { generateHazmatShippingPaper } from "@/app/actions/hazmat-shipping-paper"
import { toast } from "sonner"
import {
  DetailPageLayout,
  DetailSection,
  InfoGrid,
  InfoField,
  StatusBadge,
} from "@/components/dashboard/detail-page-layout"
import { LoadTripPlanningEstimate } from "@/components/load-trip-planning-estimate"
import { TripSummaryCard } from "@/components/trips/trip-summary-card"
import { LoadGeofenceEventsSection } from "@/components/eld/load-geofence-events-section"
import type { TripPlanningEstimate } from "@/app/actions/promiles"
import { getLastStopRoutingAddress, getOrderedDeliveryStopAddresses } from "@/lib/load-routing-from-stops"
import { createCustomerPortalAccess, reviewPortalLoadRequest } from "@/app/actions/customer-portal"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getDrivers } from "@/app/actions/drivers"
import { createPermit, getPermits, uploadPermitDocument } from "@/app/actions/permits"
import { UpgradeModal } from "@/components/billing/upgrade-modal"
import { DriverSuggestionList } from "@/components/dispatch/driver-suggestion-list"
import type { DriverSuggestion } from "@/app/actions/dispatch-assist"
import { SaveLoadTemplateDialog } from "@/components/loads/save-load-template-dialog"

type LoadData = NonNullable<Awaited<ReturnType<typeof getLoad>>["data"]>
type RouteData = NonNullable<Awaited<ReturnType<typeof getRoutes>>["data"]>[number]
type RoutesResult = Awaited<ReturnType<typeof getRoutes>>
type TruckData = NonNullable<Awaited<ReturnType<typeof getTrucks>>["data"]>[number]
type DeliveryPointData = NonNullable<Awaited<ReturnType<typeof getLoadDeliveryPoints>>["data"]>[number]
type LoadSummaryData = NonNullable<Awaited<ReturnType<typeof getLoadSummary>>["data"]>
type InvoiceData = NonNullable<Awaited<ReturnType<typeof getInvoices>>["data"]>[number]
type DriverData = NonNullable<Awaited<ReturnType<typeof getDrivers>>["data"]>[number]
type LoadDocumentData = NonNullable<Awaited<ReturnType<typeof getDocuments>>["data"]>[number]
type PermitData = NonNullable<Awaited<ReturnType<typeof getPermits>>["data"]>[number]

type ScoredRoute = {
  route: RouteData
  score: number
  reasons: string[]
}

type RouteDataWithCompatibility = RouteData & {
  _compatibilityScore?: number
  _compatibilityReasons?: string[]
}

function pickBestMatchingRoute(
  loadData: LoadData,
  routeRows: RouteData[],
): RouteDataWithCompatibility | null {
  const normalizedWeight =
    typeof loadData.weight === "string"
      ? Number(loadData.weight.replace(/[^0-9.]/g, "")) || 0
      : Number(loadData.weight || 0)
  const loadWeightKg = Number(loadData.weight_kg || 0) || (normalizedWeight ? normalizedWeight * 1000 : 0)

  let truckHeight = 4.0

  const normalizeLocation = (location: string) => {
    if (!location) return ""
    return location.toLowerCase().replace(/,/g, "").replace(/\s+/g, " ").trim()
  }

  const loadOriginNormalized = normalizeLocation(loadData.origin || "")
  const loadDestNormalized = normalizeLocation(loadData.destination || "")

  const matchingRoutes = routeRows.filter((route: RouteData) => {
    const routeOriginNormalized = normalizeLocation(route.origin || "")
    const routeDestNormalized = normalizeLocation(route.destination || "")

    const originMatch =
      routeOriginNormalized &&
      loadOriginNormalized &&
      (routeOriginNormalized.includes(loadOriginNormalized) ||
        loadOriginNormalized.includes(routeOriginNormalized) ||
        routeOriginNormalized.split(" ")[0] === loadOriginNormalized.split(" ")[0])

    const destMatch =
      routeDestNormalized &&
      loadDestNormalized &&
      (routeDestNormalized.includes(loadDestNormalized) ||
        loadDestNormalized.includes(routeDestNormalized) ||
        routeDestNormalized.split(" ")[0] === loadDestNormalized.split(" ")[0])

    return originMatch && destMatch
  })

  const scoredRoutes: ScoredRoute[] = matchingRoutes.map((route: RouteData) => {
    let score = 0
    const reasons: string[] = []

    if (
      route.origin?.toLowerCase() === loadData.origin?.toLowerCase() &&
      route.destination?.toLowerCase() === loadData.destination?.toLowerCase()
    ) {
      score += 100
      reasons.push("Exact origin and destination match")
    } else {
      score += 50
      reasons.push("Partial location match")
    }

    if (route.truck_id) {
      score += 30
      reasons.push("Route assigned to specific truck")
      if (route.truck_id === loadData.truck_id) {
        score += 50
        reasons.push("Route matches assigned truck")
      }
    }

    if (route.status === "scheduled" || route.status === "in_progress") {
      score += 20
      reasons.push("Route is active/scheduled")
    } else if (route.status === "pending") {
      score += 10
    }

    if (route.priority === "high") {
      score += 15
      reasons.push("High priority route")
    }

    if (route.waypoints && Array.isArray(route.waypoints) && route.waypoints.length > 0) {
      score += 10
      reasons.push("Route has detailed waypoints")
    }

    if (route.distance && route.estimated_time) {
      score += 10
      reasons.push("Route has complete distance/time info")
    }

    if (loadWeightKg > 36000) {
      if (
        route.name?.toLowerCase().includes("truck") ||
        route.name?.toLowerCase().includes("highway") ||
        route.name?.toLowerCase().includes("i-") ||
        route.name?.toLowerCase().includes("us-")
      ) {
        score += 25
        reasons.push("Route suitable for heavy loads (truck routes/highways)")
      }
    }

    const isHazmat =
      loadData.contents?.toLowerCase().includes("chemical") ||
      loadData.contents?.toLowerCase().includes("hazard") ||
      loadData.contents?.toLowerCase().includes("hazmat")
    if (isHazmat) {
      if (
        route.special_instructions?.toLowerCase().includes("hazmat") ||
        route.special_instructions?.toLowerCase().includes("no tunnel")
      ) {
        score += 20
        reasons.push("Route compatible with hazmat cargo")
      }
    }

    if (truckHeight > 4.2) {
      if (
        route.special_instructions?.toLowerCase().includes("clearance") ||
        route.special_instructions?.toLowerCase().includes("bridge")
      ) {
        score += 15
        reasons.push("Route considers height restrictions")
      }
    }

    return { route, score, reasons }
  })

  scoredRoutes.sort((a, b) => b.score - a.score)

  if (loadData.route_id) {
    const specificRoute = routeRows.find((r: RouteData) => r.id === loadData.route_id)
    if (specificRoute) {
      const existingIndex = scoredRoutes.findIndex((sr) => sr.route.id === specificRoute.id)
      if (existingIndex >= 0) {
        scoredRoutes[existingIndex].score += 200
        scoredRoutes[existingIndex].reasons.push("This is the assigned route for this load")
      } else {
        scoredRoutes.unshift({
          route: specificRoute,
          score: 200,
          reasons: ["This is the assigned route for this load"],
        })
      }
      scoredRoutes.sort((a, b) => b.score - a.score)
    }
  }

  const bestRoute = scoredRoutes.length > 0 ? (scoredRoutes[0].route as RouteDataWithCompatibility) : null
  if (bestRoute && scoredRoutes.length > 0) {
    bestRoute._compatibilityScore = scoredRoutes[0].score
    bestRoute._compatibilityReasons = scoredRoutes[0].reasons
  }
  return bestRoute
}

function hasRequiredUpgrade(value: unknown): value is { upgrade?: { required?: boolean } } {
  if (!value || typeof value !== "object" || !("upgrade" in value)) return false
  const upgrade = (value as { upgrade?: unknown }).upgrade
  return !!upgrade && typeof upgrade === "object" && "required" in upgrade
}

export default function LoadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [load, setLoad] = useState<LoadData | null>(null)
  const [matchingRoute, setMatchingRoute] = useState<RouteDataWithCompatibility | null>(null)
  const [truck, setTruck] = useState<TruckData | null>(null)
  const [routesResult, setRoutesResult] = useState<RoutesResult | null>(null)
  const [deliveryPoints, setDeliveryPoints] = useState<DeliveryPointData[]>([])
  const [loadSummary, setLoadSummary] = useState<LoadSummaryData | null>(null)
  const [relatedInvoice, setRelatedInvoice] = useState<InvoiceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [portalUrl, setPortalUrl] = useState<string>("")
  const [isCreatingPortal, setIsCreatingPortal] = useState(false)
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false)
  const [isDispatchDialogOpen, setIsDispatchDialogOpen] = useState(false)
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false)
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false)
  const [isQuickDispatching, setIsQuickDispatching] = useState(false)
  const [isQuickInvoicing, setIsQuickInvoicing] = useState(false)
  const [drivers, setDrivers] = useState<DriverData[]>([])
  const [trucks, setTrucks] = useState<TruckData[]>([])
  const [selectedDispatchDriverId, setSelectedDispatchDriverId] = useState<string>("")
  const [selectedDispatchTruckId, setSelectedDispatchTruckId] = useState<string>("")
  const [loadDocuments, setLoadDocuments] = useState<LoadDocumentData[]>([])
  const [isGeneratingRateConf, setIsGeneratingRateConf] = useState(false)
  const [isGeneratingHazmatPaper, setIsGeneratingHazmatPaper] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [permits, setPermits] = useState<PermitData[]>([])
  const [isCreatingPermit, setIsCreatingPermit] = useState(false)
  const [portalReviewMessage, setPortalReviewMessage] = useState("")
  const [portalQuotedRate, setPortalQuotedRate] = useState("")
  const [isSubmittingPortalReview, setIsSubmittingPortalReview] = useState(false)
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("lbs")
  const [permitForm, setPermitForm] = useState({
    permit_number: "",
    issuing_state: "",
    permit_type: "oversize",
    issued_date: "",
    expiry_date: "",
    max_weight: "",
    max_height: "",
    max_width: "",
    max_length: "",
    route_restriction: "",
  })

  /** For multi-stop loads, trip planning needs one destination — use last delivery stop. */
  const lastStopRoutingAddress = useMemo(
    () => getLastStopRoutingAddress(deliveryPoints),
    [deliveryPoints],
  )
  const orderedDeliveryStopAddresses = useMemo(
    () => getOrderedDeliveryStopAddresses(deliveryPoints),
    [deliveryPoints],
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    getCompanySettings()
      .then((result) => {
        const unit = result.data?.weight_unit === "kg" ? "kg" : "lbs"
        setWeightUnit(unit)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (id === "add") {
      router.replace("/dashboard/loads/add")
    }
  }, [id, router])

  useEffect(() => {
    let mounted = true
    async function loadRelatedDocuments() {
      if (!id || id === "add") return
      const docs = await getDocuments({ load_id: id, limit: 50 })
      const permitResult = await getPermits({ load_id: id })
      if (mounted && docs.data) {
        setLoadDocuments(docs.data)
      }
      if (mounted && permitResult.data) {
        setPermits(permitResult.data)
      }
    }
    void loadRelatedDocuments()
    return () => {
      mounted = false
    }
  }, [id])

  useEffect(() => {
    let isMounted = true

    async function loadSecondaryData(loadData: LoadData) {
      try {
        const secondaryTasks: Promise<void>[] = []

        if (loadData.delivery_type === "multi") {
          secondaryTasks.push(
            (async () => {
              const [deliveryPointsResult, summaryResult] = await Promise.all([
                getLoadDeliveryPoints(id),
                getLoadSummary(id),
              ])
              if (!isMounted) return
              if (deliveryPointsResult.data) setDeliveryPoints(deliveryPointsResult.data)
              if (summaryResult.data) setLoadSummary(summaryResult.data)
            })(),
          )
        }

        if (loadData.truck_id) {
          secondaryTasks.push(
            (async () => {
              const { getTruck } = await import("@/app/actions/trucks")
              const truckResult = await getTruck(loadData.truck_id!)
              if (isMounted && truckResult.data) setTruck(truckResult.data)
            })(),
          )
        }

        if (loadData.status === "delivered") {
          secondaryTasks.push(
            (async () => {
              const invoicesResult = await getInvoices({ load_id: id, limit: 1 })
              if (isMounted && invoicesResult.data && invoicesResult.data.length > 0) {
                setRelatedInvoice(invoicesResult.data[0])
              }
            })(),
          )
        }

        secondaryTasks.push(
          (async () => {
            const routesResult = await getRoutes({ limit: 50 })
            if (!isMounted) return
            setRoutesResult(routesResult)
            if (routesResult.data) {
              setMatchingRoute(pickBestMatchingRoute(loadData, routesResult.data as RouteData[]) || null)
            }
          })(),
        )

        await Promise.all(secondaryTasks)
      } catch (error: unknown) {
        if (isMounted) {
          console.error("[LoadDetail] Secondary load failed:", error)
        }
      }
    }

    async function loadData() {
      if (!id || id === "add" || !isMounted) return

      setIsLoading(true)

      try {
        const loadResult = await getLoad(id)
        if (!isMounted) return

        if (loadResult.error) {
          toast.error(loadResult.error || "Failed to load load details")
          return
        }

        if (loadResult.data) {
          setLoad(loadResult.data)
          setIsLoading(false)
          void loadSecondaryData(loadResult.data)
        }
      } catch (error: unknown) {
        if (isMounted) {
          toast.error(errorMessage(error, "Failed to load load details"))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    if (id && id !== "add") {
      loadData()
    }

    return () => {
      isMounted = false
    }
  }, [id])

  useEffect(() => {
    if (!isDispatchDialogOpen) return

    let active = true
    void (async () => {
      try {
        const [driversResult, trucksResult] = await Promise.all([getDrivers(), getTrucks()])
        if (!active) return

        const activeDrivers = ((driversResult.data || []) as DriverData[]).filter(
          (d: DriverData) => d.status === "active",
        )
        const assignableTrucks = ((trucksResult.data || []) as TruckData[]).filter(
          (t: TruckData) => t.status === "available" || t.status === "in_use"
        )

        setDrivers(activeDrivers)
        setTrucks(assignableTrucks)
        setSelectedDispatchDriverId(load?.driver_id || "")
        setSelectedDispatchTruckId(load?.truck_id || "")
      } catch {
        if (!active) return
        toast.error("Failed to load drivers/trucks for dispatch.")
      }
    })()

    return () => {
      active = false
    }
  }, [isDispatchDialogOpen, load?.driver_id, load?.truck_id])

  if (id === "add") {
    return null
  }

  if (isLoading || !mounted) {
    return (
      <DetailPageLayout
        title="Loading..."
        backUrl="/dashboard/loads"
      >
        <div className="text-center py-12">
                <p className="text-muted-foreground">Loading load details...</p>
              </div>
      </DetailPageLayout>
    )
  }

  if (!load) {
    return (
      <DetailPageLayout
        title="Load Not Found"
        backUrl="/dashboard/loads"
      >
        <div className="text-center py-12">
                <p className="text-muted-foreground">Load not found</p>
                <Link href="/dashboard/loads">
                  <Button className="mt-4">Back to Loads</Button>
                </Link>
              </div>
      </DetailPageLayout>
    )
  }

  // Calculate weight in kg for the map
  const weightKg = load.weight_kg
    ? Number(load.weight_kg)
    : typeof load.weight === "string"
      ? (Number(load.weight.replace(/[^0-9.]/g, "")) || 0) * 1000
      : Number(load.weight || 0) * 1000

  // Helper function to format dates consistently (prevents hydration mismatch)
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A"
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return "N/A"
      // Use a consistent format that works on both server and client
      return date.toISOString().split('T')[0] // YYYY-MM-DD format
    } catch {
      return "N/A"
    }
  }

  // Helper function to format date with time
  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A"
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return "N/A"
      // Use a consistent format
      const dateParts = date.toISOString().split('T')
      const timePart = dateString && dateString.includes('T') && dateString.split('T')[1] 
        ? dateString.split('T')[1].substring(0, 5) 
        : ''
      return dateParts[0] + (timePart ? ' ' + timePart : '')
    } catch {
      return "N/A"
    }
  }

  const getStatusVariant = (
    status?: string | null,
  ): "success" | "default" | "warning" | "danger" | "info" => {
    switch (status?.toLowerCase()) {
      case "delivered":
        return "success"
      case "in_transit":
        return "info"
      case "confirmed":
        return "info"
      case "pending":
        return "warning"
      case "cancelled":
        return "danger"
      default:
        return "default"
    }
  }

  const getStatusStripClasses = (variant: "success" | "default" | "warning" | "danger" | "info") => {
    switch (variant) {
      case "success":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      case "warning":
        return "border-amber-500/30 bg-amber-500/10 text-amber-300"
      case "danger":
        return "border-red-500/30 bg-red-500/10 text-red-300"
      case "info":
        return "border-blue-500/30 bg-blue-500/10 text-blue-300"
      default:
        return "border-zinc-500/40 bg-zinc-500/10 text-zinc-300"
    }
  }

  if (!load) {
  return (
      <DetailPageLayout
        title="Loading..."
        backUrl="/dashboard/loads"
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading load details...</p>
        </div>
      </DetailPageLayout>
    )
  }

  // Determine dispatch status
  const dispatchStatus = load.driver_id && load.truck_id ? "Dispatched" : "Undispatched"
  const dispatchStatusVariant = dispatchStatus === "Dispatched" ? "success" : "warning"
  
  // Determine invoice status
  const invoiceStatus = relatedInvoice 
    ? relatedInvoice.status === "paid" ? "Paid" 
      : relatedInvoice.status === "partially_paid" ? "Partially Paid"
      : "Invoiced"
    : "Uninvoiced"
  const invoiceStatusVariant = invoiceStatus === "Paid" ? "success" 
    : invoiceStatus === "Partially Paid" ? "info"
    : invoiceStatus === "Invoiced" ? "info"
    : "warning"

  const canGenerateInvoice =
    !relatedInvoice &&
    (load.status === "delivered" || load.status === "completed")

  // Handle share tracking link
  async function handleShareTrackingLink() {
    if (!load.customer_id) {
      toast.error("This load is not associated with a customer. Please assign a customer first.")
      return
    }

    setIsCreatingPortal(true)
    try {
      const result = await createCustomerPortalAccess({
        customer_id: load.customer_id,
        can_view_location: true,
        email_notifications: true,
        expires_days: 90, // 90 days expiration
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      // Get portal URL
      const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
      const token = result.data?.access_token
      if (token) {
        const url = `${baseUrl}/portal/${token}`
        setPortalUrl(url)
        setIsShareDialogOpen(true)
        toast.success("Portal access created! Share the link with your customer.")
      }
    } catch (error: unknown) {
      toast.error("Failed to create portal access: " + (errorMessage(error, "Unknown error")))
    } finally {
      setIsCreatingPortal(false)
    }
  }

  async function handleGenerateInvoice() {
    setIsGeneratingInvoice(true)
    try {
      const result = await autoGenerateInvoiceOnPOD(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      const invoiceId = result.data?.invoiceId
      if (!invoiceId) {
        toast.error("Invoice generated but no invoice ID was returned")
        return
      }
      toast.success(result.data?.alreadyExists ? "Invoice already exists for this load" : "Invoice generated")

      const invoicesResult = await getInvoices({ load_id: id, limit: 1 })
      if (invoicesResult.data && invoicesResult.data.length > 0) {
        setRelatedInvoice(invoicesResult.data[0])
      }
      router.push(`/dashboard/accounting/invoices/${invoiceId}`)
    } catch (error: unknown) {
      toast.error("Failed to generate invoice: " + errorMessage(error, "Unknown error"))
    } finally {
      setIsGeneratingInvoice(false)
    }
  }

  async function handleQuickDispatch() {
    setIsQuickDispatching(true)
    try {
      if (!selectedDispatchDriverId || !selectedDispatchTruckId) {
        toast.error("Please assign both driver and truck before dispatching.")
        return
      }

      if (!(await ensureDispatchConfirmed())) return

      const result = await quickAssignLoad(
        id,
        selectedDispatchDriverId,
        selectedDispatchTruckId,
      )
      if (result.error) {
        toast.error(result.error)
        return
      }

      const refreshed = await getLoad(id)
      if (refreshed.data) {
        setLoad(refreshed.data as LoadData)
      } else {
        setLoad((prev: LoadData | null) =>
          prev
            ? {
                ...prev,
                driver_id: selectedDispatchDriverId,
                truck_id: selectedDispatchTruckId,
                status: "scheduled",
              }
            : prev,
        )
      }
      toast.success("Load dispatched successfully.")
      setIsDispatchDialogOpen(false)
    } catch (error: unknown) {
      toast.error("Failed to dispatch load: " + errorMessage(error, "Unknown error"))
    } finally {
      setIsQuickDispatching(false)
    }
  }

  async function handleQuickInvoice() {
    setIsQuickInvoicing(true)
    try {
      const amount = Number(load?.total_rate ?? load?.rate ?? load?.value ?? 0)
      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error("Cannot create invoice: load amount is missing.")
        return
      }

      const issueDate = new Date()
      const dueDate = new Date(issueDate)
      dueDate.setDate(dueDate.getDate() + 30)
      const customerName =
        load?.company_name?.trim() ||
        load?.consignee_name?.trim() ||
        "Customer"

      const invoiceResult = await createInvoice({
        customer_name: customerName,
        load_id: id,
        amount,
        issue_date: issueDate.toISOString().split("T")[0]!,
        due_date: dueDate.toISOString().split("T")[0]!,
        description: `Invoice for load ${load?.shipment_number || id}`,
      })

      if (invoiceResult.error || !invoiceResult.data) {
        toast.error(invoiceResult.error || "Failed to create invoice")
        return
      }

      setRelatedInvoice(invoiceResult.data)

      setIsInvoiceDialogOpen(false)
      toast.success("Invoice created.")
      router.push(`/dashboard/accounting/invoices/${invoiceResult.data.id}`)
    } catch (error: unknown) {
      toast.error("Failed to create invoice: " + errorMessage(error, "Unknown error"))
    } finally {
      setIsQuickInvoicing(false)
    }
  }

  function handleCopyPortalUrl() {
    if (portalUrl) {
      navigator.clipboard.writeText(portalUrl)
      toast.success("Portal URL copied to clipboard!")
    }
  }

  async function handleGenerateRateConfirmation() {
    if (!id || id === "add") return
    setIsGeneratingRateConf(true)
    const result = await generateRateConfirmation(id)
    setIsGeneratingRateConf(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Rate confirmation generated")
    const docs = await getDocuments({ load_id: id, limit: 50 })
    if (docs.data) setLoadDocuments(docs.data)
  }

  async function handleGenerateHazmatShippingPaper() {
    if (!id || id === "add") return
    setIsGeneratingHazmatPaper(true)
    const result = await generateHazmatShippingPaper(id)
    setIsGeneratingHazmatPaper(false)
    if (result.error) {
      if (hasRequiredUpgrade(result) && result.upgrade?.required) {
        setShowUpgradeModal(true)
      }
      toast.error(result.error)
      return
    }
    toast.success("HAZMAT shipping paper generated")
    const docs = await getDocuments({ load_id: id, limit: 50 })
    if (docs.data) setLoadDocuments(docs.data)
  }

  async function handleCreatePermit() {
    if (!id || id === "add") return
    setIsCreatingPermit(true)
    const result = await createPermit({
      permit_number: permitForm.permit_number,
      issuing_state: permitForm.issuing_state,
      permit_type: permitForm.permit_type,
      issued_date: permitForm.issued_date || undefined,
      expiry_date: permitForm.expiry_date || undefined,
      max_weight: permitForm.max_weight ? Number(permitForm.max_weight) : undefined,
      max_height: permitForm.max_height ? Number(permitForm.max_height) : undefined,
      max_width: permitForm.max_width ? Number(permitForm.max_width) : undefined,
      max_length: permitForm.max_length ? Number(permitForm.max_length) : undefined,
      route_restriction: permitForm.route_restriction || undefined,
      load_id: id,
      truck_id: load?.truck_id || undefined,
    })
    setIsCreatingPermit(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Permit created")
    setPermitForm({
      permit_number: "",
      issuing_state: "",
      permit_type: "oversize",
      issued_date: "",
      expiry_date: "",
      max_weight: "",
      max_height: "",
      max_width: "",
      max_length: "",
      route_restriction: "",
    })
    const permitResult = await getPermits({ load_id: id })
    if (permitResult.data) setPermits(permitResult.data)
  }

  async function handleUploadPermitFile(permitId: string, file: File) {
    const result = await uploadPermitDocument(permitId, file)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Permit attachment uploaded")
    if (!id || id === "add") return
    const docs = await getDocuments({ load_id: id, limit: 50 })
    if (docs.data) setLoadDocuments(docs.data)
    const permitResult = await getPermits({ load_id: id })
    if (permitResult.data) setPermits(permitResult.data)
  }

  async function handlePortalRequestReview(decision: "accepted" | "rejected") {
    if (!id || id === "add") return
    if (isSubmittingPortalReview) return
    if (decision === "rejected" && portalReviewMessage.trim().length < 3) {
      toast.error("Please include a short rejection message")
      return
    }

    setIsSubmittingPortalReview(true)
    try {
      const result = await reviewPortalLoadRequest({
        load_id: id,
        decision,
        message: portalReviewMessage,
        quoted_rate: portalQuotedRate.trim() ? Number(portalQuotedRate) : null,
      })
      if (result.error || !result.data) {
        toast.error(result.error || "Failed to update request")
        return
      }
      setLoad((prev: LoadData | null) => (prev ? { ...prev, ...result.data } : prev))
      toast.success(decision === "accepted" ? "Load request accepted" : "Load request rejected")
      setPortalReviewMessage("")
      setPortalQuotedRate("")
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to review request"))
    } finally {
      setIsSubmittingPortalReview(false)
    }
  }

  return (
    <>
    <DetailPageLayout
      title={<span className="text-3xl font-bold tracking-tight">{load.shipment_number || "Load Details"}</span>}
      subtitle={
        load.origin && load.destination ? (
          <span className="inline-flex items-center gap-2 text-sm md:text-base">
            <span>{load.origin}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span>{load.destination}</span>
          </span>
        ) : undefined
      }
      backUrl="/dashboard/loads"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-md border border-border/70 bg-muted/20 p-1">
            <Link href={`/dashboard/loads/${id}/edit`}>
              <Button variant="ghost" size="sm" className="h-8 px-3">
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
            {relatedInvoice?.id ? (
              <Link href={`/dashboard/accounting/invoices/${relatedInvoice.id}`}>
                <Button variant="ghost" size="sm" className="h-8 px-3">
                  <FileText className="mr-2 h-4 w-4" />
                  View Invoice
                </Button>
              </Link>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3"
                onClick={() => setIsInvoiceDialogOpen(true)}
              >
                <FileText className="mr-2 h-4 w-4" />
                View Invoice
              </Button>
            )}
            <Link href={`/dashboard/bols/create?loadId=${id}`}>
              <Button variant="ghost" size="sm" className="h-8 px-3">
                <FilePenLine className="mr-2 h-4 w-4" />
                Create BOL
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3"
              onClick={() => setIsSaveTemplateOpen(true)}
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Save as template
            </Button>
          </div>
          {load.customer_id ? (
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-border/70 bg-transparent"
              onClick={handleShareTrackingLink}
              disabled={isCreatingPortal}
            >
              <Share2 className="w-4 h-4 mr-2" />
              {isCreatingPortal ? "Creating..." : "Share Tracking Link"}
            </Button>
          ) : null}
          {canGenerateInvoice ? (
            <Button
              size="sm"
              className="h-9"
              onClick={handleGenerateInvoice}
              disabled={isGeneratingInvoice}
            >
              <FileText className="w-4 h-4 mr-2" />
              {isGeneratingInvoice ? "Generating..." : "Generate Invoice"}
            </Button>
          ) : null}
        </div>
      }
      headerActions={
        <div className="flex w-full flex-wrap items-center gap-2 text-xs sm:text-sm">
          <span className="font-medium text-muted-foreground">Dispatch:</span>
          <span
            className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${getStatusStripClasses(
              dispatchStatusVariant,
            )}`}
          >
            {dispatchStatus}
          </span>
          <span className="text-muted-foreground/80">·</span>
          <span className="font-medium text-muted-foreground">Invoice:</span>
          <span
            className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${getStatusStripClasses(
              invoiceStatusVariant,
            )}`}
          >
            {invoiceStatus}
          </span>
          <span className="text-muted-foreground/80">·</span>
          <span className="font-medium text-muted-foreground">Load:</span>
          <span
            className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${getStatusStripClasses(
              getStatusVariant(load.status),
            )}`}
          >
            {load.status?.replace("_", " ") || "Unknown"}
          </span>
          {dispatchStatus === "Undispatched" && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto h-8 border-border/70"
              onClick={() => setIsDispatchDialogOpen(true)}
            >
              Dispatch
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {load.requested_via_portal && (
          <Card className="border border-border/80 bg-card p-4 md:p-5">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Shipper Request Review</h3>
                <StatusBadge
                  status={`Request ${String(load.portal_request_status || "pending")}`}
                  variant={
                    String(load.portal_request_status || "pending") === "accepted"
                      ? "success"
                      : String(load.portal_request_status || "pending") === "rejected"
                        ? "danger"
                        : "warning"
                  }
                />
              </div>
              {load.requested_equipment_type ? (
                <p className="text-sm text-muted-foreground">Requested equipment: {load.requested_equipment_type}</p>
              ) : null}
              {load.portal_request_message ? (
                <p className="text-sm text-muted-foreground">{load.portal_request_message}</p>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="portal-rate">Quoted Rate (optional)</Label>
                  <Input
                    id="portal-rate"
                    type="number"
                    step="0.01"
                    value={portalQuotedRate}
                    onChange={(e) => setPortalQuotedRate(e.target.value)}
                    placeholder="2500.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="portal-review-message">Message to customer</Label>
                  <Input
                    id="portal-review-message"
                    value={portalReviewMessage}
                    onChange={(e) => setPortalReviewMessage(e.target.value)}
                    placeholder="Add acceptance/rejection note"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => handlePortalRequestReview("accepted")}
                  disabled={isSubmittingPortalReview}
                >
                  Accept and Confirm
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handlePortalRequestReview("rejected")}
                  disabled={isSubmittingPortalReview}
                >
                  Reject with Message
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Single strip: route estimate on this load vs manual IFTA elsewhere */}
        <Card className="border border-border/80 bg-card p-4 md:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">Trip planning</span> (section below) ·{" "}
              <span className="text-foreground font-medium">IFTA trip sheet</span> for manual miles without ELD
            </p>
            <div className="flex flex-wrap gap-2 shrink-0">
              <a href="#trip-planning-promiles">
                <Button type="button" size="sm" variant="secondary">
                  <Calculator className="w-4 h-4 mr-2" />
                  Trip planning
                </Button>
              </a>
              <Link href="/dashboard/ifta/trip-sheet">
                <Button type="button" variant="outline" size="sm">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  IFTA trip sheet
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {/* Load Overview - Always Visible */}
        <DetailSection
          title="Load Overview"
          icon={<Package className="w-5 h-5" />}
          description="Basic load information and status"
          className="border-border/70 bg-card/80"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">Shipment Number</p>
              <p className="mt-1 text-base text-white">{load.shipment_number || "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">Status</p>
              <div className="mt-1">
                <StatusBadge
                  status={load.status?.replace("_", " ") || "Unknown"}
                  variant={getStatusVariant(load.status)}
                />
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">Origin</p>
              <p className="mt-1 text-base text-white">{load.origin || "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">Destination</p>
              <p className="mt-1 text-base text-white">{load.destination || "—"}</p>
            </div>
            {load.company_name && (
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Company</p>
                <p className="mt-1 text-base text-white">{load.company_name}</p>
              </div>
            )}
            {load.delivery_type && (
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Delivery Type</p>
                <p className="mt-1 text-base text-white">
                  {load.delivery_type === "multi" ? "Multiple Deliveries" : "Single Delivery"}
                </p>
              </div>
            )}
            {load.load_date && (
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Load Date</p>
                <p className="mt-1 text-base text-white">{formatDate(load.load_date)}</p>
              </div>
            )}
            {load.estimated_delivery && (
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Estimated Delivery</p>
                <p className="mt-1 text-base text-white">{formatDate(load.estimated_delivery)}</p>
              </div>
            )}
          </div>
        </DetailSection>
        <div className="border-t border-border/60" />

        <TripSummaryCard loadId={id} loadStatus={load.status ?? ""} />

        <LoadGeofenceEventsSection loadId={id} />

          <div id="trip-planning-promiles">
            <LoadTripPlanningEstimate
              loadId={id}
              origin={load.origin}
              destination={load.destination}
              initialEstimate={load.trip_planning_estimate as TripPlanningEstimate | null | undefined}
              truckGrossWeightLbs={truck?.gross_vehicle_weight}
              suggestedRoutingDestination={lastStopRoutingAddress || null}
              deliveryStopAddresses={
                load.delivery_type === "multi" && orderedDeliveryStopAddresses.length > 0
                  ? orderedDeliveryStopAddresses
                  : undefined
              }
              onSaved={async () => {
                const r = await getLoad(id)
                if (r.data) setLoad(r.data)
              }}
            />
          </div>

          {/* Load Summary for Multi-Delivery */}
          {load.delivery_type === "multi" && loadSummary && (
            <Card className="border-border p-4 md:p-8">
              <h2 className="text-xl font-bold text-foreground mb-6">Load Summary</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Total Delivery Points</p>
                  <p className="text-xl md:text-2xl font-bold text-foreground">{loadSummary.total_delivery_points}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Total Weight (kg)</p>
                  <p className="text-xl md:text-2xl font-bold text-foreground">{(loadSummary.total_weight_kg || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Total Pieces</p>
                  <p className="text-xl md:text-2xl font-bold text-foreground">{loadSummary.total_pieces}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Total Pallets</p>
                  <p className="text-xl md:text-2xl font-bold text-foreground">{loadSummary.total_pallets}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Delivery Points Breakdown */}
          {load.delivery_type === "multi" && deliveryPoints.length > 0 ? (
            <Card className="border-border p-4 md:p-8">
              <h2 className="text-xl font-bold text-foreground mb-6">Delivery Points Breakdown</h2>
              <div className="space-y-4">
                {deliveryPoints.map((point, index) => (
                  <Card key={point.id || index} className="border-border p-4 md:p-6 bg-secondary/30">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{point.delivery_number}</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{point.location_name}</h3>
                          {point.location_id && (
                            <p className="text-xs text-muted-foreground">ID: {point.location_id}</p>
                          )}
                        </div>
                      </div>
                      {point.priority && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">
                          {point.priority}
                        </span>
                      )}
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Address</p>
                        <p className="text-sm text-foreground">{point.address}</p>
                        {point.city && point.state && (
                          <p className="text-xs text-muted-foreground">{point.city}, {point.state} {point.zip}</p>
                        )}
                        {point.phone && (
                          <p className="text-xs text-muted-foreground mt-1">📞 {point.phone}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Load Amount</p>
                        <div className="space-y-1">
                          {point.weight_kg > 0 && (
                            <p className="text-xs text-foreground">Weight: {point.weight_kg} kg</p>
                          )}
                          {point.pieces > 0 && (
                            <p className="text-xs text-foreground">Pieces: {point.pieces}</p>
                          )}
                          {point.pallets > 0 && (
                            <p className="text-xs text-foreground">Pallets: {point.pallets}</p>
                          )}
                          {point.boxes > 0 && (
                            <p className="text-xs text-foreground">Boxes: {point.boxes}</p>
                          )}
                          {point.carts > 0 && (
                            <p className="text-xs text-foreground">Carts: {point.carts}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Scheduled Delivery</p>
                        {point.scheduled_delivery_date && (
                          <p className="text-xs text-foreground">
                            {formatDate(point.scheduled_delivery_date)}
                            {point.scheduled_delivery_time && ` at ${point.scheduled_delivery_time}`}
                          </p>
                        )}
                        {point.time_window_start && point.time_window_end && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Window: {point.time_window_start} - {point.time_window_end}
                          </p>
                        )}
                        {point.status && (
                          <p className="text-xs mt-1">
                            Status: <span className={`${
                              point.status === "delivered" ? "text-green-400" :
                              point.status === "in_transit" ? "text-blue-400" :
                              "text-yellow-400"
                            }`}>{point.status}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {point.delivery_instructions && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">Delivery Instructions</p>
                        <p className="text-sm text-foreground">{point.delivery_instructions}</p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </Card>
          ) : load.delivery_type === "multi" ? (
            <Card className="border-border p-4 md:p-8">
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Delivery Points Added</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This load is set to multi-delivery but no delivery points have been added yet.
                </p>
                {id && typeof id === 'string' && id.trim() !== '' ? (
                  <Link href={`/dashboard/loads/${id}/edit`}>
                    <Button variant="outline">Add Delivery Points</Button>
                  </Link>
                ) : null}
              </div>
            </Card>
          ) : null}

          {/* Reference & C-TPAT */}
          {(load.customer_reference || load.bol_number) && (
            <DetailSection
              title="Reference Information"
              icon={<FileText className="w-5 h-5" />}
            >
              <InfoGrid cols={2}>
                {load.customer_reference && (
                  <InfoField
                    label="Reference"
                    value={load.customer_reference}
                  />
                )}
                {load.bol_number && (
                  <InfoField
                    label="BOL Number"
                    value={load.bol_number}
                  />
                )}
              </InfoGrid>
            </DetailSection>
          )}
        {/* Shipper Information */}
          {(load.shipper_name || load.shipper_address || load.shipper_contact_name) && (
            <DetailSection
              title="Shipper Information"
              icon={<Building2 className="w-5 h-5" />}
            >
              <InfoGrid cols={2}>
                {load.shipper_name && (
                  <InfoField
                    label="Name"
                    value={load.shipper_name}
                  />
                )}
                {load.shipper_address && (
                  <InfoField
                    label="Address"
                    value={
                      <>
                        {load.shipper_address}
                        {(load.shipper_city || load.shipper_state || load.shipper_zip) && (
                          <span className="block text-sm text-muted-foreground mt-1">
                            {[load.shipper_city, load.shipper_state, load.shipper_zip].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </>
                    }
                    icon={<MapPin className="w-4 h-4" />}
                    className="md:col-span-2"
                  />
                )}
                {load.shipper_contact_name && (
                  <InfoField
                    label="Contact Name"
                    value={load.shipper_contact_name}
                  />
                )}
                {load.shipper_contact_phone && (
                  <InfoField
                    label="Contact Phone"
                    value={load.shipper_contact_phone}
                  />
                )}
                {load.shipper_contact_email && (
                  <InfoField
                    label="Contact Email"
                    value={load.shipper_contact_email}
                  />
                )}
                {load.pickup_time && (
                  <InfoField
                    label="Pickup Time"
                    value={load.pickup_time}
                    icon={<Calendar className="w-4 h-4" />}
                  />
                )}
                {(load.pickup_time_window_start || load.pickup_time_window_end) && (
                  <InfoField
                    label="Pickup Window"
                    value={`${load.pickup_time_window_start || ""} - ${load.pickup_time_window_end || ""}`}
                  />
                )}
                {load.pickup_instructions && (
                  <InfoField
                    label="Pickup Instructions"
                    value={<span className="whitespace-pre-wrap">{load.pickup_instructions}</span>}
                    className="md:col-span-2"
                  />
                )}
              </InfoGrid>
            </DetailSection>
          )}
        {/* Consignee Information */}
          {(load.consignee_name || load.consignee_address || load.consignee_contact_name) && (
            <DetailSection
              title="Consignee Information"
              icon={<Building2 className="w-5 h-5" />}
            >
              <InfoGrid cols={2}>
                {load.consignee_name && (
                  <InfoField
                    label="Name"
                    value={load.consignee_name}
                  />
                )}
                {load.consignee_address && (
                  <InfoField
                    label="Address"
                    value={
                      <>
                        {load.consignee_address}
                        {(load.consignee_city || load.consignee_state || load.consignee_zip) && (
                          <span className="block text-sm text-muted-foreground mt-1">
                            {[load.consignee_city, load.consignee_state, load.consignee_zip].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </>
                    }
                    icon={<MapPin className="w-4 h-4" />}
                    className="md:col-span-2"
                  />
                )}
                {load.consignee_contact_name && (
                  <InfoField
                    label="Contact Name"
                    value={load.consignee_contact_name}
                  />
                )}
                {load.consignee_contact_phone && (
                  <InfoField
                    label="Contact Phone"
                    value={load.consignee_contact_phone}
                  />
                )}
                {load.consignee_contact_email && (
                  <InfoField
                    label="Contact Email"
                    value={load.consignee_contact_email}
                  />
                )}
                {load.delivery_time && (
                  <InfoField
                    label="Delivery Time"
                    value={load.delivery_time}
                    icon={<Calendar className="w-4 h-4" />}
                  />
                )}
                {(load.delivery_time_window_start || load.delivery_time_window_end) && (
                  <InfoField
                    label="Delivery Window"
                    value={`${load.delivery_time_window_start || ""} - ${load.delivery_time_window_end || ""}`}
                  />
                )}
                {load.delivery_instructions && (
                  <InfoField
                    label="Delivery Instructions"
                    value={<span className="whitespace-pre-wrap">{load.delivery_instructions}</span>}
                    className="md:col-span-2"
                  />
                )}
              </InfoGrid>
            </DetailSection>
          )}

        {/* Freight Information */}
          <DetailSection
            title="Cargo Details"
            icon={<Package className="w-5 h-5" />}
            className="border-border/70 bg-card/80"
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500">Weight</p>
                  <p className="mt-1 text-base text-white">{formatLoadWeight(load, weightUnit)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500">Contents</p>
                  <p className="mt-1 text-base text-white">{load.contents || "N/A"}</p>
                </div>
                {load.pieces && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500">Pieces</p>
                    <p className="mt-1 text-base text-white">{load.pieces}</p>
                  </div>
                )}
                {load.piece_count && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500">Piece Count</p>
                    <p className="mt-1 text-base text-white">{load.piece_count}</p>
                  </div>
                )}
                {load.pallets && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500">Pallets</p>
                    <p className="mt-1 text-base text-white">{load.pallets}</p>
                  </div>
                )}
                {load.boxes && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500">Boxes</p>
                    <p className="mt-1 text-base text-white">{load.boxes}</p>
                  </div>
                )}
                {(load.length || load.width || load.height) && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500">Dimensions</p>
                    <p className="mt-1 text-base text-white">
                      {[load.length, load.width, load.height].filter(Boolean).join(" × ")} ft
                    </p>
                  </div>
                )}
                {load.temperature && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500">Temperature</p>
                    <p className="mt-1 text-base text-white">{load.temperature}°F</p>
                  </div>
                )}
                {load.value && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500">Shipment Value</p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-400">
                      ${Number(load.value || 0).toLocaleString('en-US')}
                    </p>
                  </div>
                )}
                {load.carrier_type && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500">Carrier Type</p>
                    <p className="mt-1 text-base text-white">{load.carrier_type}</p>
                  </div>
                )}
                {load.load_type && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500">Load Type</p>
                    <p className="mt-1 text-base capitalize text-white">{load.load_type}</p>
                  </div>
                )}
                {load.freight_class && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500">Freight Class</p>
                    <p className="mt-1 text-base text-white">{load.freight_class}</p>
                  </div>
                )}
                {load.nmfc_code && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500">NMFC Code</p>
                    <p className="mt-1 text-base text-white">{load.nmfc_code}</p>
                  </div>
                )}
                {load.cube_ft && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500">Cube</p>
                    <p className="mt-1 text-base text-white">{load.cube_ft} ft3</p>
                  </div>
                )}
              </div>
              
              {/* Load Type Flags */}
              {(load.is_hazardous || load.is_oversized || load.is_reefer || load.is_tanker) && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-2">Special Requirements</p>
                  <div className="flex flex-wrap gap-2">
                    {load.is_hazardous && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/50">
                        HazMat
                      </span>
                    )}
                    {load.is_oversized && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/50">
                        Oversized
                      </span>
                    )}
                    {load.is_reefer && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/50">
                        Reefer
                      </span>
                    )}
                    {load.is_tanker && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/50">
                        Tanker
                      </span>
                    )}
                  </div>
                </div>
              )}
              {load.requires_permit && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-amber-300 font-medium">Permit required before dispatch</p>
                  {load.permit_requirement_reason ? (
                    <p className="text-xs text-muted-foreground mt-1">{load.permit_requirement_reason}</p>
                  ) : null}
                </div>
              )}
              {load.is_hazardous && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-2">HAZMAT Details</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <p className="text-sm"><span className="text-muted-foreground">UN Number:</span> {load.un_number || "N/A"}</p>
                    <p className="text-sm"><span className="text-muted-foreground">Hazard Class:</span> {load.hazard_class || "N/A"}</p>
                    <p className="text-sm"><span className="text-muted-foreground">Packing Group:</span> {load.packing_group || "N/A"}</p>
                    <p className="text-sm"><span className="text-muted-foreground">Placard Required:</span> {load.placard_required ? "Yes" : "No"}</p>
                    <p className="text-sm md:col-span-2"><span className="text-muted-foreground">Proper Shipping Name:</span> {load.proper_shipping_name || "N/A"}</p>
                    <p className="text-sm md:col-span-2"><span className="text-muted-foreground">Emergency Contact:</span> {load.emergency_contact || "N/A"}</p>
                  </div>
                </div>
              )}

              {/* Special Requirements */}
              {(load.requires_liftgate || load.requires_inside_delivery || load.requires_appointment) && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-2">Delivery Requirements</p>
                  <div className="flex flex-wrap gap-2">
                    {load.requires_liftgate && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
                        Requires Liftgate
                      </span>
                    )}
                    {load.requires_inside_delivery && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
                        Inside Delivery Required
                      </span>
                    )}
                    {load.requires_appointment && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
                        Appointment Required
                        {load.appointment_time && ` (${load.appointment_time})`}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {load.special_instructions && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-2">Special Instructions</p>
                  <p className="text-foreground whitespace-pre-wrap">{load.special_instructions}</p>
                </div>
              )}

              {relatedInvoice && (
                <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-2">Related Invoice</p>
                    {relatedInvoice.id && typeof relatedInvoice.id === 'string' && relatedInvoice.id.trim() !== '' ? (
                      <Link href={`/dashboard/accounting/invoices/${relatedInvoice.id}`}>
                        <Button variant="outline" size="sm" className="h-8 rounded-md border-border/70 bg-transparent">
                          <FileText className="w-4 h-4 mr-2" />
                          View Invoice {relatedInvoice.invoice_number}
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                )}
            </div>
          </DetailSection>

        {/* Pricing & Financial Information */}
          {(load.rate || load.total_rate || load.fuel_surcharge || load.accessorial_charges || load.discount || load.estimated_miles) && (
            <DetailSection
              title="Pricing & Charges"
              icon={<DollarSign className="w-5 h-5" />}
            >
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {load.rate && (
                  <div>
                      <p className="text-sm text-muted-foreground mb-2">Rate</p>
                      <p className="text-lg text-foreground font-bold">
                        ${Number(load.rate || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {load.rate_type && <span className="text-sm text-muted-foreground ml-2">({load.rate_type})</span>}
                      </p>
                  </div>
                )}
                  {load.fuel_surcharge && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Fuel Surcharge</p>
                      <p className="text-foreground font-medium">
                        ${Number(load.fuel_surcharge || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  {load.accessorial_charges && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Accessorial Charges</p>
                      <p className="text-foreground font-medium">
                        ${Number(load.accessorial_charges || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  {load.discount && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Discount</p>
                      <p className="text-foreground font-medium text-red-400">
                        -${Number(load.discount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  {load.total_rate && (
                    <div className="md:col-span-2 pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground mb-2">Total Rate</p>
                      <p className="text-2xl text-foreground font-bold">
                        ${Number(load.total_rate || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  {load.estimated_miles && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Estimated Miles</p>
                      <p className="text-foreground font-medium">{(load.estimated_miles || 0).toLocaleString()} miles</p>
                    </div>
                  )}
                  {(load.estimated_revenue || load.estimated_profit) && (
                    <>
                      {load.estimated_revenue && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Estimated Revenue</p>
                          <p className="text-foreground font-medium text-green-400">
                            ${Number(load.estimated_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                      {load.estimated_profit && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Estimated Profit</p>
                          <p className="text-foreground font-medium text-green-400">
                            ${Number(load.estimated_profit || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                    </>
                  )}
              </div>
            </div>
          </DetailSection>
          )}

          <DetailSection title="Permits" icon={<CircleAlert className="w-5 h-5" />}>
            <div className="space-y-4">
              {load.requires_permit ? (
                <p className="text-sm text-amber-300">
                  This load is flagged as oversize/overweight and requires a valid permit attachment before dispatch.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No permit requirement currently detected from load dimensions/weight.</p>
              )}

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label>Permit Number</Label>
                  <Input
                    value={permitForm.permit_number}
                    onChange={(e) => setPermitForm((p) => ({ ...p, permit_number: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Issuing State</Label>
                  <Input
                    value={permitForm.issuing_state}
                    onChange={(e) => setPermitForm((p) => ({ ...p, issuing_state: e.target.value.toUpperCase() }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Permit Type</Label>
                  <Input
                    value={permitForm.permit_type}
                    onChange={(e) => setPermitForm((p) => ({ ...p, permit_type: e.target.value }))}
                    className="mt-1"
                    placeholder="oversize / overweight"
                  />
                </div>
                <div>
                  <Label>Issued Date</Label>
                  <Input type="date" value={permitForm.issued_date} onChange={(e) => setPermitForm((p) => ({ ...p, issued_date: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Expiry Date</Label>
                  <Input type="date" value={permitForm.expiry_date} onChange={(e) => setPermitForm((p) => ({ ...p, expiry_date: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Max Weight (lbs)</Label>
                  <Input value={permitForm.max_weight} onChange={(e) => setPermitForm((p) => ({ ...p, max_weight: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Max Height (ft)</Label>
                  <Input value={permitForm.max_height} onChange={(e) => setPermitForm((p) => ({ ...p, max_height: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Max Width (ft)</Label>
                  <Input value={permitForm.max_width} onChange={(e) => setPermitForm((p) => ({ ...p, max_width: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Max Length (ft)</Label>
                  <Input value={permitForm.max_length} onChange={(e) => setPermitForm((p) => ({ ...p, max_length: e.target.value }))} className="mt-1" />
                </div>
                <div className="md:col-span-3">
                  <Label>Route Restriction</Label>
                  <Input
                    value={permitForm.route_restriction}
                    onChange={(e) => setPermitForm((p) => ({ ...p, route_restriction: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
              <Button size="sm" onClick={handleCreatePermit} disabled={isCreatingPermit}>
                {isCreatingPermit ? "Saving..." : "Add Permit"}
              </Button>

              {permits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No permits linked to this load.</p>
              ) : (
                <div className="space-y-2">
                  {permits.map((permit) => (
                    <div key={permit.id} className="rounded border border-border/60 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">
                            {permit.permit_number} ({permit.issuing_state}) - {permit.permit_type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Expires: {permit.expiry_date || "N/A"} {permit.document_id ? "• Attachment added" : "• No attachment"}
                          </p>
                        </div>
                        <label className="inline-flex">
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.png,.jpg,.jpeg,.webp"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) void handleUploadPermitFile(permit.id, file)
                            }}
                          />
                          <span className="cursor-pointer rounded-md border px-3 py-1.5 text-xs">Upload Attachment</span>
                        </label>
                      </div>
                      {permit.route_restriction ? (
                        <p className="text-xs text-muted-foreground mt-2">Route restriction: {permit.route_restriction}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DetailSection>

          <DetailSection title="Load Documents" icon={<FileText className="w-5 h-5" />}>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={handleGenerateRateConfirmation} disabled={isGeneratingRateConf}>
                  {isGeneratingRateConf ? "Generating..." : "Generate Rate Confirmation"}
                </Button>
                {load?.is_hazardous ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateHazmatShippingPaper}
                    disabled={isGeneratingHazmatPaper}
                  >
                    {isGeneratingHazmatPaper ? "Generating..." : "Generate HAZMAT Shipping Paper"}
                  </Button>
                ) : null}
              </div>
              {loadDocuments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents linked to this load yet.</p>
              ) : (
                <div className="space-y-2">
                  {loadDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded border border-border/60 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.type || "other"}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const urlResult = await getDocumentUrl(doc.id)
                          if (urlResult.error || !urlResult.data?.url) {
                            toast.error(urlResult.error || "Failed to open document")
                            return
                          }
                          window.open(urlResult.data.url, "_blank", "noopener,noreferrer")
                        }}
                      >
                        Open
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DetailSection>

          {/* Notes */}
          {(load.notes || load.internal_notes) && (
          <Card className="border-border p-4 md:p-8">
            <div className="flex items-center gap-3 mb-6">
                <FileText className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Notes</h2>
            </div>
              <div className="space-y-4">
                {load.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Public Notes</p>
                    <p className="text-foreground whitespace-pre-wrap">{load.notes}</p>
                  </div>
                )}
                {load.internal_notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Internal Notes</p>
                    <p className="text-foreground whitespace-pre-wrap bg-secondary/50 p-3 rounded">{load.internal_notes}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

        {/* Assignment & Dispatch Information */}
          <DetailSection
            title="Assignment"
            icon={<Truck className="w-5 h-5" />}
            className="border-border/70 bg-card/80"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Driver</p>
                {load.driver_id ? (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                      {(load.driver_name || "DR")
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part: string) => part[0]?.toUpperCase())
                        .join("") || "DR"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{load.driver_name || "Assigned Driver"}</p>
                      <p className="text-xs text-muted-foreground">ID: {load.driver_id.substring(0, 8)}...</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-md border border-dashed border-border/70 px-3 py-2 text-sm text-muted-foreground">
                    Unassigned
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Vehicle</p>
                {truck ? (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">
                        {truck.truck_number} - {truck.make} {truck.model}
                      </p>
                    </div>
                    {truck.status && (
                      <span
                        className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${
                          truck.status === "available"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : truck.status === "in_use"
                              ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                              : truck.status === "maintenance"
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                : "border-zinc-500/30 bg-zinc-500/10 text-zinc-300"
                        }`}
                      >
                        {truck.status.replace("_", " ")}
                      </span>
                    )}
                    {typeof truck.fuel_level === "number" && (
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>Fuel level</span>
                          <span>{truck.fuel_level}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-background/70">
                          <div
                            className="h-2 rounded-full bg-blue-500"
                            style={{ width: `${Math.max(0, Math.min(100, truck.fuel_level))}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : load.truck_id ? (
                  <p className="mt-3 text-sm text-foreground">Assigned (ID: {load.truck_id.substring(0, 8)}...)</p>
                ) : (
                  <div className="mt-3 rounded-md border border-dashed border-border/70 px-3 py-2 text-sm text-muted-foreground">
                    Unassigned
                  </div>
                )}
              </div>
            </div>
          </DetailSection>

          {/* Matching Route Information */}
          {matchingRoute ? (
          <DetailSection
            title="Recommended Truck Route"
            icon={<Route className="w-5 h-5" />}
            description={matchingRoute._compatibilityScore ? `Compatibility Score: ${matchingRoute._compatibilityScore}/300` : undefined}
            action={
                <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 rounded-full">
                  <Truck className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-semibold text-green-400">Truck-Optimized</span>
                </div>
            }
          >
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Route Name</p>
                  <p className="text-lg text-foreground font-bold">{matchingRoute.name || "N/A"}</p>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {matchingRoute.distance && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Distance</p>
                      <p className="text-foreground font-medium">{matchingRoute.distance}</p>
                    </div>
                  )}
                  {matchingRoute.estimated_time && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Estimated Time</p>
                      <p className="text-foreground font-medium">{matchingRoute.estimated_time}</p>
                    </div>
                  )}
                  {matchingRoute.priority && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Priority</p>
                      <p className="text-foreground font-medium capitalize">{matchingRoute.priority}</p>
                    </div>
                  )}
                  {matchingRoute.status && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Status</p>
                      <p className="text-foreground font-medium capitalize">{matchingRoute.status.replace("_", " ")}</p>
                    </div>
                  )}
                </div>
                {matchingRoute.waypoints && Array.isArray(matchingRoute.waypoints) && matchingRoute.waypoints.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Truck Route Waypoints</p>
                    <div className="space-y-1">
                      {matchingRoute.waypoints.map((waypoint: unknown, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <span className="text-foreground">
                            {typeof waypoint === "string"
                              ? waypoint
                              : typeof waypoint === "object" && waypoint !== null && "name" in waypoint
                                ? String((waypoint as { name?: unknown }).name || "")
                                : String(waypoint)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {matchingRoute._compatibilityReasons && matchingRoute._compatibilityReasons.length > 0 && (
                  <div className="border-t border-border/30 pt-4">
                    <p className="text-sm font-medium text-foreground mb-2">Why This Route is Recommended:</p>
                    <div className="space-y-1">
                      {matchingRoute._compatibilityReasons.map((reason: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {matchingRoute.id && typeof matchingRoute.id === 'string' && matchingRoute.id.trim() !== '' ? (
                  <Link href={`/dashboard/routes/${matchingRoute.id}`}>
                    <Button variant="outline" className="w-full">
                      View Full Route Details
                    </Button>
                  </Link>
                ) : null}
              </div>
          </DetailSection>
          ) : (
          <DetailSection
            title="No Matching Route Found"
            icon={<CircleAlert className="w-5 h-5 text-zinc-500" />}
            className="border-border/70 bg-card/80"
          >
            <div className="space-y-4">
              <p className="text-muted-foreground">
                No route found that matches this load's origin ({load.origin}) and destination ({load.destination}). 
                {routesResult?.data?.length === 0 ? (
                  <span className="block mt-2">You don't have any routes created yet. Create a route first, then assign it to loads.</span>
                ) : (
                  <span className="block mt-2">You may need to create a new route, or the route names might not match exactly. Try creating a route with matching origin and destination.</span>
                )}
              </p>
              <div className="flex gap-3">
                <Link href="/dashboard/routes/add">
                  <Button variant="outline" className="border-border/70 bg-transparent">
                    Create New Route
                  </Button>
                </Link>
                <Link href="/dashboard/routes">
                  <Button variant="outline" className="border-border/70 bg-transparent">
                    View All Routes
                  </Button>
                </Link>
              </div>
            </div>
          </DetailSection>
          )}

          {/* Real Google Maps Route */}
          {load.origin && load.destination && (
          <DetailSection
            title="Route Map"
            icon={<MapPin className="w-5 h-5" />}
            description="Real-time route from origin to destination"
          >
              <GoogleMapsRoute
                origin={load.origin}
                destination={load.destination}
                originCoordinates={load.origin_coordinates as { lat: number; lng: number } | undefined}
                destinationCoordinates={load.destination_coordinates as { lat: number; lng: number } | undefined}
                weight={weightKg}
                truckHeight={truck ? 4.2 : 4.0}
                contents={load.contents}
                stops={load.delivery_type === "multi" && deliveryPoints.length > 0 ? deliveryPoints.map((point) => ({
                  location_name: point.location_name,
                  address: point.address,
                  stop_number: point.delivery_number,
                  coordinates: point.coordinates as { lat: number; lng: number } | undefined,
                  stop_type: point.delivery_type || "delivery",
                })) : []}
                recommendedFuelStops={
                  Array.isArray(load.trip_planning_estimate?.fuel?.optimizer?.recommendations)
                    ? load.trip_planning_estimate.fuel.optimizer.recommendations
                    : []
                }
              />
          </DetailSection>
          )}
      </div>

      {/* Share Tracking Link Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Tracking Link</DialogTitle>
            <DialogDescription>
              Share this link with your customer to give them access to track this load in real-time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Portal URL:</p>
              <p className="text-sm text-muted-foreground break-all font-mono">{portalUrl}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCopyPortalUrl} className="flex-1">
                <Share2 className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsShareDialogOpen(false)}
              >
                Close
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The customer will receive an email with this link. The access expires in 90 days.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDispatchDialogOpen} onOpenChange={setIsDispatchDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dispatch This Load?</DialogTitle>
            <DialogDescription>
              Assign driver and truck, then dispatch. Status will move from pending to scheduled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <DriverSuggestionList
              loadId={id}
              enabled={isDispatchDialogOpen}
              onSelect={(suggestion: DriverSuggestion) => {
                setSelectedDispatchDriverId(suggestion.driver_id)
                if (suggestion.truck_id) {
                  setSelectedDispatchTruckId(suggestion.truck_id)
                }
                toast.success(`Selected ${suggestion.driver_name}`)
              }}
            />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Driver (manual override)</p>
              <Select value={selectedDispatchDriverId} onValueChange={setSelectedDispatchDriverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Truck (manual override)</p>
              <Select value={selectedDispatchTruckId} onValueChange={setSelectedDispatchTruckId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select truck" />
                </SelectTrigger>
                <SelectContent>
                  {trucks.map((truck) => (
                    <SelectItem key={truck.id} value={truck.id}>
                      {truck.truck_number} {truck.status ? `(${truck.status})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDispatchDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleQuickDispatch} disabled={isQuickDispatching}>
                {isQuickDispatching ? "Dispatching..." : "Confirm Dispatch"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SaveLoadTemplateDialog
        loadId={id}
        open={isSaveTemplateOpen}
        onOpenChange={setIsSaveTemplateOpen}
      />

      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Invoice?</DialogTitle>
            <DialogDescription>
              This creates an invoice from this load. If the load is still pending, status will be moved to scheduled automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsInvoiceDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleQuickInvoice} disabled={isQuickInvoicing}>
              {isQuickInvoicing ? "Creating..." : "Confirm Invoice"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DetailPageLayout>
    <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} feature="hazmat" />
    </>
  )
}
