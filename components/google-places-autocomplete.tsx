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
  const wrapperRef = useRef<HTMLDivElement>(null)
  const autocompleteElementRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false)

  // Load Google Maps Places API with PlaceAutocompleteElement support
  useEffect(() => {
    // Check if already loaded (check for both old and new APIs)
    if (window.google?.maps?.places?.Autocomplete || customElements.get('gmp-place-autocomplete')) {
      setIsGoogleMapsLoaded(true)
      return
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)
    if (existingScript) {
      // Wait for it to load
      const checkInterval = setInterval(() => {
        if (window.google?.maps?.places?.Autocomplete || customElements.get('gmp-place-autocomplete')) {
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

      // Try loading with new Places API first, fallback to old if needed
      const script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&libraries=places`
      script.async = true
      script.defer = true
      script.onload = () => {
        // Check for either API
        const checkElement = setInterval(() => {
          if (window.google?.maps?.places?.Autocomplete || customElements.get('gmp-place-autocomplete')) {
            clearInterval(checkElement)
            setIsGoogleMapsLoaded(true)
          }
        }, 100)
        setTimeout(() => clearInterval(checkElement), 10000)
      }
      script.onerror = () => {
        console.error('[GooglePlacesAutocomplete] Failed to load Google Maps script')
      }
      document.head.appendChild(script)
    }

    loadGoogleMaps()
  }, [])

  // Initialize Autocomplete (using old API for now - new API may not be fully available)
  useEffect(() => {
    if (!isGoogleMapsLoaded || !inputRef.current || !window.google?.maps?.places?.Autocomplete) {
      return
    }

    if (autocompleteElementRef.current) {
      // Already initialized
      return
    }

    let observer: MutationObserver | null = null
    let debounceTimeout: NodeJS.Timeout | null = null

    try {
      // Use the old Autocomplete API (it still works, just deprecated)
      // The deprecation notice says it will continue to work for at least 12 months
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        fields: [
          'address_components',
          'formatted_address',
          'geometry',
          'name',
          'place_id',
        ],
      })

      autocompleteElementRef.current = autocomplete

      // Fix z-index and click handling for the dropdown
      const fixedItems = new WeakSet<HTMLElement>()
      
      const applyStyles = () => {
        const pacContainers = document.querySelectorAll('.pac-container') as NodeListOf<HTMLElement>
        
        pacContainers.forEach((pacContainer) => {
          // Move to body if needed
          if (pacContainer.parentElement !== document.body) {
            document.body.appendChild(pacContainer)
          }
          
          // Apply container styles
          if (!pacContainer.dataset.styled) {
            pacContainer.style.cssText = `
              z-index: 99999 !important;
              position: fixed !important;
              pointer-events: auto !important;
              cursor: default !important;
              background-color: white !important;
              border-radius: 0.375rem;
              border: 1px solid hsl(var(--border));
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            `
            pacContainer.dataset.styled = 'true'
          }
          
          // Fix items - only process new ones
          const items = pacContainer.querySelectorAll('.pac-item') as NodeListOf<HTMLElement>
          items.forEach((item) => {
            if (fixedItems.has(item)) return
            
            item.style.cssText = `
              padding: 0.5rem !important;
              cursor: pointer !important;
              pointer-events: auto !important;
              border-bottom: 1px solid #e5e7eb !important;
              color: #111827 !important;
              background-color: white !important;
              user-select: none !important;
            `
            
            // Prevent clicks from closing dialog - stop all event propagation
            const stopEvents = (e: Event) => {
              e.stopPropagation()
              e.stopImmediatePropagation()
            }
            
            item.addEventListener('mousedown', stopEvents, { capture: true })
            item.addEventListener('click', stopEvents, { capture: true })
            item.addEventListener('mouseup', stopEvents, { capture: true })
            
            fixedItems.add(item)
          })
        })
        
        // Disable dialog overlay when dropdown is visible
        const hasDropdown = pacContainers.length > 0 && 
          Array.from(pacContainers).some(c => c.offsetParent !== null && c.style.display !== 'none')
        
        if (hasDropdown) {
          document.querySelectorAll('[data-slot="dialog-overlay"]').forEach((el: any) => {
            el.style.pointerEvents = 'none'
          })
        } else {
          document.querySelectorAll('[data-slot="dialog-overlay"]').forEach((el: any) => {
            el.style.pointerEvents = ''
          })
        }
      }

      // Apply styles immediately
      applyStyles()

      // Watch for dropdown creation
      observer = new MutationObserver(() => {
        if (debounceTimeout) clearTimeout(debounceTimeout)
        debounceTimeout = setTimeout(() => {
          applyStyles()
        }, 50)
      })

      observer.observe(document.body, {
        childList: true,
        subtree: false,
      })

      // Add global styles
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
            background-color: white !important;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }
          .pac-item {
            padding: 0.5rem !important;
            cursor: pointer !important;
            pointer-events: auto !important;
            border-bottom: 1px solid #e5e7eb !important;
            color: #111827 !important;
            background-color: white !important;
            user-select: none !important;
          }
          .pac-item:hover {
            background-color: #f3f4f6 !important;
          }
          .pac-item-selected {
            background-color: #e5e7eb !important;
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
        
        console.log('[GooglePlacesAutocomplete] Place selected:', place)
        console.log('[GooglePlacesAutocomplete] Address components:', place.address_components)

        if (!place.geometry) {
          console.warn('[GooglePlacesAutocomplete] Place has no geometry')
          return
        }
        
        if (!place.address_components || place.address_components.length === 0) {
          console.warn('[GooglePlacesAutocomplete] Place has no address_components')
          if (place.formatted_address) {
            onChange(place.formatted_address)
          }
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

        // Parse address components - iterate through all components
        place.address_components.forEach((component: any) => {
          const types = component.types
          console.log('[GooglePlacesAutocomplete] Processing component:', component.long_name, 'types:', types)

          // Street number (e.g., "123")
          if (types.includes('street_number')) {
            addressComponents.address_line1 = (addressComponents.address_line1 || '') + component.long_name + ' '
          }
          // Street name (e.g., "Main Street")
          if (types.includes('route')) {
            addressComponents.address_line1 = (addressComponents.address_line1 || '') + component.long_name
          }
          // Apartment, suite, etc.
          if (types.includes('subpremise')) {
            addressComponents.address_line2 = component.long_name
          }
          // Building name
          if (types.includes('premise') && !addressComponents.address_line2) {
            addressComponents.address_line2 = component.long_name
          }
          // City - check multiple types
          if (types.includes('locality')) {
            addressComponents.city = component.long_name
          }
          // Postal town (used in some countries instead of locality)
          if (types.includes('postal_town') && !addressComponents.city) {
            addressComponents.city = component.long_name
          }
          // Neighborhood as fallback for city
          if (types.includes('neighborhood') && !addressComponents.city) {
            addressComponents.city = component.long_name
          }
          // State/Province
          if (types.includes('administrative_area_level_1')) {
            addressComponents.state = component.short_name // Use short name (e.g., "CA" instead of "California")
          }
          // ZIP/Postal code
          if (types.includes('postal_code')) {
            addressComponents.zip_code = component.long_name
          }
          // Country
          if (types.includes('country')) {
            addressComponents.country = component.short_name
          }
        })
        
        // If address_line1 is still empty, try to extract from formatted_address
        if (!addressComponents.address_line1 && place.formatted_address) {
          const parts = place.formatted_address.split(',')
          if (parts.length > 0) {
            addressComponents.address_line1 = parts[0].trim()
          }
        }

        // Use the parsed street address for address_line1, fallback to formatted if parsing failed
        const streetAddress = addressComponents.address_line1?.trim() || place.formatted_address || value

        console.log('[GooglePlacesAutocomplete] Parsed address components:', addressComponents)
        console.log('[GooglePlacesAutocomplete] Street address:', streetAddress)

        // IMPORTANT: Call onPlaceSelect FIRST before onChange
        // This ensures all fields are filled before the input value changes
        if (onPlaceSelect) {
          console.log('[GooglePlacesAutocomplete] Calling onPlaceSelect with:', addressComponents)
          // Use setTimeout to ensure state updates happen
          setTimeout(() => {
            onPlaceSelect(addressComponents)
          }, 0)
        } else {
          console.warn('[GooglePlacesAutocomplete] onPlaceSelect callback not provided')
        }

        // Update the input value with just the street address (not the full formatted address)
        onChange(streetAddress)
      })
    } catch (error) {
      console.error('[GooglePlacesAutocomplete] Error initializing autocomplete:', error)
    }

    // Cleanup
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout)
      }
      if (observer) {
        observer.disconnect()
      }
      if (autocompleteElementRef.current) {
        window.google?.maps?.event?.clearInstanceListeners?.(autocompleteElementRef.current)
        autocompleteElementRef.current = null
      }
      // Restore dialog overlay pointer events
      document.querySelectorAll('[data-slot="dialog-overlay"]').forEach((overlay: any) => {
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
      <div ref={wrapperRef} className="relative">
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
      </div>
      {!isGoogleMapsLoaded && (
        <p className="text-xs text-muted-foreground mt-1">
          Loading address suggestions...
        </p>
      )}
    </div>
  )
}
