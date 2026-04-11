"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { MapPin, Truck, AlertTriangle, Navigation } from "lucide-react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface TruckMapProps {
  origin: string
  destination: string
  weight: number // in kg
  truckHeight?: number // in meters
  contents?: string
  originCoordinates?: { lat: number; lng: number }
  destinationCoordinates?: { lat: number; lng: number }
  stops?: Array<{
    location_name: string
    address: string
    stop_number: number
    coordinates?: { lat: number; lng: number }
    stop_type?: string
  }> // Multi-stop support
  /** When set, links to the load detail page (interactive map + trip planning). */
  loadId?: string
}

/** Stable default — `stops = []` in params creates a new array every render and breaks useEffect deps. */
const EMPTY_STOPS: NonNullable<TruckMapProps["stops"]> = []

export function TruckMap({
  origin,
  destination,
  weight,
  truckHeight = 4.0,
  contents,
  originCoordinates,
  destinationCoordinates,
  stops,
  loadId,
}: TruckMapProps) {
  /** Inline `[]` from parents is a new reference each render — treat empty as stable EMPTY_STOPS. */
  const stopsList = !Array.isArray(stops) || stops.length === 0 ? EMPTY_STOPS : stops
  const stopsDepKey = useMemo(() => {
    if (!Array.isArray(stops) || stops.length === 0) return "__empty__"
    return JSON.stringify(
      stops.map((s) => ({
        a: s.address ?? "",
        n: s.location_name ?? "",
        sn: s.stop_number ?? 0,
        lat: s.coordinates?.lat,
        lng: s.coordinates?.lng,
      })),
    )
  }, [stops])
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

    setRestrictions(calculatedRestrictions)

    // Build waypoints array including stops
    const waypointsArray = [
      { name: origin, type: "origin" },
      ...stopsList.map((stop) => ({
        name: stop.location_name || stop.address,
        type: stop.stop_type || "waypoint",
        stop_number: stop.stop_number,
      })),
      { name: destination, type: "destination" },
    ]

    // Calculate route distance and duration using Google Maps API if available
    const calculateRoute = async () => {
      try {
        const { getRouteDirections } = await import("@/app/actions/integrations-google-maps")
        const waypointAddresses = stopsList.map((s) => s.address || s.location_name)
        const result = await getRouteDirections(origin, destination, waypointAddresses.length > 0 ? waypointAddresses : undefined)
        
        if (result.data) {
          setRoute({
            distance: result.data.distance,
            duration: result.data.duration,
            truckFriendly: true,
            waypoints: waypointsArray,
            polyline: result.data.polyline as string | undefined,
          })
        } else {
          setRoute({
            distance: "—",
            duration: "—",
            truckFriendly: true,
            waypoints: waypointsArray,
            isEstimated: true,
          })
        }
      } catch {
        setRoute({
          distance: "—",
          duration: "—",
          truckFriendly: true,
          waypoints: waypointsArray,
          isEstimated: true,
        })
      }
    }
    
    calculateRoute()
  }, [origin, destination, weight, truckHeight, contents, stopsDepKey])

  const [roadPreviewUrl, setRoadPreviewUrl] = useState<string | null>(null)
  const previewRevokeRef = useRef<string | null>(null)

  useEffect(() => {
    previewRevokeRef.current && URL.revokeObjectURL(previewRevokeRef.current)
    previewRevokeRef.current = null
    setRoadPreviewUrl(null)

    if (!route || route.isEstimated) return
    const o = origin?.trim()
    const d = destination?.trim()
    if (!o || !d) return

    const ctrl = new AbortController()
    ;(async () => {
      try {
        const body: { origin: string; destination: string; polyline?: string } = {
          origin: o,
          destination: d,
        }
        const poly = route.polyline
        if (typeof poly === "string" && poly.length > 0) {
          body.polyline = poly
        }

        let res = await fetch("/api/maps/static-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        })
        // Marker-only fallback if path failed (e.g. stale cache without polyline handling upstream)
        if (!res.ok && body.polyline) {
          res = await fetch("/api/maps/static-preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ origin: o, destination: d }),
            signal: ctrl.signal,
          })
        }
        if (!res.ok) return
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        previewRevokeRef.current = url
        setRoadPreviewUrl(url)
      } catch {
        /* ignore */
      }
    })()

    return () => {
      ctrl.abort()
      if (previewRevokeRef.current) {
        URL.revokeObjectURL(previewRevokeRef.current)
        previewRevokeRef.current = null
      }
    }
  }, [route, origin, destination])

  return (
    <div className="space-y-4">
      {/* Map Visualization — real roads when Static Maps + public key; otherwise schematic */}
      <div className="relative w-full h-80 bg-secondary/30 rounded-lg border border-border/50 overflow-hidden">
        {roadPreviewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- blob URL from proxied Static Maps */}
            <img
              src={roadPreviewUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            {loadId && (
              <div className="absolute bottom-2 right-2">
                <Link
                  href={`/dashboard/loads/${loadId}`}
                  className="rounded-md bg-background/90 px-2 py-1 text-xs text-primary underline-offset-2 hover:underline"
                >
                  Full map
                </Link>
              </div>
            )}
          </>
        ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-full h-full p-6">
            {/* Origin */}
            <div className="absolute left-1/4 top-1/4 flex flex-col items-center z-10">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse border-2 border-white" />
              <p className="text-xs text-foreground mt-1 bg-card/90 px-2 py-1 rounded shadow-sm max-w-[120px] truncate">Start: {origin}</p>
            </div>

            {/* Route path - dynamic based on number of stops */}
            <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }} viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: "#3b82f6", stopOpacity: 0.8 }} />
                  <stop offset="100%" style={{ stopColor: "#10b981", stopOpacity: 0.8 }} />
                </linearGradient>
              </defs>
              {stopsList.length > 0 ? (
                // Multi-stop route path
                <path
                  d={`M 25 25 ${stopsList.map((_, i) => {
                    const x = 25 + ((i + 1) * 50) / (stopsList.length + 1)
                    const y = 25 + ((i + 1) * 45) / (stopsList.length + 1)
                    return `L ${x} ${y}`
                  }).join(' ')} L 75 70`}
                  stroke="url(#routeGradient)"
                  strokeWidth="0.5"
                  fill="none"
                  strokeDasharray="2,1"
                />
              ) : (
                // Simple origin-destination path
                <path
                  d="M 25 25 Q 50 40, 75 70"
                  stroke="url(#routeGradient)"
                  strokeWidth="0.5"
                  fill="none"
                  strokeDasharray="2,1"
                />
              )}
            </svg>

            {/* Stops/Waypoints */}
            {stopsList.length > 0 ? (
              stopsList.map((stop, index) => {
                const x = 25 + ((index + 1) * 50) / (stopsList.length + 1)
                const y = 25 + ((index + 1) * 45) / (stopsList.length + 1)
                return (
                  <div
                    key={stop.stop_number || index}
                    className="absolute flex flex-col items-center z-10"
                    style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                  >
                    <div className="w-3 h-3 bg-yellow-500 rounded-full border-2 border-white" />
                    <p className="text-xs text-foreground mt-1 bg-card/90 px-2 py-1 rounded shadow-sm max-w-[120px] truncate">
                      Stop {stop.stop_number}: {stop.location_name || stop.address}
                    </p>
                  </div>
                )
              })
            ) : (
              // Default waypoint if no stops
              <div className="absolute left-1/2 top-2/5 flex flex-col items-center z-10">
                <Truck className="w-4 h-4 text-primary animate-bounce" />
                <p className="text-xs text-muted-foreground mt-1 bg-card/90 px-2 py-1 rounded">En Route</p>
              </div>
            )}

            {/* Destination */}
            <div className="absolute right-1/4 bottom-1/4 flex flex-col items-center z-10">
              <MapPin className="w-4 h-4 text-red-500" />
              <p className="text-xs text-foreground mt-1 bg-card/90 px-2 py-1 rounded shadow-sm max-w-[120px] truncate">End: {destination}</p>
            </div>
          </div>
        </div>
        )}
        {!roadPreviewUrl && loadId && (
          <div className="absolute bottom-2 right-2">
            <Link
              href={`/dashboard/loads/${loadId}`}
              className="rounded-md bg-background/90 px-2 py-1 text-xs text-primary underline-offset-2 hover:underline"
            >
              Full map
            </Link>
          </div>
        )}
      </div>

      {/* Route Information */}
      {route && (
        <Card className="border-border p-4 bg-card/50">
          <div className="flex items-center gap-2 mb-3">
            <Navigation className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-foreground">Route</h4>
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
            {(route.waypoints ?? []).map((waypoint: any, idx: number) => (
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
        onClick={async () => {
          // Open navigation in Trucker Path (truck-specific navigation app)
          // IMPORTANT: Trucker Path ONLY accepts coordinates (lat,lng), NOT addresses!
          // iOS: truckerpath://route?saddr=lat,lng&daddr=lat,lng&paddr=lat,lng|lat,lng
          // Android: truckerpath://route?s_addr=lat,lng&d_addr=lat,lng&p_addr=lat,lng|lat,lng
          
          try {
            // Helper function to geocode address to coordinates using OpenStreetMap Nominatim (free)
            const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
              try {
                const response = await fetch(
                  `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
                  {
                    headers: {
                      'User-Agent': 'LogisticsApp/1.0' // Required by Nominatim
                    }
                  }
                )
                const data = await response.json()
                if (data && data.length > 0) {
                  return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon)
                  }
                }
                return null
              } catch (error) {
                console.error("Geocoding error:", error)
                return null
              }
            }
            
            // Helper function to get coordinates (use existing or geocode)
            const getCoordinates = async (address: string, coords?: { lat: number; lng: number }): Promise<string | null> => {
              if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
                return `${coords.lat},${coords.lng}`
              }
              // Geocode address if coordinates not available
              const geocoded = await geocodeAddress(address)
              if (geocoded) {
                return `${geocoded.lat},${geocoded.lng}`
              }
              return null
            }
            
            // Get coordinates for origin and destination
            const originCoords = await getCoordinates(origin, originCoordinates)
            const destinationCoords = await getCoordinates(destination, destinationCoordinates)
            
            // Check if we have required coordinates
            if (!destinationCoords) {
              alert("Unable to get coordinates for destination. Please ensure the address is valid.")
              return
            }
            
            // Detect iOS vs Android
            const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
            const isAndroid = /Android/i.test(navigator.userAgent)
            const isMobile = isIOS || isAndroid
            
            // Build Trucker Path deep link URL with correct parameter names
            let truckerPathUrl = ""
            
            if (isIOS) {
              // iOS format: saddr, daddr, paddr
              if (stopsList.length > 0) {
                // Get coordinates for all stops
                const stopCoords: string[] = []
                for (const stop of stopsList) {
                  const coords = await getCoordinates(stop.address || stop.location_name, stop.coordinates)
                  if (coords) stopCoords.push(coords)
                }
                
                if (stopCoords.length > 0) {
                  const waypoints = stopCoords.join('|')
                  truckerPathUrl = originCoords
                    ? `truckerpath://route?saddr=${originCoords}&daddr=${destinationCoords}&paddr=${waypoints}`
                    : `truckerpath://route?daddr=${destinationCoords}&paddr=${waypoints}`
                } else {
                  truckerPathUrl = originCoords
                    ? `truckerpath://route?saddr=${originCoords}&daddr=${destinationCoords}`
                    : `truckerpath://route?daddr=${destinationCoords}`
                }
              } else {
                truckerPathUrl = originCoords
                  ? `truckerpath://route?saddr=${originCoords}&daddr=${destinationCoords}`
                  : `truckerpath://route?daddr=${destinationCoords}`
              }
            } else if (isAndroid) {
              // Android format: s_addr, d_addr, p_addr
              if (stopsList.length > 0) {
                const stopCoords: string[] = []
                for (const stop of stopsList) {
                  const coords = await getCoordinates(stop.address || stop.location_name, stop.coordinates)
                  if (coords) stopCoords.push(coords)
                }
                
                if (stopCoords.length > 0) {
                  const waypoints = stopCoords.join('|')
                  truckerPathUrl = originCoords
                    ? `truckerpath://route?s_addr=${originCoords}&d_addr=${destinationCoords}&p_addr=${waypoints}`
                    : `truckerpath://route?d_addr=${destinationCoords}&p_addr=${waypoints}`
                } else {
                  truckerPathUrl = originCoords
                    ? `truckerpath://route?s_addr=${originCoords}&d_addr=${destinationCoords}`
                    : `truckerpath://route?d_addr=${destinationCoords}`
                }
              } else {
                truckerPathUrl = originCoords
                  ? `truckerpath://route?s_addr=${originCoords}&d_addr=${destinationCoords}`
                  : `truckerpath://route?d_addr=${destinationCoords}`
              }
            }
            
            if (isMobile && truckerPathUrl) {
              // On mobile: Try to open Trucker Path app
              try {
                window.location.href = truckerPathUrl
              } catch (e) {
                window.open(truckerPathUrl, "_blank")
              }
            } else {
              // On desktop/web: Use Google Maps with truck routing (better fallback)
              // Or provide instructions to install Trucker Path app
              const googleMapsUrl = stopsList.length > 0
                ? `https://www.google.com/maps/dir/${encodeURIComponent(origin)}/${stopsList.map(s => encodeURIComponent(s.address || s.location_name)).join('/')}/${encodeURIComponent(destination)}`
                : `https://www.google.com/maps/dir/${encodeURIComponent(origin)}/${encodeURIComponent(destination)}`
              
              const useTruckerPath = confirm(
                "Trucker Path app is best for truck navigation.\n\n" +
                "On mobile: Install Trucker Path app to use truck-specific routing.\n" +
                "On desktop: Click OK to open Google Maps (truck routing) or Cancel to visit Trucker Path website."
              )
              
              if (useTruckerPath) {
                window.open(googleMapsUrl, "_blank")
              } else {
                window.open("https://truckerpath.com", "_blank")
              }
            }
          } catch (error) {
            console.error("Error opening Trucker Path:", error)
            alert("Error opening navigation. Please try again or install the Trucker Path app.")
          }
        }}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        <Navigation className="w-4 h-4 mr-2" />
        Start Truck Navigation {stopsList.length > 0 && `(${stopsList.length} stops)`}
      </Button>
    </div>
  )
}
