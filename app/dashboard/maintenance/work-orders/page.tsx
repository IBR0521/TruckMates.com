"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Filter, Eye, Wrench, Calendar, DollarSign, Truck } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { getWorkOrders } from "@/app/actions/maintenance-enhanced"

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [filteredWorkOrders, setFilteredWorkOrders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  useEffect(() => {
    loadWorkOrders()
  }, [])

  async function loadWorkOrders() {
    setIsLoading(true)
    const result = await getWorkOrders()
    if (result.error) {
      toast.error(result.error)
    } else {
      setWorkOrders(result.data || [])
      setFilteredWorkOrders(result.data || [])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    let filtered = [...workOrders]

    if (searchTerm) {
      filtered = filtered.filter(
        (wo) =>
          wo.work_order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          wo.title?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((wo) => wo.status === statusFilter)
    }

    setFilteredWorkOrders(filtered)
  }, [workOrders, searchTerm, statusFilter])

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Work Orders</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage maintenance work orders</p>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Filters */}
          <Card className="border-border p-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search work orders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="waiting_parts">Waiting Parts</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Summary Cards */}
          <div className="grid md:grid-cols-4 gap-6">
            <Card className="border-border p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Total</p>
              <p className="text-3xl font-bold text-foreground">{workOrders.length}</p>
            </Card>
            <Card className="border-border p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Pending</p>
              <p className="text-3xl font-bold text-yellow-400">
                {workOrders.filter((wo) => wo.status === "pending").length}
              </p>
            </Card>
            <Card className="border-border p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">In Progress</p>
              <p className="text-3xl font-bold text-blue-400">
                {workOrders.filter((wo) => wo.status === "in_progress").length}
              </p>
            </Card>
            <Card className="border-border p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Completed</p>
              <p className="text-3xl font-bold text-green-400">
                {workOrders.filter((wo) => wo.status === "completed").length}
              </p>
            </Card>
          </div>

          {/* Work Orders List */}
          {isLoading ? (
            <Card className="border-border p-8">
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading work orders...</p>
              </div>
            </Card>
          ) : filteredWorkOrders.length === 0 ? (
            <Card className="border-border p-8">
              <div className="text-center py-12">
                <Wrench className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No work orders found</h3>
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "Work orders will appear here when created from maintenance records"}
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredWorkOrders.map((wo: any) => (
                <Card key={wo.id} className="border-border p-6 hover:bg-secondary/20 transition">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{wo.work_order_number}</h3>
                      <p className="text-muted-foreground">{wo.title}</p>
                    </div>
                    <Badge
                      className={
                        wo.status === "completed"
                          ? "bg-green-500/20 text-green-400"
                          : wo.status === "in_progress"
                          ? "bg-blue-500/20 text-blue-400"
                          : wo.status === "waiting_parts"
                          ? "bg-orange-500/20 text-orange-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }
                    >
                      {wo.status}
                    </Badge>
                  </div>
                  <div className="grid md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Truck</p>
                        <p className="text-sm font-medium">
                          {(wo.truck as any)?.truck_number || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Created</p>
                        <p className="text-sm font-medium">
                          {new Date(wo.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Cost</p>
                        <p className="text-sm font-medium">
                          {wo.actual_total_cost
                            ? `$${wo.actual_total_cost.toFixed(2)}`
                            : wo.estimated_total_cost
                            ? `$${wo.estimated_total_cost.toFixed(2)}`
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Priority</p>
                        <Badge
                          variant="outline"
                          className={
                            wo.priority === "urgent" || wo.priority === "high"
                              ? "border-red-500/50 text-red-400"
                              : ""
                          }
                        >
                          {wo.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Link href={`/dashboard/maintenance/work-orders/${wo.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

