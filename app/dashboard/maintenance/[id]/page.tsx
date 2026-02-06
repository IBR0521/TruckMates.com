"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  CheckCircle,
  Wrench,
  FileText,
  Package,
  AlertTriangle,
  Upload,
  Download,
  Trash2,
  Plus,
  ExternalLink,
  Calendar,
  DollarSign,
  Truck,
  User,
  Clock,
} from "lucide-react"
import Link from "next/link"
import { use } from "react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { getMaintenanceById, updateMaintenanceStatus } from "@/app/actions/maintenance"
import {
  getWorkOrders,
  createWorkOrderFromMaintenance,
  checkAndReserveParts,
  completeWorkOrder,
} from "@/app/actions/maintenance-enhanced"
import {
  getMaintenanceDocuments,
  uploadMaintenanceDocument,
  deleteMaintenanceDocument,
} from "@/app/actions/maintenance-enhanced"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export default function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [maintenance, setMaintenance] = useState<any>(null)
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "work-orders" | "documents" | "parts">("overview")
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadDocumentType, setUploadDocumentType] = useState("repair_order")

  useEffect(() => {
    if (id === "add") {
      router.replace("/dashboard/maintenance/add")
      return
    }
    loadData()
  }, [id, router])

  async function loadData() {
    setIsLoading(true)
    try {
      const [maintenanceResult, workOrdersResult, documentsResult] = await Promise.all([
        getMaintenanceById(id),
        getWorkOrders({ maintenance_id: id }),
        getMaintenanceDocuments(id),
      ])

      if (maintenanceResult.error) {
        toast.error(maintenanceResult.error)
        router.push("/dashboard/maintenance")
        return
      }

      setMaintenance(maintenanceResult.data)
      setWorkOrders(workOrdersResult.data || [])
      setDocuments(documentsResult.data || [])
    } catch (error: any) {
      toast.error("Failed to load maintenance data")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleMarkCompleted() {
    if (!maintenance) return

    const result = await updateMaintenanceStatus(
      id,
      "completed",
      maintenance.actual_cost || maintenance.estimated_cost
    )

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Maintenance marked as completed")
      loadData()
    }
  }

  async function handleCreateWorkOrder() {
    const result = await createWorkOrderFromMaintenance(id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Work order created successfully")
      loadData()
    }
  }

  async function handleUploadDocument() {
    if (!uploadFile) {
      toast.error("Please select a file")
      return
    }

    const result = await uploadMaintenanceDocument(id, uploadFile, uploadDocumentType)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Document uploaded successfully")
      setIsUploadDialogOpen(false)
      setUploadFile(null)
      loadData()
    }
  }

  async function handleDeleteDocument(documentId: string) {
    if (!confirm("Are you sure you want to delete this document?")) return

    const result = await deleteMaintenanceDocument(documentId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Document deleted successfully")
      loadData()
    }
  }

  async function handleReserveParts(workOrderId: string) {
    const result = await checkAndReserveParts(workOrderId)
    if (result.error) {
      toast.error(result.error)
    } else {
      const allReserved = result.data?.every((p: any) => p.reserved)
      if (allReserved) {
        toast.success("All parts reserved successfully")
      } else {
        toast.warning("Some parts could not be reserved - check inventory")
      }
      loadData()
    }
  }

  async function handleCompleteWorkOrder(workOrderId: string) {
    const result = await completeWorkOrder(workOrderId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Work order completed successfully")
      loadData()
    }
  }

  if (isLoading) {
    return (
      <div className="w-full p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading maintenance details...</p>
        </div>
      </div>
    )
  }

  if (!maintenance) {
    return (
      <div className="w-full p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Maintenance record not found</p>
          <Link href="/dashboard/maintenance">
            <Button variant="outline" className="mt-4">
              Back to Maintenance
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const truck = maintenance.truck as any
  const partsUsed = (maintenance.parts_used as any[]) || []
  const faultCodeEvent = maintenance.maintenance_id ? null : null // Would need to query eld_events

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <Link href="/dashboard/maintenance">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Maintenance
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Maintenance Details</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {truck?.truck_number || "Truck"} - {maintenance.service_type}
            </p>
          </div>
          <div className="flex gap-2">
            {maintenance.status !== "completed" && (
              <Button onClick={handleMarkCompleted} className="bg-green-500 hover:bg-green-600">
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Completed
              </Button>
            )}
            {workOrders.length === 0 && maintenance.status !== "completed" && (
              <Button onClick={handleCreateWorkOrder} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Create Work Order
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="max-w-7xl mx-auto">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="work-orders">
              Work Orders ({workOrders.length})
            </TabsTrigger>
            <TabsTrigger value="documents">
              Documents ({documents.length})
            </TabsTrigger>
            <TabsTrigger value="parts">Parts ({partsUsed.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-border p-6">
                <h3 className="text-lg font-semibold mb-4">Maintenance Information</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Truck className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Truck</p>
                      <p className="font-medium">
                        {truck?.truck_number || "N/A"} {truck?.make && truck?.model && `(${truck.make} ${truck.model})`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Wrench className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Service Type</p>
                      <p className="font-medium">{maintenance.service_type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Scheduled Date</p>
                      <p className="font-medium">
                        {new Date(maintenance.scheduled_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {maintenance.completed_date && (
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Completed Date</p>
                        <p className="font-medium">
                          {new Date(maintenance.completed_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Mileage</p>
                      <p className="font-medium">
                        {maintenance.current_mileage
                          ? `${maintenance.current_mileage.toLocaleString()} mi`
                          : maintenance.mileage
                          ? `${maintenance.mileage.toLocaleString()} mi`
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="border-border p-6">
                <h3 className="text-lg font-semibold mb-4">Status & Cost</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                    <Badge
                      className={
                        maintenance.status === "completed"
                          ? "bg-green-500/20 text-green-400"
                          : maintenance.status === "in_progress"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }
                    >
                      {maintenance.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Priority</p>
                    <Badge
                      className={
                        maintenance.priority === "high" || maintenance.priority === "urgent"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-blue-500/20 text-blue-400"
                      }
                    >
                      {maintenance.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Estimated Cost</p>
                      <p className="font-medium">
                        {maintenance.estimated_cost ? `$${maintenance.estimated_cost.toFixed(2)}` : "N/A"}
                      </p>
                    </div>
                  </div>
                  {maintenance.actual_cost && (
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Actual Cost</p>
                        <p className="font-medium">${maintenance.actual_cost.toFixed(2)}</p>
                      </div>
                    </div>
                  )}
                  {maintenance.vendor && (
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Vendor</p>
                        <p className="font-medium">{maintenance.vendor}</p>
                      </div>
                    </div>
                  )}
                  {maintenance.technician && (
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Technician</p>
                        <p className="font-medium">{maintenance.technician}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {maintenance.notes && (
              <Card className="border-border p-6">
                <h3 className="text-lg font-semibold mb-4">Notes</h3>
                <p className="text-foreground whitespace-pre-wrap">{maintenance.notes}</p>
              </Card>
            )}

            {faultCodeEvent && (
              <Card className="border-border p-6 border-orange-500/50">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Created from ELD Fault Code</h3>
                    <p className="text-sm text-muted-foreground">
                      This maintenance was automatically created from an ELD diagnostic fault code.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="work-orders" className="space-y-6 mt-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Work Orders</h3>
              {workOrders.length === 0 && maintenance.status !== "completed" && (
                <Button onClick={handleCreateWorkOrder}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Work Order
                </Button>
              )}
            </div>

            {workOrders.length === 0 ? (
              <Card className="border-border p-8">
                <div className="text-center py-8">
                  <Wrench className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No work orders created yet</p>
                  {maintenance.status !== "completed" && (
                    <Button onClick={handleCreateWorkOrder} className="mt-4">
                      Create Work Order
                    </Button>
                  )}
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {workOrders.map((wo: any) => (
                  <Card key={wo.id} className="border-border p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-semibold">{wo.work_order_number}</h4>
                        <p className="text-sm text-muted-foreground">{wo.title}</p>
                      </div>
                      <Badge
                        className={
                          wo.status === "completed"
                            ? "bg-green-500/20 text-green-400"
                            : wo.status === "in_progress"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }
                      >
                        {wo.status}
                      </Badge>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Estimated Cost</p>
                        <p className="font-medium">
                          {wo.estimated_total_cost ? `$${wo.estimated_total_cost.toFixed(2)}` : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Actual Cost</p>
                        <p className="font-medium">
                          {wo.actual_total_cost ? `$${wo.actual_total_cost.toFixed(2)}` : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Labor Hours</p>
                        <p className="font-medium">
                          {wo.actual_labor_hours || wo.estimated_labor_hours || "N/A"}
                        </p>
                      </div>
                    </div>
                    {wo.parts_required && (wo.parts_required as any[]).length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm text-muted-foreground mb-2">Parts Required</p>
                        <div className="space-y-1">
                          {(wo.parts_required as any[]).map((part: any, idx: number) => (
                            <p key={idx} className="text-sm">
                              {part.name || part.part_number} - Qty: {part.quantity}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      {!wo.parts_reserved && wo.status !== "completed" && (
                        <Button
                          onClick={() => handleReserveParts(wo.id)}
                          variant="outline"
                          size="sm"
                        >
                          Reserve Parts
                        </Button>
                      )}
                      {wo.status !== "completed" && (
                        <Button
                          onClick={() => handleCompleteWorkOrder(wo.id)}
                          size="sm"
                          className="bg-green-500 hover:bg-green-600"
                        >
                          Complete Work Order
                        </Button>
                      )}
                      <Link href={`/dashboard/maintenance/work-orders/${wo.id}`}>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="documents" className="space-y-6 mt-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Documents</h3>
              <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Document
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Maintenance Document</DialogTitle>
                    <DialogDescription>Upload a document related to this maintenance record</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Document Type</Label>
                      <Select value={uploadDocumentType} onValueChange={setUploadDocumentType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="repair_order">Repair Order</SelectItem>
                          <SelectItem value="invoice">Invoice</SelectItem>
                          <SelectItem value="warranty">Warranty</SelectItem>
                          <SelectItem value="part_receipt">Part Receipt</SelectItem>
                          <SelectItem value="inspection">Inspection</SelectItem>
                          <SelectItem value="estimate">Estimate</SelectItem>
                          <SelectItem value="work_order">Work Order</SelectItem>
                          <SelectItem value="photo">Photo</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>File</Label>
                      <Input
                        type="file"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      />
                    </div>
                    <Button onClick={handleUploadDocument} className="w-full" disabled={!uploadFile}>
                      Upload
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {documents.length === 0 ? (
              <Card className="border-border p-8">
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No documents uploaded yet</p>
                </div>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {documents.map((doc: any) => (
                  <Card key={doc.id} className="border-border p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">{doc.name}</h4>
                        <p className="text-sm text-muted-foreground">{doc.document_type}</p>
                      </div>
                      <Badge variant="outline">{doc.document_type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2">
                      <a href={doc.storage_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View
                        </Button>
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="text-red-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="parts" className="space-y-6 mt-6">
            <h3 className="text-lg font-semibold">Parts Used</h3>
            {partsUsed.length === 0 ? (
              <Card className="border-border p-8">
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No parts recorded yet</p>
                </div>
              </Card>
            ) : (
              <Card className="border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-6 py-3 text-left text-sm font-semibold">Part Number</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">Quantity</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">Unit Cost</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">Total Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partsUsed.map((part: any, idx: number) => (
                        <tr key={idx} className="border-b border-border hover:bg-secondary/20">
                          <td className="px-6 py-4">{part.part_number || "N/A"}</td>
                          <td className="px-6 py-4">{part.name || "N/A"}</td>
                          <td className="px-6 py-4">{part.quantity || 0}</td>
                          <td className="px-6 py-4">
                            {part.unit_cost ? `$${part.unit_cost.toFixed(2)}` : "N/A"}
                          </td>
                          <td className="px-6 py-4">
                            {part.total_cost ? `$${part.total_cost.toFixed(2)}` : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
