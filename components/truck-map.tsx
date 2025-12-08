"use client"

import { useState, useEffect } from "react"
import { MapPin, Truck, AlertTriangle, Navigation } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface TruckMapProps {
  origin: string
  destination: string
  weight: number // in kg
  truckHeight?: number // in meters
  contents?: string
}

export function TruckMap({ origin, destination, weight, truckHeight = 4.0, contents }: TruckMapProps) {
  const [route, setRoute] = useState<any>(null)
  const [restrictions, setRestrictions] = useState<string[]>([])

  useEffect(() => {
    const calculatedRestrictions: string[] = []

    // Weight restrictions
    if (weight > 36000) {
      calculatedRestrictions.push("Heavy load - Avoid residential roads")
    }

    // Height restrictions
    if (truckHeight > 4.2) {
      calculatedRestrictions.push("High vehicle - Check bridge clearances")
    }

    // Hazmat restrictions
    if (contents?.toLowerCase().includes("chemical") || contents?.toLowerCase().includes("hazard")) {
      calculatedRestrictions.push("Hazmat cargo - Restricted tunnel access")
    }

    // Always add truck-specific routing
    calculatedRestrictions.push("Truck-approved highways only")

    setRestrictions(calculatedRestrictions)

    // Simulate route calculation with truck restrictions
    setRoute({
      distance: "245 miles",
      duration: "4h 35m",
      truckFriendly: true,
      waypoints: [
        { name: origin, type: "origin" },
        { name: "I-95 South", type: "highway" },
        { name: "US-1 Truck Route", type: "highway" },
        { name: "I-476 Truck Lanes", type: "highway" },
        { name: destination, type: "destination" },
      ],
    })
  }, [origin, destination, weight, truckHeight, contents])

  return (
    <div className="space-y-4">
      {/* Map Visualization */}
      <div className="relative w-full h-80 bg-secondary/30 rounded-lg border border-border/50 overflow-hidden">
        {/* Map Canvas */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-full h-full p-6">
            {/* Route visualization */}
            <div className="absolute left-1/4 top-1/4 flex flex-col items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <p className="text-xs text-foreground mt-1 bg-card/90 px-2 py-1 rounded">{origin}</p>
            </div>

            {/* Route path */}
            <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
              <defs>
                <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: "#3b82f6", stopOpacity: 0.8 }} />
                  <stop offset="100%" style={{ stopColor: "#10b981", stopOpacity: 0.8 }} />
                </linearGradient>
              </defs>
              <path
                d="M 25% 25% Q 50% 40%, 75% 70%"
                stroke="url(#routeGradient)"
                strokeWidth="3"
                fill="none"
                strokeDasharray="10,5"
              />
            </svg>

            {/* Waypoints */}
            <div className="absolute left-1/2 top-2/5 flex flex-col items-center">
              <Truck className="w-4 h-4 text-primary animate-bounce" />
              <p className="text-xs text-muted-foreground mt-1 bg-card/90 px-2 py-1 rounded">En Route</p>
            </div>

            {/* Destination */}
            <div className="absolute right-1/4 bottom-1/4 flex flex-col items-center">
              <MapPin className="w-4 h-4 text-red-500" />
              <p className="text-xs text-foreground mt-1 bg-card/90 px-2 py-1 rounded">{destination}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Route Information */}
      {route && (
        <Card className="border-border p-4 bg-card/50">
          <div className="flex items-center gap-2 mb-3">
            <Navigation className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-foreground">Truck Route Details</h4>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Distance</p>
              <p className="text-sm font-medium text-foreground">{route.distance}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-sm font-medium text-foreground">{route.duration}</p>
            </div>
          </div>

          {/* Waypoints */}
          <div className="space-y-2 mb-4">
            <p className="text-xs font-medium text-muted-foreground">Route Waypoints</p>
            {route.waypoints.map((waypoint: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <div
                  className={`w-2 h-2 rounded-full ${
                    waypoint.type === "origin"
                      ? "bg-green-500"
                      : waypoint.type === "destination"
                        ? "bg-red-500"
                        : "bg-blue-500"
                  }`}
                />
                <span className="text-foreground">{waypoint.name}</span>
              </div>
            ))}
          </div>

          {/* Restrictions */}
          {restrictions.length > 0 && (
            <div className="border-t border-border/30 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <p className="text-xs font-medium text-foreground">Truck Restrictions</p>
              </div>
              <div className="space-y-1">
                {restrictions.map((restriction, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">•</span>
                    {restriction}
                  </p>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Action Button */}
      <Button
        onClick={() => {
          // Open navigation in Google Maps or preferred navigation app
          const originEncoded = encodeURIComponent(origin)
          const destinationEncoded = encodeURIComponent(destination)
          const googleMapsUrl = `https://www.google.com/maps/dir/${originEncoded}/${destinationEncoded}`
          window.open(googleMapsUrl, "_blank")
        }}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        <Navigation className="w-4 h-4 mr-2" />
        Start Truck Navigation
      </Button>
    </div>
  )
}
