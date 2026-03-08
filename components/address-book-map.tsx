"use client"

import React, { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, MapPin, AlertCircle } from "lucide-react"
import type { AddressBookEntry } from "@/app/actions/enhanced-address-book"

interface AddressBookMapProps {
  entries: AddressBookEntry[]
}

declare global {
  interface Window {
    google: any
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  shipper: "#3B82F6", // Blue
  receiver: "#22C55E", // Green
  vendor: "#F59E0B", // Amber
  broker: "#8B5CF6", // Purple
  driver: "#EC4899", // Pink
  warehouse: "#6366F1", // Indigo
  repair_shop: "#EF4444", // Red
  fuel_station: "#F97316", // Orange
  other: "#6B7280", // Gray
}

export function AddressBookMap({ entries }: AddressBookMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const infoWindowsRef = useRef<Map<string, any>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const containerReadyRef = useRef(false)

  // Callback ref to ensure container is attached before initializing
  const setMapRef = (node: HTMLDivElement | null) => {
    if (node) {
      mapRef.current = node
      containerReadyRef.current = true
      // Don't call initializeMap here - let useEffect handle it
      // This ensures React is fully initialized before calling hooks
    } else {
      containerReadyRef.current = false
    }
  }

  useEffect(() => {
    // Don't load map if there are no entries
    if (entries.length === 0) {
      setIsLoading(false)
      return
    }

    // Wait a tick to ensure DOM is ready and ref is attached
    const initTimer = setTimeout(() => {
      // Check if container is ready
      if (!mapRef.current || !containerReadyRef.current) {
        // Container not ready yet, will retry on next render
        return
      }

      // Load Google Maps script
      const loadMap = async () => {
      let apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

      // If not in env, try to fetch from API route (uses GOOGLE_MAPS_API_KEY)
      if (!apiKey) {
        try {
          const response = await fetch('/api/google-maps-key')
          if (response.ok) {
            const data = await response.json()
            apiKey = data.apiKey
          }
        } catch (error) {
          console.warn('[AddressBookMap] Failed to fetch API key from server:', error)
        }
      }

      if (!apiKey) {
        setLoadError("Google Maps API key not configured. Please set GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local")
        setIsLoading(false)
        return
      }

      // Check if Google Maps is already loaded and container is ready
      // Must check that Map constructor is available, not just that maps object exists
      if (window.google?.maps?.Map && typeof window.google.maps.Map === 'function' && containerReadyRef.current) {
        initializeMap()
        return
      }

      // Set timeout for loading (30 seconds)
      const timeoutId = setTimeout(() => {
        if (isLoading) {
          setLoadError("Map loading timeout. Please check your internet connection and API key.")
          setIsLoading(false)
        }
      }, 30000)

      // Check if script is already being loaded
      const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)
      if (existingScript) {
        // Wait for existing script to load
        const checkGoogleMaps = setInterval(() => {
          // Check that Map constructor is available, not just that maps object exists
          if (window.google?.maps?.Map && typeof window.google.maps.Map === 'function' && containerReadyRef.current) {
            clearInterval(checkGoogleMaps)
            clearTimeout(timeoutId)
            initializeMap()
          }
        }, 100)

        // Cleanup after 30 seconds
        setTimeout(() => {
          clearInterval(checkGoogleMaps)
        }, 30000)

        return () => {
          clearInterval(checkGoogleMaps)
          clearTimeout(timeoutId)
        }
      }

      // Load Google Maps script
      const script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`
      script.async = true
      script.defer = true
      script.onload = () => {
        clearTimeout(timeoutId)
        // Wait for container to be ready before initializing
        if (containerReadyRef.current) {
          initializeMap()
        } else {
          // Retry after a short delay if container not ready yet
          setTimeout(() => {
            if (containerReadyRef.current) {
              initializeMap()
            }
          }, 100)
        }
      }
      script.onerror = () => {
        clearTimeout(timeoutId)
        setLoadError("Failed to load Google Maps. Please check your API key and network connection.")
        setIsLoading(false)
      }
      document.head.appendChild(script)

        return () => {
          clearTimeout(timeoutId)
        }
      }

      loadMap()
    }, 50) // Small delay to ensure ref is attached

    return () => clearTimeout(initTimer)
  }, [entries.length]) // Re-run if entries change

  useEffect(() => {
    if (mapInstanceRef.current && entries.length > 0) {
      updateMarkers()
    }
  }, [entries])

  const initializeMap = () => {
    // Double-check container is ready
    if (!mapRef.current || !containerReadyRef.current) {
      console.warn("[AddressBookMap] Map container ref not available yet, will retry")
      // Don't set error, just wait - the callback ref will retry
      return
    }

    // Check if Google Maps API is fully loaded with Map constructor
    if (!window.google || !window.google.maps || typeof window.google.maps.Map !== 'function') {
      console.warn("[AddressBookMap] Google Maps API not fully loaded yet, will retry")
      // Retry after a short delay
      setTimeout(() => {
        if (window.google?.maps?.Map && typeof window.google.maps.Map === 'function') {
          initializeMap()
        } else {
          setLoadError("Google Maps API failed to load. Please refresh the page.")
          setIsLoading(false)
        }
      }, 200)
      return
    }

    try {
      // Calculate center from entries or use default
      let center = { lat: 39.8283, lng: -98.5795 } // US center
      if (entries.length > 0) {
        const validEntries = entries.filter(e => e.coordinates)
        if (validEntries.length > 0) {
          const avgLat = validEntries.reduce((sum, e) => sum + (e.coordinates?.lat || 0), 0) / validEntries.length
          const avgLng = validEntries.reduce((sum, e) => sum + (e.coordinates?.lng || 0), 0) / validEntries.length
          center = { lat: avgLat, lng: avgLng }
        }
      }

      // Double-check Map constructor is available before using it
      if (typeof window.google.maps.Map !== 'function') {
        throw new Error("Google Maps Map constructor is not available")
      }

      const map = new window.google.maps.Map(mapRef.current, {
        center: center,
        zoom: entries.length === 1 ? 12 : 6,
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
    } catch (error: unknown) {
      console.error("Error initializing map:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setLoadError(`Error initializing Google Maps: ${errorMessage}`)
      setIsLoading(false)
    }
  }

  const updateMarkers = () => {
    if (!mapInstanceRef.current || !window.google) {
      return
    }

    // Clear existing markers
    markersRef.current.forEach((marker) => {
      marker.setMap(null)
    })
    markersRef.current.clear()

    infoWindowsRef.current.forEach((infoWindow) => {
      infoWindow.close()
    })
    infoWindowsRef.current.clear()

    // Add markers for each entry
    entries.forEach((entry) => {
      if (!entry.coordinates) return

      const color = CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.other

      const marker = new window.google.maps.Marker({
        position: {
          lat: entry.coordinates.lat,
          lng: entry.coordinates.lng,
        },
        map: mapInstanceRef.current,
        title: entry.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 2,
        },
      })

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

      // Create info window with escaped content
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-weight: 600; font-size: 14px;">${escapeHtml(entry.name)}</h3>
            ${entry.company_name ? `<p style="margin: 0 0 4px 0; color: #666; font-size: 12px;">${escapeHtml(entry.company_name)}</p>` : ""}
            <p style="margin: 0 0 4px 0; color: #666; font-size: 12px;">
              ${escapeHtml(entry.address_line1)}<br/>
              ${escapeHtml(entry.city)}, ${escapeHtml(entry.state)} ${escapeHtml(entry.zip_code)}
            </p>
            ${entry.phone ? `<p style="margin: 4px 0 0 0; color: #666; font-size: 12px;">📞 ${escapeHtml(entry.phone)}</p>` : ""}
            ${entry.email ? `<p style="margin: 4px 0 0 0; color: #666; font-size: 12px;">✉️ ${escapeHtml(entry.email)}</p>` : ""}
          </div>
        `,
      })

      marker.addListener("click", () => {
        // Close all other info windows
        infoWindowsRef.current.forEach((iw) => iw.close())
        infoWindow.open(mapInstanceRef.current, marker)
      })

      markersRef.current.set(entry.id, marker)
      infoWindowsRef.current.set(entry.id, infoWindow)
    })

    // Fit bounds to show all markers
    if (entries.length > 0) {
      const bounds = new window.google.maps.LatLngBounds()
      entries.forEach((entry) => {
        if (entry.coordinates) {
          bounds.extend({
            lat: entry.coordinates.lat,
            lng: entry.coordinates.lng,
          })
        }
      })
      if (entries.length > 1) {
        mapInstanceRef.current.fitBounds(bounds)
      }
    }
  }

  if (loadError) {
    return (
      <Card className="border border-border/50 p-8 text-center">
        <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground mb-2 font-medium">{loadError}</p>
        <p className="text-sm text-muted-foreground mt-2">
          Please check your Google Maps API key in <code className="bg-secondary px-1 rounded">.env.local</code>
        </p>
        <Button 
          onClick={() => window.location.reload()} 
          className="mt-4"
          variant="outline"
        >
          Retry
        </Button>
      </Card>
    )
  }

  // Loading state is now handled inline with the map container
  // This ensures the container is always rendered for the ref to attach

  // Don't try to load map if no entries
  if (entries.length === 0) {
    return (
      <Card className="border border-border/50 p-8 text-center">
        <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground mb-2">No addresses to display</p>
        <p className="text-sm text-muted-foreground">
          Add addresses to see them on the map
        </p>
      </Card>
    )
  }

  const verifiedEntries = entries.filter(e => e.coordinates && e.geocoding_status === "verified")
  
  // Show helpful message if no verified entries (but map already loaded or failed)
  if (verifiedEntries.length === 0 && !isLoading && !loadError) {
    return (
      <div className="space-y-4">
        <Card className="border border-orange-500/20 bg-orange-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground mb-1">No verified addresses to display</p>
              <p className="text-xs text-muted-foreground">
                Only addresses with verified coordinates can be shown on the map. 
                Switch to list view and click the globe icon (🌐) next to failed addresses to geocode them.
              </p>
            </div>
          </div>
        </Card>
        <div className="w-full h-[600px] rounded-lg overflow-hidden border border-border bg-secondary/20 flex items-center justify-center">
          <div className="text-center">
            <MapPin className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-medium mb-2">Map Ready</p>
            <p className="text-sm text-muted-foreground">
              Geocode addresses in list view to see them here
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Always render the container, even when loading, so the ref can attach
  return (
    <div className="w-full h-[600px] rounded-lg overflow-hidden border border-border relative">
      <div ref={setMapRef} className="w-full h-full" />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary/20 z-10">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  )
}

