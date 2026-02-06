"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Download, Eye, AlertTriangle, CheckCircle, FileCheck, Search, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { exportToExcel } from "@/lib/export-utils"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { getDVIRs, deleteDVIR, getDVIRStats } from "@/app/actions/dvir"
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

export default function DVIRPage() {
  const router = useRouter()
  const [dvirRecords, setDvirRecords] = useState<any[]>([])
  const [filteredDvirs, setFilteredDvirs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [stats, setStats] = useState<any>(null)

  const loadDVIRs = async () => {
    setIsLoading(true)
    const [dvirResult, statsResult] = await Promise.all([
      getDVIRs(),
      getDVIRStats(),
    ])
    
    if (dvirResult.error) {
      toast.error(dvirResult.error)
    } else if (dvirResult.data) {
      setDvirRecords(dvirResult.data)
      setFilteredDvirs(dvirResult.data)
    }

    if (statsResult.data) {
      setStats(statsResult.data)
    }
    
    setIsLoading(false)
  }

  useEffect(() => {
    loadDVIRs()
  }, [])

  // Filter DVIRs
  useEffect(() => {
    let filtered = [...dvirRecords]

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (dvir) =>
          dvir.drivers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          dvir.trucks?.truck_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          dvir.location?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((dvir) => dvir.status === statusFilter)
    }

    // Apply type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((dvir) => dvir.inspection_type === typeFilter)
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.inspection_date || 0).getTime()
      const dateB = new Date(b.inspection_date || 0).getTime()
      return dateB - dateA
    })

    setFilteredDvirs(filtered)
  }, [dvirRecords, searchTerm, statusFilter, typeFilter])

  const handleExport = () => {
    try {
      const exportData = dvirRecords.map(({ id, company_id, driver_id, truck_id, created_at, updated_at, drivers, trucks, ...rest }) => ({
        ...rest,
        driver_name: drivers?.name,
        truck_number: trucks?.truck_number,
      }))
      exportToExcel(exportData, "dvir")
      toast.success("DVIR records exported successfully")
    } catch (error) {
      toast.error("Failed to export DVIR records")
    }
  }

  const handleDelete = async (id: string) => {
    const result = await deleteDVIR(id)
    if (result.error) {
      toast.error(result.error)
      setDeleteId(null)
    } else {
      toast.success("DVIR deleted successfully")
      setDeleteId(null)
      await loadDVIRs()
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "passed":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/50">Passed</Badge>
      case "failed":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/50">Failed</Badge>
      case "defects_corrected":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50">Defects Corrected</Badge>
      default:
        return <Badge className="bg-gray-500/20 text-gray-500 border-gray-500/50">Pending</Badge>
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "pre_trip":
        return "Pre-Trip"
      case "post_trip":
        return "Post-Trip"
      case "on_road":
        return "On-Road"
      default:
        return type
    }
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">DVIR Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">Driver Vehicle Inspection Reports for compliance</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            onClick={handleExport}
            variant="outline"
            size="sm"
            className="border-border/50 bg-transparent hover:bg-secondary/50 text-foreground"
          >
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Link href="/dashboard/dvir/add">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">New DVIR</span>
              <span className="sm:hidden">New</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Summary Cards */}
          {stats && (
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <Card className="border border-border/50 p-4 md:p-6">
                <p className="text-muted-foreground text-sm font-medium mb-2">Total Inspections</p>
                <p className="text-3xl font-bold text-foreground">{stats.total}</p>
              </Card>
              <Card className="border border-border/50 p-4 md:p-6">
                <p className="text-muted-foreground text-sm font-medium mb-2">Passed</p>
                <p className="text-3xl font-bold text-green-400">{stats.passed}</p>
              </Card>
              <Card className="border border-border/50 p-4 md:p-6">
                <p className="text-muted-foreground text-sm font-medium mb-2">With Defects</p>
                <p className="text-3xl font-bold text-red-400">{stats.with_defects}</p>
              </Card>
              <Card className="border border-border/50 p-4 md:p-6">
                <p className="text-muted-foreground text-sm font-medium mb-2">Unsafe</p>
                <p className="text-3xl font-bold text-orange-400">{stats.unsafe}</p>
              </Card>
            </div>
          )}

          {/* Filters */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search driver, truck, location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background border-border"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="defects_corrected">Defects Corrected</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="pre_trip">Pre-Trip</SelectItem>
                  <SelectItem value="post_trip">Post-Trip</SelectItem>
                  <SelectItem value="on_road">On-Road</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  setSearchTerm("")
                  setStatusFilter("all")
                  setTypeFilter("all")
                }}
                variant="outline"
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </Card>

          {/* DVIR List */}
          {isLoading ? (
            <Card className="p-8">
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading DVIR records...</p>
              </div>
            </Card>
          ) : filteredDvirs.length === 0 ? (
            <Card className="p-8">
              <div className="text-center py-12">
                <FileCheck className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {searchTerm || statusFilter !== "all" || typeFilter !== "all" ? "No DVIRs found" : "No DVIRs yet"}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "Get started by creating your first DVIR report"}
                </p>
                {!searchTerm && statusFilter === "all" && typeFilter === "all" && (
                  <Link href="/dashboard/dvir/add">
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Plus className="w-4 h-4 mr-2" />
                      Create DVIR
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          ) : (
            <>
              {/* Desktop: Table */}
              <Card className="border border-border/50 overflow-hidden shadow-sm hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Date</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Type</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Driver</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Truck</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Defects</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDvirs.map((dvir) => (
                        <tr key={dvir.id} className="border-b border-border hover:bg-secondary/20 transition">
                          <td className="px-6 py-4 text-foreground">
                            {dvir.inspection_date ? new Date(dvir.inspection_date).toLocaleDateString() : "N/A"}
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="outline">{getTypeLabel(dvir.inspection_type)}</Badge>
                          </td>
                          <td className="px-6 py-4 text-foreground">{dvir.drivers?.name || "N/A"}</td>
                          <td className="px-6 py-4 text-foreground">{dvir.trucks?.truck_number || "N/A"}</td>
                          <td className="px-6 py-4">{getStatusBadge(dvir.status)}</td>
                          <td className="px-6 py-4">
                            {dvir.defects_found ? (
                              <span className="text-red-400 font-medium">
                                {Array.isArray(dvir.defects) ? dvir.defects.length : 0} defect(s)
                              </span>
                            ) : (
                              <span className="text-muted-foreground">None</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="hover:bg-secondary/50"
                                onClick={() => router.push(`/dashboard/dvir/${dvir.id}`)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="hover:bg-red-500/20"
                                onClick={() => setDeleteId(dvir.id)}
                              >
                                <AlertTriangle className="w-4 h-4 text-red-400" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Mobile: Cards */}
              <div className="md:hidden space-y-4">
                {filteredDvirs.map((dvir) => (
                  <Card key={dvir.id} className="border border-border/50 p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">
                            {dvir.drivers?.name || "Unknown Driver"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {dvir.trucks?.truck_number || "N/A"} • {getTypeLabel(dvir.inspection_type)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {dvir.inspection_date ? new Date(dvir.inspection_date).toLocaleDateString() : "N/A"}
                          </p>
                        </div>
                        {getStatusBadge(dvir.status)}
                      </div>
                      
                      <div className="pt-2 border-t border-border/30">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Defects</span>
                          <span className={dvir.defects_found ? "text-red-400 font-medium" : "text-muted-foreground"}>
                            {dvir.defects_found
                              ? `${Array.isArray(dvir.defects) ? dvir.defects.length : 0} found`
                              : "None"}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-border/30">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => router.push(`/dashboard/dvir/${dvir.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/20"
                          onClick={() => setDeleteId(dvir.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the DVIR record from the system.
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





