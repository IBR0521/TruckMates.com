"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, FileText, Calendar, Truck } from "lucide-react"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { generateDVIRAuditPDF } from "@/app/actions/dvir-pdf"
import { getTrucks } from "@/app/actions/trucks"

export default function DVIRAuditPage() {
  const [trucks, setTrucks] = useState<any[]>([])
  const [selectedTruck, setSelectedTruck] = useState<string>("all")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    loadTrucks()
    // Set default date range (last 30 days)
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    setEndDate(end.toISOString().split("T")[0])
    setStartDate(start.toISOString().split("T")[0])
  }, [])

  async function loadTrucks() {
    const result = await getTrucks()
    if (result.data) {
      setTrucks(result.data)
    }
  }

  async function handleGeneratePDF() {
    if (!startDate || !endDate) {
      toast.error("Please select a date range")
      return
    }

    setIsGenerating(true)
    try {
      const result = await generateDVIRAuditPDF({
        truck_id: selectedTruck !== "all" ? selectedTruck : undefined,
        start_date: startDate,
        end_date: endDate,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      // Create blob and download
      const blob = new Blob([result.html], { type: "text/html" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `DVIR_Audit_${startDate}_${endDate}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Also open in new window for printing
      const printWindow = window.open("", "_blank")
      if (printWindow) {
        printWindow.document.write(result.html)
        printWindow.document.close()
        printWindow.focus()
        // Auto-print after a short delay
        setTimeout(() => {
          printWindow.print()
        }, 500)
      }

      toast.success("DVIR audit report generated successfully")
    } catch (error: any) {
      toast.error("Failed to generate PDF: " + error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">DVIR Audit Report</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generate PDF reports for DOT audits and compliance
          </p>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="border-border p-6">
            <h2 className="text-lg font-semibold mb-6">Report Filters</h2>
            <div className="space-y-4">
              <div>
                <Label>Truck</Label>
                <Select value={selectedTruck} onValueChange={setSelectedTruck}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select truck" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Trucks</SelectItem>
                    {trucks.map((truck) => (
                      <SelectItem key={truck.id} value={truck.id}>
                        {truck.truck_number} {truck.make && truck.model && `(${truck.make} ${truck.model})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <Label>End Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleGeneratePDF}
                disabled={isGenerating || !startDate || !endDate}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <FileText className="w-4 h-4 mr-2 animate-pulse" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Generate Audit PDF
                  </>
                )}
              </Button>
            </div>
          </Card>

          <Card className="border-border p-6 bg-blue-500/10 border-blue-500/50">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-2">Audit-Ready Reports</h3>
                <p className="text-sm text-muted-foreground">
                  This report includes all DVIRs for the selected date range and truck. The PDF is formatted
                  for DOT audits and includes all required information: inspection dates, driver signatures,
                  defects found, and corrective actions. You can print or save this report for your records.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}



