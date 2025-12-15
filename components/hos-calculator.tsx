"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calculator, Clock, AlertTriangle, CheckCircle2 } from "lucide-react"
import { calculateRemainingHOS } from "@/app/actions/eld-advanced"
import { getDrivers } from "@/app/actions/drivers"
import { toast } from "sonner"

export function HOSCalculator() {
  const [driverId, setDriverId] = useState("")
  const [drivers, setDrivers] = useState<any[]>([])
  const [hosData, setHosData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    loadDrivers()
  }, [])

  useEffect(() => {
    if (driverId) {
      calculateHOS()
    }
  }, [driverId, date])

  async function loadDrivers() {
    const result = await getDrivers()
    if (result.data) {
      setDrivers(result.data)
    }
  }

  async function calculateHOS() {
    if (!driverId) return

    setIsLoading(true)
    try {
      const result = await calculateRemainingHOS(driverId, date)
      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        setHosData(result.data)
      }
    } catch (error) {
      toast.error("Failed to calculate HOS")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="p-6 border-border">
      <div className="flex items-center gap-2 mb-6">
        <Calculator className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">HOS Calculator</h2>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <Label htmlFor="driver">Driver</Label>
          <Select value={driverId} onValueChange={setDriverId}>
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
        </div>

        <div>
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {hosData && (
        <div className="space-y-4">
          {/* Status */}
          <div className={`p-4 rounded-lg border ${
            hosData.canDrive
              ? "bg-green-500/10 border-green-500/20"
              : "bg-red-500/10 border-red-500/20"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {hosData.canDrive ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-500" />
              )}
              <h3 className="font-semibold text-foreground">
                {hosData.canDrive ? "Can Drive" : "Cannot Drive"}
              </h3>
            </div>
            {hosData.violations.length > 0 && (
              <div className="mt-2 space-y-1">
                {hosData.violations.map((violation: string, index: number) => (
                  <p key={index} className="text-sm text-red-500">• {violation}</p>
                ))}
              </div>
            )}
          </div>

          {/* Hours Breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 bg-card/50 border-border">
              <p className="text-xs text-muted-foreground mb-1">Driving Hours</p>
              <p className="text-2xl font-bold text-foreground">
                {hosData.drivingHours.toFixed(1)}h
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                of 11.0h max
              </p>
            </Card>

            <Card className="p-4 bg-card/50 border-border">
              <p className="text-xs text-muted-foreground mb-1">On-Duty Hours</p>
              <p className="text-2xl font-bold text-foreground">
                {hosData.onDutyHours.toFixed(1)}h
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                of 14.0h max
              </p>
            </Card>

            <Card className="p-4 bg-card/50 border-border">
              <p className="text-xs text-muted-foreground mb-1">Remaining Driving</p>
              <p className={`text-2xl font-bold ${
                hosData.remainingDriving > 2
                  ? "text-green-500"
                  : hosData.remainingDriving > 0
                  ? "text-yellow-500"
                  : "text-red-500"
              }`}>
                {hosData.remainingDriving.toFixed(1)}h
              </p>
            </Card>

            <Card className="p-4 bg-card/50 border-border">
              <p className="text-xs text-muted-foreground mb-1">Remaining On-Duty</p>
              <p className={`text-2xl font-bold ${
                hosData.remainingOnDuty > 2
                  ? "text-green-500"
                  : hosData.remainingOnDuty > 0
                  ? "text-yellow-500"
                  : "text-red-500"
              }`}>
                {hosData.remainingOnDuty.toFixed(1)}h
              </p>
            </Card>
          </div>

          {/* Break Requirement */}
          {hosData.needsBreak && (
            <Card className="p-4 bg-yellow-500/10 border-yellow-500/20">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="font-semibold text-foreground">Break Required</p>
                  <p className="text-sm text-muted-foreground">
                    30 minutes off-duty break needed (has driven 8+ hours)
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {!driverId && (
        <div className="text-center py-8 text-muted-foreground">
          Select a driver to calculate HOS
        </div>
      )}
    </Card>
  )
}
