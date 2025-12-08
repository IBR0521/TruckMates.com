"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export default function CreateSettlementPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    driver: "",
    periodStart: "",
    periodEnd: "",
    loads: "",
    grossPay: "",
    fuelDeduction: "",
    advanceDeduction: "",
    otherDeductions: "",
    notes: "",
  })

  const calculateNetPay = () => {
    const gross = Number.parseFloat(formData.grossPay) || 0
    const fuel = Number.parseFloat(formData.fuelDeduction) || 0
    const advance = Number.parseFloat(formData.advanceDeduction) || 0
    const other = Number.parseFloat(formData.otherDeductions) || 0
    return (gross - fuel - advance - other).toFixed(2)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success("Settlement created successfully")
    setTimeout(() => {
      router.push("/dashboard/accounting/settlements")
    }, 500)
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/30 backdrop-blur px-8 py-6">
        <Link href="/dashboard/accounting/settlements">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Settlements
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Create Settlement</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate driver payment settlement</p>
      </div>

      <div className="p-8">
        <Card className="max-w-3xl mx-auto border-border p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Driver Name *</label>
              <Input
                required
                value={formData.driver}
                onChange={(e) => setFormData({ ...formData, driver: e.target.value })}
                placeholder="Select driver"
                className="bg-background border-border"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Period Start *</label>
                <Input
                  required
                  type="date"
                  value={formData.periodStart}
                  onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                  className="bg-background border-border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Period End *</label>
                <Input
                  required
                  type="date"
                  value={formData.periodEnd}
                  onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                  className="bg-background border-border"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Number of Loads *</label>
              <Input
                required
                type="number"
                value={formData.loads}
                onChange={(e) => setFormData({ ...formData, loads: e.target.value })}
                placeholder="0"
                className="bg-background border-border"
              />
            </div>

            <div className="border-t border-border pt-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Payment Breakdown</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Gross Pay *</label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    value={formData.grossPay}
                    onChange={(e) => setFormData({ ...formData, grossPay: e.target.value })}
                    placeholder="0.00"
                    className="bg-background border-border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Fuel Deduction</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.fuelDeduction}
                    onChange={(e) => setFormData({ ...formData, fuelDeduction: e.target.value })}
                    placeholder="0.00"
                    className="bg-background border-border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Advance Deduction</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.advanceDeduction}
                    onChange={(e) => setFormData({ ...formData, advanceDeduction: e.target.value })}
                    placeholder="0.00"
                    className="bg-background border-border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Other Deductions</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.otherDeductions}
                    onChange={(e) => setFormData({ ...formData, otherDeductions: e.target.value })}
                    placeholder="0.00"
                    className="bg-background border-border"
                  />
                </div>

                <div className="pt-4 border-t border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-foreground">Net Pay:</span>
                    <span className="text-2xl font-bold text-green-400">${calculateNetPay()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Additional notes..."
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Create Settlement
              </Button>
              <Link href="/dashboard/accounting/settlements">
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
