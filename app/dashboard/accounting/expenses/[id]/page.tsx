"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Download, Trash2 } from "lucide-react"
import Link from "next/link"
import { use } from "react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
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

export default function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  useEffect(() => {
    if (id === "add") {
      router.replace("/dashboard/accounting/expenses/add")
    }
  }, [id, router])

  if (id === "add") {
    return null
  }

  const expense = {
    id: id,
    date: "01/05/2025",
    category: "Fuel",
    description: "Diesel - Route TX-CA",
    amount: "$450.00",
    driver: "John Smith",
    truck: "TR-001",
    receipt: "Yes",
    notes: "Filled up at truck stop near Dallas",
    vendor: "Pilot Flying J",
    paymentMethod: "Company Card",
    mileage: "95,234 mi",
  }

  const handleDelete = () => {
    toast.success("Expense deleted successfully")
    setTimeout(() => {
      router.push("/dashboard/accounting/expenses")
    }, 500)
  }

  const handleDownload = () => {
    toast.success("Receipt downloaded successfully")
    // In a real app, this would download the actual receipt file
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <Link href="/dashboard/accounting/expenses">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Expenses
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Expense Details</h1>
            <p className="text-muted-foreground text-sm mt-1">{expense.date}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleDownload} variant="outline" className="border-border bg-transparent">
              <Download className="w-4 h-4 mr-2" />
              Download Receipt
            </Button>
            <Button
              onClick={() => setShowDeleteDialog(true)}
              variant="outline"
              className="border-red-500/50 hover:bg-red-500/20 bg-transparent"
            >
              <Trash2 className="w-4 h-4 mr-2 text-red-400" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="border-border p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Category</p>
                  <span className="px-3 py-1 rounded-full text-sm font-semibold bg-primary/20 text-primary">
                    {expense.category}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-foreground font-medium">{expense.description}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Amount</p>
                  <p className="text-2xl font-bold text-foreground">{expense.amount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Vendor</p>
                  <p className="text-foreground">{expense.vendor}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Driver</p>
                  <p className="text-foreground">{expense.driver}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Truck</p>
                  <p className="text-foreground">{expense.truck}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Mileage</p>
                  <p className="text-foreground">{expense.mileage}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Payment Method</p>
                  <p className="text-foreground">{expense.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Receipt</p>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      expense.receipt === "Yes" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {expense.receipt}
                  </span>
                </div>
              </div>
            </div>

            {expense.notes && (
              <div className="border-t border-border pt-6 mt-6">
                <p className="text-sm text-muted-foreground mb-2">Notes</p>
                <p className="text-foreground">{expense.notes}</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this expense from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
