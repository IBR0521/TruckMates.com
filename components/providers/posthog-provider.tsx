"use client"

import { useEffect } from "react"
import type React from "react"
import { PostHogProvider as PHProvider } from "posthog-js/react"
import { getPostHogBrowserClient, initPostHogBrowser } from "@/lib/analytics/posthog"

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initPostHogBrowser()
  }, [])

  return <PHProvider client={getPostHogBrowserClient() as any}>{children}</PHProvider>
}

