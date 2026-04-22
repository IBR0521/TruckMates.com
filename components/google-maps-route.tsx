"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { errorMessage } from "@/lib/error-message"
import { MapPin, Navigation, AlertTriangle, Ruler, Clock3 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getRouteDirections } from "@/app/actions/integrations-google-maps"

interface GoogleMapsRouteProps {
  origin: string
  destination: string
  originCoordinates?: { lat: number; lng: number }
  destinationCoordinates?: { lat: number; lng: number }
  stops?: Array<{
    location_name: string
    address: string
    stop_number: number
    coordinates?: { lat: number; lng: number }
    stop_type?: string
  }>
  weight?: number
  truckHeight?: number
  contents?: string
  showNavigationButton?: boolean
  onRouteDataChange?: (routeData: any) => void
}

const EMPTY_STOPS: NonNullable<GoogleMapsRouteProps["stops"]> = []

declare global {
  interface Window {
    google: any
    initGoogleMaps: () => void
  }
  
  namespace google {
    namespace maps {
      interface GeocoderResult {
        geometry: {
          location: {
            lat(): number
            lng(): number
          }
        }
      }
      enum GeocoderStatus {
        OK = 'OK',
        ERROR = 'ERROR',
        INVALID_REQUEST = 'INVALID_REQUEST',
        OVER_QUERY_LIMIT = 'OVER_QUERY_LIMIT',
        REQUEST_DENIED = 'REQUEST_DENIED',
        ZERO_RESULTS = 'ZERO_RESULTS'
      }
    }
  }
}

