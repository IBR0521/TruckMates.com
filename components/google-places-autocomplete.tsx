"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

declare global {
  interface Window {
    google: any
  }
}

interface AddressComponents {
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
  coordinates?: { lat: number; lng: number }
}

interface GooglePlacesAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onPlaceSelect?: (address: AddressComponents) => void
  placeholder?: string
  label?: string
  required?: boolean
  className?: string
  id?: string
  disabled?: boolean
}

export function GooglePlacesAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Enter address...",
  label,
  required = false,
  className = "",
  id,
  disabled = false,
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false)

  // Load Google Maps Places API
  useEffect(() => {
    // Check if already loaded
    if (window.google?.maps?.places?.Autocomplete) {
      setIsGoogleMapsLoaded(true)
      return
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)
    if (existingScript) {
      // Wait for it to load
      const checkInterval = setInterval(() => {
        if (window.google?.maps?.places?.Autocomplete) {
          clearInterval(checkInterval)
          setIsGoogleMapsLoaded(true)
        }
      }, 100)
      setTimeout(() => clearInterval(checkInterval), 10000)
      return
    }

    // Load Google Maps script
    const loadGoogleMaps = async () => {
      let apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

      if (!apiKey) {
        try {
          const response = await fetch('/api/google-maps-key')
          if (response.ok) {
            const data = await response.json()
            apiKey = data.apiKey
          }
        } catch (error) {
          console.error('[GooglePlacesAutocomplete] Failed to fetch API key:', error)
        }
      }

      if (!apiKey) {
        console.warn('[GooglePlacesAutocomplete] Google Maps API key not configured')
        return
      }

      const script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`
      script.async = true
      script.defer = true
      script.onload = () => {
        setIsGoogleMapsLoaded(true)
      }
      script.onerror = () => {
        console.error('[GooglePlacesAutocomplete] Failed to load Google Maps script')
      }
      document.head.appendChild(script)
    }

    loadGoogleMaps()
  }, [])

  // Initialize Autocomplete
  useEffect(() => {
    if (!isGoogleMapsLoaded || !inputRef.current || !window.google?.maps?.places?.Autocomplete) {
      return
    }

    if (autocompleteRef.current) {
      // Already initialized
      return
    }

    let observer: MutationObserver | null = null

    try {
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'], // Restrict to addresses
        fields: [
          'address_components',
          'formatted_address',
          'geometry',
          'name',
          'place_id',
        ],
      })

      autocompleteRef.current = autocomplete

      // Aggressively fix z-index and click handling
      const applyStyles = () => {
        const pacContainers = document.querySelectorAll('.pac-container') as NodeListOf<HTMLElement>
        const hasDropdown = pacContainers.length > 0
        
        // Disable ALL overlays when dropdown is visible
        if (hasDropdown) {
          // Disable dialog overlays
          document.querySelectorAll('[data-slot="dialog-overlay"]').forEach((el: any) => {
            el.style.pointerEvents = 'none'
            el.style.zIndex = '1'
          })
          // Disable any other overlays
          document.querySelectorAll('[role="dialog"] > div:first-child').forEach((el: any) => {
            if (el.style.position === 'fixed' && el.style.inset === '0px') {
              el.style.pointerEvents = 'none'
            }
          })
        }
        
        pacContainers.forEach((pacContainer) => {
          // Force move to body
          if (pacContainer.parentElement !== document.body) {
            document.body.appendChild(pacContainer)
          }
          
          // Aggressive styling
          pacContainer.style.cssText = `
            z-index: 99999 !important;
            position: fixed !important;
            pointer-events: auto !important;
            cursor: default !important;
          `
          
          // Fix all items - use mousedown instead of click
          const items = pacContainer.querySelectorAll('.pac-item') as NodeListOf<HTMLElement>
          items.forEach((item, index) => {
            item.style.cssText = `
              pointer-events: auto !important;
              cursor: pointer !important;
              user-select: none !important;
            `
            
            // Remove all existing handlers
            const newItem = item.cloneNode(true) as HTMLElement
            item.parentNode?.replaceChild(newItem, item)
            
            // Add mousedown handler (fires before click, harder to block)
            newItem.addEventListener('mousedown', (e) => {
              e.stopPropagation()
              e.preventDefault()
              // Trigger the actual selection
              setTimeout(() => {
                newItem.click()
              }, 10)
            }, true)
          })
        })
      }

      // Apply styles immediately and repeatedly
      applyStyles()
      const styleInterval = setInterval(applyStyles, 100)

      // Watch for dropdown creation and updates
      observer = new MutationObserver(() => {
        applyStyles()
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      })

      // Cleanup interval
      return () => {
        clearInterval(styleInterval)
      }

      // Add global styles - aggressive overrides
      const styleId = 'google-places-autocomplete-styles'
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style')
        style.id = styleId
        style.textContent = `
          .pac-container {
            z-index: 99999 !important;
            position: fixed !important;
            pointer-events: auto !important;
            cursor: default !important;
            border-radius: 0.375rem;
            border: 1px solid hsl(var(--border));
            background-color: hsl(var(--popover));
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }
          .pac-item {
            padding: 0.5rem !important;
            cursor: pointer !important;
            pointer-events: auto !important;
            border-bottom: 1px solid hsl(var(--border));
            color: hsl(var(--foreground)) !important;
            user-select: none !important;
          }
          .pac-item:hover {
            background-color: hsl(var(--accent)) !important;
          }
          .pac-item-selected {
            background-color: hsl(var(--accent)) !important;
          }
          /* Force overlay to not block */
          [data-slot="dialog-overlay"] {
            pointer-events: none !important;
          }
          body:has(.pac-container) [data-slot="dialog-overlay"] {
            pointer-events: none !important;
          }
        `
        document.head.appendChild(style)
      }

      // Handle place selection
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()

        if (!place.geometry || !place.address_components) {
          return
        }

        // Parse address components
        const addressComponents: AddressComponents = {
          address_line1: '',
          address_line2: '',
          city: '',
          state: '',
          zip_code: '',
          country: '',
          coordinates: {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          },
        }

        // Parse address components
        place.address_components.forEach((component: any) => {
          const types = component.types

          if (types.includes('street_number')) {
            addressComponents.address_line1 = component.long_name + ' '
          } else if (types.includes('route')) {
            addressComponents.address_line1 = (addressComponents.address_line1 || '') + component.long_name
          } else if (types.includes('subpremise') || types.includes('premise')) {
            addressComponents.address_line2 = component.long_name
          } else if (types.includes('locality') || types.includes('postal_town')) {
            addressComponents.city = component.long_name
          } else if (types.includes('administrative_area_level_1')) {
            addressComponents.state = component.short_name // Use short name for state (e.g., "CA" instead of "California")
          } else if (types.includes('postal_code')) {
            addressComponents.zip_code = component.long_name
          } else if (types.includes('country')) {
            addressComponents.country = component.short_name
          }
        })

        // Update the input value
        onChange(place.formatted_address || value)

        // Call the callback with parsed address components
        if (onPlaceSelect) {
          onPlaceSelect(addressComponents)
        }
      })
    } catch (error) {
      console.error('[GooglePlacesAutocomplete] Error initializing autocomplete:', error)
    }

    // Cleanup
    let styleInterval: NodeJS.Timeout | null = null
    return () => {
      if (styleInterval) {
        clearInterval(styleInterval)
      }
      if (observer) {
        observer.disconnect()
      }
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners?.(autocompleteRef.current)
        autocompleteRef.current = null
      }
      // Restore dialog overlay pointer events
      const dialogOverlays = document.querySelectorAll('[data-slot="dialog-overlay"]') as NodeListOf<HTMLElement>
      dialogOverlays.forEach((overlay) => {
        overlay.style.pointerEvents = ''
      })
    }
  }, [isGoogleMapsLoaded, onChange, onPlaceSelect, value])

  // Ensure input is not disabled when Google Maps loads
  useEffect(() => {
    if (isGoogleMapsLoaded && inputRef.current && inputRef.current.disabled) {
      inputRef.current.disabled = false
    }
  }, [isGoogleMapsLoaded])

  return (
    <div className={className}>
      {label && (
        <Label htmlFor={id} className={required ? "after:content-['*'] after:ml-0.5 after:text-destructive" : ""}>
          {label}
        </Label>
      )}
      <Input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || !isGoogleMapsLoaded}
        className="mt-1"
        autoComplete="off"
      />
      {!isGoogleMapsLoaded && (
        <p className="text-xs text-muted-foreground mt-1">
          Loading address suggestions...
        </p>
      )}
    </div>
  )
}

