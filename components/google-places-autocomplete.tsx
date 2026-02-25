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

  // Load Google Maps Places API (New) with PlaceAutocompleteElement
  useEffect(() => {
    // Check if already loaded
    if (window.google?.maps?.places?.PlaceAutocompleteElement) {
      setIsGoogleMapsLoaded(true)
      return
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)
    if (existingScript) {
      // Wait for it to load
      const checkInterval = setInterval(() => {
        if (window.google?.maps?.places?.PlaceAutocompleteElement) {
          clearInterval(checkInterval)
          setIsGoogleMapsLoaded(true)
        }
      }, 100)
      setTimeout(() => clearInterval(checkInterval), 10000)
      return
    }

    // Load Google Maps script with new Places API
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

      // Load the new Places API (New) library
      const script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&libraries=places&v=beta`
      script.async = true
      script.defer = true
      script.onload = () => {
        // Wait for PlaceAutocompleteElement to be available
        const checkElement = setInterval(() => {
          if (window.google?.maps?.places?.PlaceAutocompleteElement) {
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

  // Initialize PlaceAutocompleteElement
  useEffect(() => {
    if (!isGoogleMapsLoaded || !inputRef.current || !window.google?.maps?.places?.PlaceAutocompleteElement) {
      return
    }

    if (autocompleteElementRef.current) {
      // Already initialized
      return
    }

    try {
      // Create the PlaceAutocompleteElement web component
      const autocompleteElement = new window.google.maps.places.PlaceAutocompleteElement({
        requestedResultTypes: ['street_address', 'route'],
        requestedFields: [
          'address_components',
          'formatted_address',
          'geometry',
          'name',
          'place_id',
        ],
      })

      // Set up the element
      autocompleteElement.id = id || 'place-autocomplete'
      
      // Hide the default input and use our styled input instead
      const defaultInput = autocompleteElement.querySelector('input')
      if (defaultInput) {
        defaultInput.style.display = 'none'
      }

      // Insert our styled input into the autocomplete element
      if (inputRef.current && wrapperRef.current) {
        // Clone our input and sync it with the autocomplete
        const ourInput = inputRef.current
        
        // Sync our input value to autocomplete
        ourInput.addEventListener('input', (e) => {
          const target = e.target as HTMLInputElement
          const autocompleteInput = autocompleteElement.querySelector('input') as HTMLInputElement
          if (autocompleteInput) {
            autocompleteInput.value = target.value
            autocompleteInput.dispatchEvent(new Event('input', { bubbles: true }))
          }
        })

        // Listen for place selection
        autocompleteElement.addEventListener('gmp-placeselect', (event: any) => {
          const place = event.detail.place
          
          console.log('[GooglePlacesAutocomplete] Place selected:', place)
          console.log('[GooglePlacesAutocomplete] Address components:', place.addressComponents)

          if (!place.geometry) {
            console.warn('[GooglePlacesAutocomplete] Place has no geometry')
            return
          }

          if (!place.addressComponents || place.addressComponents.length === 0) {
            console.warn('[GooglePlacesAutocomplete] Place has no addressComponents')
            if (place.formattedAddress) {
              onChange(place.formattedAddress)
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

          // Parse address components
          place.addressComponents.forEach((component: any) => {
            const types = component.types
            console.log('[GooglePlacesAutocomplete] Processing component:', component.longText, 'types:', types)

            // Street number
            if (types.includes('street_number')) {
              addressComponents.address_line1 = (addressComponents.address_line1 || '') + component.longText + ' '
            }
            // Street name
            if (types.includes('route')) {
              addressComponents.address_line1 = (addressComponents.address_line1 || '') + component.longText
            }
            // Apartment, suite, etc.
            if (types.includes('subpremise')) {
              addressComponents.address_line2 = component.longText
            }
            // Building name
            if (types.includes('premise') && !addressComponents.address_line2) {
              addressComponents.address_line2 = component.longText
            }
            // City
            if (types.includes('locality')) {
              addressComponents.city = component.longText
            }
            // Postal town
            if (types.includes('postal_town') && !addressComponents.city) {
              addressComponents.city = component.longText
            }
            // Neighborhood as fallback
            if (types.includes('neighborhood') && !addressComponents.city) {
              addressComponents.city = component.longText
            }
            // State/Province
            if (types.includes('administrative_area_level_1')) {
              addressComponents.state = component.shortText || component.longText
            }
            // ZIP/Postal code
            if (types.includes('postal_code')) {
              addressComponents.zip_code = component.longText
            }
            // Country
            if (types.includes('country')) {
              addressComponents.country = component.shortText || component.longText
            }
          })

          // If address_line1 is still empty, try to extract from formatted_address
          if (!addressComponents.address_line1 && place.formattedAddress) {
            const parts = place.formattedAddress.split(',')
            if (parts.length > 0) {
              addressComponents.address_line1 = parts[0].trim()
            }
          }

          const streetAddress = addressComponents.address_line1?.trim() || place.formattedAddress || value

          console.log('[GooglePlacesAutocomplete] Parsed address components:', addressComponents)
          console.log('[GooglePlacesAutocomplete] Street address:', streetAddress)

          // Call onPlaceSelect FIRST
          if (onPlaceSelect) {
            console.log('[GooglePlacesAutocomplete] Calling onPlaceSelect with:', addressComponents)
            setTimeout(() => {
              onPlaceSelect(addressComponents)
            }, 0)
          }

          // Update the input value
          onChange(streetAddress)
        })

        // Append autocomplete element to wrapper
        if (wrapperRef.current) {
          wrapperRef.current.appendChild(autocompleteElement)
        }
      }

      autocompleteElementRef.current = autocompleteElement
    } catch (error) {
      console.error('[GooglePlacesAutocomplete] Error initializing PlaceAutocompleteElement:', error)
      // Fallback to old API if new one fails
      console.warn('[GooglePlacesAutocomplete] Falling back to deprecated Autocomplete API')
      // You could implement fallback here if needed
    }

    // Cleanup
    return () => {
      if (autocompleteElementRef.current) {
        try {
          autocompleteElementRef.current.remove()
        } catch (e) {
          // Ignore cleanup errors
        }
        autocompleteElementRef.current = null
      }
    }
  }, [isGoogleMapsLoaded, onChange, onPlaceSelect, value, id])

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
