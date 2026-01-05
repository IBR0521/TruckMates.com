"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertCircle, RefreshCw, Home } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Global application error:", error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div className="w-full min-h-screen flex items-center justify-center p-8 bg-background">
          <Card className="max-w-md w-full p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Something went wrong!</h2>
            <p className="text-muted-foreground mb-6">
              {error.message || "An unexpected error occurred in the application."}
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground mb-4">Error ID: {error.digest}</p>
            )}
            <div className="flex gap-3 justify-center">
              <Button onClick={reset} className="bg-primary hover:bg-primary/90">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try again
              </Button>
              <Button
                variant="outline"
                onClick={() => (window.location.href = "/")}
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </div>
          </Card>
        </div>
      </body>
    </html>
  )
}






