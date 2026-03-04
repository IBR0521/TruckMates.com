"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AddressComponents {
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
  coordinates?: { lat: number; lng: number }
}

interface MapboxAddressAutocompleteProps {
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

interface MapboxFeature {
  id: string
  type: string
  place_type: string[]
  relevance: number
  properties: {
    accuracy?: string
    [key: string]: any
  }
  text: string
  place_name: string
  center: [number, number] // [lng, lat]
  geometry: {
    type: string
    coordinates: [number, number] // [lng, lat]
  }
  context?: Array<{
    id: string
    text: string
    short_code?: string
    [key: string]: any
  }>
}

export function MapboxAddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Enter address...",
  label,
  required = false,
  className = "",
  id,
  disabled = false,
}: MapboxAddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Get Mapbox API key
  const getMapboxApiKey = useCallback(async (): Promise<string | null> => {
    // Check environment variable first
    let apiKey = process.env.NEXT_PUBLIC_MAPBOX_API_KEY

    if (!apiKey) {
      // Try to fetch from API route (server-side key)
      try {
        const response = await fetch('/api/mapbox-key')
        if (response.ok) {
          const data = await response.json()
          apiKey = data.apiKey
        }
      } catch (error) {
        console.error('[MapboxAddressAutocomplete] Failed to fetch API key:', error)
      }
    }

    return apiKey || null
  }, [])

  // Fetch suggestions from Mapbox Geocoding API
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    const apiKey = await getMapboxApiKey()
    if (!apiKey) {
      console.warn('[MapboxAddressAutocomplete] Mapbox API key not configured')
      setSuggestions([])
      setShowDropdown(false)
      return
    }

    setIsLoading(true)

    try {
      // Mapbox Geocoding API endpoint
      // Limit to address types and set proximity to improve results
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${apiKey}` +
        `&types=address,poi,postcode,place` +
        `&autocomplete=true` +
        `&limit=5` +
        `&language=en`

      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`Mapbox API error: ${response.status}`)
      }

      const data = await response.json()
      setSuggestions(data.features || [])
      setShowDropdown(data.features && data.features.length > 0)
      setSelectedIndex(-1)
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Request was cancelled, ignore
        return
      }
      console.error('[MapboxAddressAutocomplete] Error fetching suggestions:', error)
      setSuggestions([])
      setShowDropdown(false)
    } finally {
      setIsLoading(false)
    }
  }, [getMapboxApiKey])

  // Debounced search
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    if (value && !disabled) {
      debounceTimeoutRef.current = setTimeout(() => {
        fetchSuggestions(value)
      }, 300) // 300ms debounce
    } else {
      setSuggestions([])
      setShowDropdown(false)
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [value, disabled, fetchSuggestions])

  // Parse Mapbox feature to AddressComponents
  const parseMapboxFeature = useCallback((feature: MapboxFeature): AddressComponents => {
    const components: AddressComponents = {
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      zip_code: '',
      country: '',
      coordinates: {
        lat: feature.center[1],
        lng: feature.center[0],
      },
    }

    // Parse context array (Mapbox provides structured address components)
    if (feature.context) {
      feature.context.forEach((ctx) => {
        const ctxId = ctx.id

        // Extract components from context IDs
        // Mapbox context IDs: country, region, postcode, district, place, locality, neighborhood, address
        if (ctxId.startsWith('country')) {
          components.country = ctx.short_code || ctx.text
        } else if (ctxId.startsWith('region')) {
          // State/Province
          components.state = ctx.short_code || ctx.text
        } else if (ctxId.startsWith('postcode')) {
          components.zip_code = ctx.text
        } else if (ctxId.startsWith('place') || ctxId.startsWith('locality')) {
          // City
          if (!components.city) {
            components.city = ctx.text
          }
        } else if (ctxId.startsWith('district')) {
          // District/County (sometimes used for city in some regions)
          if (!components.city) {
            components.city = ctx.text
          }
        }
      })
    }

    // Extract address line 1 from place_name
    // Mapbox format: "Street Address, City, State ZIP, Country"
    const placeParts = feature.place_name.split(',').map(p => p.trim())
    
    if (placeParts.length > 0) {
      // First part is usually the street address
      components.address_line1 = placeParts[0]
    }

    // Fallback: Try to extract from place_name if context didn't provide it
    if (!components.city && placeParts.length >= 2) {
      // City is usually second-to-last or third-to-last
      const cityCandidate = placeParts[placeParts.length - 2] || placeParts[placeParts.length - 3]
      if (cityCandidate && !/^\d+/.test(cityCandidate)) {
        // Check if it's not a zip code (starts with number)
        components.city = cityCandidate
      }
    }

    if (!components.zip_code && placeParts.length >= 2) {
      // Extract zip from place_name
      const zipMatch = feature.place_name.match(/\b(\d{5}(?:-\d{4})?|[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b/i)
      if (zipMatch) {
        components.zip_code = zipMatch[1].toUpperCase()
      }
    }

    if (!components.state && placeParts.length >= 2) {
      // Extract state abbreviation
      const stateMatch = feature.place_name.match(/\b([A-Z]{2,3})\b/)
      if (stateMatch && !/\d/.test(stateMatch[1])) {
        components.state = stateMatch[1]
      }
    }

    // Use feature text as address_line1 if we don't have it
    if (!components.address_line1 && feature.text) {
      components.address_line1 = feature.text
    }

    console.log('[MapboxAddressAutocomplete] Parsed address:', components)
    return components
  }, [])

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback((feature: MapboxFeature) => {
    const parsed = parseMapboxFeature(feature)
    
    // Update input value
    onChange(parsed.address_line1 || feature.place_name)

    // Call onPlaceSelect callback
    if (onPlaceSelect) {
      onPlaceSelect(parsed)
    }

    // Close dropdown
    setShowDropdown(false)
    setSuggestions([])
    inputRef.current?.blur()
  }, [onChange, onPlaceSelect, parseMapboxFeature])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        setShowDropdown(false)
        setSuggestions([])
        inputRef.current?.blur()
        break
    }
  }, [showDropdown, suggestions, selectedIndex, handleSelectSuggestion])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowDropdown(true)
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="mt-1"
          autoComplete="off"
        />
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {/* Dropdown suggestions */}
        {showDropdown && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md"
            style={{ maxHeight: '300px', overflowY: 'auto' }}
          >
            {suggestions.map((feature, index) => (
              <div
                key={feature.id}
                onClick={() => handleSelectSuggestion(feature)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`cursor-pointer px-4 py-2 text-sm transition-colors ${
                  index === selectedIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <div className="font-medium">{feature.text}</div>
                <div className="text-xs text-muted-foreground">{feature.place_name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {!process.env.NEXT_PUBLIC_MAPBOX_API_KEY && (
        <p className="text-xs text-muted-foreground mt-1">
          Mapbox API key not configured. Set NEXT_PUBLIC_MAPBOX_API_KEY environment variable.
        </p>
      )}
    </div>
  )
}

