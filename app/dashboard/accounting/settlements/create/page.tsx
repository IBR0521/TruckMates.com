"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Calculator, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createSettlement, getDriverLoadsForPeriod, getDriverFuelExpensesForPeriod } from "@/app/actions/accounting"
import { getDrivers } from "@/app/actions/drivers"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function CreateSettlementPage() {
  const router = useRouter()
  const [drivers, setDrivers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)
  const [selectedLoads, setSelectedLoads] = useState<any[]>([])
  const [fuelExpenses, setFuelExpenses] = useState<any[]>([])
  const [formData, setFormData] = useState({
    driver_id: "",
    periodStart: "",
    periodEnd: "",
    grossPay: "",
    fuelDeduction: "",
    advanceDeduction: "",
    otherDeductions: "",
    payment_method: "",
    notes: "",
  })

  useEffect(() => {
    async function loadDrivers() {
      const result = await getDrivers()
      if (result.data) {
        setDrivers(result.data)
      }
    }
    loadDrivers()
  }, [])

  // Auto-calculate when driver and period are selected
  const handleCalculate = async () => {
    if (!formData.driver_id || !formData.periodStart || !formData.periodEnd) {
      toast.error("Please select driver and period dates first")
      return
    }

    setIsCalculating(true)
    try {
      // Get driver's loads for the period
      const loadsResult = await getDriverLoadsForPeriod(
        formData.driver_id,
        formData.periodStart,
        formData.periodEnd
      )

      if (loadsResult.error) {
        toast.error(loadsResult.error)
        setIsCalculating(false)
        return
      }

      const loads = loadsResult.data || []
      setSelectedLoads(loads)

      // Get driver's fuel expenses
      const fuelResult = await getDriverFuelExpensesForPeriod(
        formData.driver_id,
        formData.periodStart,
        formData.periodEnd
      )

      if (fuelResult.error) {
        toast.error(fuelResult.error)
        setIsCalculating(false)
        return
      }

      setFuelExpenses(fuelResult.data || [])

      // Get driver's pay rate
      const selectedDriver = drivers.find((d) => d.id === formData.driver_id)
      const payRate = selectedDriver?.pay_rate

      // Calculate gross pay
      let calculatedGrossPay = 0
      if (loads.length > 0) {
        if (payRate) {
          const payRateNum = Number(payRate) || 0
          if (payRateNum <= 1) {
            // Percentage: multiply each load value by pay rate
            calculatedGrossPay = loads.reduce((sum, load) => {
              const loadValue = Number(load.value) || 0
              return sum + (loadValue * payRateNum)
            }, 0)
          } else {
            // Per-load amount: multiply by number of loads
            calculatedGrossPay = loads.length * payRateNum
          }
        } else {
          // If no pay rate, sum load values as estimate
          calculatedGrossPay = loads.reduce((sum, load) => sum + (Number(load.value) || 0), 0)
        }
      }

      // Auto-fill calculated values
      setFormData({
        ...formData,
        grossPay: calculatedGrossPay > 0 ? calculatedGrossPay.toFixed(2) : "",
        fuelDeduction: fuelResult.totalFuelExpense > 0 ? fuelResult.totalFuelExpense.toFixed(2) : "",
      })

      toast.success(`Found ${loads.length} loads and ${fuelResult.data?.length || 0} fuel expenses`)
    } catch (error: any) {
      toast.error(error.message || "Failed to calculate settlement")
    } finally {
      setIsCalculating(false)
    }
  }

  const calculateNetPay = () => {
    const gross = Number.parseFloat(formData.grossPay) || 0
    const fuel = Number.parseFloat(formData.fuelDeduction) || 0
    const advance = Number.parseFloat(formData.advanceDeduction) || 0
    const other = Number.parseFloat(formData.otherDeductions) || 0
    return (gross - fuel - advance - other).toFixed(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const grossPay = Number.parseFloat(formData.grossPay) || 0
    const fuelDeduction = Number.parseFloat(formData.fuelDeduction) || 0
    const advanceDeduction = Number.parseFloat(formData.advanceDeduction) || 0
    const otherDeductions = Number.parseFloat(formData.otherDeductions) || 0
    const totalDeductions = fuelDeduction + advanceDeduction + otherDeductions
    const netPay = grossPay - totalDeductions

    const result = await createSettlement({
      driver_id: formData.driver_id,
      period_start: formData.periodStart,
      period_end: formData.periodEnd,
      gross_pay: grossPay,
      fuel_deduction: fuelDeduction,
      advance_deduction: advanceDeduction,
      other_deductions: otherDeductions,
      payment_method: formData.payment_method || undefined,
    })

    setIsLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Settlement created successfully")
      setTimeout(() => {
        router.push("/dashboard/accounting/settlements")
      }, 500)
    }
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
              <label className="block text-sm font-medium text-foreground mb-2">Driver *</label>
              <Select
                value={formData.driver_id}
                onValueChange={(value) => setFormData({ ...formData, driver_id: value, grossPay: "", fuelDeduction: "" })}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name} {driver.pay_rate ? `($${driver.pay_rate}/load)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Button
                type="button"
                onClick={handleCalculate}
                disabled={!formData.driver_id || !formData.periodStart || !formData.periodEnd || isCalculating}
                variant="outline"
                className="w-full border-border"
              >
                {isCalculating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4 mr-2" />
                    Auto-Calculate from Loads & Expenses
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                This will automatically load driver's loads and fuel expenses for the selected period and calculate gross pay and deductions.
              </p>
            </div>

            {selectedLoads.length > 0 && (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-sm font-semibold text-foreground mb-2">
                  ✓ Found {selectedLoads.length} loads for this period
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {selectedLoads.map((load) => (
                    <p key={load.id} className="text-xs text-muted-foreground">
                      • {load.shipment_number} - ${load.value || 0}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {fuelExpenses.length > 0 && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm font-semibold text-foreground mb-2">
                  ✓ Found {fuelExpenses.length} fuel expenses (Total: ${fuelExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0).toFixed(2)})
                </p>
              </div>
            )}

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
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedLoads.length > 0 ? `Calculated from ${selectedLoads.length} loads` : "Enter manually or use auto-calculate"}
                  </p>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    {fuelExpenses.length > 0 ? `Auto-filled from ${fuelExpenses.length} fuel expenses` : "Enter manually or use auto-calculate"}
                  </p>
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
              <label className="block text-sm font-medium text-foreground mb-2">Payment Method</label>
              <Select
                value={formData.payment_method}
                onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="direct_deposit">Direct Deposit</SelectItem>
                  <SelectItem value="wire_transfer">Wire Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
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
              <Button 
                type="submit" 
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={isLoading}
              >
                {isLoading ? "Creating..." : "Create Settlement"}
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
