"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import {
  Calculator,
  TrendingUp,
  DollarSign,
  Route,
  Fuel,
  User,
} from "lucide-react"

export function ProfitEstimator() {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    // Miles
    loadedMiles: "",
    deadheadMiles: "",
    
    // Charges
    loadedChargeType: "per-mile" as "flat" | "per-mile",
    loadedCharge: "",
    deadheadChargeType: "per-mile" as "flat" | "per-mile",
    deadheadCharge: "",
    additionalCharges: "",
    
    // Fuel
    fuelCostPerGallon: "",
    truckMPG: "",
    
    // Driver Settlement
    driverPayType: "percentage" as "percentage" | "per-mile" | "hourly",
    driverPay: "",
    driverHours: "",
    
    // Other Expenses
    tolls: "",
    otherExpenses: "",
  })

  // Calculate profit in real-time
  const calculations = useMemo(() => {
    const loadedMiles = parseFloat(formData.loadedMiles) || 0
    const deadheadMiles = parseFloat(formData.deadheadMiles) || 0
    const totalMiles = loadedMiles + deadheadMiles
    
    // Calculate loaded charges
    let loadedRevenue = 0
    if (formData.loadedChargeType === "flat") {
      loadedRevenue = parseFloat(formData.loadedCharge) || 0
    } else {
      loadedRevenue = (parseFloat(formData.loadedCharge) || 0) * loadedMiles
    }
    
    // Calculate deadhead charges
    let deadheadRevenue = 0
    if (formData.deadheadChargeType === "flat") {
      deadheadRevenue = parseFloat(formData.deadheadCharge) || 0
    } else {
      deadheadRevenue = (parseFloat(formData.deadheadCharge) || 0) * deadheadMiles
    }
    
    const additionalCharges = parseFloat(formData.additionalCharges) || 0
    const totalRevenue = loadedRevenue + deadheadRevenue + additionalCharges

    // Calculate fuel cost using MPG
    const fuelCostPerGallon = parseFloat(formData.fuelCostPerGallon) || 0
    const truckMPG = parseFloat(formData.truckMPG) || 0
    const fuelCost = truckMPG > 0 && totalMiles > 0
      ? (totalMiles / truckMPG) * fuelCostPerGallon
      : 0

    // Calculate driver pay
    let driverPayAmount = 0
    const driverPay = parseFloat(formData.driverPay) || 0
    const driverHours = parseFloat(formData.driverHours) || 0
    
    if (formData.driverPayType === "percentage") {
      driverPayAmount = totalRevenue * (driverPay / 100)
    } else if (formData.driverPayType === "per-mile") {
      driverPayAmount = totalMiles * driverPay
    } else if (formData.driverPayType === "hourly") {
      driverPayAmount = driverHours * driverPay
    }

    // Calculate other expenses
    const tolls = parseFloat(formData.tolls) || 0
    const otherExpenses = parseFloat(formData.otherExpenses) || 0

    const totalExpenses = fuelCost + driverPayAmount + tolls + otherExpenses
    const estimatedProfit = totalRevenue - totalExpenses
    const profitMargin = totalRevenue > 0 ? (estimatedProfit / totalRevenue) * 100 : 0

    // Calculate per-mile metrics
    const revenuePerMile = totalMiles > 0 ? totalRevenue / totalMiles : 0
    const costPerMile = totalMiles > 0 ? totalExpenses / totalMiles : 0
    const profitPerMile = totalMiles > 0 ? estimatedProfit / totalMiles : 0
    const fuelCostPerMile = totalMiles > 0 ? fuelCost / totalMiles : 0

    return {
      totalRevenue,
      loadedRevenue,
      deadheadRevenue,
      additionalCharges,
      totalExpenses,
      fuelCost,
      driverPayAmount,
      tolls,
      otherExpenses,
      estimatedProfit,
      profitMargin,
      totalMiles,
      revenuePerMile,
      costPerMile,
      profitPerMile,
      fuelCostPerMile,
    }
  }, [formData])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 w-full sm:w-auto">
          <Calculator className="w-4 h-4 mr-2" />
          <span className="hidden xs:inline">Profit Estimator</span>
          <span className="xs:hidden">Profit</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Profit Estimator
          </DialogTitle>
          <DialogDescription>
            Estimate potential profits for a load by considering miles, charges, and expenses
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Miles Section */}
          <Card className="p-4">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Route className="w-4 h-4 text-blue-500" />
              Miles
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Loaded Miles</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.loadedMiles}
                  onChange={(e) => setFormData({ ...formData, loadedMiles: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Deadhead Miles</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.deadheadMiles}
                  onChange={(e) => setFormData({ ...formData, deadheadMiles: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </Card>

          {/* Charges Section */}
          <Card className="p-4">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Charges
            </h3>
            <div className="space-y-4">
              {/* Loaded Charges */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Loaded Charge Type</Label>
                  <select
                    value={formData.loadedChargeType}
                    onChange={(e) => setFormData({ ...formData, loadedChargeType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="per-mile">Per Mile</option>
                    <option value="flat">Flat Rate</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>
                    {formData.loadedChargeType === "flat" ? "Loaded Charge ($)" : "Loaded Charge per Mile ($)"}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.loadedCharge}
                    onChange={(e) => setFormData({ ...formData, loadedCharge: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Deadhead Charges */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Deadhead Charge Type</Label>
                  <select
                    value={formData.deadheadChargeType}
                    onChange={(e) => setFormData({ ...formData, deadheadChargeType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="per-mile">Per Mile</option>
                    <option value="flat">Flat Rate</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>
                    {formData.deadheadChargeType === "flat" ? "Deadhead Charge ($)" : "Deadhead Charge per Mile ($)"}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.deadheadCharge}
                    onChange={(e) => setFormData({ ...formData, deadheadCharge: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Additional Charges */}
              <div className="space-y-2">
                <Label>Additional Charges ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.additionalCharges}
                  onChange={(e) => setFormData({ ...formData, additionalCharges: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </Card>

          {/* Fuel Cost Section */}
          <Card className="p-4">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Fuel className="w-4 h-4 text-orange-500" />
              Fuel Cost
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fuel Cost per Gallon ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.fuelCostPerGallon}
                  onChange={(e) => setFormData({ ...formData, fuelCostPerGallon: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Truck MPG (Miles per Gallon)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.truckMPG}
                  onChange={(e) => setFormData({ ...formData, truckMPG: e.target.value })}
                  placeholder="6.5"
                />
              </div>
            </div>
            {calculations.fuelCost > 0 && (
              <div className="mt-3 p-3 bg-orange-500/10 rounded-md border border-orange-500/20">
                <p className="text-sm">
                  <span className="text-muted-foreground">Estimated Fuel Cost:</span>{" "}
                  <span className="font-semibold text-foreground">{formatCurrency(calculations.fuelCost)}</span>
                </p>
              </div>
            )}
          </Card>

          {/* Driver Settlement Section */}
          <Card className="p-4">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-purple-500" />
              Driver Settlement
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Driver Pay Type</Label>
                  <select
                    value={formData.driverPayType}
                    onChange={(e) => setFormData({ ...formData, driverPayType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="percentage">Percentage of Revenue</option>
                    <option value="per-mile">Per Mile</option>
                    <option value="hourly">Hourly Rate</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>
                    {formData.driverPayType === "percentage"
                      ? "Driver Pay (%)"
                      : formData.driverPayType === "per-mile"
                      ? "Driver Pay per Mile ($)"
                      : "Driver Pay per Hour ($)"}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.driverPay}
                    onChange={(e) => setFormData({ ...formData, driverPay: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                {formData.driverPayType === "hourly" && (
                  <div className="space-y-2">
                    <Label>Driver Hours</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.driverHours}
                      onChange={(e) => setFormData({ ...formData, driverHours: e.target.value })}
                      placeholder="0.0"
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Other Expenses Section */}
          <Card className="p-4">
            <h3 className="font-semibold text-foreground mb-4">Other Expenses</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tolls ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.tolls}
                  onChange={(e) => setFormData({ ...formData, tolls: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Other Expenses ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.otherExpenses}
                  onChange={(e) => setFormData({ ...formData, otherExpenses: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </Card>

          {/* Results Section */}
          {calculations.totalRevenue > 0 && (
            <Card className="p-6 border-2 border-primary/20 bg-primary/5">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Profit Summary
              </h3>
              
              <div className="space-y-4">
                {/* Revenue Breakdown */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-muted-foreground">Total Revenue:</span>
                    <span className="font-semibold text-foreground text-lg">{formatCurrency(calculations.totalRevenue)}</span>
                  </div>
                  {(calculations.loadedRevenue > 0 || calculations.deadheadRevenue > 0 || calculations.additionalCharges > 0) && (
                    <div className="pl-4 space-y-1 text-sm text-muted-foreground">
                      {calculations.loadedRevenue > 0 && (
                        <div className="flex justify-between">
                          <span>Loaded Revenue:</span>
                          <span>{formatCurrency(calculations.loadedRevenue)}</span>
                        </div>
                      )}
                      {calculations.deadheadRevenue > 0 && (
                        <div className="flex justify-between">
                          <span>Deadhead Revenue:</span>
                          <span>{formatCurrency(calculations.deadheadRevenue)}</span>
                        </div>
                      )}
                      {calculations.additionalCharges > 0 && (
                        <div className="flex justify-between">
                          <span>Additional Charges:</span>
                          <span>{formatCurrency(calculations.additionalCharges)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Expenses Breakdown */}
                <div className="pl-4 border-l-2 border-red-500/20">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Expenses:</p>
                  <div className="space-y-1 text-sm">
                    {calculations.fuelCost > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Fuel Cost:</span>
                        <span className="text-foreground">{formatCurrency(calculations.fuelCost)}</span>
                      </div>
                    )}
                    {calculations.driverPayAmount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Driver Pay:</span>
                        <span className="text-foreground">{formatCurrency(calculations.driverPayAmount)}</span>
                      </div>
                    )}
                    {calculations.tolls > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Tolls:</span>
                        <span className="text-foreground">{formatCurrency(calculations.tolls)}</span>
                      </div>
                    )}
                    {calculations.otherExpenses > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Other Expenses:</span>
                        <span className="text-foreground">{formatCurrency(calculations.otherExpenses)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-red-500/20">
                      <span className="font-medium text-foreground">Total Expenses:</span>
                      <span className="font-semibold text-foreground">{formatCurrency(calculations.totalExpenses)}</span>
                    </div>
                  </div>
                </div>

                {/* Profit Results */}
                <div className="border-t border-border pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-semibold text-foreground">Estimated Profit:</span>
                    <span
                      className={`text-2xl font-bold ${
                        calculations.estimatedProfit >= 0 ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {formatCurrency(calculations.estimatedProfit)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm text-muted-foreground">Profit Margin:</span>
                    <span
                      className={`text-lg font-semibold ${
                        calculations.profitMargin >= 0 ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {calculations.profitMargin.toFixed(2)}%
                    </span>
                  </div>

                  {/* Per-Mile Metrics */}
                  {calculations.totalMiles > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Revenue/Mile</p>
                        <p className="text-sm font-semibold text-foreground">{formatCurrency(calculations.revenuePerMile)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Cost/Mile</p>
                        <p className="text-sm font-semibold text-foreground">{formatCurrency(calculations.costPerMile)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Profit/Mile</p>
                        <p className={`text-sm font-semibold ${
                          calculations.profitPerMile >= 0 ? "text-green-500" : "text-red-500"
                        }`}>
                          {formatCurrency(calculations.profitPerMile)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Fuel Cost/Mile</p>
                        <p className="text-sm font-semibold text-foreground">{formatCurrency(calculations.fuelCostPerMile)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFormData({
                  loadedMiles: "",
                  deadheadMiles: "",
                  loadedChargeType: "per-mile",
                  loadedCharge: "",
                  deadheadChargeType: "per-mile",
                  deadheadCharge: "",
                  additionalCharges: "",
                  fuelCostPerGallon: "",
                  truckMPG: "",
                  driverPayType: "percentage",
                  driverPay: "",
                  driverHours: "",
                  tolls: "",
                  otherExpenses: "",
                })
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
