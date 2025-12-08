"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Download, Eye, Trash2, Receipt } from "lucide-react"
import Link from "next/link"
import { exportToExcel } from "@/lib/export-utils"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { getExpenses, deleteExpense } from "@/app/actions/accounting"

export default function ExpensesPage() {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [expensesList, setExpensesList] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadExpenses = async () => {
    setIsLoading(true)
    const result = await getExpenses()
    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }
    if (result.data) {
      setExpensesList(result.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadExpenses()
  }, [])

  const handleExport = () => {
    try {
      const exportData = expensesList.map(({ id, company_id, driver_id, truck_id, receipt_url, created_at, updated_at, ...rest }) => rest)
      exportToExcel(exportData, "expenses")
      toast.success("Expenses exported successfully")
    } catch (error) {
      toast.error("Failed to export expenses")
    }
  }

  const handleDelete = async (id: string) => {
    const result = await deleteExpense(id)
    if (result.error) {
      toast.error(result.error)
      setDeleteId(null)
    } else {
      toast.success("Expense deleted successfully")
      setDeleteId(null)
      await loadExpenses()
    }
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/30 backdrop-blur px-8 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Expenses</h1>
          <p className="text-muted-foreground text-sm mt-1">Track and manage fleet expenses</p>
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
          <Link href="/dashboard/accounting/expenses/add">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </Link>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Summary Cards */}
          <div className="grid md:grid-cols-4 gap-6">
            <Card className="border border-border/50 p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Total Expenses</p>
              <p className="text-3xl font-bold text-foreground">
                ${expensesList.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0).toFixed(2)}
              </p>
            </Card>
            <Card className="border border-border/50 p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Fuel Costs</p>
              <p className="text-3xl font-bold text-foreground">
                ${expensesList.filter(e => e.category === "fuel").reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0).toFixed(2)}
              </p>
            </Card>
            <Card className="border border-border/50 p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Maintenance</p>
              <p className="text-3xl font-bold text-foreground">
                ${expensesList.filter(e => e.category === "maintenance").reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0).toFixed(2)}
              </p>
            </Card>
            <Card className="border border-border/50 p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Total Records</p>
              <p className="text-3xl font-bold text-foreground">{expensesList.length}</p>
            </Card>
          </div>

          {/* Expenses Table */}
          {isLoading ? (
            <Card className="border border-border/50 p-8">
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading expenses...</p>
              </div>
            </Card>
          ) : expensesList.length === 0 ? (
            <Card className="border border-border/50 p-8">
              <div className="text-center py-12">
                <Receipt className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No expenses yet</h3>
                <p className="text-muted-foreground mb-6">Get started by adding your first expense</p>
                <Link href="/dashboard/accounting/expenses/add">
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Expense
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="border border-border/50 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Date</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Category</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Description</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Amount</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Receipt</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expensesList.map((expense) => (
                      <tr key={expense.id} className="border-b border-border hover:bg-secondary/20 transition">
                        <td className="px-6 py-4 text-foreground">{expense.date ? new Date(expense.date).toLocaleDateString() : "N/A"}</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/20 text-primary">
                            {expense.category ? expense.category.charAt(0).toUpperCase() + expense.category.slice(1) : "N/A"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-foreground">{expense.description || "N/A"}</td>
                        <td className="px-6 py-4 text-foreground font-semibold">${expense.amount ? parseFloat(expense.amount).toFixed(2) : "0.00"}</td>
                        <td className="px-6 py-4 text-foreground">{expense.has_receipt ? "Yes" : "No"}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="hover:bg-secondary/50"
                              onClick={() => router.push(`/dashboard/accounting/expenses/${expense.id}`)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="hover:bg-red-500/20"
                              onClick={() => setDeleteId(expense.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
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
              This action cannot be undone. This will permanently delete the expense from the system.
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
