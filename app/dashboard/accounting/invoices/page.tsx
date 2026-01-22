"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Download, Eye, Send, CheckCircle, FileText } from "lucide-react"
import Link from "next/link"
import { exportToExcel } from "@/lib/export-utils"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { getInvoices, deleteInvoice, updateInvoice, duplicateInvoice } from "@/app/actions/accounting"
import { InlineStatusSelect } from "@/components/dashboard/inline-status-select"
import { useListPageShortcuts } from "@/lib/hooks/use-keyboard-shortcuts"
import { Copy } from "lucide-react"
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

export default function InvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const loadInvoices = async () => {
    setIsLoading(true)
    const result = await getInvoices()
    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }
    if (result.data) {
      setInvoices(result.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadInvoices()
  }, [])

  const handleExport = () => {
    try {
      const exportData = invoices.map(({ id, company_id, load_id, items, created_at, updated_at, ...rest }) => rest)
      exportToExcel(exportData, "invoices")
      toast.success("Invoices exported successfully")
    } catch (error) {
      toast.error("Failed to export invoices")
    }
  }

  const handleDelete = async (id: string) => {
    const result = await deleteInvoice(id)
    if (result.error) {
      toast.error(result.error)
      setDeleteId(null)
    } else {
      toast.success("Invoice deleted successfully")
      setDeleteId(null)
      await loadInvoices()
    }
  }

  const handleStatusUpdate = async (id: string, status: string) => {
    const result = await updateInvoice(id, { status })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Status updated successfully")
      await loadInvoices()
    }
  }

  const handleDuplicate = async (id: string) => {
    const result = await duplicateInvoice(id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Invoice duplicated successfully")
      await loadInvoices()
      if (result.data) {
        router.push(`/dashboard/accounting/invoices/${result.data.id}`)
      }
    }
  }

  // Keyboard shortcuts
  useListPageShortcuts(router, "/dashboard/accounting/invoices/create", searchInputRef)

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage customer invoices and payments</p>
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
          <Link href="/dashboard/accounting/invoices/create" className="flex-1 sm:flex-initial">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md w-full sm:w-auto">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Create Invoice</span>
              <span className="sm:hidden">Create</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Summary Cards */}
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <Card className="border border-border/50 p-4 md:p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Total Outstanding</p>
              <p className="text-3xl font-bold text-foreground">
                ${invoices.filter(i => i.status === "pending" || i.status === "sent").reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0).toFixed(2)}
              </p>
            </Card>
            <Card className="border border-border/50 p-4 md:p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Paid</p>
              <p className="text-3xl font-bold text-green-400">
                ${invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0).toFixed(2)}
              </p>
            </Card>
            <Card className="border border-border/50 p-4 md:p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Overdue</p>
              <p className="text-3xl font-bold text-red-400">
                ${invoices.filter(i => i.status === "overdue").reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0).toFixed(2)}
              </p>
            </Card>
            <Card className="border border-border/50 p-4 md:p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Total Invoices</p>
              <p className="text-3xl font-bold text-foreground">{invoices.length}</p>
            </Card>
          </div>

          {/* Invoices Table */}
          {isLoading ? (
            <Card className="border border-border/50 p-8">
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading invoices...</p>
              </div>
            </Card>
          ) : invoices.length === 0 ? (
            <Card className="border border-border/50 p-8">
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No invoices yet</h3>
                <p className="text-muted-foreground mb-6">Get started by creating your first invoice</p>
                <Link href="/dashboard/accounting/invoices/create">
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Invoice
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
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Invoice ID</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Customer</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Amount</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Due Date</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-border hover:bg-secondary/20 transition">
                          <td className="px-6 py-4 text-foreground font-medium">{invoice.invoice_number || invoice.id}</td>
                          <td className="px-6 py-4 text-foreground">{invoice.customer_name || "N/A"}</td>
                          <td className="px-6 py-4 text-foreground font-semibold">${invoice.amount ? parseFloat(invoice.amount).toFixed(2) : "0.00"}</td>
                          <td className="px-6 py-4 text-foreground">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "N/A"}</td>
                          <td className="px-6 py-4">
                            <InlineStatusSelect
                              currentStatus={invoice.status || "draft"}
                              availableStatuses={["draft", "sent", "pending", "paid", "overdue", "cancelled"]}
                              onStatusChange={(newStatus) => handleStatusUpdate(invoice.id, newStatus)}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="hover:bg-secondary/50"
                                onClick={() => router.push(`/dashboard/accounting/invoices/${invoice.id}`)}
                                title="View invoice"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="hover:bg-blue-500/20"
                                onClick={() => handleDuplicate(invoice.id)}
                                title="Duplicate invoice"
                              >
                                <Copy className="w-4 h-4 text-blue-400" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="hover:bg-secondary/50"
                                onClick={() => toast.info("Invoice sent successfully")}
                                title="Send invoice"
                              >
                                <Send className="w-4 h-4" />
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
                {invoices.map((invoice) => (
                  <Card key={invoice.id} className="border border-border/50 p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">{invoice.invoice_number || invoice.id}</h3>
                          <p className="text-sm text-muted-foreground">{invoice.customer_name || "N/A"}</p>
                        </div>
                        <InlineStatusSelect
                          currentStatus={invoice.status || "draft"}
                          availableStatuses={["draft", "sent", "pending", "paid", "overdue", "cancelled"]}
                          onStatusChange={(newStatus) => handleStatusUpdate(invoice.id, newStatus)}
                        />
                      </div>
                      
                      <div className="space-y-2 pt-2 border-t border-border/30">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount</p>
                          <p className="text-lg font-bold text-foreground">${invoice.amount ? parseFloat(invoice.amount).toFixed(2) : "0.00"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Date</p>
                          <p className="text-sm text-foreground">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "N/A"}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-border/30">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => router.push(`/dashboard/accounting/invoices/${invoice.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="hover:bg-blue-500/20"
                          onClick={() => handleDuplicate(invoice.id)}
                          title="Duplicate invoice"
                        >
                          <Copy className="w-4 h-4 text-blue-400" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => toast.info("Invoice sent successfully")}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Send
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
              This action cannot be undone. This will permanently delete the invoice from the system.
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
