"use client"

import Script from "next/script"

/**
 * One Maps JS bootstrap per session (strategy: load once, reuse across navigations).
 * Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. When unset, feature components fall back to fetching a key.
 */
export function GoogleMapsRootScript() {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) return null

  return (
    <Script
      id="google-maps-js-root"
      strategy="beforeInteractive"
      src={`https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,drawing&loading=async`}
    />
  )
}
