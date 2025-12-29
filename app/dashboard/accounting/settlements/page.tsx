"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Download, Eye, DollarSign } from "lucide-react"
import { exportToExcel } from "@/lib/export-utils"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useState, useEffect } from "react"
import { getSettlements, deleteSettlement } from "@/app/actions/accounting"
import { getDrivers } from "@/app/actions/drivers"
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

export default function SettlementsPage() {
  const router = useRouter()
  const [settlements, setSettlements] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadSettlements = async () => {
    setIsLoading(true)
    const [settlementsResult, driversResult] = await Promise.all([
      getSettlements(),
      getDrivers(),
    ])
    if (settlementsResult.error) {
      toast.error(settlementsResult.error)
      setIsLoading(false)
      return
    }
    if (settlementsResult.data) {
      setSettlements(settlementsResult.data)
    }
    if (driversResult.data) {
      setDrivers(driversResult.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadSettlements()
  }, [])

  const handleExport = () => {
    try {
      const exportData = settlements.map(({ id, company_id, driver_id, loads, created_at, updated_at, ...rest }) => rest)
      exportToExcel(exportData, "settlements")
      toast.success("Settlements exported successfully")
    } catch (error) {
      toast.error("Failed to export settlements")
    }
  }

  const handleDelete = async (id: string) => {
    const result = await deleteSettlement(id)
    if (result.error) {
      toast.error(result.error)
      setDeleteId(null)
    } else {
      toast.success("Settlement deleted successfully")
      setDeleteId(null)
      await loadSettlements()
    }
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Driver Settlements</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage driver payments and settlements</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            onClick={handleExport}
            variant="outline"
            size="sm"
            className="border-border/50 bg-transparent hover:bg-secondary/50 text-foreground flex-1 sm:flex-initial"
          >
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Link href="/dashboard/accounting/settlements/create" className="flex-1 sm:flex-initial">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md w-full sm:w-auto">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Create Settlement</span>
              <span className="sm:hidden">Create</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Summary Cards */}
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            <Card className="border border-border/50 p-4 md:p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Total Paid</p>
              <p className="text-3xl font-bold text-green-400">
                ${settlements.filter(s => s.status === "paid").reduce((sum, s) => sum + (parseFloat(s.net_pay) || 0), 0).toFixed(2)}
              </p>
            </Card>
            <Card className="border border-border/50 p-4 md:p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Pending Payments</p>
              <p className="text-3xl font-bold text-yellow-400">
                ${settlements.filter(s => s.status === "pending").reduce((sum, s) => sum + (parseFloat(s.net_pay) || 0), 0).toFixed(2)}
              </p>
            </Card>
            <Card className="border border-border/50 p-4 md:p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Total Settlements</p>
              <p className="text-3xl font-bold text-foreground">{settlements.length}</p>
            </Card>
          </div>

          {/* Settlements Table */}
          {isLoading ? (
            <Card className="border border-border/50 p-8">
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading settlements...</p>
              </div>
            </Card>
          ) : settlements.length === 0 ? (
            <Card className="border border-border/50 p-8">
              <div className="text-center py-12">
                <DollarSign className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No settlements yet</h3>
                <p className="text-muted-foreground mb-6">Get started by creating your first settlement</p>
                <Link href="/dashboard/accounting/settlements/create">
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Settlement
                  </Button>
                </Link>
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
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Driver</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Period</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Gross Pay</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Deductions</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Net Pay</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlements.map((settlement) => {
                        const driver = drivers.find((d) => d.id === settlement.driver_id)
                        return (
                          <tr key={settlement.id} className="border-b border-border hover:bg-secondary/20 transition">
                            <td className="px-6 py-4 text-foreground font-medium">{driver?.name || "N/A"}</td>
                            <td className="px-6 py-4 text-foreground">
                              {settlement.period_start && settlement.period_end 
                                ? `${new Date(settlement.period_start).toLocaleDateString()} - ${new Date(settlement.period_end).toLocaleDateString()}`
                                : "N/A"}
                            </td>
                            <td className="px-6 py-4 text-foreground">${settlement.gross_pay ? parseFloat(settlement.gross_pay).toFixed(2) : "0.00"}</td>
                            <td className="px-6 py-4 text-red-400">${settlement.total_deductions ? parseFloat(settlement.total_deductions).toFixed(2) : "0.00"}</td>
                            <td className="px-6 py-4 text-green-400 font-semibold">${settlement.net_pay ? parseFloat(settlement.net_pay).toFixed(2) : "0.00"}</td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                  settlement.status === "paid" || settlement.status === "Paid"
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-yellow-500/20 text-yellow-400"
                                }`}
                              >
                                {settlement.status ? settlement.status.charAt(0).toUpperCase() + settlement.status.slice(1) : "Pending"}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="hover:bg-secondary/50"
                                  onClick={() => router.push(`/dashboard/accounting/settlements/${settlement.id}`)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Mobile: Cards */}
              <div className="md:hidden space-y-4">
                {settlements.map((settlement) => {
                  const driver = drivers.find((d) => d.id === settlement.driver_id)
                  return (
                    <Card key={settlement.id} className="border border-border/50 p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">{driver?.name || "N/A"}</h3>
                            <p className="text-sm text-muted-foreground">
                              {settlement.period_start && settlement.period_end 
                                ? `${new Date(settlement.period_start).toLocaleDateString()} - ${new Date(settlement.period_end).toLocaleDateString()}`
                                : "N/A"}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              settlement.status === "paid" || settlement.status === "Paid"
                                ? "bg-green-500/20 text-green-400"
                                : "bg-yellow-500/20 text-yellow-400"
                            }`}
                          >
                            {settlement.status ? settlement.status.charAt(0).toUpperCase() + settlement.status.slice(1) : "Pending"}
                          </span>
                        </div>
                        
                        <div className="space-y-2 pt-2 border-t border-border/30">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gross Pay</p>
                            <p className="text-sm text-foreground">${settlement.gross_pay ? parseFloat(settlement.gross_pay).toFixed(2) : "0.00"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deductions</p>
                            <p className="text-sm text-red-400">${settlement.total_deductions ? parseFloat(settlement.total_deductions).toFixed(2) : "0.00"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Net Pay</p>
                            <p className="text-lg font-bold text-green-400">${settlement.net_pay ? parseFloat(settlement.net_pay).toFixed(2) : "0.00"}</p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-border/30">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => router.push(`/dashboard/accounting/settlements/${settlement.id}`)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )
                })}
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
              This action cannot be undone. This will permanently delete the settlement from the system.
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
