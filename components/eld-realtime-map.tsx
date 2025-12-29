"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Truck, MapPin, AlertTriangle, RefreshCw, Play, Pause } from "lucide-react"
import { getRealtimeLocations } from "@/app/actions/eld-advanced"
import { toast } from "sonner"

interface Location {
  id: string
  latitude: number
  longitude: number
  timestamp: string
  speed?: number
  heading?: number
  engine_status?: string
  eld_devices?: {
    id: string
    device_name: string
    status: string
    trucks?: {
      id: string
      truck_number: string
    }
  }
  drivers?: {
    id: string
    name: string
  }
}

export function ELDRealtimeMap() {
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)

  const loadLocations = async () => {
    try {
      const result = await getRealtimeLocations()
      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        setLocations(result.data)
      }
    } catch (error) {
      toast.error("Failed to load locations")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadLocations()

    if (autoRefresh) {
      const interval = setInterval(loadLocations, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500"
      case "driving":
        return "bg-blue-500"
      case "idle":
        return "bg-yellow-500"
      default:
        return "bg-gray-500"
    }
  }

  const getEngineStatusColor = (status?: string) => {
    switch (status) {
      case "on":
        return "text-green-500"
      case "off":
        return "text-gray-500"
      case "idle":
        return "text-yellow-500"
      default:
        return "text-gray-500"
    }
  }

  // Calculate center of map (average of all locations)
  const centerLat = locations.length > 0
    ? locations.reduce((sum, loc) => sum + Number(loc.latitude), 0) / locations.length
    : 39.8283 // Default to US center
  const centerLng = locations.length > 0
    ? locations.reduce((sum, loc) => sum + Number(loc.longitude), 0) / locations.length
    : -98.5795

  return (
    <Card className="p-6 border-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Real-Time Fleet Map</h3>
          <p className="text-sm text-muted-foreground">
            {locations.length} truck{locations.length !== 1 ? "s" : ""} on the road
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {autoRefresh ? "Pause" : "Resume"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadLocations}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Map Visualization */}
      <div className="relative w-full h-96 bg-secondary/30 rounded-lg border border-border/50 overflow-hidden mb-4">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground">Loading map...</p>
          </div>
        ) : locations.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No active trucks</p>
            </div>
          </div>
        ) : (
          <>
            {/* Simple map visualization using relative positioning */}
            <div className="absolute inset-0 p-4">
              {locations.map((location, index) => {
                // Simple positioning (in a real implementation, use a proper map library)
                const lat = Number(location.latitude)
                const lng = Number(location.longitude)
                
                // Normalize coordinates to 0-100% (simplified)
                const x = ((lng + 180) / 360) * 100
                const y = ((90 - lat) / 180) * 100

                return (
                  <div
                    key={location.id}
                    className="absolute cursor-pointer group"
                    style={{
                      left: `${Math.max(5, Math.min(95, x))}%`,
                      top: `${Math.max(5, Math.min(95, y))}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                    onClick={() => setSelectedLocation(location)}
                  >
                    <div className="relative">
                      <Truck
                        className={`w-6 h-6 ${getEngineStatusColor(location.engine_status)} transition-transform group-hover:scale-125`}
                        style={{
                          transform: location.heading ? `rotate(${location.heading}deg)` : undefined,
                        }}
                      />
                      <div className={`absolute -top-1 -right-1 w-3 h-3 ${getStatusColor(location.eld_devices?.status || "active")} rounded-full border-2 border-background animate-pulse`} />
                      
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                        <Card className="p-2 shadow-lg min-w-[200px]">
                          <p className="font-semibold text-sm text-foreground">
                            {location.eld_devices?.trucks?.truck_number || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {location.drivers?.name || "No driver"}
                          </p>
                          {location.speed && (
                            <p className="text-xs text-muted-foreground">
                              {location.speed} mph
                            </p>
                          )}
                        </Card>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Map controls */}
            <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur p-2 rounded border border-border">
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="text-muted-foreground">Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full" />
                  <span className="text-muted-foreground">Driving</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  <span className="text-muted-foreground">Idle</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Location List */}
      {locations.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {locations.map((location) => (
            <Card
              key={location.id}
              className={`p-3 cursor-pointer transition-colors ${
                selectedLocation?.id === location.id ? "bg-primary/10 border-primary" : ""
              }`}
              onClick={() => setSelectedLocation(location)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Truck className={`w-5 h-5 ${getEngineStatusColor(location.engine_status)}`} />
                  <div>
                    <p className="font-semibold text-sm text-foreground">
                      {location.eld_devices?.trucks?.truck_number || "Unknown Truck"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {location.drivers?.name || "No driver assigned"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {location.speed && (
                    <p className="text-sm font-medium text-foreground">{location.speed} mph</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(location.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Selected Location Details */}
      {selectedLocation && (
        <Card className="mt-4 p-4 bg-primary/5 border-primary/20">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="font-semibold text-foreground">
                {selectedLocation.eld_devices?.trucks?.truck_number || "Unknown Truck"}
              </h4>
              <p className="text-sm text-muted-foreground">
                {selectedLocation.eld_devices?.device_name}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedLocation(null)}
            >
              ×
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Driver</p>
              <p className="font-medium text-foreground">
                {selectedLocation.drivers?.name || "No driver"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Speed</p>
              <p className="font-medium text-foreground">
                {selectedLocation.speed || 0} mph
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Engine Status</p>
              <Badge className={getEngineStatusColor(selectedLocation.engine_status)}>
                {selectedLocation.engine_status || "Unknown"}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Last Update</p>
              <p className="font-medium text-foreground">
                {new Date(selectedLocation.timestamp).toLocaleString()}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Location</p>
              <p className="font-medium text-foreground">
                {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
              </p>
            </div>
          </div>
        </Card>
      )}
    </Card>
  )
}
