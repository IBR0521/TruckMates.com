import { PostHog } from "posthog-node"

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com"

let serverClient: PostHog | null = null

export function getPostHogServerClient(): PostHog | null {
  if (typeof window !== "undefined") return null
  if (serverClient) return serverClient

  const key = String(process.env.NEXT_PUBLIC_POSTHOG_KEY || "").trim()
  if (!key) return null

  const host = String(process.env.NEXT_PUBLIC_POSTHOG_HOST || "").trim() || DEFAULT_POSTHOG_HOST
  serverClient = new PostHog(key, { host })
  return serverClient
}

export async function capturePostHogServerEvent(
  distinctId: string,
  event: "load_created" | "invoice_sent" | "ifta_report_generated" | "driver_added" | "plan_upgraded",
  properties?: Record<string, unknown>
): Promise<void> {
  const client = getPostHogServerClient()
  if (!client) return
  try {
    client.capture({
      distinctId,
      event,
      properties,
    })
  } catch {
    // Keep analytics non-blocking
  }
}

