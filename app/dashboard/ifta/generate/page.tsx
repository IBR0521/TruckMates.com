"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { getTrucks } from "@/app/actions/trucks"
import { generateIFTAReport } from "@/app/actions/tax-fuel-reconciliation"
import { toast } from "sonner"

export default function GenerateIFTAPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [trucks, setTrucks] = useState<Array<{ id: string; truck_number: string; make?: string; model?: string }>>([])
  const [formData, setFormData] = useState({
    quarter: "Q1",
    year: new Date().getFullYear(),
    truck_ids: [] as string[],
    include_eld: true,
  })

  useEffect(() => {
    loadTrucks()
  }, [])

  const loadTrucks = async () => {
    const result = await getTrucks()
    if (result.data) {
      setTrucks(result.data)
    }
  }

  const handleTruckToggle = (truckId: string) => {
    setFormData((prev) => ({
      ...prev,
      truck_ids: prev.truck_ids.includes(truckId)
        ? prev.truck_ids.filter((id) => id !== truckId)
        : [...prev.truck_ids, truckId],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.truck_ids.length === 0) {
      toast.error("Please select at least one truck")
      return
    }

    // Convert quarter string to number (Q1 -> 1, Q2 -> 2, etc.)
    const quarterNumber = parseInt(formData.quarter.replace("Q", ""))

    setLoading(true)
    try {
      const result = await generateIFTAReport(quarterNumber, formData.year)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("IFTA report generated successfully")
        router.push("/dashboard/ifta")
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to generate IFTA report")
    } finally {
      setLoading(false)
    }
  }

  // Calculate quarter dates for preview
  const getQuarterDates = () => {
    const year = formData.year
    const quarter = formData.quarter
    if (quarter === "Q1") return { start: `${year}-01-01`, end: `${year}-03-31`, period: `Jan-Mar ${year}` }
    if (quarter === "Q2") return { start: `${year}-04-01`, end: `${year}-06-30`, period: `Apr-Jun ${year}` }
    if (quarter === "Q3") return { start: `${year}-07-01`, end: `${year}-09-30`, period: `Jul-Sep ${year}` }
    if (quarter === "Q4") return { start: `${year}-10-01`, end: `${year}-12-31`, period: `Oct-Dec ${year}` }
    return { start: "", end: "", period: "" }
  }

  const quarterDates = getQuarterDates()

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <Link href="/dashboard/ifta">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to IFTA Reports
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Generate IFTA Report</h1>
        <p className="text-muted-foreground text-sm mt-1">Create quarterly IFTA tax report</p>
      </div>

      <div className="p-4 md:p-8">
        <Card className="max-w-3xl mx-auto border-border p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Quarter *</label>
                <select
                  required
                  value={formData.quarter}
                  onChange={(e) => setFormData({ ...formData, quarter: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
                >
                  <option>Q1</option>
                  <option>Q2</option>
                  <option>Q3</option>
                  <option>Q4</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Period: {quarterDates.period}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Year *</label>
                <Input
                  required
                  type="number"
                  min="2020"
                  max="2099"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                  className="bg-background border-border"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Select Trucks * ({formData.truck_ids.length} selected)
              </label>
              {trucks.length === 0 ? (
                <div className="p-4 bg-secondary/20 rounded-lg text-center text-muted-foreground">
                  <p>No trucks available. Please add trucks first.</p>
                  <Link href="/dashboard/trucks/add" className="text-primary hover:underline mt-2 inline-block">
                    Add Truck
                  </Link>
                </div>
              ) : (
                <div className="space-y-2 p-4 bg-secondary/20 rounded-lg max-h-64 overflow-y-auto">
                  {trucks.map((truck) => (
                    <label key={truck.id} className="flex items-center gap-2 cursor-pointer hover:bg-secondary/30 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={formData.truck_ids.includes(truck.id)}
                        onChange={() => handleTruckToggle(truck.id)}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <span className="text-foreground font-medium">{truck.truck_number}</span>
                        {(truck.make || truck.model) && (
                          <span className="text-muted-foreground text-sm ml-2">
                            {truck.make} {truck.model}
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {formData.truck_ids.length === 0 && (
                <p className="text-xs text-red-400 mt-1">Please select at least one truck</p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.include_eld}
                  onChange={(e) => setFormData({ ...formData, include_eld: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-foreground">Include ELD data</span>
              </label>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                Automatically pull mileage data from electronic logging devices (if available)
              </p>
            </div>

            <Card className="bg-secondary/20 p-4 border-border/50">
              <h4 className="text-sm font-semibold text-foreground mb-3">Report Preview</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Period:</span>
                  <span className="text-foreground font-medium">{quarterDates.period}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Selected Trucks:</span>
                  <span className="text-foreground font-medium">{formData.truck_ids.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date Range:</span>
                  <span className="text-foreground font-medium">
                    {quarterDates.start} to {quarterDates.end}
                  </span>
                </div>
                <div className="pt-2 border-t border-border/50 mt-2">
                  <p className="text-xs text-muted-foreground">
                    Note: Actual mileage and tax calculations will be performed when you generate the report based on routes and loads for the selected trucks during this period.
                  </p>
                </div>
              </div>
            </Card>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={loading || formData.truck_ids.length === 0}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Report"
                )}
              </Button>
              <Link href="/dashboard/ifta">
                <Button type="button" variant="outline" className="border-border bg-transparent" disabled={loading}>
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
