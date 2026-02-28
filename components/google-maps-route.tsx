"use client"

import { useEffect, useRef, useState } from "react"
import { MapPin, Navigation, AlertTriangle } from "lucide-react"
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
}

declare global {
  interface Window {
    google: any
    initGoogleMaps: () => void
  }
}

export function GoogleMapsRoute({
  origin,
  destination,
  originCoordinates,
  destinationCoordinates,
  stops = [],
  weight,
  truckHeight,
  contents,
}: GoogleMapsRouteProps) {
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
    if (window.google && window.google.maps) {
      setMapLoaded(true)
      return
    }

    // Get API key - try env first, then fetch from API route
    let apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    
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

      const script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`
      script.async = true
      script.defer = true
      script.onload = () => {
        // Wait for Google Maps API to be fully initialized
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
      // Cleanup
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [])

  // Initialize map and get route
  useEffect(() => {
    if (!mapLoaded || !window.google || !mapRef.current) return

    const initializeMap = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Verify Google Maps API is fully loaded
        if (!window.google?.maps?.Geocoder || typeof window.google.maps.Geocoder !== 'function') {
          throw new Error("Google Maps Geocoder API is not available. Please ensure the Google Maps JavaScript API is fully loaded.")
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
              geocoder.geocode({ address: origin }, (results, status) => {
                if (status === window.google.maps.GeocoderStatus.OK && results) {
                  resolve(results)
                } else {
                  reject(new Error(`Geocoding failed: ${status}`))
                }
              })
            })
            originCoords = {
              lat: originResult[0].geometry.location.lat(),
              lng: originResult[0].geometry.location.lng(),
            }
          } catch (err: any) {
            throw new Error(`Failed to geocode origin "${origin}": ${err.message || "Unknown error"}`)
          }
        }

        if (destinationCoordinates) {
          destCoords = destinationCoordinates
        } else {
          try {
            const destResult = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
              geocoder.geocode({ address: destination }, (results, status) => {
                if (status === window.google.maps.GeocoderStatus.OK && results) {
                  resolve(results)
                } else {
                  reject(new Error(`Geocoding failed: ${status}`))
                }
              })
            })
            destCoords = {
              lat: destResult[0].geometry.location.lat(),
              lng: destResult[0].geometry.location.lng(),
            }
          } catch (err: any) {
            throw new Error(`Failed to geocode destination "${destination}": ${err.message || "Unknown error"}`)
          }
        }

        // Initialize map
        const map = new window.google.maps.Map(mapRef.current, {
          zoom: 7,
          center: originCoords,
          mapTypeId: window.google.maps.MapTypeId.ROADMAP,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }],
            },
          ],
        })

        mapInstanceRef.current = map

        // Initialize directions service and renderer
        const directionsService = new window.google.maps.DirectionsService()
        const directionsRenderer = new window.google.maps.DirectionsRenderer({
          map,
          suppressMarkers: false,
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
        if (stops.length > 0) {
          for (const stop of stops) {
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
                  stopGeocoder.geocode({ address: stop.address || stop.location_name }, (results, status) => {
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
          optimizeWaypoints: stops.length > 0,
          avoidTolls: false,
        }

        if (waypoints.length > 0) {
          request.waypoints = waypoints
        }

        directionsService.route(request, (result: any, status: any) => {
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
                ...stops.map((stop) => ({
                  name: stop.location_name || stop.address,
                  type: stop.stop_type || "waypoint",
                  stop_number: stop.stop_number,
                })),
                { name: destination, type: "destination" },
              ],
            })

            // Fit map to show entire route
            if (result.routes[0].bounds) {
              const bounds = new window.google.maps.LatLngBounds()
              result.routes[0].bounds.forEach((bound: any) => {
                bounds.extend(bound)
              })
              map.fitBounds(bounds)
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

        // Add custom markers for origin and destination
        const originMarker = new window.google.maps.Marker({
          position: originCoords,
          map,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#10b981",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
          title: `Origin: ${origin}`,
        })

        const destMarker = new window.google.maps.Marker({
          position: destCoords,
          map,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#ef4444",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
          title: `Destination: ${destination}`,
        })

        markersRef.current = [originMarker, destMarker]

        // Add info windows
        const originInfoWindow = new window.google.maps.InfoWindow({
          content: `<div class="p-2"><strong>Origin</strong><br/>${origin}</div>`,
        })
        const destInfoWindow = new window.google.maps.InfoWindow({
          content: `<div class="p-2"><strong>Destination</strong><br/>${destination}</div>`,
        })

        originMarker.addListener("click", () => {
          originInfoWindow.open(map, originMarker)
        })
        destMarker.addListener("click", () => {
          destInfoWindow.open(map, destMarker)
        })
      } catch (err: any) {
        console.error("Map initialization error:", err)
        setError(err.message || "Failed to initialize map")
        setIsLoading(false)
      }
    }

    initializeMap()

    return () => {
      // Cleanup markers
      markersRef.current.forEach((marker) => {
        if (marker) marker.setMap(null)
      })
      markersRef.current = []
    }
  }, [mapLoaded, origin, destination, originCoordinates, destinationCoordinates, stops])

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
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary/30 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary/30 z-10">
            <div className="text-center p-4">
              <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-sm text-foreground">{error}</p>
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

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Distance</p>
              <p className="text-sm font-medium text-foreground">{routeData.distance}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-sm font-medium text-foreground">{routeData.duration}</p>
            </div>
          </div>

          {/* Waypoints */}
          <div className="space-y-2 mb-4">
            <p className="text-xs font-medium text-muted-foreground">Route Waypoints</p>
            {routeData.waypoints.map((waypoint: any, idx: number) => (
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

      {/* Navigation Button */}
      <Button
        onClick={() => {
          const googleMapsUrl = stops.length > 0
            ? `https://www.google.com/maps/dir/${encodeURIComponent(origin)}/${stops.map(s => encodeURIComponent(s.address || s.location_name)).join('/')}/${encodeURIComponent(destination)}`
            : `https://www.google.com/maps/dir/${encodeURIComponent(origin)}/${encodeURIComponent(destination)}`
          window.open(googleMapsUrl, "_blank")
        }}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        <Navigation className="w-4 h-4 mr-2" />
        Open in Google Maps {stops.length > 0 && `(${stops.length} stops)`}
      </Button>
    </div>
  )
}

