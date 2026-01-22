"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, 
  Activity, 
  Truck, 
  RefreshCw, 
  Calendar,
  MapPin,
  AlertCircle,
  FileText,
  Settings
} from "lucide-react"
import { getELDDevice, syncELDData } from "@/app/actions/eld"
import { getELDLogs, getELDEvents } from "@/app/actions/eld"
import { toast } from "sonner"
import Link from "next/link"

export default function ELDDeviceDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const deviceId = params.id as string

  const [device, setDevice] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "events">("overview")

  useEffect(() => {
    if (deviceId) {
      loadDeviceData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId])

  async function loadDeviceData() {
    setIsLoading(true)
    try {
      const [deviceResult, logsResult, eventsResult] = await Promise.all([
        getELDDevice(deviceId),
        getELDLogs({ eld_device_id: deviceId, limit: 10 }),
        getELDEvents({ eld_device_id: deviceId, limit: 10 }),
      ])

      if (deviceResult.error) {
        toast.error(deviceResult.error)
        router.push("/dashboard/eld/devices")
        return
      }

      if (deviceResult.data) {
        setDevice(deviceResult.data)
      }

      if (logsResult.data) {
        setLogs(logsResult.data)
      }

      if (eventsResult.data) {
        setEvents(eventsResult.data)
      }
    } catch (error) {
      toast.error("Failed to load device data")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSync() {
    setIsSyncing(true)
    try {
      const result = await syncELDData(deviceId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Device synced successfully")
        await loadDeviceData()
      }
    } catch (error) {
      toast.error("Failed to sync device")
    } finally {
      setIsSyncing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="w-full p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading device details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!device) {
    return (
      <div className="w-full p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Device not found</h2>
            <p className="text-muted-foreground mb-4">The ELD device you're looking for doesn't exist or you don't have access to it.</p>
            <Link href="/dashboard/eld/devices">
              <Button>Back to Devices</Button>
            </Link>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/eld/devices">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{device.device_name || "ELD Device"}</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {device.device_serial_number && `Serial: ${device.device_serial_number}`}
                {device.provider && ` • Provider: ${device.provider}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant={device.status === "active" ? "default" : "secondary"}
              className={device.status === "active" ? "bg-green-500/20 text-green-400" : ""}
            >
              {device.status || "Unknown"}
            </Badge>
            {device.status === "active" && device.api_key && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={isSyncing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Syncing..." : "Sync"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-border">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === "overview"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === "logs"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Logs ({logs.length})
            </button>
            <button
              onClick={() => setActiveTab("events")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === "events"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Events ({events.length})
            </button>
          </div>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Device Information */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold">Device Information</h2>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Device Name</p>
                    <p className="font-medium">{device.device_name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Serial Number</p>
                    <p className="font-medium">{device.device_serial_number || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Manufacturer</p>
                    <p className="font-medium">{device.manufacturer || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Model</p>
                    <p className="font-medium">{device.model || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Provider</p>
                    <p className="font-medium">{device.provider || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Firmware Version</p>
                    <p className="font-medium">{device.firmware_version || "N/A"}</p>
                  </div>
                  {device.installation_date && (
                    <div>
                      <p className="text-sm text-muted-foreground">Installation Date</p>
                      <p className="font-medium">
                        {new Date(device.installation_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {device.last_sync_at && (
                    <div>
                      <p className="text-sm text-muted-foreground">Last Sync</p>
                      <p className="font-medium">
                        {new Date(device.last_sync_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Assigned Truck */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Truck className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold">Assigned Truck</h2>
                </div>
                {device.trucks ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Truck Number</p>
                      <p className="font-medium">{device.trucks.truck_number}</p>
                    </div>
                    {(device.trucks.make || device.trucks.model) && (
                      <div>
                        <p className="text-sm text-muted-foreground">Make & Model</p>
                        <p className="font-medium">
                          {device.trucks.make} {device.trucks.model}
                        </p>
                      </div>
                    )}
                    {device.trucks?.id && typeof device.trucks.id === 'string' && device.trucks.id.trim() !== '' ? (
                      <Link href={`/dashboard/trucks/${device.trucks.id}`}>
                        <Button variant="outline" size="sm">
                          View Truck Details
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No truck assigned</p>
                )}
              </Card>

              {/* Notes */}
              {device.notes && (
                <Card className="p-6 md:col-span-2">
                  <h2 className="text-xl font-semibold mb-4">Notes</h2>
                  <p className="text-muted-foreground whitespace-pre-wrap">{device.notes}</p>
                </Card>
              )}
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === "logs" && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold">Recent Logs</h2>
                </div>
                {deviceId && typeof deviceId === 'string' && deviceId.trim() !== '' ? (
                  <Link href={`/dashboard/eld/logs?device=${deviceId}`}>
                    <Button variant="outline" size="sm">
                      View All Logs
                    </Button>
                  </Link>
                ) : null}
              </div>
              {logs.length > 0 ? (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div key={log.id} className="border border-border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{log.log_type || "Unknown"}</Badge>
                            {log.log_date && (
                              <span className="text-sm text-muted-foreground">
                                {new Date(log.log_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {log.start_time && log.end_time && (
                            <p className="text-sm text-muted-foreground">
                              {log.start_time} - {log.end_time}
                            </p>
                          )}
                          {log.duration_minutes && (
                            <p className="text-sm text-muted-foreground">
                              Duration: {log.duration_minutes} minutes
                            </p>
                          )}
                          {log.drivers && (
                            <p className="text-sm mt-2">
                              <span className="text-muted-foreground">Driver:</span> {log.drivers.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No logs found</p>
              )}
            </Card>
          )}

          {/* Events Tab */}
          {activeTab === "events" && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold">Recent Events</h2>
                </div>
                {deviceId && typeof deviceId === 'string' && deviceId.trim() !== '' ? (
                  <Link href={`/dashboard/eld/violations?device=${deviceId}`}>
                    <Button variant="outline" size="sm">
                      View All Events
                    </Button>
                  </Link>
                ) : null}
              </div>
              {events.length > 0 ? (
                <div className="space-y-4">
                  {events.map((event) => (
                    <div key={event.id} className="border border-border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge 
                              variant={event.severity === "critical" ? "destructive" : "outline"}
                            >
                              {event.severity || "warning"}
                            </Badge>
                            <span className="font-medium">{event.title || "Event"}</span>
                          </div>
                          {event.description && (
                            <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                          )}
                          {event.event_time && (
                            <p className="text-xs text-muted-foreground">
                              {new Date(event.event_time).toLocaleString()}
                            </p>
                          )}
                          {event.drivers && (
                            <p className="text-sm mt-2">
                              <span className="text-muted-foreground">Driver:</span> {event.drivers.name}
                            </p>
                          )}
                        </div>
                        {event.resolved !== undefined && (
                          <Badge variant={event.resolved ? "default" : "secondary"}>
                            {event.resolved ? "Resolved" : "Open"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No events found</p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

