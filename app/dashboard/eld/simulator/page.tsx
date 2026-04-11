"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Play, 
  Square, 
  Truck, 
  MapPin, 
  Activity,
  AlertTriangle,
  CheckCircle2,
  Radio
} from "lucide-react"
import { toast } from "sonner"
import { 
  createFakeELDDevice, 
  simulateLocationUpdate, 
  simulateHOSLog, 
  simulateELDEvent 
} from "@/app/actions/eld-simulator"
import { getELDDevices } from "@/app/actions/eld"
import { getTrucks } from "@/app/actions/trucks"
import { getDrivers } from "@/app/actions/drivers"

// BUG-069 FIX: ELD Simulator must not be accessible in production
// This is a dev testing tool that allows injection of fake GPS and HOS data
// Violates FMCSA ELD compliance if accessible in production
// Use NODE_ENV (set by Next.js / Vercel at build time) — not a custom NEXT_PUBLIC_* var
const isProductionBuild = process.env.NODE_ENV === "production"

export default function ELDSimulatorPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [deviceId, setDeviceId] = useState<string>("")
  const [truckId, setTruckId] = useState<string>("")
  const [driverId, setDriverId] = useState<string>("")
  const [deviceName, setDeviceName] = useState("Fake ELD Device")
  const [speed, setSpeed] = useState(60)
  const [updateInterval, setUpdateInterval] = useState(30)
  const [devices, setDevices] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [simulatorInterval, setSimulatorInterval] = useState<NodeJS.Timeout | null>(null)
  const [stats, setStats] = useState({
    locationsSent: 0,
    logsSent: 0,
    eventsSent: 0,
  })

  // BUG-069 FIX: Block access in production (matches server actions in eld-simulator.ts)
  if (isProductionBuild) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
          <p className="text-muted-foreground">
            The ELD Simulator is a development tool and is not available in production.
          </p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    // Cleanup interval on unmount
    return () => {
      if (simulatorInterval) {
        clearInterval(simulatorInterval)
      }
    }
  }, [simulatorInterval])

  async function loadData() {
    const [devicesRes, trucksRes, driversRes] = await Promise.all([
      getELDDevices(),
      getTrucks(),
      getDrivers(),
    ])

    if (devicesRes.data) {
      setDevices(devicesRes.data.filter((d: any) => d.provider === "truckmates_simulator"))
    }
    if (trucksRes.data) {
      setTrucks(trucksRes.data)
    }
    if (driversRes.data) {
      setDrivers(driversRes.data)
    }
  }

  async function handleCreateDevice() {
    const result = await createFakeELDDevice({
      device_name: deviceName,
      truck_id: truckId || undefined,
    })

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Fake ELD device created!")
      setDeviceId(result.data.id)
      loadData()
    }
  }

  async function startSimulator() {
    if (!deviceId) {
      toast.error("Please create or select a device first")
      return
    }

    setIsRunning(true)
    setStats({ locationsSent: 0, logsSent: 0, eventsSent: 0 })

    // Send initial location
    await simulateLocationUpdate({
      device_id: deviceId,
      truck_id: truckId || undefined,
      driver_id: driverId || undefined,
      speed,
      update_interval: updateInterval,
    })
    setStats(prev => ({ ...prev, locationsSent: prev.locationsSent + 1 }))

    // Set up interval for location updates
    const interval = setInterval(async () => {
      // Send location update
      const locResult = await simulateLocationUpdate({
        device_id: deviceId,
        truck_id: truckId || undefined,
        driver_id: driverId || undefined,
        speed,
        update_interval: updateInterval,
      })
      if (!locResult.error) {
        setStats(prev => ({ ...prev, locationsSent: prev.locationsSent + 1 }))
      }

      // Randomly send HOS log (every 2-5 minutes)
      if (Math.random() < 0.3) {
        const logTypes: Array<"driving" | "on_duty" | "off_duty" | "sleeper_berth"> = 
          ["driving", "on_duty", "off_duty", "sleeper_berth"]
        const logResult = await simulateHOSLog({
          device_id: deviceId,
          driver_id: driverId || undefined,
          truck_id: truckId || undefined,
          log_type: logTypes[Math.floor(Math.random() * logTypes.length)],
          duration_minutes: Math.floor(Math.random() * 60 + 30),
        })
        if (!logResult.error) {
          setStats(prev => ({ ...prev, logsSent: prev.logsSent + 1 }))
        }
      }

      // Randomly send event (5% chance)
      if (Math.random() < 0.05) {
        const eventTypes: Array<"hos_violation" | "speeding" | "hard_brake" | "hard_accel"> = 
          ["hos_violation", "speeding", "hard_brake", "hard_accel"]
        const eventResult = await simulateELDEvent({
          device_id: deviceId,
          driver_id: driverId || undefined,
          truck_id: truckId || undefined,
          event_type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
          severity: Math.random() < 0.3 ? "critical" : "warning",
        })
        if (!eventResult.error) {
          setStats(prev => ({ ...prev, eventsSent: prev.eventsSent + 1 }))
        }
      }
    }, updateInterval * 1000)

    setSimulatorInterval(interval)
    toast.success("Simulator started!")
  }

  function stopSimulator() {
    if (simulatorInterval) {
      clearInterval(simulatorInterval)
      setSimulatorInterval(null)
    }
    setIsRunning(false)
    toast.info("Simulator stopped")
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">ELD Device Simulator</h1>
        <p className="text-muted-foreground mt-2">
          Create and simulate a fake ELD device to test the ELD service
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Configuration */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Device Configuration</h2>
          
          <div className="space-y-4">
            <div>
              <Label>Device Name</Label>
              <Input
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="Fake ELD Device"
                disabled={isRunning}
              />
            </div>

            <div>
              <Label>Select Existing Device</Label>
              <Select
                value={deviceId || "none"}
                onValueChange={(value) => setDeviceId(value === "none" ? "" : value)}
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Create New Device" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Create New Device</SelectItem>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.device_name} ({device.device_serial_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!deviceId && (
              <Button onClick={handleCreateDevice} className="w-full" disabled={isRunning}>
                Create Fake ELD Device
              </Button>
            )}

            <div>
              <Label>Assign to Truck (Optional)</Label>
              <Select
                value={truckId || "none"}
                onValueChange={(value) => setTruckId(value === "none" ? "" : value)}
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No Truck" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Truck</SelectItem>
                  {trucks.map((truck) => (
                    <SelectItem key={truck.id} value={truck.id}>
                      {truck.truck_number} - {truck.make} {truck.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Assign to Driver (Optional)</Label>
              <Select
                value={driverId || "none"}
                onValueChange={(value) => setDriverId(value === "none" ? "" : value)}
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No Driver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Driver</SelectItem>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Simulator Controls */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Simulator Controls</h2>
          
          <div className="space-y-4">
            <div>
              <Label>Speed (MPH)</Label>
              <Input
                type="number"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                min={0}
                max={100}
                disabled={isRunning}
              />
            </div>

            <div>
              <Label>Update Interval (seconds)</Label>
              <Input
                type="number"
                value={updateInterval}
                onChange={(e) => setUpdateInterval(Number(e.target.value))}
                min={10}
                max={300}
                disabled={isRunning}
              />
            </div>

            <div className="flex gap-2">
              {!isRunning ? (
                <Button 
                  onClick={startSimulator} 
                  className="flex-1"
                  disabled={!deviceId}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Simulator
                </Button>
              ) : (
                <Button 
                  onClick={stopSimulator} 
                  variant="destructive"
                  className="flex-1"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop Simulator
                </Button>
              )}
            </div>

            {isRunning && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <Radio className="w-4 h-4 text-green-500 animate-pulse" />
                  <span className="font-semibold text-green-500">Simulator Running</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Sending data every {updateInterval} seconds
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Statistics */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Simulation Statistics</h2>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-500/10 rounded-lg">
              <MapPin className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold">{stats.locationsSent}</div>
              <div className="text-sm text-muted-foreground">Locations Sent</div>
            </div>
            
            <div className="text-center p-4 bg-purple-500/10 rounded-lg">
              <Activity className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <div className="text-2xl font-bold">{stats.logsSent}</div>
              <div className="text-sm text-muted-foreground">HOS Logs Sent</div>
            </div>
            
            <div className="text-center p-4 bg-orange-500/10 rounded-lg">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-orange-500" />
              <div className="text-2xl font-bold">{stats.eventsSent}</div>
              <div className="text-sm text-muted-foreground">Events Sent</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

