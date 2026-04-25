"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, CheckCircle2, Download, UserCheck } from "lucide-react"
import Link from "next/link"
import { use } from "react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { exportToPDF } from "@/lib/export-utils"
import { toast } from "sonner"
import { approveSettlementAsDriver, getSettlement, markSettlementPaid } from "@/app/actions/accounting"
import { errorMessage } from "@/lib/error-message"
import { getCurrentUser } from "@/lib/auth/server"
import { mapLegacyRole } from "@/lib/roles"

type SettlementLoad = {
  id?: string
  shipment_number?: string
  value?: number
  date?: string
}

export default function SettlementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [settlement, setSettlement] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPaying, setIsPaying] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isDriverUser, setIsDriverUser] = useState(false)

  useEffect(() => {
    if (id === "create") {
      router.replace("/dashboard/accounting/settlements/create")
      return
    }
    void Promise.all([loadSettlement(), loadUserRole()])
  }, [id, router])

  async function loadUserRole() {
    const userResult = await getCurrentUser()
    if (!userResult.error && userResult.data) {
      setIsDriverUser(mapLegacyRole(userResult.data.role) === "driver")
    }
  }

  async function loadSettlement() {
    setIsLoading(true)
    const result = await getSettlement(id)
    if (result.error || !result.data) {
      toast.error(result.error || "Failed to load settlement")
      setSettlement(null)
    } else {
      setSettlement(result.data)
    }
    setIsLoading(false)
  }

  const loads = useMemo<SettlementLoad[]>(
    () => (Array.isArray(settlement?.loads) ? settlement.loads : []),
    [settlement]
  )
  const status = (settlement?.status || "pending").toLowerCase()
  const isPaid = status === "paid"
  const isDriverApproved = Boolean(settlement?.driver_approved)
  const driverName = settlement?.drivers?.name || "N/A"
  const period = settlement?.period_start && settlement?.period_end
    ? `${new Date(settlement.period_start).toLocaleDateString()} - ${new Date(settlement.period_end).toLocaleDateString()}`
    : "N/A"

  const formatMoney = (value: unknown) => {
    const amount = Number(value || 0)
    return `$${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`
  }

  const handleMarkPaid = async () => {
    if (!settlement?.id || isPaid) return
    setIsPaying(true)
    const result = await markSettlementPaid(settlement.id, settlement.payment_method || undefined)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Settlement marked as paid")
      await loadSettlement()
    }
    setIsPaying(false)
  }

  const handleDriverApprove = async () => {
    if (!settlement?.id || isDriverApproved) return
    setIsApproving(true)
    const result = await approveSettlementAsDriver(settlement.id, "web_app")
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Settlement approved")
      await loadSettlement()
    }
    setIsApproving(false)
  }

  if (id === "create") {
    return null
  }

  if (isLoading) {
    return (
      <div className="w-full p-8">
        <Card className="border-border p-8 text-center">
          <p className="text-muted-foreground">Loading settlement...</p>
        </Card>
      </div>
    )
  }

  if (!settlement) {
    return (
      <div className="w-full p-8">
        <Card className="border-border p-8 text-center">
          <p className="text-muted-foreground mb-4">Settlement not found.</p>
          <Link href="/dashboard/accounting/settlements">
            <Button variant="outline">Back to Settlements</Button>
          </Link>
        </Card>
      </div>
    )
  }

  const handleDownload = () => {
    try {
      const content = `
        <h1>Settlement Details</h1>
        <p>Driver: ${driverName}</p>
        <p>Period: ${period}</p>
        <p>Status: ${settlement.status || "pending"}</p>
        <p>Net Pay: ${formatMoney(settlement.net_pay)}</p>
      `
      exportToPDF(content, `settlement-${id}`)
      toast.success("Settlement downloaded successfully")
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to download settlement"))
    }
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <Link href="/dashboard/accounting/settlements">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Settlements
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Settlement Details</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {driverName} - {period}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isPaid && (
              <Button onClick={handleMarkPaid} disabled={isPaying} className="bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {isPaying ? "Marking..." : "Mark as Paid"}
              </Button>
            )}
            {isDriverUser && !isDriverApproved && status !== "cancelled" && (
              <Button onClick={handleDriverApprove} disabled={isApproving} variant="outline">
                <UserCheck className="w-4 h-4 mr-2" />
                {isApproving ? "Approving..." : "Approve Settlement"}
              </Button>
            )}
            <Button onClick={handleDownload} variant="outline" className="border-border bg-transparent">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-border p-6">
              <p className="text-muted-foreground text-sm mb-2">Gross Pay</p>
              <p className="text-3xl font-bold text-foreground">{formatMoney(settlement.gross_pay)}</p>
            </Card>
            <Card className="border-border p-6">
              <p className="text-muted-foreground text-sm mb-2">Per-Diem (Non-Taxable)</p>
              <p className="text-3xl font-bold text-blue-400">{formatMoney(settlement.per_diem_amount)}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {Number(settlement.per_diem_eligible_nights || 0)} nights x {formatMoney(settlement.per_diem_rate_used || 0)}/night
              </p>
            </Card>
            <Card className="border-border p-6">
              <p className="text-muted-foreground text-sm mb-2">Total Deductions</p>
              <p className="text-3xl font-bold text-red-400">{formatMoney(settlement.total_deductions)}</p>
            </Card>
            <Card className="border-border p-6 bg-green-500/10 border-green-500/30 md:col-span-3">
              <p className="text-muted-foreground text-sm mb-2">Net Pay</p>
              <p className="text-3xl font-bold text-green-400">{formatMoney(settlement.net_pay)}</p>
            </Card>
          </div>

          <Card className="border-border p-8">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Driver</p>
                  <p className="text-lg font-semibold text-foreground">{driverName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Settlement Period</p>
                  <p className="text-foreground">{period}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Loads</p>
                  <p className="text-foreground font-semibold">{loads.length}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    isPaid ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {settlement.status ? settlement.status.charAt(0).toUpperCase() + settlement.status.slice(1) : "Pending"}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Paid Date</p>
                  <p className="text-foreground">{settlement.paid_date ? new Date(settlement.paid_date).toLocaleDateString() : "Not paid"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Payment Method</p>
                  <p className="text-foreground">{settlement.payment_method || "Not specified"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Driver Approval</p>
                  <p className="text-foreground">
                    {isDriverApproved
                      ? `Approved${settlement.driver_approved_at ? ` on ${new Date(settlement.driver_approved_at).toLocaleDateString()}` : ""}`
                      : "Awaiting driver approval"}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Deduction Breakdown</h3>
              <div className="space-y-3">
                <div className="flex justify-between py-2">
                  <span className="text-foreground">Fuel Charges</span>
                  <span className="text-red-400 font-medium">{formatMoney(settlement.fuel_deduction)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-foreground">Advances</span>
                  <span className="text-red-400 font-medium">{formatMoney(settlement.advance_deduction)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-foreground">Other</span>
                  <span className="text-red-400 font-medium">{formatMoney(settlement.other_deductions)}</span>
                </div>
                <div className="flex justify-between py-2 border-t border-border pt-3">
                  <span className="text-foreground font-semibold">Total Deductions</span>
                  <span className="text-red-400 font-bold text-lg">{formatMoney(settlement.total_deductions)}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-border p-8">
            <h3 className="text-lg font-semibold text-foreground mb-4">Loads Included</h3>
            {loads.length === 0 ? (
              <p className="text-muted-foreground">No loads attached to this settlement.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-sm font-semibold">Load #</th>
                      <th className="text-left py-2 text-sm font-semibold">Date</th>
                      <th className="text-right py-2 text-sm font-semibold">Load Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loads.map((load, idx) => (
                      <tr key={load.id || `${idx}-${load.shipment_number || "load"}`} className="border-b border-border/50">
                        <td className="py-2">{load.shipment_number || load.id || "N/A"}</td>
                        <td className="py-2">{load.date ? new Date(load.date).toLocaleDateString() : "N/A"}</td>
                        <td className="py-2 text-right">{formatMoney(load.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="border-border p-8">
            <h3 className="text-lg font-semibold text-foreground mb-4">Calculation Details</h3>
            {settlement.calculation_details ? (
              <pre className="text-xs bg-secondary/30 border border-border rounded-md p-4 overflow-x-auto">
                {JSON.stringify(settlement.calculation_details, null, 2)}
              </pre>
            ) : (
              <p className="text-muted-foreground">No calculation details recorded.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
