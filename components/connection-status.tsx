"use client"

import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export function ConnectionStatus() {
  const [status, setStatus] = useState<"checking" | "connected" | "error">("checking")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkConnection() {
      try {
        const response = await fetch("/api/health")
        const data = await response.json()

        if (data.status === "ok") {
          setStatus("connected")
          setError(null)
        } else {
          setStatus("error")
          setError(data.message || "Connection failed")
        }
      } catch (err: any) {
        setStatus("error")
        setError(err.message || "Failed to check connection")
      }
    }

    checkConnection()
    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000)
    return () => clearInterval(interval)
  }, [])

  if (status === "checking") {
    return (
      <Alert className="mb-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertTitle>Checking connection...</AlertTitle>
        <AlertDescription>Verifying database connection</AlertDescription>
      </Alert>
    )
  }

  if (status === "error") {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Connection Failed</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>{error || "Unable to connect to the database"}</p>
          <div className="flex flex-col gap-2 mt-2">
            <p className="text-sm font-medium">Troubleshooting steps:</p>
            <ol className="text-sm list-decimal list-inside space-y-1">
              <li>Check your internet connection</li>
              <li>Verify Supabase credentials in .env.local</li>
              <li>Ensure your Supabase project is active</li>
              <li>Check if Supabase service is operational</li>
            </ol>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="mt-2"
            >
              Retry Connection
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert className="mb-4 border-green-500/50 bg-green-500/10">
      <CheckCircle2 className="h-4 w-4 text-green-500" />
      <AlertTitle className="text-green-500">Connected</AlertTitle>
      <AlertDescription>Database connection is active</AlertDescription>
    </Alert>
  )
}














