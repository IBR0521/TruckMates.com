"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { getPortalAccessByToken, getCustomerPortalLoads, getCustomerPortalLoad, getCustomerPortalDocuments, getCustomerPortalInvoices } from "@/app/actions/customer-portal"
import { Package, FileText, DollarSign, MapPin, Download, Truck, Calendar } from "lucide-react"
import { format } from "date-fns"
import { use } from "react"

export default function CustomerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [portalAccess, setPortalAccess] = useState<any>(null)
  const [loads, setLoads] = useState<any[]>([])
  const [selectedLoad, setSelectedLoad] = useState<any>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<"loads" | "documents" | "invoices">("loads")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadPortalData()
  }, [token])

  async function loadPortalData() {
    setIsLoading(true)
    try {
      const accessResult = await getPortalAccessByToken(token)
      if (accessResult.error || !accessResult.data) {
        toast.error(accessResult.error || "Invalid access token")
        return
      }

      setPortalAccess(accessResult.data)

      const [loadsResult, documentsResult, invoicesResult] = await Promise.all([
        getCustomerPortalLoads(token),
        getCustomerPortalDocuments(token),
        getCustomerPortalInvoices(token),
      ])

      if (loadsResult.data) setLoads(loadsResult.data)
      if (documentsResult.data) setDocuments(documentsResult.data)
      if (invoicesResult.data) setInvoices(invoicesResult.data)
    } catch (error: any) {
      toast.error("Failed to load portal data")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleLoadClick(loadId: string) {
    try {
      const result = await getCustomerPortalLoad(token, loadId)
      if (result.data) {
        setSelectedLoad(result.data)
      }
    } catch (error: any) {
      toast.error("Failed to load load details")
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>
      case "scheduled":
        return <Badge variant="blue">Scheduled</Badge>
      case "in_transit":
        return <Badge variant="primary">In Transit</Badge>
      case "delivered":
        return <Badge variant="success">Delivered</Badge>
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading portal...</p>
        </div>
      </div>
    )
  }

  if (!portalAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground">Invalid or expired access token.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {portalAccess.company?.name || "TruckMates"} - Customer Portal
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Welcome, {portalAccess.customer?.name || "Customer"}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border">
          <Button
            variant={activeTab === "loads" ? "default" : "ghost"}
            onClick={() => setActiveTab("loads")}
          >
            <Package className="w-4 h-4 mr-2" />
            Loads ({loads.length})
          </Button>
          <Button
            variant={activeTab === "documents" ? "default" : "ghost"}
            onClick={() => setActiveTab("documents")}
          >
            <FileText className="w-4 h-4 mr-2" />
            Documents ({documents.length})
          </Button>
          <Button
            variant={activeTab === "invoices" ? "default" : "ghost"}
            onClick={() => setActiveTab("invoices")}
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Invoices ({invoices.length})
          </Button>
        </div>

        {/* Loads Tab */}
        {activeTab === "loads" && (
          <div className="space-y-4">
            {loads.length === 0 ? (
              <Card className="p-8 text-center">
                <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No loads found</p>
              </Card>
            ) : (
              loads.map((load) => (
                <Card key={load.id} className="p-6 hover:bg-muted/50 transition cursor-pointer" onClick={() => handleLoadClick(load.id)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">Load {load.shipment_number}</h3>
                        {getStatusBadge(load.status)}
                      </div>
                      <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>{load.origin} → {load.destination}</span>
                        </div>
                        {load.driver && (
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            <span>Driver: {load.driver.name}</span>
                          </div>
                        )}
                        {load.load_date && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Pickup: {format(new Date(load.load_date), "MMM d, yyyy")}</span>
                          </div>
                        )}
                        {load.estimated_delivery && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Delivery: {format(new Date(load.estimated_delivery), "MMM d, yyyy")}</span>
                          </div>
                        )}
                      </div>
                      {load.contents && (
                        <p className="text-sm text-muted-foreground mt-2">Contents: {load.contents}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === "documents" && (
          <div className="space-y-4">
            {documents.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No documents available</p>
              </Card>
            ) : (
              documents.map((doc) => (
                <Card key={doc.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{doc.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {doc.type} • {format(new Date(doc.upload_date), "MMM d, yyyy")}
                      </p>
                    </div>
                    {doc.file_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </a>
                      </Button>
                    )}
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
                <DollarSign className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No invoices available</p>
              </Card>
            ) : (
              invoices.map((invoice) => (
                <Card key={invoice.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Invoice {invoice.invoice_number}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Amount: ${Number(invoice.amount).toFixed(2)} • 
                        Status: {invoice.status} • 
                        Due: {format(new Date(invoice.due_date), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Badge variant={invoice.status === "paid" ? "success" : invoice.status === "overdue" ? "destructive" : "secondary"}>
                      {invoice.status}
                    </Badge>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Load Detail Modal */}
        {selectedLoad && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedLoad(null)}>
            <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">Load {selectedLoad.shipment_number}</h2>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedLoad(null)}>×</Button>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-medium">{getStatusBadge(selectedLoad.status)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Origin</p>
                    <p className="font-medium">{selectedLoad.origin}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Destination</p>
                    <p className="font-medium">{selectedLoad.destination}</p>
                  </div>
                  {selectedLoad.driver_location && portalAccess.can_view_location && (
                    <div>
                      <p className="text-sm text-muted-foreground">Driver Location</p>
                      <p className="font-medium">{selectedLoad.driver_location.address || "Tracking..."}</p>
                    </div>
                  )}
                  {selectedLoad.contents && (
                    <div>
                      <p className="text-sm text-muted-foreground">Contents</p>
                      <p className="font-medium">{selectedLoad.contents}</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}




