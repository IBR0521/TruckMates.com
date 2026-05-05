const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com"

let browserInitialized = false

export function getPostHogBrowserClient() {
  if (typeof window === "undefined") return null
  return (window as typeof window & { posthog?: unknown }).posthog ?? null
}

export async function initPostHogBrowser() {
  if (typeof window === "undefined" || browserInitialized) return
  const key = String(process.env.NEXT_PUBLIC_POSTHOG_KEY || "").trim()
  if (!key) return

  const host = String(process.env.NEXT_PUBLIC_POSTHOG_HOST || "").trim() || DEFAULT_POSTHOG_HOST
  const { default: posthog } = await import("posthog-js")
  posthog.init(key, {
    api_host: host,
    capture_pageview: false,
    persistence: "localStorage+cookie",
  })
  browserInitialized = true
}

