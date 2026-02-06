  "use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Settings, Plus, Edit, Trash2, Download, Upload } from "lucide-react"
import {
  getIFTATaxRates,
  upsertIFTATaxRate,
  bulkUpdateIFTATaxRates,
  deleteIFTATaxRate,
} from "@/app/actions/ifta-tax-rates"
import type { IFTATaxRate } from "@/app/actions/ifta-tax-rates"

const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
]

export default function IFTATaxRatesPage() {
  const [taxRates, setTaxRates] = useState<IFTATaxRate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingRate, setEditingRate] = useState<IFTATaxRate | null>(null)
  const [formData, setFormData] = useState({
    state_code: "",
    state_name: "",
    quarter: 1,
    year: new Date().getFullYear(),
    tax_rate_per_gallon: "",
    effective_date: "",
    notes: "",
  })

  useEffect(() => {
    loadTaxRates()
  }, [selectedQuarter, selectedYear])

  const loadTaxRates = async () => {
    setIsLoading(true)
    const result = await getIFTATaxRates({
      quarter: selectedQuarter,
      year: selectedYear,
    })
    if (result.error) {
      toast.error(result.error)
    } else if (result.data) {
      setTaxRates(result.data)
    }
    setIsLoading(false)
  }

  const handleEdit = (rate: IFTATaxRate) => {
    setEditingRate(rate)
    setFormData({
      state_code: rate.state_code,
      state_name: rate.state_name,
      quarter: rate.quarter,
      year: rate.year,
      tax_rate_per_gallon: rate.tax_rate_per_gallon.toString(),
      effective_date: rate.effective_date,
      notes: rate.notes || "",
    })
    setShowEditDialog(true)
  }

  const handleAdd = () => {
    setEditingRate(null)
    setFormData({
      state_code: "",
      state_name: "",
      quarter: selectedQuarter,
      year: selectedYear,
      tax_rate_per_gallon: "",
      effective_date: `${selectedYear}-${String((selectedQuarter - 1) * 3 + 1).padStart(2, "0")}-01`,
      notes: "",
    })
    setShowEditDialog(true)
  }

  const handleSave = async () => {
    if (!formData.state_code || !formData.state_name || !formData.tax_rate_per_gallon) {
      toast.error("Please fill in all required fields")
      return
    }

    const result = await upsertIFTATaxRate({
      state_code: formData.state_code,
      state_name: formData.state_name,
      quarter: formData.quarter,
      year: formData.year,
      tax_rate_per_gallon: parseFloat(formData.tax_rate_per_gallon),
      effective_date: formData.effective_date,
      notes: formData.notes || null,
    })

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(editingRate ? "Tax rate updated successfully" : "Tax rate created successfully")
      setShowEditDialog(false)
      loadTaxRates()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tax rate?")) return

    const result = await deleteIFTATaxRate(id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Tax rate deleted successfully")
      loadTaxRates()
    }
  }

  const handleBulkUpdate = async () => {
    // Open CSV upload dialog
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".csv"
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const lines = text.split("\n").filter((line: string) => line.trim())
        const header = lines[0].split(",").map((h: string) => h.trim().toLowerCase())
        
        // Expected format: state_code,state_name,tax_rate_per_gallon
        const stateCodeIndex = header.indexOf("state_code")
        const stateNameIndex = header.indexOf("state_name")
        const rateIndex = header.indexOf("tax_rate_per_gallon")

        if (stateCodeIndex === -1 || stateNameIndex === -1 || rateIndex === -1) {
          toast.error("CSV must have columns: state_code, state_name, tax_rate_per_gallon")
          return
        }

        const rates = []
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",").map((v: string) => v.trim())
          if (values[stateCodeIndex] && values[stateNameIndex] && values[rateIndex]) {
            rates.push({
              state_code: values[stateCodeIndex],
              state_name: values[stateNameIndex],
              tax_rate_per_gallon: parseFloat(values[rateIndex]),
            })
          }
        }

        if (rates.length === 0) {
          toast.error("No valid rates found in CSV")
          return
        }

        const result = await bulkUpdateIFTATaxRates(selectedQuarter, selectedYear, rates)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success(`Successfully updated ${result.data?.updated || rates.length} tax rates`)
          loadTaxRates()
        }
      } catch (error: any) {
        toast.error(`Failed to process CSV: ${error.message}`)
      }
    }
    input.click()
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">IFTA Tax Rates</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage quarterly tax rates for accurate IFTA reporting
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleBulkUpdate} variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Bulk Update
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Rate
          </Button>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Filters */}
          <Card className="border border-border/50 p-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="quarter">Quarter</Label>
                <Select
                  value={selectedQuarter.toString()}
                  onValueChange={(value) => setSelectedQuarter(parseInt(value))}
                >
                  <SelectTrigger id="quarter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Q1 (Jan-Mar)</SelectItem>
                    <SelectItem value="2">Q2 (Apr-Jun)</SelectItem>
                    <SelectItem value="3">Q3 (Jul-Sep)</SelectItem>
                    <SelectItem value="4">Q4 (Oct-Dec)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value) || new Date().getFullYear())}
                  min={2020}
                  max={2030}
                />
              </div>
            </div>
          </Card>

          {/* Tax Rates Table */}
          <Card className="border border-border/50">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                Tax Rates for Q{selectedQuarter} {selectedYear}
              </h2>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : taxRates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tax rates found for this quarter. Click "Add Rate" to create one.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-semibold">State</th>
                        <th className="text-right p-3 font-semibold">Tax Rate ($/gal)</th>
                        <th className="text-left p-3 font-semibold">Effective Date</th>
                        <th className="text-left p-3 font-semibold">Notes</th>
                        <th className="text-right p-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxRates.map((rate) => (
                        <tr key={rate.id} className="border-b border-border/50 hover:bg-secondary/50">
                          <td className="p-3">
                            <div className="font-medium">{rate.state_name}</div>
                            <div className="text-sm text-muted-foreground">{rate.state_code}</div>
                          </td>
                          <td className="p-3 text-right font-mono">
                            ${rate.tax_rate_per_gallon.toFixed(4)}
                          </td>
                          <td className="p-3 text-sm">
                            {new Date(rate.effective_date).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {rate.notes || "-"}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(rate)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(rate.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Edit/Add Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRate ? "Edit Tax Rate" : "Add Tax Rate"}</DialogTitle>
            <DialogDescription>
              {editingRate
                ? "Update the tax rate for this state and quarter."
                : "Add a new tax rate for IFTA reporting."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="state_code">State Code *</Label>
                <Select
                  value={formData.state_code}
                  onValueChange={(value) => {
                    const state = US_STATES.find((s) => s.code === value)
                    setFormData({
                      ...formData,
                      state_code: value,
                      state_name: state?.name || "",
                    })
                  }}
                >
                  <SelectTrigger id="state_code">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem key={state.code} value={state.code}>
                        {state.name} ({state.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="state_name">State Name *</Label>
                <Input
                  id="state_name"
                  value={formData.state_name}
                  onChange={(e) => setFormData({ ...formData, state_name: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quarter">Quarter *</Label>
                <Select
                  value={formData.quarter.toString()}
                  onValueChange={(value) => setFormData({ ...formData, quarter: parseInt(value) })}
                >
                  <SelectTrigger id="quarter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Q1 (Jan-Mar)</SelectItem>
                    <SelectItem value="2">Q2 (Apr-Jun)</SelectItem>
                    <SelectItem value="3">Q3 (Jul-Sep)</SelectItem>
                    <SelectItem value="4">Q4 (Oct-Dec)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="year">Year *</Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                  min={2020}
                  max={2030}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="tax_rate_per_gallon">Tax Rate ($/gallon) *</Label>
              <Input
                id="tax_rate_per_gallon"
                type="number"
                step="0.0001"
                value={formData.tax_rate_per_gallon}
                onChange={(e) => setFormData({ ...formData, tax_rate_per_gallon: e.target.value })}
                placeholder="0.2500"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter the tax rate in dollars per gallon (e.g., 0.25 for 25 cents)
              </p>
            </div>
            <div>
              <Label htmlFor="effective_date">Effective Date *</Label>
              <Input
                id="effective_date"
                type="date"
                value={formData.effective_date}
                onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes about this rate"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingRate ? "Update" : "Create"} Rate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

