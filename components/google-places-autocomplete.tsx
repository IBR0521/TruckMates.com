"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDebounce } from "@/lib/hooks/use-debounce"
import { assertPlacesUsageAllowedForSession, recordClientPlacesUsageForSession } from "@/app/actions/api-usage"
import { toast } from "sonner"

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

function parsePlaceToAddress(place: any): AddressComponents {
  const addressComponents: AddressComponents = {
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip_code: "",
    country: "",
    coordinates: place?.geometry?.location
      ? {
          lat: typeof place.geometry.location.lat === "function"
            ? place.geometry.location.lat()
            : place.geometry.location.lat,
          lng: typeof place.geometry.location.lng === "function"
            ? place.geometry.location.lng()
            : place.geometry.location.lng,
        }
      : undefined,
  }

  ;(place.address_components || []).forEach((component: any) => {
    const types: string[] = component.types || []
    if (types.includes("street_number")) {
      addressComponents.address_line1 = (addressComponents.address_line1 || "") + component.long_name + " "
    }
    if (types.includes("route")) {
      addressComponents.address_line1 = (addressComponents.address_line1 || "") + component.long_name
    }
    if (types.includes("subpremise")) addressComponents.address_line2 = component.long_name
    if (types.includes("premise") && !addressComponents.address_line2) {
      addressComponents.address_line2 = component.long_name
    }
    if (types.includes("postal_town") && !addressComponents.city) addressComponents.city = component.long_name
    if (types.includes("locality") && !addressComponents.city) addressComponents.city = component.long_name
    if (types.includes("administrative_area_level_2") && !addressComponents.city) {
      addressComponents.city = component.long_name
    }
    if (types.includes("neighborhood") && !addressComponents.city) addressComponents.city = component.long_name
    if (types.includes("administrative_area_level_1") && !addressComponents.state) {
      addressComponents.state = component.short_name
    }
    if (types.includes("postal_code") && !addressComponents.zip_code) {
      addressComponents.zip_code = component.long_name
    }
    if (types.includes("postal_code_prefix") && !addressComponents.zip_code) {
      addressComponents.zip_code = component.long_name
    }
    if (types.includes("country") && !addressComponents.country) {
      addressComponents.country = component.short_name
    }
  })

  const streetAddress =
    addressComponents.address_line1?.trim() || place.formatted_address || ""
  return { ...addressComponents, address_line1: streetAddress }
}

/** Loads Maps JS once when NEXT_PUBLIC key is missing (root layout script skipped). */
function ensureMapsLoaded(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places?.AutocompleteService) {
      resolve()
      return
    }
    const existing = document.querySelector(`script[src*="maps.googleapis.com"]`)
    if (existing) {
      const t = setInterval(() => {
        if (window.google?.maps?.places?.AutocompleteService) {
          clearInterval(t)
          resolve()
        }
      }, 50)
      setTimeout(() => {
        clearInterval(t)
        if (window.google?.maps?.places?.AutocompleteService) resolve()
        else reject(new Error("Maps load timeout"))
      }, 12000)
      return
    }

    let apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    const finish = (key: string) => {
      const script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&libraries=places`
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("Failed to load Google Maps"))
      document.head.appendChild(script)
    }

    if (apiKey) {
      finish(apiKey)
      return
    }
    fetch("/api/google-maps-key")
      .then((r) => r.json())
      .then((data) => {
        apiKey = data.apiKey
        if (!apiKey) reject(new Error("No API key"))
        else finish(apiKey as string)
      })
      .catch(reject)
  })
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
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [mapsReady, setMapsReady] = useState(false)
  const [predictions, setPredictions] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [loadingPredictions, setLoadingPredictions] = useState(false)
  const debouncedQuery = useDebounce(value, 300)

  useEffect(() => {
    let cancelled = false
    ensureMapsLoaded()
      .then(() => {
        if (!cancelled) setMapsReady(true)
      })
      .catch(() => {
        if (!cancelled) setMapsReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const runPredictions = useCallback(
    async (q: string) => {
      if (!mapsReady || q.trim().length < 3) {
        setPredictions([])
        setOpen(false)
        return
      }
      setLoadingPredictions(true)
      try {
        const gate = await assertPlacesUsageAllowedForSession("autocomplete")
        if (!gate.allowed) {
          setLoadingPredictions(false)
          toast.error(gate.reason || "Monthly Places API limit reached for your plan.")
          setPredictions([])
          setOpen(false)
          return
        }
        const svc = new window.google.maps.places.AutocompleteService()
        svc.getPlacePredictions({ input: q, types: ["address"] }, (res: any[] | null, status: string) => {
          setLoadingPredictions(false)
          const ok = status === window.google.maps.places.PlacesServiceStatus?.OK || status === "OK"
          if (!ok || !res?.length) {
            setPredictions([])
            setOpen(false)
            return
          }
          setPredictions(res)
          setOpen(true)
        })
      } catch {
        setLoadingPredictions(false)
        setPredictions([])
        setOpen(false)
      }
    },
    [mapsReady],
  )

  useEffect(() => {
    void runPredictions(debouncedQuery)
  }, [debouncedQuery, runPredictions])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  const selectPrediction = (prediction: any) => {
    if (!window.google?.maps?.places) return
    void (async () => {
      const gate = await assertPlacesUsageAllowedForSession("details")
      if (!gate.allowed) {
        toast.error(gate.reason || "Monthly Places API limit reached for your plan.")
        return
      }
      const dummy = document.createElement("div")
      const svc = new window.google.maps.places.PlacesService(dummy)
      svc.getDetails(
        {
          placeId: prediction.place_id,
          fields: ["address_components", "formatted_address", "geometry", "name", "place_id"],
        },
        (place: any, status: string) => {
          const ok = status === window.google.maps.places.PlacesServiceStatus?.OK || status === "OK"
          if (!ok || !place) return
          void recordClientPlacesUsageForSession("details").then((rec) => {
            if (!rec.allowed && rec.reason) {
              toast.error(rec.reason)
            }
          })
          const parsed = parsePlaceToAddress(place)
          const street = parsed.address_line1?.trim() || place.formatted_address || value
          if (onPlaceSelect) {
            setTimeout(() => onPlaceSelect(parsed), 0)
          }
          onChange(street)
          setOpen(false)
          setPredictions([])
        },
      )
    })()
  }

  return (
    <div className={className} ref={wrapperRef}>
      {label && (
        <Label htmlFor={id} className={required ? "after:content-['*'] after:ml-0.5 after:text-destructive" : ""}>
          {label}
        </Label>
      )}
      <div className="relative">
        <Input
          id={id}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled || !mapsReady}
          className="mt-1"
          autoComplete="off"
        />
        {open && predictions.length > 0 && (
          <ul
            className="absolute z-[9999] mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md"
            role="listbox"
          >
            {predictions.map((p) => (
              <li key={p.place_id}>
                <button
                  type="button"
                  className="w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-accent"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectPrediction(p)}
                >
                  {p.description}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!mapsReady && (
        <p className="text-xs text-muted-foreground mt-1">Loading address suggestions…</p>
      )}
      {mapsReady && loadingPredictions && value.trim().length >= 3 && (
        <p className="text-xs text-muted-foreground mt-1">Searching…</p>
      )}
    </div>
  )
}
