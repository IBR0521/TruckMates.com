"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Download, Eye, AlertTriangle, CheckCircle, Wrench, Search, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { exportToExcel } from "@/lib/export-utils"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { getMaintenance, deleteMaintenance } from "@/app/actions/maintenance"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function MaintenancePage() {
  const router = useRouter()
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([])
  const [filteredMaintenance, setFilteredMaintenance] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("scheduled_date")

  const loadMaintenance = async () => {
    setIsLoading(true)
    const result = await getMaintenance()
    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }
    if (result.data) {
      setMaintenanceRecords(result.data)
      setFilteredMaintenance(result.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadMaintenance()
  }, [])

  // Filter and sort maintenance
  useEffect(() => {
    let filtered = [...maintenanceRecords]

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (record) =>
          record.service_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.technician?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((record) => record.status === statusFilter)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "scheduled_date":
          return new Date(a.scheduled_date || 0).getTime() - new Date(b.scheduled_date || 0).getTime()
        case "service_type":
          return (a.service_type || "").localeCompare(b.service_type || "")
        case "status":
          return (a.status || "").localeCompare(b.status || "")
        default:
          return 0
      }
    })

    setFilteredMaintenance(filtered)
  }, [maintenanceRecords, searchTerm, statusFilter, sortBy])

  const handleExport = () => {
    try {
      const exportData = maintenanceRecords.map(({ id, company_id, truck_id, created_at, updated_at, ...rest }) => rest)
      exportToExcel(exportData, "maintenance")
      toast.success("Maintenance records exported successfully")
    } catch (error) {
      toast.error("Failed to export maintenance records")
    }
  }

  const handleDelete = async (id: string) => {
    const result = await deleteMaintenance(id)
    if (result.error) {
      toast.error(result.error)
      setDeleteId(null)
    } else {
      toast.success("Maintenance record deleted successfully")
      setDeleteId(null)
      await loadMaintenance()
    }
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Maintenance Schedule</h1>
          <p className="text-muted-foreground text-sm mt-1">Track and schedule vehicle maintenance</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleExport}
            variant="outline"
            className="border-border/50 bg-transparent hover:bg-secondary/50 text-foreground"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Link href="/dashboard/maintenance/add">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
              <Plus className="w-4 h-4 mr-2" />
              Schedule Service
            </Button>
          </Link>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Summary Cards */}
          <div className="grid md:grid-cols-4 gap-6">
            <Card className="border border-border/50 p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Scheduled</p>
              <p className="text-3xl font-bold text-foreground">{maintenanceRecords.filter(r => r.status === "scheduled").length}</p>
            </Card>
            <Card className="border border-border/50 p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Overdue</p>
              <p className="text-3xl font-bold text-red-400">{maintenanceRecords.filter(r => r.status === "overdue").length}</p>
            </Card>
            <Card className="border border-border/50 p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Completed</p>
              <p className="text-3xl font-bold text-foreground">{maintenanceRecords.filter(r => r.status === "completed").length}</p>
            </Card>
            <Card className="border border-border/50 p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Total Records</p>
              <p className="text-3xl font-bold text-foreground">{maintenanceRecords.length}</p>
            </Card>
          </div>

          {/* Maintenance Table */}
          {isLoading ? (
            <Card className="border border-border/50 p-8">
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading maintenance records...</p>
              </div>
            </Card>
          ) : filteredMaintenance.length === 0 ? (
            <Card className="border border-border/50 p-8">
              <div className="text-center py-12">
                <Wrench className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {searchTerm || statusFilter !== "all" ? "No maintenance records found" : "No maintenance records yet"}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {searchTerm || statusFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "Get started by scheduling your first maintenance service"}
                </p>
                {!searchTerm && statusFilter === "all" && (
                  <Link href="/dashboard/maintenance/add">
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Plus className="w-4 h-4 mr-2" />
                      Schedule Service
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          ) : (
            <Card className="border border-border/50 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Truck</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Service Type</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Scheduled Date</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Mileage</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Priority</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Est. Cost</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaintenance.map((record) => (
                      <tr key={record.id} className="border-b border-border hover:bg-secondary/20 transition">
                        <td className="px-6 py-4 text-foreground font-medium">{record.truck_id || "N/A"}</td>
                        <td className="px-6 py-4 text-foreground">{record.service_type || "N/A"}</td>
                        <td className="px-6 py-4 text-foreground">{record.scheduled_date ? new Date(record.scheduled_date).toLocaleDateString() : "N/A"}</td>
                        <td className="px-6 py-4 text-foreground">{record.mileage ? `${record.mileage.toLocaleString()} mi` : "N/A"}</td>
                        <td className="px-6 py-4">
                          <Badge
                            className={
                              record.priority === "high" || record.priority === "High"
                                ? "bg-red-500/20 text-red-400 border-red-500/50"
                                : "bg-blue-500/20 text-blue-400 border-blue-500/50"
                            }
                          >
                            {record.priority ? record.priority.charAt(0).toUpperCase() + record.priority.slice(1) : "Normal"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-foreground">{record.estimated_cost ? `$${record.estimated_cost.toFixed(2)}` : "N/A"}</td>
                        <td className="px-6 py-4">
                          <Badge
                            className={`flex items-center gap-1 w-fit ${
                              record.status === "completed" || record.status === "Completed"
                                ? "bg-green-500/20 text-green-400 border-green-500/50"
                                : record.status === "overdue" || record.status === "Overdue"
                                  ? "bg-red-500/20 text-red-400 border-red-500/50"
                                  : "bg-blue-500/20 text-blue-400 border-blue-500/50"
                            }`}
                          >
                            {(record.status === "overdue" || record.status === "Overdue") && <AlertTriangle className="w-3 h-3" />}
                            {(record.status === "completed" || record.status === "Completed") && <CheckCircle className="w-3 h-3" />}
                            {record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : "N/A"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="hover:bg-secondary/50"
                              onClick={() => router.push(`/dashboard/maintenance/${record.id}`)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the maintenance record from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