export function GoogleMapsRoute({
  origin,
  destination,
  originCoordinates,
  destinationCoordinates,
  stops,
  weight,
  truckHeight,
  contents,
  showNavigationButton = true,
  onRouteDataChange,
}: GoogleMapsRouteProps) {
  const toFriendlyMapError = (raw: string) => {
    const value = String(raw || "").toLowerCase()
    if (!origin?.trim() || !destination?.trim()) return "Enter origin and destination to preview this route."
    if (value.includes("geocode") || value.includes("address") || value.includes("zero_results")) {
      return "We couldn't locate one of the addresses. Please check origin and destination."
    }
    if (value.includes("api") || value.includes("denied") || value.includes("quota")) {
      return "Route preview is temporarily unavailable. Please try again shortly."
    }
    return "Route preview is unavailable right now. Please verify the route inputs and try again."
  }
  const safeStops = !Array.isArray(stops) || stops.length === 0 ? EMPTY_STOPS : stops
  const stopsSig = useMemo(() => {
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
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const directionsServiceRef = useRef<any>(null)
  const directionsRendererRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [routeData, setRouteData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Load Google Maps script
  useEffect(() => {
    // Check if Google Maps is already loaded
    if (window.google?.maps?.Geocoder && typeof window.google.maps.Geocoder === 'function' && 
        window.google.maps.Map && typeof window.google.maps.Map === 'function') {
      setMapLoaded(true)
      return
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
    if (existingScript) {
      // Wait for existing script to load
      const checkReady = setInterval(() => {
        if (window.google?.maps?.Geocoder && typeof window.google.maps.Geocoder === 'function' && 
            window.google.maps.Map && typeof window.google.maps.Map === 'function') {
          clearInterval(checkReady)
          setMapLoaded(true)
        }
      }, 100)
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkReady)
        if (window.google?.maps?.Geocoder && typeof window.google.maps.Geocoder === 'function') {
          setMapLoaded(true)
        } else {
          setError("Google Maps API failed to initialize. Please refresh the page.")
          setIsLoading(false)
        }
      }, 10000)
      
      return () => {
        clearInterval(checkReady)
      }
    }

    // Get API key - try env first, then fetch from API route
    let apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    let script: HTMLScriptElement | null = null
    let checkReadyInterval: NodeJS.Timeout | null = null
    
    const loadScript = async () => {
      // If no API key in env, try to fetch from API route
      if (!apiKey) {
        try {
          const response = await fetch('/api/google-maps-key')
          if (response.ok) {
            const data = await response.json()
            apiKey = data.apiKey
          } else {
            const errorData = await response.json().catch(() => ({}))
            setError(errorData.error || "Google Maps API key not configured. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in Vercel environment variables.")
            setIsLoading(false)
            return
          }
        } catch (error) {
          console.error('[GoogleMapsRoute] Failed to fetch API key:', error)
          setError("Failed to load Google Maps API key. Please check your environment variables.")
          setIsLoading(false)
          return
        }
      }

      if (!apiKey) {
        setError("Google Maps API key not configured. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in Vercel environment variables.")
        setIsLoading(false)
        return
      }

      script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`
      script.async = true
      script.defer = true
      script.onload = () => {
        // Wait for Google Maps API to be fully initialized
        checkReadyInterval = setInterval(() => {
          if (window.google?.maps?.Geocoder && typeof window.google.maps.Geocoder === 'function' && 
              window.google.maps.Map && typeof window.google.maps.Map === 'function') {
            if (checkReadyInterval) clearInterval(checkReadyInterval)
            setMapLoaded(true)
          }
        }, 100)
        
        // Timeout after 10 seconds
        setTimeout(() => {
          if (checkReadyInterval) clearInterval(checkReadyInterval)
          if (window.google?.maps?.Geocoder && typeof window.google.maps.Geocoder === 'function') {
            setMapLoaded(true)
          } else {
            setError("Google Maps API loaded but Geocoder is not available. Please check your API key permissions.")
            setIsLoading(false)
          }
        }, 10000)
      }
      script.onerror = (error) => {
        console.error('[GoogleMapsRoute] Script load error:', error)
        setError("Failed to load Google Maps. Please check: 1) API key is set in Vercel, 2) Domain restrictions allow your production domain, 3) Maps JavaScript API is enabled in Google Cloud Console.")
        setIsLoading(false)
      }
      document.head.appendChild(script)
    }

    loadScript()

    return () => {
      // Cleanup intervals
      if (checkReadyInterval) {
        clearInterval(checkReadyInterval)
      }
      // Don't remove script - other components might be using it
      // The browser will handle cleanup when the page unloads
    }
  }, [])

  // Initialize map and get route
  useEffect(() => {
    if (!mapLoaded || !window.google || !mapRef.current) return
    let cancelled = false

    const initializeMap = async () => {
      try {
        if (cancelled) return
        setIsLoading(true)
        setError(null)

        const mapStyles = [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ]

        if (!origin?.trim() || !destination?.trim()) {
          const mapElement = mapRef.current
          if (!mapElement) return
          const map = new window.google.maps.Map(mapElement, {
            zoom: 4,
            center: { lat: 39.8283, lng: -98.5795 },
            mapTypeId: window.google.maps.MapTypeId.ROADMAP,
            styles: mapStyles,
          })
          mapInstanceRef.current = map
          setTimeout(() => {
            if (!mapInstanceRef.current) return
            window.google.maps.event.trigger(mapInstanceRef.current, "resize")
            mapInstanceRef.current.setCenter({ lat: 39.8283, lng: -98.5795 })
          }, 150)
          setRouteData(null)
          setError("Enter origin and destination to preview this route.")
          setIsLoading(false)
          return
        }

        // Verify Google Maps API is fully loaded
        if (!window.google?.maps?.Geocoder || typeof window.google.maps.Geocoder !== 'function') {
          throw new Error("Google Maps Geocoder API is not available. Please ensure the Google Maps JavaScript API is fully loaded.")
        }

        // Multi-stop with no delivery points: cannot draw route without addresses
        if ((destination === "Multiple Locations" || destination === "Multiple locations") && safeStops.length === 0) {
          setError("Add delivery points to view the multi-stop route. The map will update once addresses are set.")
          setIsLoading(false)
          return
        }

        // Get coordinates for origin and destination
        let originCoords: { lat: number; lng: number }
        let destCoords: { lat: number; lng: number }

        // Use Google Maps Geocoder service directly (client-side)
        const geocoder = new window.google.maps.Geocoder()

        if (originCoordinates) {
          originCoords = originCoordinates
        } else {
          try {
            const originResult = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
              geocoder.geocode({ address: origin }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
                if (status === window.google.maps.GeocoderStatus.OK && results && results.length > 0) {
                  resolve(results)
                } else {
                  // Provide specific error messages
                  let errorMsg = `Geocoding failed: ${status}`
                  if (status === window.google.maps.GeocoderStatus.ERROR) {
                    errorMsg = "Geocoding service error. Please check your API key and try again."
                  } else if (status === window.google.maps.GeocoderStatus.INVALID_REQUEST) {
                    errorMsg = "Invalid address format."
                  } else if (status === window.google.maps.GeocoderStatus.OVER_QUERY_LIMIT) {
                    errorMsg = "Geocoding quota exceeded. Please try again later."
                  } else if (status === window.google.maps.GeocoderStatus.REQUEST_DENIED) {
                    errorMsg = "Geocoding API access denied. Please check your API key permissions."
                  } else if (status === window.google.maps.GeocoderStatus.ZERO_RESULTS) {
                    errorMsg = "Address not found."
                  }
                  reject(new Error(errorMsg))
                }
              })
            })
            originCoords = {
              lat: originResult[0].geometry.location.lat(),
              lng: originResult[0].geometry.location.lng(),
            }
          } catch (err: unknown) {
            throw new Error(`Origin geocoding failed: ${errorMessage(err, "Unknown error")}`)
          }
        }

        // Multi-stop: destination is "Multiple Locations" — use last delivery point as destination (no geocode of literal string)
        const isMultiStop = !destinationCoordinates && (destination === "Multiple Locations" || destination === "Multiple locations") && safeStops.length > 0
        if (destinationCoordinates) {
          destCoords = destinationCoordinates
        } else if (isMultiStop) {
          // Resolve last stop as destination (geocode or use coordinates)
          const lastStop = safeStops[safeStops.length - 1]
          if (lastStop.coordinates) {
            destCoords = lastStop.coordinates
          } else {
            const address = lastStop.address || lastStop.location_name
            const lastResult = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
              geocoder.geocode({ address }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
                if (status === window.google.maps.GeocoderStatus.OK && results && results.length > 0) resolve(results)
                else reject(new Error(`Address not found: "${address}"`))
              })
            })
            destCoords = {
              lat: lastResult[0].geometry.location.lat(),
              lng: lastResult[0].geometry.location.lng(),
            }
          }
        } else {
          try {
            const destResult = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
              geocoder.geocode({ address: destination }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
                if (status === window.google.maps.GeocoderStatus.OK && results && results.length > 0) {
                  resolve(results)
                } else {
                  let errorMsg = `Geocoding failed: ${status}`
                  if (status === window.google.maps.GeocoderStatus.ZERO_RESULTS) {
                    errorMsg = "Address not found."
                  }
                  reject(new Error(errorMsg))
                }
              })
            })
            destCoords = {
              lat: destResult[0].geometry.location.lat(),
              lng: destResult[0].geometry.location.lng(),
            }
          } catch (err: unknown) {
            throw new Error(`Destination geocoding failed: ${errorMessage(err, "Unknown error")}`)
          }
        }

        // Initialize map
        // Ref can become null while async geocoding is in-flight.
        if (cancelled || !mapRef.current) {
          return
        }
        const mapElement = mapRef.current
        const map = new window.google.maps.Map(mapElement, {
          zoom: 7,
          center: originCoords,
          mapTypeId: window.google.maps.MapTypeId.ROADMAP,
          styles: mapStyles,
        })

        mapInstanceRef.current = map
        setTimeout(() => {
          if (!mapInstanceRef.current) return
          window.google.maps.event.trigger(mapInstanceRef.current, "resize")
          mapInstanceRef.current.setCenter(originCoords)
        }, 150)

        // Initialize directions service and renderer
        const directionsService = new window.google.maps.DirectionsService()
        const directionsRenderer = new window.google.maps.DirectionsRenderer({
          map,
          suppressMarkers: false, // Keep default DirectionsRenderer markers
          suppressInfoWindows: false, // Keep default info windows
          polylineOptions: {
            strokeColor: "#3b82f6",
            strokeWeight: 4,
            strokeOpacity: 0.8,
          },
        })

        directionsServiceRef.current = directionsService
        directionsRendererRef.current = directionsRenderer

        // Build waypoints array
        const waypoints: any[] = []
        if (safeStops.length > 0) {
          for (const stop of safeStops) {
            if (stop.coordinates) {
              waypoints.push({
                location: new window.google.maps.LatLng(stop.coordinates.lat, stop.coordinates.lng),
                stopover: true,
              })
            } else {
              try {
                // Verify Geocoder is still available
                if (!window.google?.maps?.Geocoder || typeof window.google.maps.Geocoder !== 'function') {
                  console.warn(`Geocoder not available for stop "${stop.address || stop.location_name}"`)
                  return
                }
                const stopGeocoder = new window.google.maps.Geocoder()
                const stopResult = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
                  stopGeocoder.geocode({ address: stop.address || stop.location_name }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
                    if (status === window.google.maps.GeocoderStatus.OK && results) {
                      resolve(results)
                    } else {
                      reject(new Error(`Geocoding failed: ${status}`))
                    }
                  })
                })
                waypoints.push({
                  location: new window.google.maps.LatLng(
                    stopResult[0].geometry.location.lat(),
                    stopResult[0].geometry.location.lng()
                  ),
                  stopover: true,
                })
              } catch (err) {
                console.warn(`Failed to geocode stop "${stop.address || stop.location_name}":`, err)
                // Continue without this waypoint
              }
            }
          }
        }

        // Request route
        const request: any = {
          origin: new window.google.maps.LatLng(originCoords.lat, originCoords.lng),
          destination: new window.google.maps.LatLng(destCoords.lat, destCoords.lng),
          travelMode: window.google.maps.TravelMode.DRIVING,
          optimizeWaypoints: safeStops.length > 0,
          avoidTolls: false,
        }

        if (waypoints.length > 0) {
          request.waypoints = waypoints
        }

        directionsService.route(request, (result: any, status: any) => {
          if (cancelled) return
          if (status === window.google.maps.DirectionsStatus.OK) {
            directionsRenderer.setDirections(result)

            // Extract route information
            if (!result.routes || result.routes.length === 0) {
              setError("No routes found")
              setIsLoading(false)
              return
            }
            
            const route = result.routes[0]
            if (!route.legs || route.legs.length === 0) {
              setError("No route legs found")
              setIsLoading(false)
              return
            }
            
            const leg = route.legs[0]
            const totalDistance = route.legs.reduce(
              (sum: number, leg: any) => sum + (leg.distance?.value || 0),
              0
            )
            const totalDuration = route.legs.reduce(
              (sum: number, leg: any) => sum + (leg.duration?.value || 0),
              0
            )

            setRouteData({
              distance: `${(totalDistance / 1609.34).toFixed(0)} miles`,
              distance_meters: totalDistance,
              duration: `${Math.floor(totalDuration / 3600)}h ${Math.floor((totalDuration % 3600) / 60)}m`,
              duration_seconds: totalDuration,
              waypoints: [
                { name: origin, type: "origin" },
                ...safeStops.map((stop) => ({
                  name: stop.location_name || stop.address,
                  type: stop.stop_type || "waypoint",
                  stop_number: stop.stop_number,
                })),
                { name: destination, type: "destination" },
              ],
            })
            onRouteDataChange?.({
              distance: `${(totalDistance / 1609.34).toFixed(0)} miles`,
              distance_meters: totalDistance,
              duration: `${Math.floor(totalDuration / 3600)}h ${Math.floor((totalDuration % 3600) / 60)}m`,
              duration_seconds: totalDuration,
            })

            // Fit map to show entire route
            // result.routes[0].bounds is already a LatLngBounds object, not an array
            if (result.routes[0].bounds) {
              map.fitBounds(result.routes[0].bounds)
            }

            setIsLoading(false)
          } else {
            // Provide specific error messages for common issues
            let errorMessage = `Directions request failed: ${status}`
            
            if (status === window.google.maps.DirectionsStatus.REQUEST_DENIED) {
              errorMessage = `Google Maps Directions API access denied. Please check:
1. Directions API is enabled in Google Cloud Console
2. API key has proper restrictions configured
3. API key has permission to use Directions Service
Visit: https://console.cloud.google.com/google/maps-apis`
            } else if (status === window.google.maps.DirectionsStatus.OVER_QUERY_LIMIT) {
              errorMessage = "Google Maps API quota exceeded. Please try again later or contact support."
            } else if (status === window.google.maps.DirectionsStatus.ZERO_RESULTS) {
              errorMessage = "No route found between the specified locations. Please check the addresses."
            } else if (status === window.google.maps.DirectionsStatus.INVALID_REQUEST) {
              errorMessage = "Invalid route request. Please check the origin and destination addresses."
            }
            
            setError(errorMessage)
            setIsLoading(false)
          }
        })

        // Use default DirectionsRenderer markers and info windows
        // No custom markers needed
      } catch (err: unknown) {
        console.error("Map initialization error:", err)
        if (cancelled) return
        setError(toFriendlyMapError(errorMessage(err, "Failed to initialize map")))
        setIsLoading(false)
      }
    }

    initializeMap()

    return () => {
      cancelled = true
      // Cleanup markers
      markersRef.current.forEach((marker) => {
        if (marker) marker.setMap(null)
      })
      markersRef.current = []
    }
  }, [mapLoaded, origin, destination, originCoordinates, destinationCoordinates, stopsSig])

  // Keep map tiles painted when parent layout changes size.
  useEffect(() => {
    if (!mapRef.current || !mapInstanceRef.current || !window.google?.maps?.event) return
    const container = mapRef.current
    const observer = new ResizeObserver(() => {
      if (!mapInstanceRef.current) return
      window.google.maps.event.trigger(mapInstanceRef.current, "resize")
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [mapLoaded, origin, destination])

  // Calculate restrictions
  const restrictions: string[] = []
  if (weight && weight > 36000) {
    restrictions.push("Heavy load - Avoid residential roads")
  }
  if (truckHeight && truckHeight > 4.2) {
    restrictions.push("High vehicle - Check bridge clearances")
  }
  if (contents?.toLowerCase().includes("chemical") || contents?.toLowerCase().includes("hazard")) {
    restrictions.push("Hazmat cargo - Restricted tunnel access")
  }
  restrictions.push("Truck-approved highways only")

  return (
    <div className="space-y-4">
      {/* Map Container */}
      <div className="relative w-full h-96 rounded-lg border border-border/50 overflow-hidden">
        {routeData && !isLoading && !error && (
          <div className="absolute right-3 top-3 z-10 rounded-md border border-border/70 bg-background/80 px-3 py-2 text-xs backdrop-blur">
            <p className="font-medium text-foreground">{routeData.duration}</p>
            <p className="text-muted-foreground">{routeData.distance}</p>
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary/30 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}
        {error && error === "Enter origin and destination to preview this route." && (
          <div className="absolute left-3 top-3 z-10 rounded-md border border-border/70 bg-background/80 px-3 py-2 backdrop-blur">
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        )}
        {error && error !== "Enter origin and destination to preview this route." && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary/30 z-10">
            <div className="text-center p-4 max-w-md">
              <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-sm text-foreground">{toFriendlyMapError(error)}</p>
            </div>
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" />
      </div>

      {/* Route Information */}
      {routeData && (
        <Card className="border-border p-4 bg-card/50">
          <div className="flex items-center gap-2 mb-3">
            <Navigation className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-foreground">Truck Route Details</h4>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 mb-4">
            <div className="rounded-md border border-border/60 bg-background/40 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Ruler className="h-3.5 w-3.5" />
                Distance
              </div>
              <p className="mt-1 text-sm font-semibold text-foreground">{routeData.distance}</p>
            </div>
            <div className="rounded-md border border-border/60 bg-background/40 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                Duration
              </div>
              <p className="mt-1 text-sm font-semibold text-foreground">{routeData.duration}</p>
            </div>
          </div>

          {/* Waypoints */}
          <div className="space-y-2 mb-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Route Waypoints</p>
            {(routeData.waypoints ?? []).map((waypoint: any, idx: number) => (
              <div key={idx} className="flex gap-3 text-xs">
                <div className="flex w-3 flex-col items-center">
                  <div
                    className={`mt-1 h-2.5 w-2.5 rounded-full ${
                      waypoint.type === "origin"
                        ? "bg-emerald-500"
                        : waypoint.type === "destination"
                          ? "bg-red-500"
                          : "bg-blue-500"
                    }`}
                  />
                  {idx < (routeData.waypoints ?? []).length - 1 && (
                    <div className="mt-1 h-5 w-px bg-border/70" />
                  )}
                </div>
                <div className="pb-1">
                  <p className="text-foreground">{waypoint.name}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Restrictions */}
          {restrictions.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <p className="text-xs font-medium text-foreground">Truck Restrictions</p>
              </div>
              <div className="space-y-1">
                {restrictions.map((restriction, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">•</span>
                    {restriction}
                  </p>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Navigation Button */}
      {showNavigationButton && (
        <Button
          onClick={() => {
            const googleMapsUrl = safeStops.length > 0
              ? `https://www.google.com/maps/dir/${encodeURIComponent(origin)}/${safeStops.map(s => encodeURIComponent(s.address || s.location_name)).join('/')}/${encodeURIComponent(destination)}`
              : `https://www.google.com/maps/dir/${encodeURIComponent(origin)}/${encodeURIComponent(destination)}`
            window.open(googleMapsUrl, "_blank")
          }}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Navigation className="w-4 h-4 mr-2" />
          Open in Google Maps {safeStops.length > 0 && `(${safeStops.length} stops)`}
        </Button>
      )}
    </div>
  )
}

