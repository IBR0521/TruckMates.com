"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

// Dynamically import Logo to prevent SSR issues
const Logo = dynamic(() => import("@/components/logo").then(mod => ({ default: mod.Logo })), {
  ssr: false,
  loading: () => <div className="h-16 w-48 bg-muted animate-pulse rounded" />
})

// Dynamically import the server action to prevent evaluation during SSR
const createDemoAndSignIn = dynamic(
  () => import("@/app/actions/demo-simple").then(mod => ({ default: mod.createDemoAndSignIn })),
  { ssr: false }
)

function DemoSetupContent() {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    async function handleDemo() {
      try {
        // Dynamically import the action function
        const { createDemoAndSignIn: createDemo } = await import("@/app/actions/demo-simple")
        const result = await createDemo()
        
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
        
        // BUG-068 FIX: Use environment variables instead of hardcoded credentials
        const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL || "demo@truckmates.com"
        const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD || "demo123456"
        
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: demoPassword,
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
  }, [router, mounted])

  if (status === "error") {
    const isProduction = typeof window !== 'undefined' && 
                         !window.location.hostname.includes('localhost') &&
                         !window.location.hostname.includes('127.0.0.1')
    const isConfigError = errorMessage.toLowerCase().includes('supabase configuration') || 
                         errorMessage.toLowerCase().includes('missing')

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <Logo size="lg" />
          <div className="mt-8 p-6 bg-destructive/10 border border-destructive/20 rounded-lg">
            <h2 className="text-xl font-bold text-destructive mb-2">Demo Setup Failed</h2>
            <p className="text-sm text-muted-foreground mb-4">{errorMessage}</p>
            
            {isConfigError && isProduction && (
              <div className="mt-4 p-4 bg-secondary/50 rounded-lg text-left">
                <p className="text-sm font-semibold mb-2">To fix this issue:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside mb-3">
                  <li>Go to Vercel Dashboard → Your Project</li>
                  <li>Settings → Environment Variables</li>
                  <li>Add <code className="bg-background px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code></li>
                  <li>Add <code className="bg-background px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
                  <li>Select <strong>Production</strong> environment</li>
                  <li>Redeploy your application</li>
                </ol>
                <a
                  href="/diagnostics"
                  className="text-xs text-primary hover:underline"
                >
                  Check connection status →
                </a>
              </div>
            )}
            
            <div className="flex gap-2 justify-center mt-4">
              <button
                onClick={() => window.location.reload()}
                className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition"
              >
                Try Again
              </button>
              <a
                href="/"
                className="text-sm px-4 py-2 border border-border rounded-md hover:bg-secondary transition"
              >
                Go Home
              </a>
            </div>
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
