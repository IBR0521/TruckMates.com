import { ENV } from "../config/env"

const REQUEST_TIMEOUT_MS = 12000

export async function apiRequest<T>(
  path: string,
  token: string,
  method: "GET" | "POST" = "GET",
  body?: unknown
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${ENV.apiUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`Request timeout after ${Math.round(REQUEST_TIMEOUT_MS / 1000)}s for ${path}`)
    }
    throw e
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = (await res.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      // Keep fallback message for non-JSON errors.
    }
    throw new Error(message)
  }

  return (await res.json()) as T
}
