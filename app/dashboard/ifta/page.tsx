"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Download, FileText, Plus, Receipt, Settings } from "lucide-react"
import { exportToExcel } from "@/lib/export-utils"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useState, useEffect } from "react"
import { getIFTAReports, deleteIFTAReport } from "@/app/actions/tax-fuel-reconciliation"
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

export default function IFTAPage() {
  const router = useRouter()
  const [iftaReports, setIftaReports] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadReports = async () => {
    setIsLoading(true)
    const result = await getIFTAReports()
    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }
    if (result.data) {
      setIftaReports(result.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadReports()
  }, [])

  const handleExport = () => {
    try {
      const exportData = iftaReports.map(({ id, company_id, state_breakdown, truck_ids, created_at, updated_at, ...rest }) => rest)
      exportToExcel(exportData, "ifta-reports")
      toast.success("IFTA reports exported successfully")
    } catch (error) {
      toast.error("Failed to export IFTA reports")
    }
  }

  const handleDelete = async (id: string) => {
    const result = await deleteIFTAReport(id)
    if (result.error) {
      toast.error(result.error)
      setDeleteId(null)
    } else {
      toast.success("IFTA report deleted successfully")
      setDeleteId(null)
      await loadReports()
    }
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">IFTA Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">International Fuel Tax Agreement reporting</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/accounting/ifta/tax-rates">
            <Button
              variant="outline"
              className="border-border/50 bg-transparent hover:bg-secondary/50 text-foreground"
            >
              <Settings className="w-4 h-4 mr-2" />
              Tax Rates
            </Button>
          </Link>
          <Button
            onClick={handleExport}
            variant="outline"
            className="border-border/50 bg-transparent hover:bg-secondary/50 text-foreground"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Link href="/dashboard/ifta/generate">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
              <Plus className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
          </Link>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Summary Cards */}
          <div className="grid md:grid-cols-4 gap-6">
            <Card className="border border-border/50 p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Total Reports</p>
              <p className="text-3xl font-bold text-foreground">{iftaReports.length}</p>
            </Card>
            <Card className="border border-border/50 p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Filed</p>
              <p className="text-3xl font-bold text-foreground">{iftaReports.filter(r => r.status === "filed").length}</p>
            </Card>
            <Card className="border border-border/50 p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Draft</p>
              <p className="text-3xl font-bold text-foreground">{iftaReports.filter(r => r.status === "draft").length}</p>
            </Card>
            <Card className="border border-border/50 p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Paid</p>
              <p className="text-3xl font-bold text-foreground">{iftaReports.filter(r => r.status === "paid").length}</p>
            </Card>
          </div>

          {/* IFTA Reports */}
          {isLoading ? (
            <Card className="border border-border/50 p-8">
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading IFTA reports...</p>
              </div>
            </Card>
          ) : iftaReports.length === 0 ? (
            <Card className="border border-border/50 p-8">
              <div className="text-center py-12">
                <Receipt className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No IFTA reports yet</h3>
                <p className="text-muted-foreground mb-6">Get started by generating your first IFTA report</p>
                <Link href="/dashboard/ifta/generate">
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Plus className="w-4 h-4 mr-2" />
                    Generate Report
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="border border-border/50 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-4">Quarterly Reports</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Quarter</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Period</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Total Miles</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Fuel Purchased</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Tax Owed</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {iftaReports.map((report) => (
                      <tr key={report.id} className="border-b border-border hover:bg-secondary/20 transition">
                        <td className="px-6 py-4 text-foreground font-medium">{report.quarter} {report.year}</td>
                        <td className="px-6 py-4 text-foreground">{report.period || "N/A"}</td>
                        <td className="px-6 py-4 text-foreground">{report.total_miles || "N/A"}</td>
                        <td className="px-6 py-4 text-foreground">{report.fuel_purchased || "N/A"}</td>
                        <td className="px-6 py-4 text-foreground font-semibold">{report.tax_owed ? `$${report.tax_owed.toFixed(2)}` : "N/A"}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              report.status === "filed" || report.status === "Filed"
                                ? "bg-green-500/20 text-green-400"
                                : report.status === "paid" || report.status === "Paid"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : "bg-yellow-500/20 text-yellow-400"
                            }`}
                          >
                            {report.status ? report.status.charAt(0).toUpperCase() + report.status.slice(1) : "Draft"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="hover:bg-secondary/50"
                              onClick={() => router.push(`/dashboard/ifta/${report.id}`)}
                            >
                              <FileText className="w-4 h-4" />
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
              This action cannot be undone. This will permanently delete the IFTA report from the system.
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
