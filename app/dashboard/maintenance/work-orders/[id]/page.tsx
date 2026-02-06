"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, CheckCircle, Package, User, Calendar, DollarSign, Truck, Wrench } from "lucide-react"
import Link from "next/link"
import { use } from "react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { getWorkOrder, updateWorkOrder, checkAndReserveParts, completeWorkOrder } from "@/app/actions/maintenance-enhanced"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [workOrder, setWorkOrder] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false)
  const [actualCost, setActualCost] = useState("")
  const [actualLaborHours, setActualLaborHours] = useState("")
  const [completionNotes, setCompletionNotes] = useState("")

  useEffect(() => {
    loadWorkOrder()
  }, [id])

  async function loadWorkOrder() {
    setIsLoading(true)
    const result = await getWorkOrder(id)
    if (result.error) {
      toast.error(result.error)
      router.push("/dashboard/maintenance/work-orders")
    } else {
      setWorkOrder(result.data)
      if (result.data?.actual_total_cost) {
        setActualCost(result.data.actual_total_cost.toString())
      }
      if (result.data?.actual_labor_hours) {
        setActualLaborHours(result.data.actual_labor_hours.toString())
      }
    }
    setIsLoading(false)
  }

  async function handleReserveParts() {
    const result = await checkAndReserveParts(id)
    if (result.error) {
      toast.error(result.error)
    } else {
      const allReserved = result.data?.every((p: any) => p.reserved)
      if (allReserved) {
        toast.success("All parts reserved successfully")
      } else {
        const unreserved = result.data?.filter((p: any) => !p.reserved)
        toast.warning(
          `Some parts could not be reserved: ${unreserved?.map((p: any) => p.part_name).join(", ")}`
        )
      }
      loadWorkOrder()
    }
  }

  async function handleComplete() {
    const result = await completeWorkOrder(
      id,
      actualCost ? parseFloat(actualCost) : undefined,
      actualLaborHours ? parseFloat(actualLaborHours) : undefined,
      completionNotes
    )
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Work order completed successfully")
      setIsCompleteDialogOpen(false)
      router.push(`/dashboard/maintenance/${result.data?.maintenance_id}`)
    }
  }

  async function handleUpdateStatus(newStatus: string) {
    const result = await updateWorkOrder(id, { status: newStatus })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Work order updated")
      loadWorkOrder()
    }
  }

  if (isLoading) {
    return (
      <div className="w-full p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading work order...</p>
        </div>
      </div>
    )
  }

  if (!workOrder) {
    return (
      <div className="w-full p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Work order not found</p>
          <Link href="/dashboard/maintenance/work-orders">
            <Button variant="outline" className="mt-4">
              Back to Work Orders
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const maintenance = workOrder.maintenance as any
  const truck = workOrder.truck as any
  const assignedUser = workOrder.assigned_user as any
  const assignedVendor = workOrder.assigned_vendor as any
  const partsRequired = (workOrder.parts_required as any[]) || []

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <Link href="/dashboard/maintenance/work-orders">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Work Orders
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{workOrder.work_order_number}</h1>
            <p className="text-muted-foreground text-sm mt-1">{workOrder.title}</p>
          </div>
          <div className="flex gap-2">
            {workOrder.status !== "completed" && workOrder.status !== "cancelled" && (
              <>
                {!workOrder.parts_reserved && partsRequired.length > 0 && (
                  <Button onClick={handleReserveParts} variant="outline">
                    <Package className="w-4 h-4 mr-2" />
                    Reserve Parts
                  </Button>
                )}
                <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-green-500 hover:bg-green-600">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Complete Work Order
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Complete Work Order</DialogTitle>
                      <DialogDescription>Enter final costs and notes</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Actual Cost</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={actualCost}
                          onChange={(e) => setActualCost(e.target.value)}
                          placeholder={workOrder.estimated_total_cost?.toString() || "0.00"}
                        />
                      </div>
                      <div>
                        <Label>Actual Labor Hours</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={actualLaborHours}
                          onChange={(e) => setActualLaborHours(e.target.value)}
                          placeholder={workOrder.estimated_labor_hours?.toString() || "0"}
                        />
                      </div>
                      <div>
                        <Label>Completion Notes</Label>
                        <Textarea
                          value={completionNotes}
                          onChange={(e) => setCompletionNotes(e.target.value)}
                          placeholder="Add any notes about the completion..."
                        />
                      </div>
                      <Button onClick={handleComplete} className="w-full">
                        Complete Work Order
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-border p-6">
              <h3 className="text-lg font-semibold mb-4">Work Order Information</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <Badge
                    className={
                      workOrder.status === "completed"
                        ? "bg-green-500/20 text-green-400"
                        : workOrder.status === "in_progress"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }
                  >
                    {workOrder.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Priority</p>
                  <Badge
                    variant="outline"
                    className={
                      workOrder.priority === "urgent" || workOrder.priority === "high"
                        ? "border-red-500/50 text-red-400"
                        : ""
                    }
                  >
                    {workOrder.priority}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Truck className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Truck</p>
                    <p className="font-medium">{truck?.truck_number || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {new Date(workOrder.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {workOrder.started_at && (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Started</p>
                      <p className="font-medium">
                        {new Date(workOrder.started_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
                {workOrder.completed_at && (
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Completed</p>
                      <p className="font-medium">
                        {new Date(workOrder.completed_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <Card className="border-border p-6">
              <h3 className="text-lg font-semibold mb-4">Costs & Labor</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Estimated Cost</p>
                    <p className="font-medium">
                      {workOrder.estimated_total_cost
                        ? `$${workOrder.estimated_total_cost.toFixed(2)}`
                        : "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Actual Cost</p>
                    <p className="font-medium">
                      {workOrder.actual_total_cost
                        ? `$${workOrder.actual_total_cost.toFixed(2)}`
                        : "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Wrench className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Labor Hours</p>
                    <p className="font-medium">
                      {workOrder.actual_labor_hours || workOrder.estimated_labor_hours || "N/A"}
                    </p>
                  </div>
                </div>
                {assignedUser && (
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Assigned To</p>
                      <p className="font-medium">{assignedUser.name || assignedUser.email}</p>
                    </div>
                  </div>
                )}
                {assignedVendor && (
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Vendor</p>
                      <p className="font-medium">{assignedVendor.name}</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {partsRequired.length > 0 && (
            <Card className="border-border p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Parts Required</h3>
                {!workOrder.parts_reserved && workOrder.status !== "completed" && (
                  <Badge variant="outline" className="text-orange-400 border-orange-500/50">
                    Not Reserved
                  </Badge>
                )}
                {workOrder.parts_reserved && (
                  <Badge variant="outline" className="text-green-400 border-green-500/50">
                    Reserved
                  </Badge>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-2 text-left text-sm font-semibold">Part Number</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Name</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Quantity</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Unit Cost</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partsRequired.map((part: any, idx: number) => (
                      <tr key={idx} className="border-b border-border">
                        <td className="px-4 py-2">{part.part_number || "N/A"}</td>
                        <td className="px-4 py-2">{part.name || "N/A"}</td>
                        <td className="px-4 py-2">{part.quantity || 0}</td>
                        <td className="px-4 py-2">
                          {part.unit_cost ? `$${part.unit_cost.toFixed(2)}` : "N/A"}
                        </td>
                        <td className="px-4 py-2">
                          {part.unit_cost && part.quantity
                            ? `$${(part.unit_cost * part.quantity).toFixed(2)}`
                            : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {workOrder.description && (
            <Card className="border-border p-6">
              <h3 className="text-lg font-semibold mb-4">Description</h3>
              <p className="text-foreground whitespace-pre-wrap">{workOrder.description}</p>
            </Card>
          )}

          {maintenance && (
            <Card className="border-border p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Related Maintenance</h3>
                  <p className="text-sm text-muted-foreground">{maintenance.service_type}</p>
                </div>
                <Link href={`/dashboard/maintenance/${maintenance.id}`}>
                  <Button variant="outline" size="sm">
                    View Maintenance
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          {workOrder.status !== "completed" && workOrder.status !== "cancelled" && (
            <Card className="border-border p-6">
              <h3 className="text-lg font-semibold mb-4">Update Status</h3>
              <div className="flex gap-2">
                {workOrder.status === "pending" && (
                  <Button onClick={() => handleUpdateStatus("in_progress")} variant="outline">
                    Start Work
                  </Button>
                )}
                {workOrder.status === "in_progress" && (
                  <Button onClick={() => handleUpdateStatus("waiting_parts")} variant="outline">
                    Waiting for Parts
                  </Button>
                )}
                <Button
                  onClick={() => handleUpdateStatus("cancelled")}
                  variant="outline"
                  className="text-red-400 hover:text-red-500"
                >
                  Cancel Work Order
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}


