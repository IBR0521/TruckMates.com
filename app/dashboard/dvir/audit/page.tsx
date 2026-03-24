"use client"

import { Button } from "@/components/ui/button"
import { errorMessage } from "@/lib/error-message"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, FileText, Calendar, Truck } from "lucide-react"
import { useState, useEffect } from "react"
import { toast } from "sonner"
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
      const params = new URLSearchParams()
      if (selectedTruck !== "all") params.set("truck_id", selectedTruck)
      if (startDate) params.set("start_date", startDate)
      if (endDate) params.set("end_date", endDate)

      const response = await fetch(`/api/dvir/audit/pdf?${params.toString()}`)

      if (!response.ok) {
        let errorMessage = "Failed to generate DVIR audit report"
        try {
          const errorData = await response.json()
          if (errorData?.error) errorMessage = errorData.error
        } catch {
          // Ignore JSON parse errors
        }
        toast.error(errorMessage)
        return
      }

      const contentType = response.headers.get("content-type")

      if (contentType === "application/pdf") {
        // Download actual PDF
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `DVIR_Audit_${startDate}_${endDate}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success("DVIR audit report downloaded as PDF")
      } else {
        // Fallback: HTML response (if Puppeteer not available)
        const html = await response.text()
        const printWindow = window.open("", "_blank")
        if (printWindow) {
          printWindow.document.write(html)
          printWindow.document.close()
          setTimeout(() => {
            printWindow.print()
          }, 300)
          toast.success("DVIR audit report opened (HTML fallback)")
        } else {
          toast.error("Please allow popups to view the DVIR audit report")
        }
      }
    } catch (error: unknown) {
      toast.error("Failed to generate DVIR audit report: " + (errorMessage(error, "Unknown error")))
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
                    Generate Audit Report
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
                  This report includes all DVIRs for the selected date range and truck. The report is formatted
                  for DOT audits and includes all required information: inspection dates, driver signatures,
                  defects found, and corrective actions. The report is generated as a real PDF file ready for
                  professional use and compliance documentation.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}



