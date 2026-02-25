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
    return () => {
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners?.(autocompleteRef.current)
        autocompleteRef.current = null
      }
    }
  }, [isGoogleMapsLoaded, onChange, onPlaceSelect, value])

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

