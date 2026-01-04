"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createInvoice, getLoadForInvoice } from "@/app/actions/accounting"
import { getLoads } from "@/app/actions/loads"
import { getCompanySettings } from "@/app/actions/number-formats"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function CreateInvoicePage() {
  const router = useRouter()
  const [loads, setLoads] = useState<any[]>([])
  const [isLoadingLoads, setIsLoadingLoads] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    customer_name: "",
    load_id: "",
    amount: "",
    dueDate: "",
    issueDate: new Date().toISOString().split("T")[0],
    description: "",
    paymentTerms: "Net 30",
  })

  useEffect(() => {
    async function loadData() {
      setIsLoadingLoads(true)
      const [loadsResult, settingsResult] = await Promise.all([
        getLoads(),
        getCompanySettings(),
      ])
      if (loadsResult.data) {
        setLoads(loadsResult.data)
      }
      // Apply default payment terms from settings
      if (settingsResult.data?.default_payment_terms) {
        setFormData(prev => ({
          ...prev,
          paymentTerms: settingsResult.data.default_payment_terms,
        }))
      }
      setIsLoadingLoads(false)
    }
    loadData()
  }, [])

  // Auto-fill invoice when load is selected
  const handleLoadChange = async (loadId: string) => {
    if (!loadId) {
      setFormData({ ...formData, load_id: "", customer_name: "", amount: "", description: "" })
      return
    }

    setIsLoadingLoads(true)
    const result = await getLoadForInvoice(loadId)
    setIsLoadingLoads(false)

    if (result.data) {
      const load = result.data
      setFormData({
        ...formData,
        load_id: loadId,
        customer_name: load.company_name || formData.customer_name,
        amount: load.value ? String(load.value) : formData.amount,
        description: `Invoice for load ${load.shipment_number} - ${load.origin} to ${load.destination}${load.contents ? ` (${load.contents})` : ""}`,
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Calculate due date if not provided
    let dueDate = formData.dueDate
    if (!dueDate && formData.issueDate) {
      const issueDate = new Date(formData.issueDate)
      const days = formData.paymentTerms === "Net 15" ? 15 : formData.paymentTerms === "Net 45" ? 45 : formData.paymentTerms === "Net 60" ? 60 : 30
      issueDate.setDate(issueDate.getDate() + days)
      dueDate = issueDate.toISOString().split("T")[0]
    }

    const result = await createInvoice({
      customer_name: formData.customer_name,
      load_id: formData.load_id || undefined,
      amount: Number.parseFloat(formData.amount),
      issue_date: formData.issueDate,
      due_date: dueDate,
      payment_terms: formData.paymentTerms,
      description: formData.description || undefined,
    })

    setIsSubmitting(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Invoice created successfully")
      setTimeout(() => {
        router.push("/dashboard/accounting/invoices")
      }, 500)
    }
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <Link href="/dashboard/accounting/invoices">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Invoices
          </Button>
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Create Invoice</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate a new customer invoice</p>
      </div>

      <div className="p-4 md:p-8">
        <Card className="max-w-3xl mx-auto border-border p-4 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Load (Optional - Auto-fills invoice details)</label>
              <Select
                value={formData.load_id || "none"}
                onValueChange={(value) => handleLoadChange(value === "none" ? "" : value)}
                disabled={isLoadingLoads}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder={isLoadingLoads ? "Loading loads..." : "Select a load to auto-fill"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None - Manual Entry</SelectItem>
                  {loads.map((load) => (
                    <SelectItem key={load.id} value={load.id}>
                      {load.shipment_number} - {load.origin} → {load.destination} {load.value ? `($${load.value})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.load_id && (
                <p className="text-xs text-muted-foreground mt-1">
                  ✓ Load selected - Customer and amount will be auto-filled
                </p>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Customer Name *</label>
                <Input
                  required
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="e.g. ABC Logistics"
                  className="bg-background border-border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Amount *</label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  className="bg-background border-border"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Payment Terms</label>
                <Select
                  value={formData.paymentTerms}
                  onValueChange={(value) => setFormData({ ...formData, paymentTerms: value })}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Net 15">Net 15</SelectItem>
                    <SelectItem value="Net 30">Net 30</SelectItem>
                    <SelectItem value="Net 45">Net 45</SelectItem>
                    <SelectItem value="Net 60">Net 60</SelectItem>
                    <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Issue Date *</label>
                <Input
                  required
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                  className="bg-background border-border"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Due Date *</label>
              <Input
                required
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="bg-background border-border"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to auto-calculate based on payment terms
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                placeholder="Invoice description..."
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                type="submit" 
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create Invoice"}
              </Button>
              <Link href="/dashboard/accounting/invoices">
                <Button type="button" variant="outline" className="border-border bg-transparent">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
