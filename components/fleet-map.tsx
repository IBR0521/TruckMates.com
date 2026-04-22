"use client"

import { useEffect, useRef, useState } from "react"
import { errorMessage } from "@/lib/error-message"
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
  zone_type: "circle" | "polygon" | "rectangle"
  center_latitude?: number
  center_longitude?: number
  radius_meters?: number
  polygon_coordinates?: Array<{ lat: number; lng: number }> | number[][]
  north_bound?: number
  south_bound?: number
  east_bound?: number
  west_bound?: number
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
  const debug = process.env.NODE_ENV !== "production"

  // Callback ref to ensure container is attached
  const setMapRef = (node: HTMLDivElement | null) => {
    if (node) {
      if (debug) console.log('[FleetMap] Container ref attached', node)
      mapRef.current = node
      containerReadyRef.current = true
      // Try to initialize if Google Maps is already loaded and Map constructor is available
      if (window.google?.maps?.Map && typeof window.google.maps.Map === 'function' && !mapInstanceRef.current) {
        if (debug) console.log('[FleetMap] Google Maps already loaded, initializing...')
        setTimeout(() => initializeMap(), 100)
      }
    } else {
      if (debug) console.log('[FleetMap] Container ref detached')
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
        setLoadError("Google Maps API key not configured. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in Vercel environment variables and redeploy.")
        setIsLoading(false)
        return
      }

      // Check if already loaded and Map constructor is available
      if (window.google?.maps?.Map && typeof window.google.maps.Map === 'function') {
        // Wait for container to be ready
        if (containerReadyRef.current && mapRef.current) {
            initializeMap()
          }
        return
      }

      // Check if script is already being loaded or already exists
      const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)
      if (existingScript) {
        // Wait for it to load and Map constructor to be available
          const checkInterval = setInterval(() => {
          if (window.google?.maps?.Map && typeof window.google.maps.Map === 'function') {
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
        if (debug) console.log('[FleetMap] Google Maps script loaded')
        // Wait for Google Maps to fully initialize (check for Map constructor)
        const checkGoogleMaps = setInterval(() => {
          if (window.google?.maps?.Map && typeof window.google.maps.Map === 'function') {
            clearInterval(checkGoogleMaps)
            if (debug) console.log('[FleetMap] Google Maps fully initialized')
            // Wait a bit more to ensure everything is ready
            setTimeout(() => {
              if (containerReadyRef.current && mapRef.current) {
                initializeMap()
              } else {
                // Container not ready yet, wait for it
                const checkContainer = setInterval(() => {
                  if (containerReadyRef.current && mapRef.current) {
                    clearInterval(checkContainer)
                    initializeMap()
                  }
                }, 100)
                setTimeout(() => clearInterval(checkContainer), 5000)
              }
            }, 100)
          }
        }, 100)
        
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkGoogleMaps)
          if (!window.google?.maps?.Map || typeof window.google.maps.Map !== 'function') {
            setLoadError("Google Maps failed to initialize. Please check your API key and refresh the page.")
            setIsLoading(false)
          }
        }, 10000)
      }
      
      script.onerror = (error) => {
        script.removeAttribute("data-loading")
        console.error('[FleetMap] Script load error:', error)
        setLoadError("Failed to load Google Maps. Please check: 1) API key is set in Vercel, 2) Domain restrictions allow your production domain, 3) Maps JavaScript API is enabled in Google Cloud Console.")
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
    if (debug) console.log('[FleetMap] initializeMap called', {
      hasGoogle: !!window.google,
      hasMaps: !!(window.google && window.google.maps),
      hasMapConstructor: !!(window.google?.maps?.Map),
      containerReady: containerReadyRef.current,
      hasMapRef: !!mapRef.current,
      mapInstance: !!mapInstanceRef.current
    })

    // Check if Google Maps is fully loaded with Map constructor
    if (!window.google || !window.google.maps || typeof window.google.maps.Map !== 'function') {
      if (debug)
        console.warn('[FleetMap] Google Maps not fully loaded yet', {
        hasGoogle: !!window.google,
        hasMaps: !!(window.google?.maps),
        hasMapConstructor: typeof window.google?.maps?.Map
        })
      // Retry after a short delay
      setTimeout(() => {
        if (window.google?.maps?.Map && typeof window.google.maps.Map === 'function') {
          initializeMap()
        } else {
          setLoadError("Google Maps failed to load. Please check your API key and refresh the page.")
          setIsLoading(false)
        }
      }, 500)
      return
    }

    // Retry if container not ready yet
    if (!containerReadyRef.current || !mapRef.current) {
      if (debug) console.warn('[FleetMap] Container not ready, retrying...')
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
      if (debug) console.log('[FleetMap] Creating map instance...')
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: center[0], lng: center[1] },
        zoom: zoom,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
      })

        mapInstanceRef.current = map
      if (debug) console.log('[FleetMap] Map instance created successfully')
        setIsLoading(false)

      // Update markers and geofences after a short delay
      setTimeout(() => {
        updateMarkers()
        if (showGeofences) {
          updateGeofences()
        }
      }, 500)
    } catch (error: unknown) {
      console.error("[FleetMap] Error initializing map:", error)
      setLoadError(errorMessage(error, "Failed to initialize map"))
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

  // Keep Google Map canvas synced with container size changes.
  useEffect(() => {
    if (!mapRef.current || !mapInstanceRef.current || !window.google?.maps?.event) return

    const container = mapRef.current
    const observer = new ResizeObserver(() => {
      if (!mapInstanceRef.current) return
      window.google.maps.event.trigger(mapInstanceRef.current, "resize")
      mapInstanceRef.current.setCenter({ lat: center[0], lng: center[1] })
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [center])

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

      // HIGH FIX: Escape HTML to prevent XSS attacks
      const escapeHtml = (text: string | null | undefined): string => {
        if (!text) return ""
        const div = document.createElement("div")
        div.textContent = text
        return div.innerHTML
      }

      // LOW FIX: Format truck popup with proper formatting (status capitalization, driver name formatting)
      const formatStatus = (status?: string) => {
        if (!status) return "Unknown status"
        return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
      }
      
      const formatDriverName = (name?: string) => {
        if (!name) return "No driver"
        return name.trim()
      }
      
      // Add info window with escaped and formatted content
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; font-family: system-ui, -apple-system, sans-serif;">
            <strong style="font-size: 14px; color: #1f2937;">${escapeHtml(vehicle.truck_number || "Unknown")}</strong><br/>
            <span style="color: #6b7280; font-size: 12px;">${escapeHtml(formatDriverName(vehicle.driver?.name))}</span><br/>
            <span style="color: #4b5563; font-size: 12px;">${escapeHtml(formatStatus(vehicle.status))}</span>
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
        
        // Escape HTML to prevent XSS
        const escapeHtml = (s: string) => {
          const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
          }
          return s.replace(/[&<>"']/g, (c) => map[c] || c)
        }

        // Function to create content with working close button
        const createInfoContent = () => {
          return `
            <div style="padding: 14px; min-width: 220px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; border-radius: 8px; position: relative;">
              <button 
                onclick="window.closeGeofenceInfo_${geofence.id} && window.closeGeofenceInfo_${geofence.id}()"
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
                ${escapeHtml(geofence.name)}
              </div>
              ${geofence.description ? `
                <div style="font-size: 14px; color: #374151; margin-top: 6px; line-height: 1.5;">
                  ${escapeHtml(geofence.description)}
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
            ;(window as any)[`closeGeofenceInfo_${geofence.id}`] = undefined
          } else {
            // Set up close function before opening (scoped to this geofence)
            ;(window as any)[`closeGeofenceInfo_${geofence.id}`] = () => {
              infoWindow.close()
              ;(window as any)[`closeGeofenceInfo_${geofence.id}`] = undefined
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
      } else if (
        geofence.zone_type === "rectangle" &&
        geofence.north_bound != null &&
        geofence.south_bound != null &&
        geofence.east_bound != null &&
        geofence.west_bound != null
      ) {
        const rectangle = new window.google.maps.Rectangle({
          strokeColor: isSelected ? "#ef4444" : "#3b82f6",
          strokeOpacity: isSelected ? 0.8 : 0.5,
          strokeWeight: isSelected ? 3 : 2,
          fillColor: isSelected ? "#ef4444" : "#3b82f6",
          fillOpacity: isSelected ? 0.1 : 0.03,
          map: mapInstanceRef.current,
          bounds: {
            north: Number(geofence.north_bound),
            south: Number(geofence.south_bound),
            east: Number(geofence.east_bound),
            west: Number(geofence.west_bound),
          },
          zIndex: isSelected ? 1000 : 1,
        })

        const infoWindow = new window.google.maps.InfoWindow()

        const escapeHtml = (s: string) => {
          const map: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          }
          return s.replace(/[&<>"']/g, (c) => map[c] || c)
        }

        const createInfoContent = () => {
          return `
            <div style="padding: 14px; min-width: 220px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; border-radius: 8px; position: relative;">
              <button 
                onclick="window.closeGeofenceInfo_${geofence.id} && window.closeGeofenceInfo_${geofence.id}()"
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
                ${escapeHtml(geofence.name)}
              </div>
              ${geofence.description ? `
                <div style="font-size: 14px; color: #374151; margin-top: 6px; line-height: 1.5;">
                  ${escapeHtml(geofence.description)}
                </div>
              ` : ''}
              <div style="font-size: 12px; color: #6b7280; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
                Rectangle Zone
              </div>
            </div>
          `
        }

        ;(rectangle as any).infoWindow = infoWindow

        rectangle.addListener("click", () => {
          if (onGeofenceClick) {
            onGeofenceClick(geofence.id)
          }

          geofenceShapesRef.current.forEach((shape, id) => {
            if (id !== geofence.id) {
              const storedInfoWindow = (shape as any).infoWindow
              if (storedInfoWindow && storedInfoWindow.getMap()) {
                storedInfoWindow.close()
              }
            }
          })

          if (infoWindow.getMap()) {
            infoWindow.close()
            ;(window as any)[`closeGeofenceInfo_${geofence.id}`] = undefined
          } else {
            ;(window as any)[`closeGeofenceInfo_${geofence.id}`] = () => {
              infoWindow.close()
              ;(window as any)[`closeGeofenceInfo_${geofence.id}`] = undefined
            }

            const bounds = rectangle.getBounds()
            infoWindow.setContent(createInfoContent())
            infoWindow.setPosition(bounds.getCenter())
            infoWindow.open(mapInstanceRef.current)
          }
        })

        geofenceShapesRef.current.set(geofence.id, rectangle)
      } else if (geofence.zone_type === "polygon" && geofence.polygon_coordinates) {
        // Handle both {lat, lng} and [lat, lng] formats
        const paths = geofence.polygon_coordinates.map((coord: any) => {
          if (typeof coord === 'object' && 'lat' in coord && 'lng' in coord) {
            return { lat: coord.lat, lng: coord.lng }
          } else if (Array.isArray(coord) && coord.length >= 2) {
            return { lat: coord[0], lng: coord[1] }
          }
          return null
        }).filter((p: any) => p !== null)
        
        if (paths.length === 0) {
          return // Skip invalid polygon
        }
        
        const polygon = new window.google.maps.Polygon({
          paths,
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
        
        // Escape HTML to prevent XSS
        const escapeHtml = (s: string) => {
          const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
          }
          return s.replace(/[&<>"']/g, (c) => map[c] || c)
        }

        // Function to create content with working close button
        const createInfoContent = () => {
          return `
            <div style="padding: 14px; min-width: 220px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; border-radius: 8px; position: relative;">
              <button 
                onclick="window.closeGeofenceInfo_${geofence.id} && window.closeGeofenceInfo_${geofence.id}()"
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
                ${escapeHtml(geofence.name)}
              </div>
              ${geofence.description ? `
                <div style="font-size: 14px; color: #374151; margin-top: 6px; line-height: 1.5;">
                  ${escapeHtml(geofence.description)}
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
            ;(window as any)[`closeGeofenceInfo_${geofence.id}`] = undefined
          } else {
            // Set up close function before opening (scoped to this geofence)
            ;(window as any)[`closeGeofenceInfo_${geofence.id}`] = () => {
              infoWindow.close()
              ;(window as any)[`closeGeofenceInfo_${geofence.id}`] = undefined
            }
            
            // Get center of polygon for info window
            const bounds = new window.google.maps.LatLngBounds()
            geofence.polygon_coordinates!.forEach((coord: any) => {
              // Handle both {lat, lng} and [lat, lng] formats
              const lat = coord.lat ?? coord[0] ?? coord.latitude
              const lng = coord.lng ?? coord[1] ?? coord.longitude
              if (lat != null && lng != null) {
                bounds.extend({ lat, lng })
              }
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
    <div className="h-full w-full rounded-lg relative">
      <div ref={setMapRef} className="h-full w-full" />
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

