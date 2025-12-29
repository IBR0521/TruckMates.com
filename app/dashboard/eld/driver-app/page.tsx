"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Truck,
  MapPin,
  Bell,
  RefreshCw,
} from "lucide-react"
import { calculateRemainingHOS } from "@/app/actions/eld-advanced"
import { getDrivers } from "@/app/actions/drivers"
import { getELDLogs } from "@/app/actions/eld"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export default function DriverAppPage() {
  const router = useRouter()
  const [driverId, setDriverId] = useState("")
  const [drivers, setDrivers] = useState<any[]>([])
  const [hosData, setHosData] = useState<any>(null)
  const [currentStatus, setCurrentStatus] = useState<string>("off_duty")
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    loadDrivers()
  }, [])

  useEffect(() => {
    if (driverId) {
      loadHOSData()
      const interval = setInterval(loadHOSData, 60000) // Update every minute
      return () => clearInterval(interval)
    }
  }, [driverId])

  async function loadDrivers() {
    const result = await getDrivers()
    if (result.data) {
      setDrivers(result.data)
    }
  }

  async function loadHOSData() {
    if (!driverId) return

    setIsLoading(true)
    try {
      const result = await calculateRemainingHOS(driverId)
      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        setHosData(result.data)
        setLastUpdate(new Date())
      }

      // Get current status from latest log
      const logsResult = await getELDLogs({ driver_id: driverId })
      if (logsResult.data && logsResult.data.length > 0) {
        const latestLog = logsResult.data[0]
        if (latestLog.end_time === null) {
          setCurrentStatus(latestLog.log_type)
        } else {
          setCurrentStatus("off_duty")
        }
      }
    } catch (error) {
      toast.error("Failed to load HOS data")
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "driving":
        return "bg-blue-500/20 text-blue-500 border-blue-500/50"
      case "on_duty":
        return "bg-yellow-500/20 text-yellow-500 border-yellow-500/50"
      case "off_duty":
        return "bg-green-500/20 text-green-500 border-green-500/50"
      case "sleeper_berth":
        return "bg-purple-500/20 text-purple-500 border-purple-500/50"
      default:
        return "bg-gray-500/20 text-gray-500 border-gray-500/50"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "driving":
        return <Truck className="w-6 h-6" />
      case "on_duty":
        return <Clock className="w-6 h-6" />
      case "off_duty":
        return <CheckCircle2 className="w-6 h-6" />
      case "sleeper_berth":
        return <MapPin className="w-6 h-6" />
      default:
        return <Clock className="w-6 h-6" />
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Driver HOS Status</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadHOSData}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Driver Selection */}
        {!driverId && (
          <Card className="p-6 border-border">
            <h2 className="text-lg font-semibold text-foreground mb-4">Select Driver</h2>
            <div className="space-y-2">
              {drivers.map((driver) => (
                <Button
                  key={driver.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setDriverId(driver.id)}
                >
                  {driver.name}
                </Button>
              ))}
            </div>
          </Card>
        )}

        {driverId && hosData && (
          <>
            {/* Current Status - Big Display */}
            <Card className="p-8 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <div className={`p-4 rounded-full ${getStatusColor(currentStatus)}`}>
                    {getStatusIcon(currentStatus)}
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {currentStatus.replace("_", " ").toUpperCase()}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </p>
              </div>
            </Card>

            {/* Can Drive Status */}
            <Card
              className={`p-6 border-2 ${
                hosData.canDrive
                  ? "bg-green-500/10 border-green-500/50"
                  : "bg-red-500/10 border-red-500/50"
              }`}
            >
              <div className="flex items-center gap-3">
                {hosData.canDrive ? (
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground">
                    {hosData.canDrive ? "✅ Can Drive" : "❌ Cannot Drive"}
                  </h3>
                  {hosData.violations.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {hosData.violations.map((violation: string, index: number) => (
                        <p key={index} className="text-sm text-red-500">• {violation}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Remaining Hours - Big Numbers */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-6 bg-card/50 border-border">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Remaining Driving</p>
                  <p
                    className={`text-4xl font-bold ${
                      hosData.remainingDriving > 2
                        ? "text-green-500"
                        : hosData.remainingDriving > 0
                        ? "text-yellow-500"
                        : "text-red-500"
                    }`}
                  >
                    {hosData.remainingDriving.toFixed(1)}h
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">of 11.0h max</p>
                </div>
              </Card>

              <Card className="p-6 bg-card/50 border-border">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Remaining On-Duty</p>
                  <p
                    className={`text-4xl font-bold ${
                      hosData.remainingOnDuty > 2
                        ? "text-green-500"
                        : hosData.remainingOnDuty > 0
                        ? "text-yellow-500"
                        : "text-red-500"
                    }`}
                  >
                    {hosData.remainingOnDuty.toFixed(1)}h
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">of 14.0h max</p>
                </div>
              </Card>
            </div>

            {/* Hours Breakdown */}
            <Card className="p-6 border-border">
              <h3 className="font-semibold text-foreground mb-4">Today's Hours</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-foreground">Driving</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {hosData.drivingHours.toFixed(1)}h
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm text-foreground">On-Duty</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {hosData.onDutyHours.toFixed(1)}h
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-foreground">Off-Duty</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {hosData.offDutyHours.toFixed(1)}h
                  </span>
                </div>
              </div>
            </Card>

            {/* Break Requirement Alert */}
            {hosData.needsBreak && (
              <Card className="p-6 bg-yellow-500/10 border-yellow-500/20">
                <div className="flex items-center gap-3">
                  <Bell className="w-6 h-6 text-yellow-500" />
                  <div>
                    <h3 className="font-semibold text-foreground">Break Required</h3>
                    <p className="text-sm text-muted-foreground">
                      30 minutes off-duty break needed (has driven 8+ hours)
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Quick Actions */}
            <Card className="p-6 border-border">
              <h3 className="font-semibold text-foreground mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/dashboard/eld/logs")}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  View Full HOS Logs
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/dashboard/eld/health")}
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Fleet Health Dashboard
                </Button>
              </div>
            </Card>

            {/* Change Driver */}
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setDriverId("")
                setHosData(null)
              }}
            >
              Change Driver
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
