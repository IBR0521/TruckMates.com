"use client"

import { useEffect, useState } from "react"
import type React from "react"
import { PostHogProvider as PHProvider } from "posthog-js/react"
import type { PostHog } from "posthog-js"
import { getPostHogBrowserClient, initPostHogBrowser } from "@/lib/analytics/posthog"

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<PostHog | null>(null)

  useEffect(() => {
    const key = String(process.env.NEXT_PUBLIC_POSTHOG_KEY || "").trim()
    if (!key) return
    void (async () => {
      await initPostHogBrowser()
      setClient(getPostHogBrowserClient())
    })()
  }, [])

  if (!client) return <>{children}</>
  return <PHProvider client={client}>{children}</PHProvider>
}

