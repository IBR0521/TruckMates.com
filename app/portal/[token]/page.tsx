"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Package, MapPin, Calendar, Truck, User, FileText, ArrowRight, CheckCircle2, XCircle, Clock } from "lucide-react"
import { getPortalAccessByToken, getCustomerPortalLoads, getCustomerPortalInvoices } from "@/app/actions/customer-portal"
import { toast } from "sonner"
import Link from "next/link"

export default function CustomerPortalPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const [isLoading, setIsLoading] = useState(true)
  const [portalAccess, setPortalAccess] = useState<any>(null)
  const [loads, setLoads] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<"loads" | "invoices">("loads")

  useEffect(() => {
    async function loadPortalData() {
      setIsLoading(true)
      try {
        const accessResult = await getPortalAccessByToken(token)
        if (accessResult.error || !accessResult.data) {
          toast.error(accessResult.error || "Invalid access token")
          router.push("/")
          return
        }

        setPortalAccess(accessResult.data)

        // Load loads and invoices
        const [loadsResult, invoicesResult] = await Promise.all([
          getCustomerPortalLoads(token),
          getCustomerPortalInvoices(token),
        ])

        if (loadsResult.data) setLoads(loadsResult.data)
        if (invoicesResult.data) setInvoices(invoicesResult.data)
      } catch (error: any) {
        toast.error("Failed to load portal data")
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }

    if (token) {
      loadPortalData()
    }
  }, [token, router])

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "delivered":
      case "completed":
      case "paid":
        return "bg-green-500"
      case "in_transit":
      case "in_progress":
        return "bg-blue-500"
      case "pending":
      case "draft":
        return "bg-yellow-500"
      case "cancelled":
      case "overdue":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return "N/A"
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading portal...</p>
        </div>
      </div>
    )
  }

  if (!portalAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 max-w-md w-full">
          <div className="text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            <p className="text-muted-foreground">Invalid or expired access token.</p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Customer Portal</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Welcome, {portalAccess.customer?.name || portalAccess.customer?.company_name || "Customer"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm">
                {portalAccess.company?.name || "TruckMates"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab("loads")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "loads"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Loads ({loads.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab("invoices")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "invoices"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Invoices ({invoices.length})
              </div>
            </button>
          </nav>
        </div>

        {/* Loads Tab */}
        {activeTab === "loads" && (
          <div className="space-y-4">
            {loads.length === 0 ? (
              <Card className="p-8 text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Loads Found</h3>
                <p className="text-muted-foreground">You don't have any loads assigned yet.</p>
              </Card>
            ) : (
              loads.map((load) => (
                <Card key={load.id} className="p-6 hover:shadow-md transition-shadow">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Package className="w-5 h-5 text-primary" />
                            {load.shipment_number || "N/A"}
                          </h3>
                          {load.contents && (
                            <p className="text-sm text-muted-foreground mt-1">{load.contents}</p>
                          )}
                        </div>
                        <Badge className={getStatusColor(load.status)}>
                          {load.status?.replace("_", " ").toUpperCase() || "UNKNOWN"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-xs text-muted-foreground">Origin</p>
                            <p className="text-sm font-medium">{load.origin || "N/A"}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-xs text-muted-foreground">Destination</p>
                            <p className="text-sm font-medium">{load.destination || "N/A"}</p>
                          </div>
                        </div>
                        {load.load_date && (
                          <div className="flex items-start gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground">Pickup Date</p>
                              <p className="text-sm font-medium">{formatDate(load.load_date)}</p>
                            </div>
                          </div>
                        )}
                        {load.estimated_delivery && (
                          <div className="flex items-start gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground">Est. Delivery</p>
                              <p className="text-sm font-medium">{formatDate(load.estimated_delivery)}</p>
                            </div>
                          </div>
                        )}
                        {load.driver && (
                          <div className="flex items-start gap-2">
                            <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground">Driver</p>
                              <p className="text-sm font-medium">{load.driver.name || "N/A"}</p>
                            </div>
                          </div>
                        )}
                        {load.truck && (
                          <div className="flex items-start gap-2">
                            <Truck className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground">Truck</p>
                              <p className="text-sm font-medium">{load.truck.truck_number || "N/A"}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <Link href={`/portal/${token}/loads/${load.id}`}>
                        <Button variant="outline" className="w-full sm:w-auto">
                          View Details
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Invoices Tab */}
        {activeTab === "invoices" && (
          <div className="space-y-4">
            {invoices.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Invoices Found</h3>
                <p className="text-muted-foreground">You don't have any invoices yet.</p>
              </Card>
            ) : (
              invoices.map((invoice) => (
                <Card key={invoice.id} className="p-6 hover:shadow-md transition-shadow">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary" />
                            {invoice.invoice_number || "N/A"}
                          </h3>
                          {invoice.description && (
                            <p className="text-sm text-muted-foreground mt-1">{invoice.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(invoice.status)}>
                            {invoice.status?.toUpperCase() || "UNKNOWN"}
                          </Badge>
                          {invoice.amount && (
                            <span className="text-lg font-semibold">${parseFloat(invoice.amount).toFixed(2)}</span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {invoice.issue_date && (
                          <div className="flex items-start gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground">Issue Date</p>
                              <p className="text-sm font-medium">{formatDate(invoice.issue_date)}</p>
                            </div>
                          </div>
                        )}
                        {invoice.due_date && (
                          <div className="flex items-start gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground">Due Date</p>
                              <p className="text-sm font-medium">{formatDate(invoice.due_date)}</p>
                            </div>
                          </div>
                        )}
                        {invoice.paid_date && (
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground">Paid Date</p>
                              <p className="text-sm font-medium">{formatDate(invoice.paid_date)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <Link href={`/portal/${token}/invoices/${invoice.id}`}>
                        <Button variant="outline" className="w-full sm:w-auto">
                          View Invoice
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
