"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import { Logo } from "@/components/logo"
import { createDemoAndSignIn } from "@/app/actions/demo-simple"
import { Loader2 } from "lucide-react"

function DemoSetupContent() {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    async function handleDemo() {
      try {
        const result = await createDemoAndSignIn()
        
        if (result.error) {
          // If there's a warning but demo was created, continue anyway
          if (result.warning) {
            console.warn("Demo setup warning:", result.warning)
            // Continue - company is created, data might populate later
          } else {
            setErrorMessage(result.error)
            setStatus("error")
            return
          }
        }

        // Sign in on client side to establish session
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: "demo@truckmates.com",
          password: "demo123456",
        })

        if (signInError || !signInData.user) {
          setErrorMessage(`Failed to sign in: ${signInError?.message || "Unknown error"}. Please try again.`)
          setStatus("error")
          return
        }

        // Verify session is established - wait for it
        let sessionEstablished = false
        for (let i = 0; i < 5; i++) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session && session.user) {
            sessionEstablished = true
            break
          }
          await new Promise(resolve => setTimeout(resolve, 500))
        }

        if (!sessionEstablished) {
          setErrorMessage("Session not established. Please try again.")
          setStatus("error")
          return
        }

        // Use window.location for full page reload to ensure session is recognized
        window.location.href = "/dashboard"
      } catch (error: any) {
        console.error("Demo setup error:", error)
        setErrorMessage(error?.message || "An unexpected error occurred. Please try again.")
        setStatus("error")
      }
    }

    handleDemo()
  }, [router])

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <Logo size="lg" />
          <div className="mt-8 p-6 bg-destructive/10 border border-destructive/20 rounded-lg">
            <h2 className="text-xl font-bold text-destructive mb-2">Demo Setup Failed</h2>
            <p className="text-sm text-muted-foreground mb-4">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-primary hover:underline"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <Logo size="lg" />
        <div className="mt-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Setting up your demo...</h2>
          <p className="text-sm text-muted-foreground">
            Creating your demo workspace. This will only take a moment.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function DemoSetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <DemoSetupContent />
    </Suspense>
  )
}
