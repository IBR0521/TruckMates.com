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
  description?: string
  zone_type: "circle" | "polygon"
  center_latitude?: number
  center_longitude?: number
  radius_meters?: number
  polygon_coordinates?: number[][]
  is_active: boolean
}

interface FleetMapProps {
  vehicles: Vehicle[]
  selectedVehicle?: string | null
  onVehicleClick?: (vehicleId: string) => void
  center?: [number, number]
  zoom?: number
  geofences?: Geofence[]
  showGeofences?: boolean
  selectedGeofence?: string | null
  onGeofenceClick?: (geofenceId: string) => void
}

declare global {
  interface Window {
    google: any
  }
}

export function FleetMap({
  vehicles,
  selectedVehicle,
  onVehicleClick,
  center = [37.7749, -122.4194],
  zoom = 6,
  geofences = [],
  showGeofences = true,
  selectedGeofence = null,
  onGeofenceClick,
}: FleetMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const geofenceShapesRef = useRef<Map<string, any>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const containerReadyRef = useRef(false)

  // Callback ref to ensure container is attached
  const setMapRef = (node: HTMLDivElement | null) => {
    if (node) {
      console.log('[FleetMap] Container ref attached', node)
      mapRef.current = node
      containerReadyRef.current = true
      // Try to initialize if Google Maps is already loaded
      if (window.google && window.google.maps && !mapInstanceRef.current) {
        console.log('[FleetMap] Google Maps already loaded, initializing...')
        setTimeout(() => initializeMap(), 100)
      }
    } else {
      console.log('[FleetMap] Container ref detached')
      containerReadyRef.current = false
    }
  }

  // Load Google Maps script
  useEffect(() => {
    if (mapInstanceRef.current) return // Already initialized

    const loadGoogleMaps = async () => {
      // Get API key
      let apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

      if (!apiKey) {
        try {
          const response = await fetch('/api/google-maps-key')
          if (response.ok) {
            const data = await response.json()
            apiKey = data.apiKey
          }
        } catch (error) {
          console.error('Failed to fetch API key:', error)
        }
      }

      if (!apiKey) {
        setLoadError("Google Maps API key not configured")
        setIsLoading(false)
        return
      }

      // Check if already loaded
      if (window.google && window.google.maps) {
        // Wait for container to be ready
        if (containerReadyRef.current && mapRef.current) {
            initializeMap()
          }
        return
      }

      // Check if script is already being loaded or already exists
      const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)
      if (existingScript) {
        // Wait for it to load
          const checkInterval = setInterval(() => {
          if (window.google && window.google.maps) {
              clearInterval(checkInterval)
            if (containerReadyRef.current && mapRef.current) {
              initializeMap()
            }
          }
        }, 100)
        
        setTimeout(() => clearInterval(checkInterval), 10000)
        return
      }

      // Load script only if it doesn't exist
      const script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,drawing&loading=async`
      script.async = true
      script.defer = true
      
      // Mark script as loading to prevent duplicates
      script.setAttribute("data-loading", "true")
      
      script.onload = () => {
        script.removeAttribute("data-loading")
        if (window.google && window.google.maps) {
          // Wait for container to be ready
          if (containerReadyRef.current && mapRef.current) {
            initializeMap()
          } else {
            // Wait a bit for container
            setTimeout(() => {
              if (mapRef.current) {
                initializeMap()
              }
            }, 200)
          }
        }
      }
      
      script.onerror = () => {
        script.removeAttribute("data-loading")
        setLoadError("Failed to load Google Maps. Please check your API key.")
        setIsLoading(false)
      }
      
      document.head.appendChild(script)
    }

    // Wait a bit for container to be attached via callback ref
    const timer = setTimeout(() => {
      if (containerReadyRef.current || mapRef.current) {
        loadGoogleMaps()
      } else {
        // Container should be ready by now, but if not, wait a bit more
        setTimeout(() => {
          if (mapRef.current) {
            loadGoogleMaps()
          } else {
            setLoadError("Map container not found. Please refresh the page.")
            setIsLoading(false)
          }
        }, 500)
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }, [])

  // Initialize map
  const initializeMap = () => {
    console.log('[FleetMap] initializeMap called', {
      hasGoogle: !!window.google,
      hasMaps: !!(window.google && window.google.maps),
      containerReady: containerReadyRef.current,
      hasMapRef: !!mapRef.current,
      mapInstance: !!mapInstanceRef.current
    })

    if (!window.google || !window.google.maps) {
      console.warn('[FleetMap] Google Maps not loaded yet')
      return
    }

    // Retry if container not ready yet
    if (!containerReadyRef.current || !mapRef.current) {
      console.warn('[FleetMap] Container not ready, retrying...')
      setTimeout(() => {
        if (containerReadyRef.current && mapRef.current) {
          initializeMap()
        } else {
          console.error('[FleetMap] Container still not ready after retry')
          setLoadError("Map container not ready. Please refresh the page.")
          setIsLoading(false)
        }
      }, 200)
      return
    }

    try {
      console.log('[FleetMap] Creating map instance...')
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: center[0], lng: center[1] },
        zoom: zoom,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
      })

        mapInstanceRef.current = map
      console.log('[FleetMap] Map instance created successfully')
        setIsLoading(false)

      // Update markers and geofences after a short delay
      setTimeout(() => {
        updateMarkers()
        if (showGeofences) {
          updateGeofences()
        }
      }, 500)
    } catch (error: any) {
      console.error("[FleetMap] Error initializing map:", error)
      setLoadError(error.message || "Failed to initialize map")
      setIsLoading(false)
    }
  }

  // Update markers when vehicles change
  useEffect(() => {
    if (mapInstanceRef.current) {
      updateMarkers()
    }
  }, [vehicles, selectedVehicle])

  // Update geofences when they change
  useEffect(() => {
    if (mapInstanceRef.current && showGeofences) {
      updateGeofences()
    }
  }, [geofences, showGeofences, selectedGeofence])

  // Update map center and zoom
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat: center[0], lng: center[1] })
      mapInstanceRef.current.setZoom(zoom)
    }
  }, [center, zoom])

  // Update vehicle markers
  const updateMarkers = () => {
    if (!mapInstanceRef.current || !window.google) return

    // Remove old markers
    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current.clear()

    // Add new markers
    vehicles.forEach((vehicle) => {
      if (!vehicle.location) return

      const isSelected = selectedVehicle === vehicle.id

      const marker = new window.google.maps.Marker({
        position: {
          lat: Number(vehicle.location.latitude),
          lng: Number(vehicle.location.longitude),
        },
        map: mapInstanceRef.current,
        title: vehicle.truck_number,
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: isSelected ? "#ef4444" : "#3b82f6",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          rotation: vehicle.location.heading || 0,
        },
      })

      // Add click handler
      if (onVehicleClick) {
        marker.addListener("click", () => {
          onVehicleClick(vehicle.id)
        })
      }

      // Add info window
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <strong>${vehicle.truck_number}</strong><br/>
            ${vehicle.driver?.name || "No driver"}<br/>
            ${vehicle.status || "Unknown status"}
          </div>
        `,
      })

      marker.addListener("click", () => {
        infoWindow.open(mapInstanceRef.current, marker)
      })

      markersRef.current.set(vehicle.id, marker)
    })
  }

  // Update geofences
  const updateGeofences = () => {
    if (!mapInstanceRef.current || !window.google) return

    // Remove old geofences
    geofenceShapesRef.current.forEach((shape) => shape.setMap(null))
    geofenceShapesRef.current.clear()

    if (!showGeofences) return

    geofences.forEach((geofence) => {
      if (!geofence.is_active) return

      const isSelected = selectedGeofence === geofence.id

      if (geofence.zone_type === "circle" && geofence.center_latitude && geofence.center_longitude && geofence.radius_meters) {
        const circle = new window.google.maps.Circle({
          strokeColor: isSelected ? "#ef4444" : "#3b82f6",
          strokeOpacity: isSelected ? 0.8 : 0.5,
          strokeWeight: isSelected ? 3 : 2,
          fillColor: isSelected ? "#ef4444" : "#3b82f6",
          fillOpacity: isSelected ? 0.1 : 0.03,
          map: mapInstanceRef.current,
          center: {
            lat: Number(geofence.center_latitude),
            lng: Number(geofence.center_longitude),
          },
          radius: Number(geofence.radius_meters),
          zIndex: isSelected ? 1000 : 1,
        })

        // Create info window with close button functionality
        const infoWindow = new window.google.maps.InfoWindow()
        
        // Function to create content with working close button
        const createInfoContent = () => {
          return `
            <div style="padding: 14px; min-width: 220px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; border-radius: 8px; position: relative;">
              <button 
                onclick="window.closeGeofenceInfo && window.closeGeofenceInfo()"
                style="position: absolute; top: 8px; right: 8px; background: transparent; border: none; cursor: pointer; padding: 4px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: background 0.2s; z-index: 1000;"
                onmouseover="this.style.background='#f3f4f6'"
                onmouseout="this.style.background='transparent'"
                title="Close"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4L4 12M4 4L12 12" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <div style="font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.3; padding-right: 28px;">
                ${geofence.name}
              </div>
              ${geofence.description ? `
                <div style="font-size: 14px; color: #374151; margin-top: 6px; line-height: 1.5;">
                  ${geofence.description}
                </div>
              ` : ''}
              <div style="font-size: 12px; color: #6b7280; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
                ${geofence.zone_type === "circle" ? `Circle - ${geofence.radius_meters}m radius` : "Polygon Zone"}
              </div>
            </div>
          `
        }

        // Store info window reference on the circle
        ;(circle as any).infoWindow = infoWindow

        circle.addListener("click", () => {
          if (onGeofenceClick) {
            onGeofenceClick(geofence.id)
          }
          
          // Close any other open info windows first
          geofenceShapesRef.current.forEach((shape, id) => {
            if (id !== geofence.id) {
              const storedInfoWindow = (shape as any).infoWindow
              if (storedInfoWindow && storedInfoWindow.getMap()) {
                storedInfoWindow.close()
              }
            }
          })
          
          // Toggle info window - close if already open, open if closed
          if (infoWindow.getMap()) {
            infoWindow.close()
            window.closeGeofenceInfo = undefined
          } else {
            // Set up close function before opening
            window.closeGeofenceInfo = () => {
              infoWindow.close()
              window.closeGeofenceInfo = undefined
            }
            
            // Set content and open
            infoWindow.setContent(createInfoContent())
            infoWindow.setPosition({
              lat: Number(geofence.center_latitude),
              lng: Number(geofence.center_longitude),
            })
            infoWindow.open(mapInstanceRef.current)
          }
        })

        geofenceShapesRef.current.set(geofence.id, circle)
      } else if (geofence.zone_type === "polygon" && geofence.polygon_coordinates) {
        const polygon = new window.google.maps.Polygon({
          paths: geofence.polygon_coordinates.map((coord) => ({
            lat: coord[0],
            lng: coord[1],
          })),
          strokeColor: isSelected ? "#ef4444" : "#3b82f6",
          strokeOpacity: isSelected ? 0.8 : 0.5,
          strokeWeight: isSelected ? 3 : 2,
          fillColor: isSelected ? "#ef4444" : "#3b82f6",
          fillOpacity: isSelected ? 0.1 : 0.03,
          map: mapInstanceRef.current,
          zIndex: isSelected ? 1000 : 1,
        })

        // Create info window with close button functionality
        const infoWindow = new window.google.maps.InfoWindow()
        
        // Function to create content with working close button
        const createInfoContent = () => {
          return `
            <div style="padding: 14px; min-width: 220px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; border-radius: 8px; position: relative;">
              <button 
                onclick="window.closeGeofenceInfo && window.closeGeofenceInfo()"
                style="position: absolute; top: 8px; right: 8px; background: transparent; border: none; cursor: pointer; padding: 4px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: background 0.2s; z-index: 1000;"
                onmouseover="this.style.background='#f3f4f6'"
                onmouseout="this.style.background='transparent'"
                title="Close"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4L4 12M4 4L12 12" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <div style="font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.3; padding-right: 28px;">
                ${geofence.name}
              </div>
              ${geofence.description ? `
                <div style="font-size: 14px; color: #374151; margin-top: 6px; line-height: 1.5;">
                  ${geofence.description}
                </div>
              ` : ''}
              <div style="font-size: 12px; color: #6b7280; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
                Polygon Zone
              </div>
            </div>
          `
        }

        // Store info window reference on the polygon
        ;(polygon as any).infoWindow = infoWindow

        polygon.addListener("click", () => {
          if (onGeofenceClick) {
            onGeofenceClick(geofence.id)
          }
          
          // Close any other open info windows first
          geofenceShapesRef.current.forEach((shape, id) => {
            if (id !== geofence.id) {
              const storedInfoWindow = (shape as any).infoWindow
              if (storedInfoWindow && storedInfoWindow.getMap()) {
                storedInfoWindow.close()
              }
            }
          })
          
          // Toggle info window - close if already open, open if closed
          if (infoWindow.getMap()) {
            infoWindow.close()
            window.closeGeofenceInfo = undefined
          } else {
            // Set up close function before opening
            window.closeGeofenceInfo = () => {
              infoWindow.close()
              window.closeGeofenceInfo = undefined
            }
            
            // Get center of polygon for info window
            const bounds = new window.google.maps.LatLngBounds()
            geofence.polygon_coordinates!.forEach((coord) => {
              bounds.extend({ lat: coord[0], lng: coord[1] })
            })
            
            // Set content and open
            infoWindow.setContent(createInfoContent())
            infoWindow.setPosition(bounds.getCenter())
            infoWindow.open(mapInstanceRef.current)
          }
        })

        geofenceShapesRef.current.set(geofence.id, polygon)
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
        </div>
      </div>
    )
  }

  // Always render the container, even when loading, so the ref can attach
    return (
    <div className="h-full w-full rounded-lg relative" style={{ minHeight: "600px" }}>
      <div
        ref={setMapRef}
        className="h-full w-full"
        style={{ minHeight: "600px" }}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary/20 rounded-lg border border-border z-10">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}
      </div>
  )
}

