"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Download, Loader2, Mail } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  generate1099NECPdfBase64,
  getContractor1099Summary,
  send1099ToDriver,
} from "@/app/actions/tax-forms"

type Row = {
  driverId: string
  driverName: string
  driverEmail: string | null
  employeeType: string | null
  annualPayments: number
  settlementCount: number
  qualifiesFor1099: boolean
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0)
}

export default function YearEnd1099Page() {
  const currentYear = new Date().getFullYear()
  const [taxYear, setTaxYear] = useState(String(currentYear))
  const [rows, setRows] = useState<Row[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [workingDriverId, setWorkingDriverId] = useState<string | null>(null)

  const yearOptions = useMemo(() => Array.from({ length: 8 }, (_, i) => String(currentYear - i)), [currentYear])

  const loadData = async (year: number) => {
    setIsLoading(true)
    const result = await getContractor1099Summary(year)
    if (result.error) {
      toast.error(result.error)
      setRows([])
    } else {
      setRows(result.data || [])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    void loadData(Number(taxYear))
  }, [taxYear])

  const handleGenerate = async (driverId: string) => {
    setWorkingDriverId(driverId)
    const result = await generate1099NECPdfBase64(driverId, Number(taxYear))
    setWorkingDriverId(null)
    if (result.error || !result.base64 || !result.filename) {
      toast.error(result.error || "Failed to generate 1099")
      return
    }

    const binary = atob(result.base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = result.filename
    a.click()
    URL.revokeObjectURL(url)
    toast.success("1099 generated")
  }

  const handleSend = async (driverId: string) => {
    setWorkingDriverId(driverId)
    const result = await send1099ToDriver(driverId, Number(taxYear))
    setWorkingDriverId(null)
    if (result.error || !result.data) {
      toast.error(result.error || "Failed to send 1099")
      return
    }
    toast.success(`1099 sent to ${result.data.to}`)
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <Link href="/dashboard/settings">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Year-End 1099-NEC</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Contractor annual settlement totals and one-click 1099 generation/email.
        </p>
      </div>

      <div className="p-4 md:p-8 space-y-6">
        <Card className="border-border p-4 md:p-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Tax Year</label>
              <Select value={taxYear} onValueChange={setTaxYear}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => loadData(Number(taxYear))} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Refresh
            </Button>
          </div>
        </Card>

        <Card className="border-border p-4 md:p-6">
          {isLoading ? (
            <p className="text-muted-foreground">Loading contractor totals...</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground">No contractor drivers found for this year.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-sm font-semibold">Driver</th>
                    <th className="text-left py-2 text-sm font-semibold">Email</th>
                    <th className="text-left py-2 text-sm font-semibold">Settlements</th>
                    <th className="text-left py-2 text-sm font-semibold">Annual Pay Total</th>
                    <th className="text-left py-2 text-sm font-semibold">1099 Status</th>
                    <th className="text-right py-2 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isWorking = workingDriverId === row.driverId
                    return (
                      <tr key={row.driverId} className="border-b border-border/50">
                        <td className="py-3 text-sm text-foreground">{row.driverName}</td>
                        <td className="py-3 text-sm text-muted-foreground">{row.driverEmail || "No email"}</td>
                        <td className="py-3 text-sm text-foreground">{row.settlementCount}</td>
                        <td className="py-3 text-sm text-foreground font-medium">{formatMoney(row.annualPayments)}</td>
                        <td className="py-3 text-sm">
                          <span className={row.qualifiesFor1099 ? "text-green-400" : "text-yellow-400"}>
                            {row.qualifiesFor1099 ? "Eligible (>= $600)" : "Below threshold"}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isWorking}
                              onClick={() => handleGenerate(row.driverId)}
                            >
                              {isWorking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                              Generate 1099
                            </Button>
                            <Button
                              size="sm"
                              disabled={isWorking || !row.driverEmail}
                              onClick={() => handleSend(row.driverId)}
                            >
                              {isWorking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                              Send to Driver
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

