"use client"

import { useEffect, useRef, useState } from "react"
import { Truck } from "lucide-react"

interface Vehicle {
  id: string
  truck_number: string
  status?: string
  driver?: { name: string }
  location?: {
    latitude: number
    longitude: number
    speed?: number
    heading?: number
    timestamp: string
  }
}

interface Geofence {
  id: string
  name: string
  zone_type: string
  center_latitude?: number
  center_longitude?: number
  radius_meters?: number
  polygon_coordinates?: Array<{ lat: number; lng: number }>
  north_bound?: number
  south_bound?: number
  east_bound?: number
  west_bound?: number
  is_active: boolean
}

interface FleetMapProps {
  vehicles: Vehicle[]
  selectedVehicle: string | null
  onVehicleClick: (vehicleId: string) => void
  center: [number, number]
  zoom: number
  geofences?: Geofence[]
  showGeofences?: boolean
}

declare global {
  interface Window {
    google: any
    initMap: () => void
  }
}

export function FleetMap({ vehicles, selectedVehicle, onVehicleClick, center, zoom, geofences = [], showGeofences = true }: FleetMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const geofenceShapesRef = useRef<Map<string, any>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    // Load Google Maps script
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      setLoadError("Google Maps API key not configured. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local")
      setIsLoading(false)
      return
    }

    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      initializeMap()
      return
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)
    if (existingScript) {
      existingScript.addEventListener("load", initializeMap)
      return
    }

    // Load Google Maps script
    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = initializeMap
    script.onerror = () => {
      setLoadError("Failed to load Google Maps. Please check your API key.")
      setIsLoading(false)
    }
    document.head.appendChild(script)

    return () => {
      // Cleanup: remove script load listener if it exists
      existingScript?.removeEventListener("load", initializeMap)
    }
  }, [])

  useEffect(() => {
    if (mapInstanceRef.current && vehicles.length > 0) {
      updateMarkers()
    }
  }, [vehicles, selectedVehicle])

  useEffect(() => {
    if (mapInstanceRef.current && showGeofences) {
      updateGeofences()
    } else if (mapInstanceRef.current && !showGeofences) {
      // Clear geofences when hidden
      geofenceShapesRef.current.forEach((shape) => {
        shape.setMap(null)
      })
      geofenceShapesRef.current.clear()
    }
  }, [geofences, showGeofences])

  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat: center[0], lng: center[1] })
      mapInstanceRef.current.setZoom(zoom)
    }
  }, [center, zoom])

  const initializeMap = () => {
    if (!mapRef.current || !window.google) {
      return
    }

    try {
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: center[0], lng: center[1] },
        zoom: zoom,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      })

      mapInstanceRef.current = map
      setIsLoading(false)
      updateMarkers()
    } catch (error) {
      console.error("Error initializing map:", error)
      setLoadError("Error initializing Google Maps")
      setIsLoading(false)
    }
  }

  const updateMarkers = () => {
    if (!mapInstanceRef.current || !window.google) return

    const map = mapInstanceRef.current

    // Clear existing markers
    markersRef.current.forEach((marker) => {
      marker.setMap(null)
    })
    markersRef.current.clear()

    // Add markers for vehicles with locations
    vehicles.forEach((vehicle) => {
      if (!vehicle.location) return

      const lat = Number(vehicle.location.latitude)
      const lng = Number(vehicle.location.longitude)
      const isSelected = selectedVehicle === vehicle.id

      // Check if vehicle is inside any geofence
      const insideZones = geofences
        .filter((g) => g.is_active)
        .filter((g) => {
          if (!g.center_latitude || !g.center_longitude || !g.radius_meters) return false
          if (g.zone_type !== "circle") return false
          
          // Calculate distance using Haversine formula
          const R = 6371000 // Earth radius in meters
          const dLat = ((lat - g.center_latitude) * Math.PI) / 180
          const dLon = ((lng - g.center_longitude) * Math.PI) / 180
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((g.center_latitude * Math.PI) / 180) *
              Math.cos((lat * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
          const distance = R * c
          return distance <= g.radius_meters
        })
        .map((g) => g.name)

      const isInsideZone = insideZones.length > 0

      // Determine marker color based on status and zone
      let iconColor = "#6B7280" // gray (default)
      if (isInsideZone) {
        iconColor = "#3B82F6" // blue (inside zone)
      } else if (vehicle.status === "in_use" || vehicle.status === "in-use") {
        iconColor = "#10B981" // green
      } else if (vehicle.status === "maintenance") {
        iconColor = "#F59E0B" // yellow
      }

      // Create custom marker icon
      const icon = {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: iconColor,
        fillOpacity: 1,
        strokeColor: "#FFFFFF",
        strokeWeight: 2,
        scale: isSelected ? 10 : 8,
      }

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map: map,
        icon: icon,
        title: vehicle.truck_number,
        zIndex: isSelected ? 1000 : 100,
      })

      // Create info window
      const infoContent = `
        <div style="padding: 8px; min-width: 200px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
            ${vehicle.truck_number}
          </div>
          ${vehicle.driver ? `<div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">${vehicle.driver.name}</div>` : ""}
          ${vehicle.location.speed ? `<div style="font-size: 12px; color: #6B7280;">Speed: ${vehicle.location.speed} mph</div>` : ""}
          ${insideZones.length > 0 ? `<div style="font-size: 11px; color: #3B82F6; margin-top: 4px; font-weight: 500;">📍 Inside: ${insideZones.join(", ")}</div>` : ""}
          <div style="font-size: 11px; color: #9CA3AF; margin-top: 4px;">
            ${new Date(vehicle.location.timestamp).toLocaleTimeString()}
          </div>
        </div>
      `

      const infoWindow = new window.google.maps.InfoWindow({
        content: infoContent,
      })

      // Show info window if selected
      if (isSelected) {
        infoWindow.open(map, marker)
      }

      // Add click listener
      marker.addListener("click", () => {
        onVehicleClick(vehicle.id)
        infoWindow.open(map, marker)
      })

      markersRef.current.set(vehicle.id, { marker, infoWindow })
    })
  }

  const updateGeofences = () => {
    if (!mapInstanceRef.current || !window.google) return

    const map = mapInstanceRef.current

    // Clear existing geofence shapes
    geofenceShapesRef.current.forEach((shape) => {
      shape.setMap(null)
    })
    geofenceShapesRef.current.clear()

    // Only show active geofences
    const activeGeofences = geofences.filter((g) => g.is_active)

    activeGeofences.forEach((geofence) => {
      if (geofence.zone_type === "circle" && geofence.center_latitude && geofence.center_longitude && geofence.radius_meters) {
        const circle = new window.google.maps.Circle({
          strokeColor: "#3B82F6",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#3B82F6",
          fillOpacity: 0.15,
          map: map,
          center: {
            lat: geofence.center_latitude,
            lng: geofence.center_longitude,
          },
          radius: geofence.radius_meters,
          zIndex: 1,
        })

        // Add info window on click
        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; min-width: 150px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
                ${geofence.name}
              </div>
              <div style="font-size: 12px; color: #6B7280;">
                Geofence Zone
              </div>
              <div style="font-size: 11px; color: #9CA3AF; margin-top: 4px;">
                ${(geofence.radius_meters / 1000).toFixed(2)} km radius
              </div>
            </div>
          `,
        })

        circle.addListener("click", () => {
          infoWindow.setPosition({ lat: geofence.center_latitude!, lng: geofence.center_longitude! })
          infoWindow.open(map)
        })

        geofenceShapesRef.current.set(geofence.id, { circle, infoWindow })
      } else if (geofence.zone_type === "polygon" && geofence.polygon_coordinates && geofence.polygon_coordinates.length > 0) {
        const polygonPath = geofence.polygon_coordinates.map((coord) => ({
          lat: coord.lat || coord.latitude,
          lng: coord.lng || coord.longitude,
        }))

        const polygon = new window.google.maps.Polygon({
          paths: polygonPath,
          strokeColor: "#3B82F6",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#3B82F6",
          fillOpacity: 0.15,
          map: map,
          zIndex: 1,
        })

        geofenceShapesRef.current.set(geofence.id, polygon)
      } else if (
        geofence.zone_type === "rectangle" &&
        geofence.north_bound &&
        geofence.south_bound &&
        geofence.east_bound &&
        geofence.west_bound
      ) {
        const rectangle = new window.google.maps.Rectangle({
          bounds: {
            north: geofence.north_bound,
            south: geofence.south_bound,
            east: geofence.east_bound,
            west: geofence.west_bound,
          },
          strokeColor: "#3B82F6",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#3B82F6",
          fillOpacity: 0.15,
          map: map,
          zIndex: 1,
        })

        geofenceShapesRef.current.set(geofence.id, rectangle)
      }
    })
  }

  if (loadError) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-secondary/20 rounded-lg border border-border">
        <div className="text-center p-8">
          <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground font-medium mb-2">Map Unavailable</p>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <p className="text-xs text-muted-foreground mt-4">
            To enable the map, add your Google Maps API key to <code className="bg-secondary px-1 rounded">.env.local</code>
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-secondary/20 rounded-lg border border-border">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={mapRef}
      className="h-full w-full rounded-lg"
      style={{ minHeight: "600px" }}
    />
  )
}

