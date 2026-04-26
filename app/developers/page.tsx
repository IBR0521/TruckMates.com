"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import Link from "next/link"

export default function DevelopersPage() {
  const [spec, setSpec] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/v1/openapi")
        const json = await response.json()
        if (!response.ok) {
          setError(json?.error || "Failed to load OpenAPI spec")
          return
        }
        setSpec(json)
      } catch {
        setError("Failed to load OpenAPI spec")
      }
    })()
  }, [])

  return (
    <div className="w-full p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Developers</h1>
        <p className="text-muted-foreground mt-2">Public versioned API documentation for TruckMates integrations.</p>
      </div>

      <Card className="p-4">
        <h2 className="font-semibold mb-2">Base URL</h2>
        <code>/api/v1</code>
        <p className="text-sm text-muted-foreground mt-2">
          Authenticate with `x-api-key` header using an Enterprise API key from{" "}
          <Link href="/dashboard/settings/api-keys" className="text-primary underline">
            Settings → API Keys
          </Link>
          .
        </p>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-2">OpenAPI 3.0 Spec</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Endpoint: <code>/api/v1/openapi</code>
        </p>
        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : !spec ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <pre className="max-h-[600px] overflow-auto rounded bg-muted p-3 text-xs">
            {JSON.stringify(spec, null, 2)}
          </pre>
        )}
      </Card>
    </div>
  )
}
