"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, DollarSign, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getDrivers } from "@/app/actions/drivers"
import { deletePayRule, getActivePayRule, getDriverPayRules, upsertDriverPayRule, type DriverPayRule } from "@/app/actions/settlement-pay-rules"
import { getCompanySettings, updateCompanySettings } from "@/app/actions/number-formats"
import { getCurrentUser } from "@/lib/auth/server"
import { mapLegacyRole } from "@/lib/roles"

export default function PayRulesPage() {
  const [drivers, setDrivers] = useState<any[]>([])
  const [selectedDriverId, setSelectedDriverId] = useState<string>("")
  const [history, setHistory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingPerDiem, setIsSavingPerDiem] = useState(false)
  const [isManager, setIsManager] = useState(false)
  const [perDiemRate, setPerDiemRate] = useState<number>(69)
  const [form, setForm] = useState<DriverPayRule>({
    driver_id: "",
    pay_type: "per_mile",
    base_rate_per_mile: 0,
    base_percentage: 0,
    base_flat_rate: 0,
    minimum_pay_guarantee: 0,
    effective_from: new Date().toISOString().split("T")[0],
    notes: "",
    bonuses: [],
    deductions: [],
    is_active: true,
  })

  const activeRule = useMemo(() => history.find((r) => r.is_active), [history])

  useEffect(() => {
    void loadInitial()
  }, [])

  const loadInitial = async () => {
    setIsLoading(true)
    const [driversResult, userResult] = await Promise.all([getDrivers(), getCurrentUser()])
    if (driversResult.error) {
      toast.error(driversResult.error)
    } else {
      setDrivers(driversResult.data || [])
    }
    if (!userResult.error && userResult.data) {
      const mapped = mapLegacyRole(userResult.data.role)
      setIsManager(mapped === "super_admin" || mapped === "operations_manager")
    }
    const settingsResult = await getCompanySettings()
    if (!settingsResult.error && settingsResult.data?.per_diem_rate !== undefined && settingsResult.data?.per_diem_rate !== null) {
      const rate = Number(settingsResult.data.per_diem_rate)
      if (Number.isFinite(rate) && rate >= 0) {
        setPerDiemRate(rate)
      }
    }
    setIsLoading(false)
  }

  const loadDriverRules = async (driverId: string) => {
    setSelectedDriverId(driverId)
    setForm((prev) => ({ ...prev, driver_id: driverId }))
    const [activeResult, historyResult] = await Promise.all([
      getActivePayRule(driverId),
      getDriverPayRules(driverId),
    ])
    if (activeResult.error) toast.error(activeResult.error)
    if (historyResult.error) toast.error(historyResult.error)
    const ruleHistory = historyResult.data || []
    setHistory(ruleHistory)

    if (activeResult.data) {
      const r = activeResult.data
      setForm({
        id: r.id,
        driver_id: driverId,
        pay_type: r.pay_type,
        base_rate_per_mile: Number(r.base_rate_per_mile || 0),
        base_percentage: Number(r.base_percentage || 0),
        base_flat_rate: Number(r.base_flat_rate || 0),
        minimum_pay_guarantee: Number(r.minimum_pay_guarantee || 0),
        effective_from: r.effective_from || new Date().toISOString().split("T")[0],
        effective_to: r.effective_to || "",
        notes: r.notes || "",
        bonuses: Array.isArray(r.bonuses) ? r.bonuses : [],
        deductions: Array.isArray(r.deductions) ? r.deductions : [],
        is_active: true,
      })
    }
  }

  const handleSave = async () => {
    if (!isManager) return toast.error("Only managers can manage pay rules")
    if (!selectedDriverId) return toast.error("Select a driver first")
    setIsSaving(true)
    const payload: DriverPayRule = {
      ...form,
      driver_id: selectedDriverId,
      effective_to: form.effective_to || undefined,
      notes: form.notes || undefined,
      base_rate_per_mile: Number(form.base_rate_per_mile || 0),
      base_percentage: Number(form.base_percentage || 0),
      base_flat_rate: Number(form.base_flat_rate || 0),
      minimum_pay_guarantee: Number(form.minimum_pay_guarantee || 0),
    }
    const result = await upsertDriverPayRule(payload)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Pay rule saved")
      await loadDriverRules(selectedDriverId)
    }
    setIsSaving(false)
  }

  const handleDelete = async (ruleId: string) => {
    if (!isManager) return toast.error("Only managers can delete pay rules")
    const result = await deletePayRule(ruleId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Pay rule deleted")
      await loadDriverRules(selectedDriverId)
    }
  }

  const handleSavePerDiemRate = async () => {
    if (!isManager) return toast.error("Only managers can update per-diem settings")
    setIsSavingPerDiem(true)
    const result = await updateCompanySettings({ per_diem_rate: perDiemRate })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Per-diem rate updated")
    }
    setIsSavingPerDiem(false)
  }

  if (isLoading) {
    return (
      <div className="w-full p-8">
        <Card className="border-border p-8 text-center text-muted-foreground">Loading pay rules...</Card>
      </div>
    )
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
        <h1 className="text-3xl font-bold text-foreground">Driver Pay Rules</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure and review each driver's settlement pay engine.</p>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <Card className="border-border p-6">
            <h3 className="font-semibold text-foreground mb-3">Per-Diem Default</h3>
            <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <Label className="mb-2 block">Per-Diem Rate (USD per night)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={perDiemRate}
                  onChange={(e) => setPerDiemRate(Number(e.target.value || 0))}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Default IRS transportation worker rate is $69/night.
                </p>
              </div>
              <Button onClick={handleSavePerDiemRate} disabled={!isManager || isSavingPerDiem}>
                <Save className="w-4 h-4 mr-2" />
                {isSavingPerDiem ? "Saving..." : "Save Rate"}
              </Button>
            </div>
          </Card>

          <Card className="border-border p-6">
            <Label className="mb-2 block">Driver</Label>
            <Select value={selectedDriverId} onValueChange={loadDriverRules}>
              <SelectTrigger>
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          {selectedDriverId && (
            <>
              <Card className="border-border p-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-2 block">Pay Type</Label>
                    <Select
                      value={form.pay_type}
                      onValueChange={(value: DriverPayRule["pay_type"]) => setForm((prev) => ({ ...prev, pay_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_mile">Per Mile</SelectItem>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="flat">Flat Per Load</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-2 block">Effective From</Label>
                    <Input
                      type="date"
                      value={form.effective_from}
                      onChange={(e) => setForm((prev) => ({ ...prev, effective_from: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">Rate Per Mile</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.base_rate_per_mile || 0}
                      onChange={(e) => setForm((prev) => ({ ...prev, base_rate_per_mile: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">Percentage (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.base_percentage || 0}
                      onChange={(e) => setForm((prev) => ({ ...prev, base_percentage: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">Flat Rate Per Load</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.base_flat_rate || 0}
                      onChange={(e) => setForm((prev) => ({ ...prev, base_flat_rate: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">Minimum Pay Guarantee</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.minimum_pay_guarantee || 0}
                      onChange={(e) => setForm((prev) => ({ ...prev, minimum_pay_guarantee: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="mb-2 block">Notes</Label>
                    <Input
                      value={form.notes || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Optional notes for this rule"
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button onClick={handleSave} disabled={isSaving || !isManager}>
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? "Saving..." : "Save Pay Rule"}
                  </Button>
                </div>
              </Card>

              <Card className="border-border p-6">
                <h3 className="font-semibold text-foreground mb-3">Current Active Rule</h3>
                {activeRule ? (
                  <div className="text-sm text-foreground space-y-1">
                    <p><span className="text-muted-foreground">Type:</span> {activeRule.pay_type}</p>
                    <p><span className="text-muted-foreground">Effective:</span> {activeRule.effective_from}</p>
                    <p><span className="text-muted-foreground">Min Guarantee:</span> ${Number(activeRule.minimum_pay_guarantee || 0).toFixed(2)}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No active rule for this driver.</p>
                )}
              </Card>

              <Card className="border-border p-6">
                <h3 className="font-semibold text-foreground mb-3">Rule History</h3>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No rules found.</p>
                ) : (
                  <div className="space-y-2">
                    {history.map((rule) => (
                      <div key={rule.id} className="flex items-center justify-between border border-border rounded-md p-3">
                        <div className="text-sm">
                          <p className="font-medium text-foreground flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            {rule.pay_type} {rule.is_active ? "(Active)" : ""}
                          </p>
                          <p className="text-muted-foreground">Effective {rule.effective_from} {rule.effective_to ? `to ${rule.effective_to}` : ""}</p>
                        </div>
                        {!rule.is_active && isManager && (
                          <Button variant="outline" size="sm" onClick={() => handleDelete(rule.id)}>
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

