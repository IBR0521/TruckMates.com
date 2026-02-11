"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import { Logo } from "@/components/logo"
import { setupDemoCompany } from "@/app/actions/demo"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

const DEMO_EMAIL = "demo@truckmates.com"
const DEMO_PASSWORD = "demo123456"

function DemoSetupContent() {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState("")
  const supabase = createClient()

  useEffect(() => {
    async function handleDemo() {
      try {
        // Helper function to retry with exponential backoff
        const retryOperation = async <T>(
          operation: () => Promise<T>,
          maxRetries: number = 3,
          delay: number = 1000
        ): Promise<T> => {
          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              return await operation()
            } catch (error: any) {
              const isRetryable = error?.message?.includes('Database server error') || 
                                 error?.message?.includes('timeout') ||
                                 error?.message?.includes('ECONNREFUSED') ||
                                 error?.code === 'ECONNRESET'
              
              if (attempt === maxRetries - 1 || !isRetryable) {
                throw error
              }
              
              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)))
            }
          }
          throw new Error('Max retries exceeded')
        }
        
        // Try to sign in first (demo user might already exist)
        let signInResult = await retryOperation(
          () => supabase.auth.signInWithPassword({
            email: DEMO_EMAIL,
            password: DEMO_PASSWORD,
          }),
          2, // Only 2 retries for sign-in (user might not exist)
          500
        ).catch((error) => ({ error, data: null }))

        let userId: string | null = null
        let isNewUser = false

        // If sign-in fails, create the user
        if (signInResult.error) {
          console.log("Sign-in failed, creating new demo user:", signInResult.error.message)
          
          try {
            const signUpResult = await retryOperation(
              () => supabase.auth.signUp({
                email: DEMO_EMAIL,
                password: DEMO_PASSWORD,
                options: {
                  emailRedirectTo: undefined,
                  data: {
                    is_demo: true,
                    role: 'super_admin'
                  }
                }
              }),
              3, // 3 retries for signup
              1000
            )

            if (signUpResult.error) {
              console.error("Demo sign-up error:", signUpResult.error)
              
              // Provide better error messages based on error type
              let errorMsg = signUpResult.error.message
              if (errorMsg?.includes('Database server error') || errorMsg?.includes('500')) {
                errorMsg = "Database server is temporarily unavailable. Please try again in a few moments."
              } else if (errorMsg?.includes('timeout') || errorMsg?.includes('ECONNREFUSED')) {
                errorMsg = "Connection timeout. Please check your internet connection and try again."
              } else if (errorMsg?.includes('already registered') || errorMsg?.includes('already exists')) {
                // User exists but sign-in failed - try sign-in again
                console.log("User exists, retrying sign-in...")
                const retrySignIn = await retryOperation(
                  () => supabase.auth.signInWithPassword({
                    email: DEMO_EMAIL,
                    password: DEMO_PASSWORD,
                  }),
                  3,
                  1000
                )
                
                if (retrySignIn.error) {
                  errorMsg = "Demo account exists but credentials are invalid. Please contact support."
                } else {
                  userId = retrySignIn.data.user?.id || null
                }
              }
              
              if (!userId) {
                setErrorMessage(errorMsg || "Failed to create demo account. Please try again.")
                setStatus("error")
                return
              }
            } else {
              userId = signUpResult.data.user?.id || null
              isNewUser = true
            }
          } catch (error: any) {
            console.error("Demo sign-up exception:", error)
            setErrorMessage(error?.message || "Failed to create demo account. Please try again.")
            setStatus("error")
            return
          }
        } else {
          userId = signInResult.data.user?.id || null
        }

        if (!userId) {
          setErrorMessage("Failed to get user ID. Please try again.")
          setStatus("error")
          return
        }

        // Setup demo company with retry
        let result = await setupDemoCompany(userId)
        
        // Retry once if it fails (might be timing issue)
        if (result.error && result.error.includes("connect") || result.error.includes("timeout")) {
          console.log("Demo setup failed, retrying once...")
          await new Promise(resolve => setTimeout(resolve, 2000))
          result = await setupDemoCompany(userId)
        }
        
        if (result.error) {
          // Provide more helpful error message
          let errorMsg = result.error
          if (errorMsg.includes("connect") || errorMsg.includes("timeout") || errorMsg.includes("ECONNREFUSED")) {
            errorMsg = "Failed to connect to database. Please check your Supabase configuration and ensure the database is accessible."
          }
          setErrorMessage(errorMsg)
          setStatus("error")
          return
        }

        // Refresh session to ensure auth metadata is updated
        await retryOperation(
          () => supabase.auth.refreshSession(),
          2,
          500
        ).catch(() => {
          console.warn("Session refresh failed, continuing anyway")
        })

        // Verify user metadata is set
        const { data: { user: verifyUser } } = await supabase.auth.getUser()
        if (verifyUser && !verifyUser.user_metadata?.role) {
          // Update auth metadata if missing
          await supabase.auth.updateUser({
            data: {
              role: 'super_admin',
            }
          })
        }

        // Small delay to ensure session is propagated
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Redirect to dashboard
        router.push("/dashboard")
      } catch (error: any) {
        console.error("Demo setup error:", error)
        setErrorMessage(error?.message || "An unexpected error occurred. Please try again.")
        setStatus("error")
      }
    }

    handleDemo()
  }, [router, supabase])

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
            Preparing your demo workspace. This will only take a moment.
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
