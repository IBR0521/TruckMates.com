"use client"

import { Button } from "@/components/ui/button"
import { errorMessage } from "@/lib/error-message"
import { Card } from "@/components/ui/card"
import { ArrowLeft, MapPin, Package, Truck, Calendar, Edit2, Route, AlertCircle, Calculator, FileSpreadsheet } from "lucide-react"
import Link from "next/link"
import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { GoogleMapsRoute } from "@/components/google-maps-route"
import { getLoad } from "@/app/actions/loads"
import { getRoutes } from "@/app/actions/routes"
import { getTrucks } from "@/app/actions/trucks"
import { getLoadDeliveryPoints, getLoadSummary } from "@/app/actions/load-delivery-points"
import { getInvoices } from "@/app/actions/accounting"
import { autoGenerateInvoiceOnPOD } from "@/app/actions/auto-invoice"
import { toast } from "sonner"
import { Building2, FileText, DollarSign, Share2 } from "lucide-react"
import {
  DetailPageLayout,
  DetailSection,
  InfoGrid,
  InfoField,
  StatusBadge,
} from "@/components/dashboard/detail-page-layout"
import { LoadTripPlanningEstimate } from "@/components/load-trip-planning-estimate"
import type { TripPlanningEstimate } from "@/app/actions/promiles"
import { getLastStopRoutingAddress, getOrderedDeliveryStopAddresses } from "@/lib/load-routing-from-stops"
import { createCustomerPortalAccess } from "@/app/actions/customer-portal"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function LoadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [load, setLoad] = useState<any>(null)
  const [matchingRoute, setMatchingRoute] = useState<any>(null)
  const [truck, setTruck] = useState<any>(null)
  const [routesResult, setRoutesResult] = useState<{ data: any[] | null; error: string | null } | null>(null)
  const [deliveryPoints, setDeliveryPoints] = useState<any[]>([])
  const [loadSummary, setLoadSummary] = useState<any>(null)
  const [relatedInvoice, setRelatedInvoice] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [portalUrl, setPortalUrl] = useState<string>("")
  const [isCreatingPortal, setIsCreatingPortal] = useState(false)
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false)

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
    if (id === "add") {
      router.replace("/dashboard/loads/add")
    }
  }, [id, router])

  useEffect(() => {
    let isMounted = true
    
    async function loadData() {
      if (!id || id === "add" || !isMounted) return
      
      setIsLoading(true)
      
      try {
      // Fetch load data
      const loadResult = await getLoad(id)
        if (!isMounted) return
        
      if (loadResult.error) {
        toast.error(loadResult.error || "Failed to load load details")
          if (isMounted) setIsLoading(false)
        return
      }
      
      if (loadResult.data) {
        setLoad(loadResult.data)
        
        // Fetch delivery points if multi-delivery load
        if (loadResult.data.delivery_type === "multi") {
          const deliveryPointsResult = await getLoadDeliveryPoints(id)
            if (isMounted && deliveryPointsResult.data) {
            setDeliveryPoints(deliveryPointsResult.data)
          }
          
          const summaryResult = await getLoadSummary(id)
            if (isMounted && summaryResult.data) {
            setLoadSummary(summaryResult.data)
          }
        }
        
        // Fetch truck data directly by ID if load has truck_id (optimized - no need to fetch all trucks)
        if (loadResult.data.truck_id) {
          const { getTruck } = await import("@/app/actions/trucks")
          const truckResult = await getTruck(loadResult.data.truck_id)
            if (isMounted && truckResult.data) {
            setTruck(truckResult.data)
          }
        }
        
        // Fetch related invoice directly by load_id if load is delivered (optimized)
        if (loadResult.data.status === "delivered") {
          const { getInvoices } = await import("@/app/actions/accounting")
          const invoicesResult = await getInvoices({ load_id: id, limit: 1 })
            if (isMounted && invoicesResult.data && invoicesResult.data.length > 0) {
            setRelatedInvoice(invoicesResult.data[0])
          }
        }

        // Fetch routes with limit (optimized - only need a few for matching)
        const routesResult = await getRoutes({ limit: 50 })
          if (!isMounted) return
          
        setRoutesResult(routesResult)
        if (routesResult.data) {
          // Calculate load weight in kg
          const loadWeightKg = loadResult.data.weight_kg || 
            (loadResult.data.weight ? parseFloat(loadResult.data.weight.replace(/[^0-9.]/g, "")) * 1000 : 0)
          
          // Get truck dimensions if available
          let truckHeight = 4.0 // default in meters
          let truckMaxWeight = 80000 // default in lbs (80,000 lbs = ~36,000 kg)
          
          // Check if truck is assigned (truck state is set asynchronously, so check truck_id from load)
          if (loadResult.data.truck_id) {
            // Estimate truck height from type (if available) or use default
            // Standard semi-truck height is typically 4.0-4.2m
            truckHeight = 4.2 // Default for semi-trucks
            // Max weight from truck specs if available (assuming it's stored as string)
            // Note: This would need to be added to the truck schema if not already there
          }
          
          // Find routes that match the load's origin and destination
          // More flexible matching: extract city/state from both sides
          const normalizeLocation = (location: string) => {
            if (!location) return ""
            // Remove common suffixes and normalize
            return location.toLowerCase()
              .replace(/,/g, "")
              .replace(/\s+/g, " ")
              .trim()
          }
          
          const loadOriginNormalized = normalizeLocation(loadResult.data.origin || "")
          const loadDestNormalized = normalizeLocation(loadResult.data.destination || "")
          
          const matchingRoutes = routesResult.data.filter((route: any) => {
            const routeOriginNormalized = normalizeLocation(route.origin || "")
            const routeDestNormalized = normalizeLocation(route.destination || "")
            
            // Check if any part of the location matches (more flexible)
            const originMatch = 
              routeOriginNormalized && loadOriginNormalized &&
              (routeOriginNormalized.includes(loadOriginNormalized) ||
               loadOriginNormalized.includes(routeOriginNormalized) ||
               // Extract city name (first word) for partial matching
               routeOriginNormalized.split(" ")[0] === loadOriginNormalized.split(" ")[0])
            
            const destMatch = 
              routeDestNormalized && loadDestNormalized &&
              (routeDestNormalized.includes(loadDestNormalized) ||
               loadDestNormalized.includes(routeDestNormalized) ||
               // Extract city name (first word) for partial matching
               routeDestNormalized.split(" ")[0] === loadDestNormalized.split(" ")[0])
            
            return originMatch && destMatch
          })
          
          // Score and rank routes based on truck compatibility
          const scoredRoutes = matchingRoutes.map((route: any) => {
            let score = 0
            const reasons: string[] = []
            
            // Exact match gets highest score
            if (route.origin?.toLowerCase() === loadResult.data.origin?.toLowerCase() &&
                route.destination?.toLowerCase() === loadResult.data.destination?.toLowerCase()) {
              score += 100
              reasons.push("Exact origin and destination match")
            } else {
              score += 50
              reasons.push("Partial location match")
            }
            
            // Check if route is assigned to a truck (truck-specific route)
            if (route.truck_id) {
              score += 30
              reasons.push("Route assigned to specific truck")
              // Bonus if it matches the load's truck
              if (route.truck_id === loadResult.data.truck_id) {
                score += 50
                reasons.push("Route matches assigned truck")
              }
            }
            
            // Check route status (prefer active/scheduled routes)
            if (route.status === "scheduled" || route.status === "in_progress") {
              score += 20
              reasons.push("Route is active/scheduled")
            } else if (route.status === "pending") {
              score += 10
            }
            
            // Check priority (high priority routes get bonus)
            if (route.priority === "high") {
              score += 15
              reasons.push("High priority route")
            }
            
            // Check if route has waypoints (more detailed = better)
            if (route.waypoints && Array.isArray(route.waypoints) && route.waypoints.length > 0) {
              score += 10
              reasons.push("Route has detailed waypoints")
            }
            
            // Check if route has distance/time info (more complete = better)
            if (route.distance && route.estimated_time) {
              score += 10
              reasons.push("Route has complete distance/time info")
            }
            
            // Truck compatibility checks
            // Check if route is suitable for heavy loads
            if (loadWeightKg > 36000) { // Heavy load (>36,000 kg)
              // Prefer routes that explicitly mention truck routes or highways
              if (route.name?.toLowerCase().includes("truck") || 
                  route.name?.toLowerCase().includes("highway") ||
                  route.name?.toLowerCase().includes("i-") ||
                  route.name?.toLowerCase().includes("us-")) {
                score += 25
                reasons.push("Route suitable for heavy loads (truck routes/highways)")
              }
            }
            
            // Check hazmat compatibility
            const isHazmat = loadResult.data.contents?.toLowerCase().includes("chemical") ||
                            loadResult.data.contents?.toLowerCase().includes("hazard") ||
                            loadResult.data.contents?.toLowerCase().includes("hazmat")
            if (isHazmat) {
              // Prefer routes that avoid tunnels or have hazmat info
              if (route.special_instructions?.toLowerCase().includes("hazmat") ||
                  route.special_instructions?.toLowerCase().includes("no tunnel")) {
                score += 20
                reasons.push("Route compatible with hazmat cargo")
              }
            }
            
            // Check truck height restrictions
            if (truckHeight > 4.2) {
              // Prefer routes with height clearance info
              if (route.special_instructions?.toLowerCase().includes("clearance") ||
                  route.special_instructions?.toLowerCase().includes("bridge")) {
                score += 15
                reasons.push("Route considers height restrictions")
              }
            }
            
            return { route, score, reasons }
          })
          
          // Sort by score (highest first)
          scoredRoutes.sort((a: { score: number; [key: string]: any }, b: { score: number; [key: string]: any }) => b.score - a.score)
          
          // If load has a route_id, prioritize that route
          if (loadResult.data.route_id) {
            const specificRoute = routesResult.data.find((r: any) => r.id === loadResult.data.route_id)
            if (specificRoute) {
              // Find it in scored routes or add it
              const existingIndex = scoredRoutes.findIndex((sr: any) => sr.route.id === specificRoute.id)
              if (existingIndex >= 0) {
                // Boost its score
                scoredRoutes[existingIndex].score += 200
                scoredRoutes[existingIndex].reasons.push("This is the assigned route for this load")
              } else {
                // Add it at the top
                scoredRoutes.unshift({
                  route: specificRoute,
                  score: 200,
                  reasons: ["This is the assigned route for this load"]
                })
              }
              // Re-sort
              scoredRoutes.sort((a: { score: number; [key: string]: any }, b: { score: number; [key: string]: any }) => b.score - a.score)
            }
          }
          
          // Get the best route
          const bestRoute = scoredRoutes.length > 0 ? scoredRoutes[0].route : null
          
          // Store route compatibility info
          if (bestRoute && scoredRoutes.length > 0) {
            bestRoute._compatibilityScore = scoredRoutes[0].score
            bestRoute._compatibilityReasons = scoredRoutes[0].reasons
          }
          
          setMatchingRoute(bestRoute || null)
        }
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
  const weightKg = load.weight_kg || (load.weight ? parseFloat(load.weight.replace(/[^0-9.]/g, "")) * 1000 : 0)

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

  const getStatusVariant = (status: string): "success" | "default" | "warning" | "danger" | "info" => {
    switch (status?.toLowerCase()) {
      case "delivered":
        return "success"
      case "in_transit":
        return "info"
      case "pending":
        return "warning"
      case "cancelled":
        return "danger"
      default:
        return "default"
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

  function handleCopyPortalUrl() {
    if (portalUrl) {
      navigator.clipboard.writeText(portalUrl)
      toast.success("Portal URL copied to clipboard!")
    }
  }

  return (
    <DetailPageLayout
      title={load.shipment_number || "Load Details"}
      subtitle={load.origin && load.destination ? `${load.origin} → ${load.destination}` : undefined}
      backUrl="/dashboard/loads"
      editUrl={`/dashboard/loads/${id}/edit`}
      actions={
        <div className="flex items-center gap-2">
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
          ) : relatedInvoice?.id ? (
            <Link href={`/dashboard/accounting/invoices/${relatedInvoice.id}`}>
              <Button variant="outline" size="sm" className="h-9">
                <FileText className="w-4 h-4 mr-2" />
                View Invoice
              </Button>
            </Link>
          ) : null}
          <Link href={`/dashboard/bols/create?loadId=${id}`}>
            <Button variant="outline" size="sm" className="h-9">
              <FileText className="w-4 h-4 mr-2" />
              Create BOL
            </Button>
          </Link>
          {load.customer_id ? (
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={handleShareTrackingLink}
              disabled={isCreatingPortal}
            >
              <Share2 className="w-4 h-4 mr-2" />
              {isCreatingPortal ? "Creating..." : "Share Tracking Link"}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-6">
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

        {/* Status Indicators - TruckLogics Style */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="p-4 border-2">
            <div className="flex items-center justify-between">
                <div>
                <p className="text-sm text-muted-foreground mb-1">Dispatch Status</p>
                <StatusBadge 
                  status={dispatchStatus} 
                  variant={dispatchStatusVariant}
                />
                </div>
              </div>
          </Card>
          <Card className="p-4 border-2">
            <div className="flex items-center justify-between">
                <div>
                <p className="text-sm text-muted-foreground mb-1">Invoice Status</p>
                <StatusBadge 
                  status={invoiceStatus} 
                  variant={invoiceStatusVariant}
                />
                </div>
              </div>
          </Card>
          <Card className="p-4 border-2">
            <div className="flex items-center justify-between">
                  <div>
                <p className="text-sm text-muted-foreground mb-1">Load Status</p>
                <StatusBadge 
                  status={load.status?.replace("_", " ") || "Unknown"} 
                  variant={getStatusVariant(load.status)}
                />
                  </div>
                </div>
          </Card>
        </div>

        {/* Load Overview - Always Visible */}
        <DetailSection
          title="Load Overview"
          icon={<Package className="w-5 h-5" />}
          description="Basic load information and status"
        >
            <InfoGrid cols={2}>
              <InfoField
                label="Shipment Number"
                value={load.shipment_number || "—"}
              />
              <InfoField
                label="Status"
                value={
                  <StatusBadge
                    status={load.status?.replace("_", " ") || "Unknown"}
                    variant={getStatusVariant(load.status)}
                  />
                }
              />
              <InfoField
                label="Origin"
                value={load.origin || "—"}
                icon={<MapPin className="w-4 h-4" />}
              />
              <InfoField
                label="Destination"
                value={load.destination || "—"}
                icon={<MapPin className="w-4 h-4" />}
              />
              {load.company_name && (
                <InfoField
                  label="Company"
                  value={load.company_name}
                  icon={<Building2 className="w-4 h-4" />}
                />
              )}
              {load.delivery_type && (
                <InfoField
                  label="Delivery Type"
                  value={load.delivery_type === "multi" ? "Multiple Deliveries" : "Single Delivery"}
                />
              )}
              {load.load_date && (
                <InfoField
                  label="Load Date"
                  value={formatDate(load.load_date)}
                  icon={<Calendar className="w-4 h-4" />}
                />
              )}
              {load.estimated_delivery && (
                <InfoField
                  label="Estimated Delivery"
                  value={formatDate(load.estimated_delivery)}
                  icon={<Calendar className="w-4 h-4" />}
                />
              )}
            </InfoGrid>
          </DetailSection>

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
          >
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Weight</p>
                  <p className="text-lg text-foreground font-bold">{load.weight || (load.weight_kg ? `${(load.weight_kg / 1000).toFixed(1)} tons` : "N/A")}</p>
                  {load.weight_kg && (
                    <p className="text-xs text-muted-foreground mt-1">{load.weight_kg.toLocaleString()} kg</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Contents</p>
                  <p className="text-lg text-foreground font-bold">{load.contents || "N/A"}</p>
                </div>
                {load.pieces && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Pieces</p>
                    <p className="text-foreground font-medium">{load.pieces}</p>
                  </div>
                )}
                {load.pallets && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Pallets</p>
                    <p className="text-foreground font-medium">{load.pallets}</p>
                  </div>
                )}
                {load.boxes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Boxes</p>
                    <p className="text-foreground font-medium">{load.boxes}</p>
                  </div>
                )}
                {(load.length || load.width || load.height) && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Dimensions</p>
                    <p className="text-foreground font-medium">
                      {[load.length, load.width, load.height].filter(Boolean).join(" × ")} ft
                    </p>
                  </div>
                )}
                {load.temperature && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Temperature</p>
                    <p className="text-foreground font-medium">{load.temperature}°F</p>
                  </div>
                )}
                {load.value && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Shipment Value</p>
                    <p className="text-lg text-foreground font-bold">${typeof load.value === 'number' ? load.value.toLocaleString('en-US') : parseFloat(load.value || '0').toLocaleString('en-US')}</p>
                  </div>
                )}
                {load.carrier_type && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Carrier Type</p>
                    <p className="text-lg text-foreground font-bold">{load.carrier_type}</p>
                  </div>
                )}
                {load.load_type && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Load Type</p>
                    <p className="text-foreground font-medium capitalize">{load.load_type}</p>
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
                        <Button variant="outline" size="sm" className="w-full sm:w-auto">
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
                        ${typeof load.rate === 'number' ? load.rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : parseFloat(load.rate || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {load.rate_type && <span className="text-sm text-muted-foreground ml-2">({load.rate_type})</span>}
                      </p>
                  </div>
                )}
                  {load.fuel_surcharge && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Fuel Surcharge</p>
                      <p className="text-foreground font-medium">
                        ${typeof load.fuel_surcharge === 'number' ? load.fuel_surcharge.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : parseFloat(load.fuel_surcharge || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  {load.accessorial_charges && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Accessorial Charges</p>
                      <p className="text-foreground font-medium">
                        ${typeof load.accessorial_charges === 'number' ? load.accessorial_charges.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : parseFloat(load.accessorial_charges || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  {load.discount && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Discount</p>
                      <p className="text-foreground font-medium text-red-400">
                        -${typeof load.discount === 'number' ? load.discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : parseFloat(load.discount || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  {load.total_rate && (
                    <div className="md:col-span-2 pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground mb-2">Total Rate</p>
                      <p className="text-2xl text-foreground font-bold">
                        ${typeof load.total_rate === 'number' ? load.total_rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : parseFloat(load.total_rate || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                            ${typeof load.estimated_revenue === 'number' ? load.estimated_revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : parseFloat(load.estimated_revenue || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                      {load.estimated_profit && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Estimated Profit</p>
                          <p className="text-foreground font-medium text-green-400">
                            ${typeof load.estimated_profit === 'number' ? load.estimated_profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : parseFloat(load.estimated_profit || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                    </>
                  )}
              </div>
            </div>
          </DetailSection>
          )}

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
          >
            <div className="space-y-4">
              {load.driver_id ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Driver</p>
                  <p className="text-foreground font-medium">Assigned (ID: {load.driver_id ? load.driver_id.substring(0, 8) : 'N/A'}...)</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Driver</p>
                  <p className="text-foreground font-medium text-muted-foreground">Not assigned</p>
                </div>
              )}
              {truck ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Vehicle</p>
                  <p className="text-foreground font-medium">{truck.truck_number} - {truck.make} {truck.model}</p>
                  {truck.status && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Status: <span className={`${
                        truck.status === "available" ? "text-green-400" :
                        truck.status === "in_use" ? "text-blue-400" :
                        truck.status === "maintenance" ? "text-yellow-400" :
                        "text-gray-400"
                      }`}>{truck.status}</span>
                    </p>
                  )}
                  {truck.fuel_level !== null && (
                    <p className="text-xs text-muted-foreground mt-1">Fuel Level: {truck.fuel_level}%</p>
                  )}
                </div>
              ) : load.truck_id ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Vehicle</p>
                  <p className="text-foreground font-medium">Assigned (ID: {load.truck_id ? load.truck_id.substring(0, 8) : 'N/A'}...)</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Vehicle</p>
                  <p className="text-foreground font-medium text-muted-foreground">Not assigned</p>
                </div>
              )}
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
                      {matchingRoute.waypoints.map((waypoint: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <span className="text-foreground">{typeof waypoint === 'string' ? waypoint : waypoint.name || waypoint}</span>
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
            icon={<AlertCircle className="w-5 h-5" />}
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
                  <Button variant="outline">
                    Create New Route
                  </Button>
                </Link>
                <Link href="/dashboard/routes">
                  <Button variant="outline">
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
    </DetailPageLayout>
  )
}
