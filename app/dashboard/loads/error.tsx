"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertCircle, RefreshCw } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Loads page error:", error)
  }, [error])

  return (
    <div className="w-full min-h-screen flex items-center justify-center p-8">
      <Card className="max-w-md w-full p-8 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Something went wrong!</h2>
        <p className="text-muted-foreground mb-6">
          {error.message || "An unexpected error occurred while loading loads."}
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} className="bg-primary hover:bg-primary/90">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try again
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/dashboard")}
          >
            Go to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  )
}

